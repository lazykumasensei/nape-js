import {
  Body, BodyType, Vec2, Circle, Polygon, FluidProperties,
} from "../nape-js.esm.js";
import { drawBody, drawGrid, drawConstraints } from "../renderer.js";

// ---------------------------------------------------------------------------
// State
// ---------------------------------------------------------------------------

let _waterBody = null;
let _waterY = 0;
let _W = 0;
let _H = 0;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function spawnObject(space, x, y, type) {
  const body = new Body(BodyType.DYNAMIC, new Vec2(x, y));

  // type 0-4: different densities and shapes
  switch (type) {
    case 0: { // Light beach ball — floats high
      body.shapes.add(new Circle(18));
      for (const s of body.shapes) {
        s.material.density = 0.3;
        s.material.elasticity = 0.6;
      }
      try { body.userData._colorIdx = 0; body.userData._label = "ball"; } catch (_) {}
      break;
    }
    case 1: { // Wooden crate — floats partially submerged
      body.shapes.add(new Polygon(Polygon.box(28, 28)));
      for (const s of body.shapes) {
        s.material.density = 0.7;
        s.material.elasticity = 0.2;
      }
      try { body.userData._colorIdx = 1; body.userData._label = "wood"; } catch (_) {}
      break;
    }
    case 2: { // Rubber duck (small circle) — bobs on surface
      body.shapes.add(new Circle(12));
      for (const s of body.shapes) {
        s.material.density = 0.5;
        s.material.elasticity = 0.4;
      }
      try { body.userData._colorIdx = 5; body.userData._label = "duck"; } catch (_) {}
      break;
    }
    case 3: { // Steel block — sinks slowly
      body.shapes.add(new Polygon(Polygon.box(22, 22)));
      for (const s of body.shapes) {
        s.material.density = 3.0;
        s.material.elasticity = 0.1;
      }
      try { body.userData._colorIdx = 3; body.userData._label = "steel"; } catch (_) {}
      break;
    }
    case 4: { // Heavy anchor — sinks fast
      body.shapes.add(new Circle(14));
      for (const s of body.shapes) {
        s.material.density = 7.0;
        s.material.elasticity = 0.05;
      }
      try { body.userData._colorIdx = 4; body.userData._label = "anchor"; } catch (_) {}
      break;
    }
  }

  body.space = space;
  return body;
}

// ---------------------------------------------------------------------------
// Custom 2D renderer — draws water overlay + bodies
// ---------------------------------------------------------------------------

function renderFluid(ctx, space, W, H, showOutlines) {
  drawGrid(ctx, W, H);
  drawConstraints(ctx, space);

  // Draw bodies BELOW water first, then water, then bodies ABOVE water
  const below = [];
  const above = [];
  for (const body of space.bodies) {
    if (body === _waterBody) continue;
    if (body.position.y > _waterY - 20) {
      below.push(body);
    } else {
      above.push(body);
    }
  }

  // Draw submerged bodies
  for (const body of below) drawBody(ctx, body, showOutlines);

  // Draw water surface with gradient
  const surfaceY = _waterY;

  // Water body fill
  ctx.save();
  ctx.globalAlpha = 0.35;
  ctx.fillStyle = "#1e90ff";
  ctx.fillRect(20, surfaceY, W - 40, H - surfaceY - 10);
  ctx.globalAlpha = 1;

  // Gradient overlay near surface
  const grad = ctx.createLinearGradient(0, surfaceY - 10, 0, surfaceY + 60);
  grad.addColorStop(0, "rgba(30,144,255,0.0)");
  grad.addColorStop(0.15, "rgba(30,144,255,0.25)");
  grad.addColorStop(1, "rgba(10,60,120,0.4)");
  ctx.fillStyle = grad;
  ctx.fillRect(20, surfaceY - 10, W - 40, H - surfaceY);

  // Surface line with glow
  ctx.strokeStyle = "rgba(100,180,255,0.8)";
  ctx.lineWidth = 2;
  ctx.shadowColor = "rgba(100,180,255,0.5)";
  ctx.shadowBlur = 8;
  ctx.beginPath();
  ctx.moveTo(20, surfaceY);
  ctx.lineTo(W - 20, surfaceY);
  ctx.stroke();
  ctx.shadowBlur = 0;
  ctx.restore();

  // Draw above-water bodies on top
  for (const body of above) drawBody(ctx, body, showOutlines);

  // Draw walls
  if (_waterBody) {
    for (const body of space.bodies) {
      if (body.isStatic() && body !== _waterBody) drawBody(ctx, body, showOutlines);
    }
  }

  // Legend
  ctx.save();
  ctx.font = "11px monospace";
  ctx.fillStyle = "rgba(200,220,255,0.7)";
  const labels = [
    { color: "#58a6ff", text: "Light (0.3)" },
    { color: "#d29922", text: "Wood (0.7)" },
    { color: "#dbabff", text: "Rubber (0.5)" },
    { color: "#f85149", text: "Steel (3.0)" },
    { color: "#a371f7", text: "Anchor (7.0)" },
  ];
  const lx = 30;
  let ly = 24;
  for (const l of labels) {
    ctx.fillStyle = l.color;
    ctx.fillRect(lx, ly - 8, 10, 10);
    ctx.fillStyle = "rgba(200,220,255,0.7)";
    ctx.fillText(l.text, lx + 14, ly);
    ly += 14;
  }
  ctx.fillStyle = "rgba(200,220,255,0.5)";
  ctx.fillText("Click to drop objects", lx, ly + 6);
  ctx.restore();
}

