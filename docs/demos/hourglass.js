import { Body, BodyType, Vec2, Circle, Polygon, Broadphase } from "../nape-js.esm.js";

export default {
  id: "hourglass",
  label: "Hourglass (Spatial Hash)",
  tags: ["Broadphase", "Spatial Hash", "Particles", "Performance"],
  featured: true,
  featuredOrder: 20,
  desc:
    "1000 small circles pour through an hourglass using the <b>SPATIAL_HASH</b> broadphase — optimal for dense scenes with same-sized objects. Click to add more particles.",

  setup(space, W, H) {
    // Use Spatial Hash broadphase — ideal for many same-sized particles
    space.gravity = new Vec2(0, 600);

    const t = 10; // wall thickness
    const cx = W / 2;
    const cy = H / 2;
    const gapHalf = 12; // half-width of the narrow neck opening

    // Outer walls (container)
    const floor = new Body(BodyType.STATIC, new Vec2(cx, H - t / 2));
    floor.shapes.add(new Polygon(Polygon.box(W, t)));
    floor.space = space;

    const ceil = new Body(BodyType.STATIC, new Vec2(cx, t / 2));
    ceil.shapes.add(new Polygon(Polygon.box(W, t)));
    ceil.space = space;

    const left = new Body(BodyType.STATIC, new Vec2(t / 2, cy));
    left.shapes.add(new Polygon(Polygon.box(t, H)));
    left.space = space;

    const right = new Body(BodyType.STATIC, new Vec2(W - t / 2, cy));
    right.shapes.add(new Polygon(Polygon.box(t, H)));
    right.space = space;

    // Hourglass walls — 4 angled segments forming a proper neck
    // Each wall runs from near an outer edge to the narrow center gap.
    const margin = 30; // inset from outer walls
    const wallDefs = [
      // Upper-left:  top-left corner → left side of neck
      { x1: margin, y1: margin, x2: cx - gapHalf, y2: cy },
      // Upper-right: top-right corner → right side of neck
      { x1: W - margin, y1: margin, x2: cx + gapHalf, y2: cy },
      // Lower-left:  left side of neck → bottom-left corner
      { x1: cx - gapHalf, y1: cy, x2: margin, y2: H - margin },
      // Lower-right: right side of neck → bottom-right corner
      { x1: cx + gapHalf, y1: cy, x2: W - margin, y2: H - margin },
    ];

    for (const { x1, y1, x2, y2 } of wallDefs) {
      const dx = x2 - x1;
      const dy = y2 - y1;
      const len = Math.sqrt(dx * dx + dy * dy);
      const wall = new Body(BodyType.STATIC, new Vec2((x1 + x2) / 2, (y1 + y2) / 2));
      wall.shapes.add(new Polygon(Polygon.box(len, t)));
      wall.rotation = Math.atan2(dy, dx);
      wall.space = space;
    }

    // Spawn particles in the upper half
    const r = 3;
    for (let i = 0; i < 1000; i++) {
      const px = cx + (Math.random() - 0.5) * (W * 0.5);
      const py = margin + t + Math.random() * (cy - margin - t - 30);
      const b = new Body(BodyType.DYNAMIC, new Vec2(px, py));
      b.shapes.add(new Circle(r));
      b.space = space;
    }
  },

  click(x, y, space) {
    const r = 3;
    for (let i = 0; i < 25; i++) {
      const b = new Body(BodyType.DYNAMIC, new Vec2(
        x + (Math.random() - 0.5) * 30,
        y + (Math.random() - 0.5) * 30,
      ));
      b.shapes.add(new Circle(r));
      b.space = space;
    }
  },

  code2d: `// Hourglass with SPATIAL_HASH broadphase
const space = new Space(new Vec2(0, 600), Broadphase.SPATIAL_HASH);
addWalls();

const cx = W / 2, cy = H / 2, gap = 12, m = 30;
// 4 angled walls forming hourglass neck
const wallDefs = [
  [m, m, cx - gap, cy], [W - m, m, cx + gap, cy],
  [cx - gap, cy, m, H - m], [cx + gap, cy, W - m, H - m],
];
for (const [x1, y1, x2, y2] of wallDefs) {
  const dx = x2 - x1, dy = y2 - y1;
  const wall = new Body(BodyType.STATIC,
    new Vec2((x1 + x2) / 2, (y1 + y2) / 2));
  wall.shapes.add(new Polygon(
    Polygon.box(Math.sqrt(dx*dx + dy*dy), 10)));
  wall.rotation = Math.atan2(dy, dx);
  wall.space = space;
}

// 1000 small particles in upper half
for (let i = 0; i < 1000; i++) {
  const body = new Body(BodyType.DYNAMIC, new Vec2(
    cx + (Math.random() - 0.5) * W * 0.5,
    40 + Math.random() * (cy - 70),
  ));
  body.shapes.add(new Circle(3));
  body.space = space;
}

function loop() {
  space.step(1 / 60, 8, 3);
  ctx.clearRect(0, 0, W, H);
  drawGrid();
  for (const body of space.bodies) drawBody(body);
  requestAnimationFrame(loop);
}
loop();`,
};
