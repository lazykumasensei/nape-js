/**
 * 01 — basic sync
 *
 * The simplest possible wiring. No interpolation, one sprite per body,
 * sync runs after every `space.step()`. Good enough when render rate
 * equals physics rate (typical desktop 60 Hz).
 */

import { Application, Container, Graphics } from "pixi.js";
import { Space, Body, BodyType, Circle, Vec2 } from "@newkrok/nape-js";
import { BodySpriteBinding } from "@newkrok/nape-pixi";

async function main() {
  // --- Pixi --------------------------------------------------------------
  const app = new Application();
  await app.init({ width: 800, height: 600, backgroundColor: 0x0d1117 });
  document.body.appendChild(app.canvas);

  // --- Physics -----------------------------------------------------------
  const space = new Space(new Vec2(0, 400));
  const ball = new Body(BodyType.DYNAMIC, new Vec2(400, 50));
  ball.shapes.add(new Circle(20));
  ball.space = space;

  // Static floor
  const floor = new Body(BodyType.STATIC, new Vec2(400, 580));
  floor.shapes.add(new Circle(400)); // cheap "ground" — a big circle
  floor.space = space;

  // --- Sprite ------------------------------------------------------------
  const root = new Container();
  app.stage.addChild(root);
  const ballGfx = new Graphics().circle(0, 0, 20).fill(0x58a6ff);
  root.addChild(ballGfx);

  // --- Binding -----------------------------------------------------------
  const binding = new BodySpriteBinding();
  binding.bind(ball, ballGfx);

  // --- Loop --------------------------------------------------------------
  app.ticker.add(() => {
    space.step(1 / 60);
    binding.update();
  });
}

main();
