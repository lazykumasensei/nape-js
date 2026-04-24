/**
 * 03b — physics worker
 *
 * Runs in a module Web Worker. Receives an "init" message from the main
 * thread (see 03-worker-main.ts), sets up the Space, then steps forever
 * on a setInterval loop. Every step it writes transforms into the shared
 * (or its own fallback) Float32Array and posts a "frame" notification.
 *
 * Slot order is controlled explicitly: we track dynamic bodies in a
 * local array and write them in insertion order. Static walls live in
 * the same Space (so they participate in collision) but don't consume
 * sprite slots.
 */

/// <reference lib="webworker" />

import { Space, Body, BodyType, Circle, Polygon, Material, Vec2 } from "@newkrok/nape-js";
import { TRANSFORM_FLOATS_PER_BODY, TRANSFORM_HEADER, TRANSFORM_HEADER_FLOATS } from "@newkrok/nape-pixi";

interface InitMessage {
  type: "init";
  buffer: SharedArrayBuffer | null;
  count: number;
  width: number;
  height: number;
}

let space: Space | null = null;
let transforms: Float32Array | null = null;
let balls: Body[] = [];
let intervalId: ReturnType<typeof setInterval> | null = null;

self.addEventListener("message", (event) => {
  const msg = event.data as InitMessage;
  if (msg.type !== "init") return;

  // Match the main thread's choice: shared buffer when possible.
  if (msg.buffer) {
    transforms = new Float32Array(msg.buffer);
  } else {
    const totalFloats = TRANSFORM_HEADER_FLOATS + msg.count * TRANSFORM_FLOATS_PER_BODY;
    transforms = new Float32Array(totalFloats);
  }

  space = new Space(new Vec2(0, 400));

  // Static floor + side walls.
  const addWall = (x: number, y: number, w: number, h: number) => {
    const b = new Body(BodyType.STATIC, new Vec2(x, y));
    b.shapes.add(new Polygon(Polygon.box(w, h)));
    b.space = space!;
  };
  addWall(msg.width / 2, msg.height - 10, msg.width, 20);
  addWall(10, msg.height / 2, 20, msg.height);
  addWall(msg.width - 10, msg.height / 2, 20, msg.height);

  // Angled ramps to break up the fall — balls cascade instead of stacking
  // in a neat column.
  const addRamp = (x: number, y: number, w: number, h: number, rot: number) => {
    const b = new Body(BodyType.STATIC, new Vec2(x, y));
    b.shapes.add(new Polygon(Polygon.box(w, h)));
    b.rotation = rot;
    b.space = space!;
  };
  addRamp(220, 260, 280, 14, 0.28);
  addRamp(560, 380, 280, 14, -0.28);
  addRamp(320, 500, 320, 14, 0.22);

  // Dynamic bodies in a loose grid well above the first ramp. Shape kind
  // cycles (circle / box / capsule) by `i % 3` — the main thread mirrors
  // this to build matching sprites.
  const slippery = new Material(0.3, 0.15, 0.25, 1);
  balls = [];
  const cols = 20;
  const spacing = 20;
  const startX = (msg.width - cols * spacing) / 2 + spacing / 2;
  for (let i = 0; i < msg.count; i++) {
    const body = new Body(
      BodyType.DYNAMIC,
      new Vec2(startX + (i % cols) * spacing, 40 + Math.floor(i / cols) * spacing),
    );
    const kind = i % 3;
    if (kind === 0) {
      body.shapes.add(new Circle(8, undefined, slippery));
    } else if (kind === 1) {
      body.shapes.add(new Polygon(Polygon.box(14, 14)));
    } else {
      const half = 9;
      const r = 6;
      body.shapes.add(new Circle(r, new Vec2(-half, 0), slippery));
      body.shapes.add(new Circle(r, new Vec2(half, 0), slippery));
      body.shapes.add(new Polygon(Polygon.box(half * 2, r * 2)));
    }
    body.space = space;
    balls.push(body);
  }

  self.postMessage({ type: "ready" });

  // 60 Hz step loop.
  intervalId = setInterval(stepOnce, 1000 / 60);
});

function stepOnce() {
  if (!space || !transforms) return;
  const t0 = performance.now();
  space.step(1 / 60);
  const stepMs = performance.now() - t0;

  // Write dynamic balls in insertion order — sprite slot i = balls[i].
  for (let i = 0; i < balls.length; i++) {
    const off = TRANSFORM_HEADER_FLOATS + i * TRANSFORM_FLOATS_PER_BODY;
    transforms[off] = balls[i].position.x;
    transforms[off + 1] = balls[i].position.y;
    transforms[off + 2] = balls[i].rotation;
  }
  transforms[TRANSFORM_HEADER.BODY_COUNT] = balls.length;
  transforms[TRANSFORM_HEADER.TIME_STAMP] = (space as { timeStamp?: number }).timeStamp ?? 0;
  transforms[TRANSFORM_HEADER.STEP_MS] = stepMs;

  const isShared =
    typeof SharedArrayBuffer !== "undefined" && transforms.buffer instanceof SharedArrayBuffer;
  if (isShared) {
    self.postMessage({ type: "frame" });
  } else {
    const copy = new Float32Array(transforms);
    self.postMessage({ type: "frame", transforms: copy }, [copy.buffer]);
  }
}

self.addEventListener("beforeunload", () => {
  if (intervalId !== null) clearInterval(intervalId);
});
