/**
 * 03b — physics worker
 *
 * Runs in a module Web Worker. Receives an "init" message from the main
 * thread (see 03-worker-main.ts), sets up the Space, then steps forever
 * on a setInterval loop. Every step it writes transforms into the shared
 * (or its own fallback) Float32Array and posts a "frame" notification.
 */

/// <reference lib="webworker" />

import { Space, Body, BodyType, Circle, Vec2 } from "@newkrok/nape-js";
import {
  TRANSFORM_FLOATS_PER_BODY,
  TRANSFORM_HEADER_FLOATS,
  writeTransforms,
} from "@newkrok/nape-pixi";

interface InitMessage {
  type: "init";
  buffer: SharedArrayBuffer | null;
  count: number;
  width: number;
  height: number;
}

let space: Space | null = null;
let transforms: Float32Array | null = null;
let maxBodies = 0;
let intervalId: ReturnType<typeof setInterval> | null = null;

self.addEventListener("message", (event) => {
  const msg = event.data as InitMessage;
  if (msg.type !== "init") return;

  maxBodies = msg.count;

  // Match the main thread's choice: shared buffer when possible.
  if (msg.buffer) {
    transforms = new Float32Array(msg.buffer);
  } else {
    const totalFloats = TRANSFORM_HEADER_FLOATS + maxBodies * TRANSFORM_FLOATS_PER_BODY;
    transforms = new Float32Array(totalFloats);
  }

  space = new Space(new Vec2(0, 400));
  for (let i = 0; i < maxBodies; i++) {
    const body = new Body(
      BodyType.DYNAMIC,
      new Vec2(50 + (i % 40) * 18, 50 + Math.floor(i / 40) * 18),
    );
    body.shapes.add(new Circle(8));
    body.space = space;
  }
  // Floor
  const floor = new Body(BodyType.STATIC, new Vec2(msg.width / 2, msg.height - 10));
  floor.shapes.add(new Circle(msg.width));
  floor.space = space;

  self.postMessage({ type: "ready" });

  // 60 Hz step loop.
  intervalId = setInterval(stepOnce, 1000 / 60);
});

function stepOnce() {
  if (!space || !transforms) return;
  const t0 = performance.now();
  space.step(1 / 60);
  const stepMs = performance.now() - t0;
  writeTransforms(space, transforms, maxBodies, stepMs);

  // Same memory path as the main thread. When shared, the array is a view
  // onto the SharedArrayBuffer and no copy is posted; otherwise send a
  // copy so the main thread can swap its reference.
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
