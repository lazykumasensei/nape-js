import { Body, BodyType, Vec2, Polygon } from "../nape-js.esm.js";
import { spawnRandomShape } from "../demo-runner.js";

export default {
  id: "conveyor-belts",
  label: "Conveyor Belts",
  featured: false,
  tags: ["Kinematic", "surfaceVel"],
  desc: "Objects travel along conveyor belts using kinematic surface velocity.",
  walls: true,

  setup(space, W, H) {
    space.gravity = new Vec2(0, 500);

    // Conveyor 1: top, goes right
    const c1 = new Body(BodyType.KINEMATIC, new Vec2(W / 2 - 60, 80));
    c1.shapes.add(new Polygon(Polygon.box(200, 10)));
    c1.surfaceVel = new Vec2(80, 0);
    c1.space = space;

    // Conveyor 2: middle, goes left
    const c2 = new Body(BodyType.KINEMATIC, new Vec2(W / 2 + 60, 160));
    c2.shapes.add(new Polygon(Polygon.box(200, 10)));
    c2.surfaceVel = new Vec2(-80, 0);
    c2.space = space;

    // Conveyor 3: bottom, goes right
    const c3 = new Body(BodyType.KINEMATIC, new Vec2(W / 2 - 60, 240));
    c3.shapes.add(new Polygon(Polygon.box(200, 10)));
    c3.surfaceVel = new Vec2(80, 0);
    c3.space = space;

    // Spawn shapes at top
    for (let i = 0; i < 15; i++) {
      spawnRandomShape(space, 60 + Math.random() * 100, 30 + Math.random() * 30);
    }
  },

  click(x, y, space, W, H) {
    for (let i = 0; i < 5; i++) {
      spawnRandomShape(space, x + (Math.random() - 0.5) * 30, y + (Math.random() - 0.5) * 30);
    }
  },

  code2d: `// Conveyor Belts — kinematic surface velocity
const space = new Space(new Vec2(0, 500));
const W = canvas.width, H = canvas.height;

addWalls();

// Three conveyor belts alternating direction
const c1 = new Body(BodyType.KINEMATIC, new Vec2(W / 2 - 60, 80));
c1.shapes.add(new Polygon(Polygon.box(200, 10)));
c1.surfaceVel = new Vec2(80, 0);
c1.space = space;

const c2 = new Body(BodyType.KINEMATIC, new Vec2(W / 2 + 60, 160));
c2.shapes.add(new Polygon(Polygon.box(200, 10)));
c2.surfaceVel = new Vec2(-80, 0);
c2.space = space;

const c3 = new Body(BodyType.KINEMATIC, new Vec2(W / 2 - 60, 240));
c3.shapes.add(new Polygon(Polygon.box(200, 10)));
c3.surfaceVel = new Vec2(80, 0);
c3.space = space;

// Spawn shapes
for (let i = 0; i < 15; i++) {
  const b = new Body(BodyType.DYNAMIC, new Vec2(
    60 + Math.random() * 100, 30 + Math.random() * 30,
  ));
  if (Math.random() < 0.5) {
    b.shapes.add(new Circle(6 + Math.random() * 10));
  } else {
    const sz = 8 + Math.random() * 14;
    b.shapes.add(new Polygon(Polygon.box(sz, sz)));
  }
  b.space = space;
}

function loop() {
  space.step(1 / 60, 8, 3);
  ctx.clearRect(0, 0, W, H);
  drawGrid();
  for (const body of space.bodies) drawBody(body);
  requestAnimationFrame(loop);
}
loop();`,

  codePixi: `// Conveyor Belts — kinematic surface velocity
const space = new Space(new Vec2(0, 500));

addWalls();

// Three conveyor belts alternating direction
const c1 = new Body(BodyType.KINEMATIC, new Vec2(W / 2 - 60, 80));
c1.shapes.add(new Polygon(Polygon.box(200, 10)));
c1.surfaceVel = new Vec2(80, 0);
c1.space = space;

const c2 = new Body(BodyType.KINEMATIC, new Vec2(W / 2 + 60, 160));
c2.shapes.add(new Polygon(Polygon.box(200, 10)));
c2.surfaceVel = new Vec2(-80, 0);
c2.space = space;

const c3 = new Body(BodyType.KINEMATIC, new Vec2(W / 2 - 60, 240));
c3.shapes.add(new Polygon(Polygon.box(200, 10)));
c3.surfaceVel = new Vec2(80, 0);
c3.space = space;

// Spawn shapes
for (let i = 0; i < 15; i++) {
  const b = new Body(BodyType.DYNAMIC, new Vec2(
    60 + Math.random() * 100, 30 + Math.random() * 30,
  ));
  if (Math.random() < 0.5) {
    b.shapes.add(new Circle(6 + Math.random() * 10));
  } else {
    const sz = 8 + Math.random() * 14;
    b.shapes.add(new Polygon(Polygon.box(sz, sz)));
  }
  b.space = space;
}

function loop() {
  space.step(1 / 60, 8, 3);
  drawGrid();
  syncBodies(space);
  app.render();
  requestAnimationFrame(loop);
}
loop();`,
};
