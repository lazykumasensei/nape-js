/**
 * 03a — WorkerBridge: main-thread side
 *
 * Pairs with 03-worker.ts (the user-written worker). Physics runs in a
 * Web Worker; this main thread only owns Pixi rendering.
 *
 * Protocol chosen by *this* example (the library does not prescribe one):
 *
 *   main → worker: { type: "init", buffer: SharedArrayBuffer | null, count }
 *   worker → main: { type: "ready" }
 *   worker → main: { type: "frame", transforms? } once per physics step
 *
 * If SharedArrayBuffer is available (COOP/COEP cross-origin-isolated
 * context), `transforms` is omitted from frame messages — memory is
 * shared. Otherwise the worker posts a fresh Float32Array every frame.
 */

import { Application, Container, Graphics } from "pixi.js";
import { WorkerBridge, createTransformsBuffer } from "@newkrok/nape-pixi";

async function main() {
  const app = new Application();
  await app.init({ width: 800, height: 600, backgroundColor: 0x0d1117 });
  document.body.appendChild(app.canvas);

  const BALL_COUNT = 200;

  // Allocate shared buffer up-front so we can hand it to the worker.
  const alloc = createTransformsBuffer(BALL_COUNT);

  const worker = new Worker(new URL("./03-worker.ts", import.meta.url), {
    type: "module",
  });

  const bridge = new WorkerBridge({ worker, transforms: alloc.transforms });

  // Our handshake: tell the worker how to set up and hand it the buffer.
  worker.postMessage({
    type: "init",
    buffer: alloc.isShared ? alloc.buffer : null,
    count: BALL_COUNT,
    width: 800,
    height: 600,
  });

  await bridge.ready;

  const root = new Container();
  app.stage.addChild(root);

  // Walls are mirrored here as static visuals — the worker owns the
  // physics bodies; we just draw the same rectangles at the same spots.
  const drawWall = (x: number, y: number, w: number, h: number, rot = 0) => {
    const g = new Graphics().rect(-w / 2, -h / 2, w, h).fill(0x30363d);
    g.x = x;
    g.y = y;
    g.rotation = rot;
    root.addChild(g);
  };
  drawWall(400, 590, 800, 20);
  drawWall(10, 300, 20, 600);
  drawWall(790, 300, 20, 600);
  drawWall(220, 260, 280, 14, 0.28);
  drawWall(560, 380, 280, 14, -0.28);
  drawWall(320, 500, 320, 14, 0.22);

  // Spawn one sprite per body. Slots must match the worker's body order,
  // and the shape cycle (i % 3) must match the worker too.
  const palette = [0x3fb950, 0x58a6ff, 0xbc8cff];
  for (let i = 0; i < BALL_COUNT; i++) {
    const kind = i % 3;
    let gfx: Graphics;
    if (kind === 0) {
      gfx = new Graphics().circle(0, 0, 8).fill(palette[0]);
    } else if (kind === 1) {
      gfx = new Graphics().rect(-7, -7, 14, 14).fill(palette[1]);
    } else {
      const half = 9;
      const r = 6;
      gfx = new Graphics()
        .roundRect(-half - r, -r, (half + r) * 2, r * 2, r)
        .fill(palette[2]);
    }
    root.addChild(gfx);
    bridge.setSprite(i, gfx);
  }

  app.ticker.add(() => {
    bridge.applyTransforms();
  });

  window.addEventListener("beforeunload", () => bridge.dispose());
}

main();
