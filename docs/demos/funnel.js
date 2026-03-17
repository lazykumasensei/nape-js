import { Body, BodyType, Vec2, Polygon } from "../nape-js.esm.js";
import { spawnRandomShape } from "../demo-runner.js";

export default {
  id: "funnel",
  label: "Funnel",
  featured: false,
  tags: ["Polygon", "Static shapes"],
  desc: "Shapes pour through a funnel into a container. Click to add more shapes.",
  walls: false,
  workerCompatible: true,

  setup(space, W, H) {
    space.gravity = new Vec2(0, 600);

    // Floor
    const floor = new Body(BodyType.STATIC, new Vec2(W / 2, H - 10));
    floor.shapes.add(new Polygon(Polygon.box(W, 20)));
    floor.space = space;

    // Funnel walls (angled)
    const lFunnel = new Body(BodyType.STATIC, new Vec2(W / 2 - 80, H / 2 - 20));
    lFunnel.shapes.add(new Polygon(Polygon.box(120, 8)));
    lFunnel.rotation = -0.5;
    lFunnel.space = space;

    const rFunnel = new Body(BodyType.STATIC, new Vec2(W / 2 + 80, H / 2 - 20));
    rFunnel.shapes.add(new Polygon(Polygon.box(120, 8)));
    rFunnel.rotation = 0.5;
    rFunnel.space = space;

    // Narrow channel walls
    const lChannel = new Body(BodyType.STATIC, new Vec2(W / 2 - 20, H / 2 + 40));
    lChannel.shapes.add(new Polygon(Polygon.box(8, 60)));
    lChannel.space = space;

    const rChannel = new Body(BodyType.STATIC, new Vec2(W / 2 + 20, H / 2 + 40));
    rChannel.shapes.add(new Polygon(Polygon.box(8, 60)));
    rChannel.space = space;

    // Shapes above funnel
    for (let i = 0; i < 40; i++) {
      spawnRandomShape(space,
        W / 2 + (Math.random() - 0.5) * 200,
        30 + Math.random() * 80,
      );
    }
  },

  click(x, y, space, W, H) {
    for (let i = 0; i < 8; i++) {
      spawnRandomShape(space,
        x + (Math.random() - 0.5) * 40,
        y + (Math.random() - 0.5) * 40,
      );
    }
  },

  code2d: `// Funnel — shapes pour through a narrow channel
const space = new Space(new Vec2(0, 600));
const W = canvas.width, H = canvas.height;

// Floor
const floor = new Body(BodyType.STATIC, new Vec2(W / 2, H - 10));
floor.shapes.add(new Polygon(Polygon.box(W, 20)));
floor.space = space;

// Funnel walls (angled)
const lFunnel = new Body(BodyType.STATIC, new Vec2(W / 2 - 80, H / 2 - 20));
lFunnel.shapes.add(new Polygon(Polygon.box(120, 8)));
lFunnel.rotation = -0.5;
lFunnel.space = space;

const rFunnel = new Body(BodyType.STATIC, new Vec2(W / 2 + 80, H / 2 - 20));
rFunnel.shapes.add(new Polygon(Polygon.box(120, 8)));
rFunnel.rotation = 0.5;
rFunnel.space = space;

// Narrow channel
const lChannel = new Body(BodyType.STATIC, new Vec2(W / 2 - 20, H / 2 + 40));
lChannel.shapes.add(new Polygon(Polygon.box(8, 60)));
lChannel.space = space;

const rChannel = new Body(BodyType.STATIC, new Vec2(W / 2 + 20, H / 2 + 40));
rChannel.shapes.add(new Polygon(Polygon.box(8, 60)));
rChannel.space = space;

// Shapes above funnel
for (let i = 0; i < 40; i++) {
  const b = new Body(BodyType.DYNAMIC, new Vec2(
    W / 2 + (Math.random() - 0.5) * 200,
    30 + Math.random() * 80,
  ));
  if (Math.random() < 0.5) {
    b.shapes.add(new Circle(4 + Math.random() * 8));
  } else {
    const sz = 6 + Math.random() * 10;
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
};
