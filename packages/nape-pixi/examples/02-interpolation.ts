/**
 * 02 — fixed-step physics with render interpolation
 *
 * `FixedStepper` runs the simulation at an exact rate (60 Hz here)
 * regardless of render cadence. The returned `alpha` is how far into the
 * next step we are; `binding.update(alpha)` lerps between the pre-step
 * snapshot and the post-step state so sprites move smoothly even when
 * the browser's rAF ticks at 120 Hz, 144 Hz, or unevenly.
 *
 * This matters: without interpolation, bodies visibly jitter on any
 * display whose refresh rate doesn't divide evenly into 60.
 */

import { Application, Container, Graphics } from "pixi.js";
import { Space, Body, BodyType, Circle, Vec2 } from "@newkrok/nape-js";
import { BodySpriteBinding, FixedStepper } from "@newkrok/nape-pixi";

async function main() {
  const app = new Application();
  await app.init({ width: 800, height: 600, backgroundColor: 0x0d1117 });
  document.body.appendChild(app.canvas);

  const space = new Space(new Vec2(0, 400));
  const balls: Body[] = [];
  for (let i = 0; i < 20; i++) {
    const body = new Body(BodyType.DYNAMIC, new Vec2(100 + i * 30, 50 + (i % 3) * 30));
    body.shapes.add(new Circle(12));
    body.space = space;
    balls.push(body);
  }

  const root = new Container();
  app.stage.addChild(root);

  const stepper = new FixedStepper({ hz: 60 });
  const binding = new BodySpriteBinding({ stepper });

  for (const body of balls) {
    const gfx = new Graphics().circle(0, 0, 12).fill(0xd29922);
    root.addChild(gfx);
    binding.bind(body, gfx);
  }

  let lastMs = performance.now();
  app.ticker.add(() => {
    const now = performance.now();
    const dt = (now - lastMs) / 1000;
    lastMs = now;
    const alpha = stepper.step(space, dt);
    binding.update(alpha);
  });
}

main();
