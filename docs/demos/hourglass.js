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
    const gapHalf = 18; // half-width of the neck — wide enough for smooth flow
    const funnelW = W * 0.38; // how wide the funnel mouth is (each side from center)
    const funnelH = H * 0.28; // vertical height of the funnel section

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

    // Hourglass funnel — short steep walls converging to a neck
    // Upper funnel: mouth sits at cy - funnelH, neck at cy
    // Lower funnel: neck at cy, mouth sits at cy + funnelH
    const wallDefs = [
      // Upper-left:  wide mouth → left side of neck
      { x1: cx - funnelW, y1: cy - funnelH, x2: cx - gapHalf, y2: cy },
      // Upper-right: wide mouth → right side of neck
      { x1: cx + funnelW, y1: cy - funnelH, x2: cx + gapHalf, y2: cy },
      // Lower-left:  left side of neck → wide mouth
      { x1: cx - gapHalf, y1: cy, x2: cx - funnelW, y2: cy + funnelH },
      // Lower-right: right side of neck → wide mouth
      { x1: cx + gapHalf, y1: cy, x2: cx + funnelW, y2: cy + funnelH },
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

    // Spawn particles in the upper half (above the funnel mouth)
    const r = 3;
    for (let i = 0; i < 1000; i++) {
      const px = cx + (Math.random() - 0.5) * (funnelW * 1.6);
      const py = t + 5 + Math.random() * (cy - funnelH - t - 15);
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

const cx = W / 2, cy = H / 2;
const gap = 18, fw = W * 0.38, fh = H * 0.28;
// 4 angled walls forming hourglass funnel + neck
for (const [x1,y1,x2,y2] of [
  [cx-fw, cy-fh, cx-gap, cy], [cx+fw, cy-fh, cx+gap, cy],
  [cx-gap, cy, cx-fw, cy+fh], [cx+gap, cy, cx+fw, cy+fh],
]) {
  const dx = x2-x1, dy = y2-y1;
  const wall = new Body(BodyType.STATIC,
    new Vec2((x1+x2)/2, (y1+y2)/2));
  wall.shapes.add(new Polygon(
    Polygon.box(Math.sqrt(dx*dx+dy*dy), 10)));
  wall.rotation = Math.atan2(dy, dx);
  wall.space = space;
}

// 1000 small particles above the funnel
for (let i = 0; i < 1000; i++) {
  const body = new Body(BodyType.DYNAMIC, new Vec2(
    cx + (Math.random()-0.5) * fw * 1.6,
    15 + Math.random() * (cy - fh - 25),
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
