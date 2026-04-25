import { Body, BodyType, Vec2, Circle, Polygon, Material } from "../nape-js.esm.js";

export default {
  id: "plinko",
  label: "Plinko",
  featured: false,
  tags: ["Bouncy", "Static shapes", "Click", "Particles"],
  desc: "Balls cascade through a staggered peg field and settle into slots at the bottom. <b>Click</b> anywhere to release more balls.",
  walls: true,
  workerCompatible: true,

  setup(space, W, H) {
    space.gravity = new Vec2(0, 600);

    const ballMat = new Material(0.45, 0.2, 0.3, 2);
    const pegMat  = new Material(0.5, 0.3, 0.4, 1);

    // Peg field — staggered rows of small static circles.
    const pegR       = 5;
    const rows       = 9;
    const colSpacing = 60;
    const rowSpacing = 32;
    const pegTop     = 80;
    const sideMargin = 35;

    for (let r = 0; r < rows; r++) {
      const y       = pegTop + r * rowSpacing;
      const stagger = (r % 2) * (colSpacing / 2);
      for (let x = sideMargin + stagger; x <= W - sideMargin; x += colSpacing) {
        const peg = new Body(BodyType.STATIC, new Vec2(x, y));
        peg.shapes.add(new Circle(pegR, undefined, pegMat));
        peg.space = space;
      }
    }

    // Bottom slot dividers — 9 slots separated by 8 thin walls.
    const slotTop  = pegTop + (rows - 1) * rowSpacing + 30;
    const slotH    = H - 30 - slotTop;
    const slots    = 9;
    const slotSpan = W - 40;
    for (let i = 1; i < slots; i++) {
      const x = 20 + (i / slots) * slotSpan;
      const div = new Body(BodyType.STATIC, new Vec2(x, slotTop + slotH / 2));
      div.shapes.add(new Polygon(Polygon.box(4, slotH)));
      div.space = space;
    }

    // Initial cluster of balls scattered at the top.
    for (let i = 0; i < 18; i++) {
      const ball = new Body(BodyType.DYNAMIC, new Vec2(
        W / 2 + (Math.random() - 0.5) * 60,
        25 + Math.random() * 35,
      ));
      ball.shapes.add(new Circle(7, undefined, ballMat));
      try { ball.userData._colorIdx = i % 6; } catch(_) {}
      ball.space = space;
    }
  },

  click(x, y, space) {
    const ballMat = new Material(0.45, 0.2, 0.3, 2);
    for (let i = 0; i < 5; i++) {
      const ball = new Body(BodyType.DYNAMIC, new Vec2(
        x + (Math.random() - 0.5) * 25,
        y + (Math.random() - 0.5) * 15,
      ));
      ball.shapes.add(new Circle(7, undefined, ballMat));
      try { ball.userData._colorIdx = i % 6; } catch(_) {}
      ball.space = space;
    }
  },
};