export default {
  id: "fluid-buoyancy",
  label: "Fluid & Buoyancy",
  featured: true,
  featuredOrder: 6,
  tags: ["Fluid", "Buoyancy", "Density", "Click"],
  desc: 'Objects with different densities interact with a fluid pool — light ones float, heavy ones sink. <b>Click</b> to drop objects.',

  setup(space, W, H) {
    _W = W;
    _H = H;
    space.gravity = new Vec2(0, 600);

    const t = 20;

    // Floor
    const floor = new Body(BodyType.STATIC, new Vec2(W / 2, H - t / 2));
    floor.shapes.add(new Polygon(Polygon.box(W, t)));
    floor.space = space;

    // Left wall
    const left = new Body(BodyType.STATIC, new Vec2(t / 2, H / 2));
    left.shapes.add(new Polygon(Polygon.box(t, H)));
    left.space = space;

    // Right wall
    const right = new Body(BodyType.STATIC, new Vec2(W - t / 2, H / 2));
    right.shapes.add(new Polygon(Polygon.box(t, H)));
    right.space = space;

    // Water pool — fluid-enabled static body covering bottom 55% of scene
    _waterY = H * 0.4;
    const waterH = H - _waterY;
    const waterBody = new Body(BodyType.STATIC, new Vec2(W / 2, _waterY + waterH / 2));
    const waterShape = new Polygon(Polygon.box(W - 2 * t, waterH));
    waterShape.fluidEnabled = true;
    waterShape.fluidProperties = new FluidProperties(1.5, 3.0);
    waterShape.body = waterBody;
    waterBody.space = space;
    _waterBody = waterBody;

    // Spawn initial objects — spread across the scene
    const types = [0, 1, 2, 3, 4, 0, 1, 2, 3, 4, 0, 2, 1, 4, 3];
    for (let i = 0; i < types.length; i++) {
      const x = 80 + (i % 5) * 160 + (Math.random() - 0.5) * 60;
      const y = 50 + Math.floor(i / 5) * 50 + (Math.random() - 0.5) * 20;
      spawnObject(space, x, y, types[i]);
    }
  },

  render(ctx, space, W, H, showOutlines) {
    renderFluid(ctx, space, W, H, showOutlines);
  },

  click(x, y, space) {
    // Drop a random object at click position (above water if below surface)
    const spawnY = Math.min(y, _waterY - 30);
    const type = Math.floor(Math.random() * 5);
    spawnObject(space, x, spawnY, type);
  },

  code2d: `// Fluid & Buoyancy — different densities in a fluid pool
const space = new Space(new Vec2(0, 600));
const W = 900, H = 500;

// Walls
const t = 20;
const floor = new Body(BodyType.STATIC, new Vec2(W / 2, H - t / 2));
floor.shapes.add(new Polygon(Polygon.box(W, t)));
floor.space = space;
const left = new Body(BodyType.STATIC, new Vec2(t / 2, H / 2));
left.shapes.add(new Polygon(Polygon.box(t, H)));
left.space = space;
const right = new Body(BodyType.STATIC, new Vec2(W - t / 2, H / 2));
right.shapes.add(new Polygon(Polygon.box(t, H)));
right.space = space;

// Water pool (bottom 55% of scene)
const waterY = H * 0.4;
const waterH = H - waterY;
const water = new Body(BodyType.STATIC, new Vec2(W / 2, waterY + waterH / 2));
const waterShape = new Polygon(Polygon.box(W - 40, waterH));
waterShape.fluidEnabled = true;
waterShape.fluidProperties = new FluidProperties(1.5, 3.0);
water.shapes.add(waterShape);
water.space = space;

// Spawn objects with different densities
function spawnObject(x, y, density, radius) {
  const body = new Body(BodyType.DYNAMIC, new Vec2(x, y));
  body.shapes.add(new Circle(radius));
  body.shapes.at(0).material.density = density;
  body.space = space;
}

// Light (floats)
spawnObject(200, 60, 0.3, 18);
spawnObject(350, 80, 0.3, 18);

// Medium (partially submerged)
spawnObject(500, 50, 0.7, 16);
spawnObject(650, 70, 0.7, 16);

// Heavy (sinks)
spawnObject(300, 40, 3.0, 14);
spawnObject(600, 60, 7.0, 14);

function loop() {
  space.step(1 / 60, 8, 3);

  // Clear & draw grid
  ctx.clearRect(0, 0, W, H);
  drawGrid();

  // Draw bodies
  for (const body of space.bodies) drawBody(body);

  // Water overlay
  ctx.save();
  ctx.globalAlpha = 0.3;
  ctx.fillStyle = "#1e90ff";
  ctx.fillRect(20, waterY, W - 40, waterH);
  ctx.globalAlpha = 1;
  ctx.strokeStyle = "rgba(100,180,255,0.8)";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(20, waterY);
  ctx.lineTo(W - 20, waterY);
  ctx.stroke();
  ctx.restore();

  requestAnimationFrame(loop);
}
loop();`,
};
