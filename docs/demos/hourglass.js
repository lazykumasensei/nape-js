import { Body, BodyType, Vec2, Circle, Polygon, Broadphase } from "../nape-js.esm.js";

export default {
  id: "hourglass",
  label: "Hourglass (Spatial Hash)",
  tags: ["Broadphase", "Spatial Hash", "Particles", "Performance"],
  featured: true,
  featuredOrder: 20,
  desc:
    "200 small circles pour through an hourglass using the <b>SPATIAL_HASH</b> broadphase — optimal for dense scenes with same-sized objects. Click to add more particles.",

  setup(space, W, H) {
    // Use Spatial Hash broadphase — ideal for many same-sized particles
    space.gravity = new Vec2(0, 600);

    const t = 10; // wall thickness

    // Outer walls (container)
    const floor = new Body(BodyType.STATIC, new Vec2(W / 2, H - t / 2));
    floor.shapes.add(new Polygon(Polygon.box(W, t)));
    floor.space = space;

    const ceil = new Body(BodyType.STATIC, new Vec2(W / 2, t / 2));
    ceil.shapes.add(new Polygon(Polygon.box(W, t)));
    ceil.space = space;

    const left = new Body(BodyType.STATIC, new Vec2(t / 2, H / 2));
    left.shapes.add(new Polygon(Polygon.box(t, H)));
    left.space = space;

    const right = new Body(BodyType.STATIC, new Vec2(W - t / 2, H / 2));
    right.shapes.add(new Polygon(Polygon.box(t, H)));
    right.space = space;

    // Hourglass funnel — two angled walls converging to a narrow gap
    const cx = W / 2;
    const cy = H / 2;
    const gapHalf = 14; // half-gap width
    const funnelLen = 180;
    const angle = 0.45;

    // Upper-left funnel wall
    const ul = new Body(BodyType.STATIC, new Vec2(cx - gapHalf - 50, cy - 30));
    ul.shapes.add(new Polygon(Polygon.box(funnelLen, t)));
    ul.rotation = angle;
    ul.space = space;

    // Upper-right funnel wall
    const ur = new Body(BodyType.STATIC, new Vec2(cx + gapHalf + 50, cy - 30));
    ur.shapes.add(new Polygon(Polygon.box(funnelLen, t)));
    ur.rotation = -angle;
    ur.space = space;

    // Lower-left funnel wall (mirrors upper)
    const ll = new Body(BodyType.STATIC, new Vec2(cx - gapHalf - 50, cy + 30));
    ll.shapes.add(new Polygon(Polygon.box(funnelLen, t)));
    ll.rotation = -angle;
    ll.space = space;

    // Lower-right funnel wall
    const lr = new Body(BodyType.STATIC, new Vec2(cx + gapHalf + 50, cy + 30));
    lr.shapes.add(new Polygon(Polygon.box(funnelLen, t)));
    lr.rotation = angle;
    lr.space = space;

    // Spawn particles in the upper half
    const r = 4;
    for (let i = 0; i < 200; i++) {
      const px = cx + (Math.random() - 0.5) * (W - 80);
      const py = 20 + Math.random() * (cy - 80);
      const b = new Body(BodyType.DYNAMIC, new Vec2(px, py));
      b.shapes.add(new Circle(r));
      b.space = space;
    }
  },

  click(x, y, space) {
    const r = 4;
    for (let i = 0; i < 15; i++) {
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

// Walls
addWalls();

// Funnel walls (angled, forming hourglass shape)
const cx = W / 2, cy = H / 2;
for (const [dx, dy, angle] of [
  [-64, -30, 0.45], [64, -30, -0.45],
  [-64, 30, -0.45], [64, 30, 0.45],
]) {
  const wall = new Body(BodyType.STATIC, new Vec2(cx + dx, cy + dy));
  wall.shapes.add(new Polygon(Polygon.box(180, 10)));
  wall.rotation = angle;
  wall.space = space;
}

// 200 small particles — ideal for spatial hash
for (let i = 0; i < 200; i++) {
  const body = new Body(BodyType.DYNAMIC, new Vec2(
    cx + (Math.random() - 0.5) * (W - 80),
    20 + Math.random() * (cy - 80),
  ));
  body.shapes.add(new Circle(4));
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
