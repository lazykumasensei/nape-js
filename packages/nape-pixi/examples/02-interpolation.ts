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
import { Space, Body, BodyType, Circle, Polygon, Material, Vec2 } from "@newkrok/nape-js";
import { BodySpriteBinding, FixedStepper } from "@newkrok/nape-pixi";

async function main() {
  const app = new Application();
  await app.init({ width: 800, height: 600, backgroundColor: 0x0d1117 });
  document.body.appendChild(app.canvas);

  const space = new Space(new Vec2(0, 400));

  // Static floor + side walls so the balls stay on-screen.
  const walls: Array<{ body: Body; w: number; h: number }> = [];
  const addWall = (x: number, y: number, w: number, h: number) => {
    const b = new Body(BodyType.STATIC, new Vec2(x, y));
    b.shapes.add(new Polygon(Polygon.box(w, h)));
    b.space = space;
    walls.push({ body: b, w, h });
  };
  addWall(400, 590, 800, 20);
  addWall(10, 300, 20, 600);
  addWall(790, 300, 20, 600);

  // Three angled plates zig-zag the fall so balls scatter across the floor.
  const addRamp = (x: number, y: number, rot: number) => {
    const b = new Body(BodyType.STATIC, new Vec2(x, y));
    b.shapes.add(new Polygon(Polygon.box(220, 14)));
    b.rotation = rot;
    b.space = space;
    walls.push({ body: b, w: 220, h: 14 });
  };
  addRamp(220, 220, 0.3);
  addRamp(560, 340, -0.3);
  addRamp(280, 460, 0.25);

  const slippery = new Material(0.3, 0.15, 0.25, 1);

  const root = new Container();
  app.stage.addChild(root);

  for (const { body, w, h } of walls) {
    const gfx = new Graphics().rect(-w / 2, -h / 2, w, h).fill(0x30363d);
    gfx.x = body.position.x;
    gfx.y = body.position.y;
    gfx.rotation = body.rotation;
    root.addChild(gfx);
  }

  const stepper = new FixedStepper({ hz: 60 });
  const binding = new BodySpriteBinding({ stepper });

  const palette = [0xd29922, 0x58a6ff, 0xbc8cff];
  for (let i = 0; i < 45; i++) {
    const x = 80 + (i % 10) * 64 + ((i * 17) % 23);
    const y = 30 + Math.floor(i / 10) * 30;
    const kind = i % 3;
    const body = new Body(BodyType.DYNAMIC, new Vec2(x, y));
    let gfx: Graphics;
    if (kind === 0) {
      body.shapes.add(new Circle(13, undefined, slippery));
      gfx = new Graphics().circle(0, 0, 13).fill(palette[0]);
    } else if (kind === 1) {
      body.shapes.add(new Polygon(Polygon.box(22, 22)));
      gfx = new Graphics().rect(-11, -11, 22, 22).fill(palette[1]);
    } else {
      const half = 14;
      const r = 8;
      body.shapes.add(new Circle(r, new Vec2(-half, 0), slippery));
      body.shapes.add(new Circle(r, new Vec2(half, 0), slippery));
      body.shapes.add(new Polygon(Polygon.box(half * 2, r * 2)));
      gfx = new Graphics()
        .roundRect(-half - r, -r, (half + r) * 2, r * 2, r)
        .fill(palette[2]);
    }
    body.space = space;
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
