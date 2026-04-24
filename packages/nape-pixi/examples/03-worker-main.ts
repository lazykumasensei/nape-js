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

  // Spawn one sprite per body. Slots must match the worker's body order.
  const root = new Container();
  app.stage.addChild(root);
  for (let i = 0; i < BALL_COUNT; i++) {
    const gfx = new Graphics().circle(0, 0, 8).fill(0x3fb950);
    root.addChild(gfx);
    bridge.setSprite(i, gfx);
  }

  app.ticker.add(() => {
    bridge.applyTransforms();
  });

  window.addEventListener("beforeunload", () => bridge.dispose());
}

main();
