import { Body, BodyType, Vec2, Circle, Polygon, Material } from "../nape-js.esm.js";

export default {
  id: "dominos",
  label: "Dominos",
  featured: false,
  tags: ["Stacking", "Chain Reaction"],
  desc: "A chain of thin dominos that topple one after another. Click to drop a ball.",
  walls: false,
  workerCompatible: true,

  setup(space, W, H) {
    space.gravity = new Vec2(0, 600);

    // Floor
    const floor = new Body(BodyType.STATIC, new Vec2(W / 2, H - 10));
    floor.shapes.add(new Polygon(Polygon.box(W, 20)));
    floor.space = space;

    // Dominos
    const count = 18;
    const spacing = 22;
    const startX = 50;
    const domW = 6, domH = 36;

    for (let i = 0; i < count; i++) {
      const d = new Body(BodyType.DYNAMIC, new Vec2(
        startX + i * spacing,
        H - 30 - domH / 2,
      ));
      d.shapes.add(new Polygon(Polygon.box(domW, domH)));
      try { d.userData._colorIdx = i % 6; } catch(_) {}
      d.space = space;
    }

    // Trigger ball
    const trigger = new Body(BodyType.DYNAMIC, new Vec2(startX - 20, H - 80));
    trigger.shapes.add(new Circle(10, undefined, new Material(0.3, 0.3, 0.3, 4)));
    try { trigger.userData._colorIdx = 3; } catch(_) {}
    trigger.space = space;
    trigger.applyImpulse(new Vec2(300, 0));
  },

  click(x, y, space, W, H) {
    const b = new Body(BodyType.DYNAMIC, new Vec2(x, y));
    b.shapes.add(new Circle(12, undefined, new Material(0.3, 0.3, 0.3, 4)));
    try { b.userData._colorIdx = 3; } catch(_) {}
    b.space = space;
  },

  code2d: `// Dominos — chain reaction
const space = new Space(new Vec2(0, 600));
const W = canvas.width, H = canvas.height;

// Floor
const floor = new Body(BodyType.STATIC, new Vec2(W / 2, H - 10));
floor.shapes.add(new Polygon(Polygon.box(W, 20)));
floor.space = space;

// Line of thin dominos
const count = 18, spacing = 22, startX = 50;
for (let i = 0; i < count; i++) {
  const d = new Body(BodyType.DYNAMIC, new Vec2(startX + i * spacing, H - 30 - 18));
  d.shapes.add(new Polygon(Polygon.box(6, 36)));
  d.space = space;
}

// Trigger ball
const trigger = new Body(BodyType.DYNAMIC, new Vec2(startX - 20, H - 80));
trigger.shapes.add(new Circle(10, undefined, new Material(0.3, 0.3, 0.3, 4)));
trigger.space = space;
trigger.applyImpulse(new Vec2(300, 0));

// Click to drop a ball
canvasWrap.addEventListener("click", (e) => {
  const r = canvas.getBoundingClientRect();
  const x = e.clientX - r.left, y = e.clientY - r.top;
  const b = new Body(BodyType.DYNAMIC, new Vec2(x, y));
  b.shapes.add(new Circle(12, undefined, new Material(0.3, 0.3, 0.3, 4)));
  b.space = space;
});

function loop() {
  space.step(1 / 60, 8, 3);
  ctx.clearRect(0, 0, W, H);
  drawGrid();
  for (const body of space.bodies) drawBody(body);
  requestAnimationFrame(loop);
}
loop();`,

  codePixi: `// Dominos — chain reaction
const space = new Space(new Vec2(0, 600));

// Floor
const floor = new Body(BodyType.STATIC, new Vec2(W / 2, H - 10));
floor.shapes.add(new Polygon(Polygon.box(W, 20)));
floor.space = space;

// Line of thin dominos
const count = 18, spacing = 22, startX = 50;
for (let i = 0; i < count; i++) {
  const d = new Body(BodyType.DYNAMIC, new Vec2(startX + i * spacing, H - 30 - 18));
  d.shapes.add(new Polygon(Polygon.box(6, 36)));
  d.space = space;
}

// Trigger ball
const trigger = new Body(BodyType.DYNAMIC, new Vec2(startX - 20, H - 80));
trigger.shapes.add(new Circle(10, undefined, new Material(0.3, 0.3, 0.3, 4)));
trigger.space = space;
trigger.applyImpulse(new Vec2(300, 0));

// Click to drop a ball
app.canvas.addEventListener("click", (e) => {
  const r = app.canvas.getBoundingClientRect();
  const sx = W / r.width, sy = H / r.height;
  const x = (e.clientX - r.left) * sx, y = (e.clientY - r.top) * sy;
  const b = new Body(BodyType.DYNAMIC, new Vec2(x, y));
  b.shapes.add(new Circle(12, undefined, new Material(0.3, 0.3, 0.3, 4)));
  b.space = space;
});

function loop() {
  space.step(1 / 60, 8, 3);
  drawGrid();
  syncBodies(space);
  app.render();
  requestAnimationFrame(loop);
}
loop();`,
};
