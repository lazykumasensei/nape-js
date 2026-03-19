/**
 * Deterministic Twin-Simulation demo.
 *
 * Two identical physics spaces run side by side. With `space.deterministic = true`,
 * every body position matches bit-for-bit on every frame. A live status overlay
 * shows the match state and frame count.
 *
 * Click to drop a stack of shapes into both simulations simultaneously.
 */
import {
  Space, Body, BodyType, Vec2, Circle, Polygon, PivotJoint, DistanceJoint,
} from "../nape-js.esm.js";
import { drawBody, drawGrid } from "../renderer.js";

// ---------------------------------------------------------------------------
// State
// ---------------------------------------------------------------------------

let _spaceB = null;
let _frame = 0;
let _matched = 0;   // count of frames that matched perfectly
let _mismatched = 0;
let _W = 0;
let _H = 0;

// Seeded PRNG for reproducible "random" setups across both spaces
function mulberry32(seed) {
  return function () {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ---------------------------------------------------------------------------
// Scene builder — called identically for both spaces
// ---------------------------------------------------------------------------

function buildScene(space, W, H, rng) {
  space.gravity = new Vec2(0, 600);
  space.deterministic = true;

  const halfW = W / 2;

  // Floor
  const floor = new Body(BodyType.STATIC, new Vec2(halfW, H - 20));
  floor.shapes.add(new Polygon(Polygon.box(halfW - 10, 20)));
  floor.space = space;

  // Angled ramp
  const ramp = new Body(BodyType.STATIC, new Vec2(halfW * 0.6, H * 0.45));
  ramp.shapes.add(new Polygon(Polygon.box(halfW * 0.55, 12)));
  ramp.rotation = -0.25;
  ramp.space = space;

  // Small shelf on the right
  const shelf = new Body(BodyType.STATIC, new Vec2(halfW * 0.85, H * 0.65));
  shelf.shapes.add(new Polygon(Polygon.box(halfW * 0.25, 10)));
  shelf.rotation = 0.15;
  shelf.space = space;

  // Dynamic bodies — mixed circles and boxes
  for (let i = 0; i < 20; i++) {
    const x = halfW * 0.2 + rng() * halfW * 0.6;
    const y = 40 + rng() * H * 0.25;
    const body = new Body(BodyType.DYNAMIC, new Vec2(x, y));

    if (rng() < 0.5) {
      body.shapes.add(new Circle(6 + rng() * 10));
    } else {
      const w = 10 + rng() * 16;
      const h = 10 + rng() * 16;
      body.shapes.add(new Polygon(Polygon.box(w, h)));
    }

    body.space = space;
  }

  // Chain — a series of bodies linked by distance joints
  let prev = null;
  const chainStart = halfW * 0.15;
  for (let i = 0; i < 6; i++) {
    const cx = chainStart + i * 22;
    const cy = H * 0.2;
    const link = new Body(BodyType.DYNAMIC, new Vec2(cx, cy));
    link.shapes.add(new Circle(5));
    link.space = space;

    if (prev) {
      const joint = new DistanceJoint(
        prev, link,
        Vec2.weak(0, 0), Vec2.weak(0, 0),
        18, 24,
      );
      joint.space = space;
    } else {
      // Pin first link to world
      const pin = new PivotJoint(
        space.world, link,
        Vec2.weak(cx, cy), Vec2.weak(0, 0),
      );
      pin.space = space;
    }
    prev = link;
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Compare two spaces — return true if all dynamic body positions match. */
function spacesMatch(spA, spB) {
  const aPos = [];
  const bPos = [];

  for (const b of spA.bodies) {
    if (b.isDynamic()) aPos.push(b.position.x, b.position.y, b.rotation);
  }
  for (const b of spB.bodies) {
    if (b.isDynamic()) bPos.push(b.position.x, b.position.y, b.rotation);
  }

  if (aPos.length !== bPos.length) return false;
  for (let i = 0; i < aPos.length; i++) {
    if (aPos[i] !== bPos[i]) return false;
  }
  return true;
}

/** Spawn matching shapes in both spaces on click. */
function spawnInBoth(x, y, spA, spB, halfW) {
  // Clamp x to the left half (single-space coordinates)
  const localX = Math.min(Math.max(x, 30), halfW - 30);
  const localY = Math.max(y, 30);

  for (const sp of [spA, spB]) {
    for (let i = 0; i < 4; i++) {
      const bx = localX + (i % 2) * 16 - 8;
      const by = localY - Math.floor(i / 2) * 16;
      const body = new Body(BodyType.DYNAMIC, new Vec2(bx, by));
      if (i % 2 === 0) {
        body.shapes.add(new Circle(7 + i));
      } else {
        body.shapes.add(new Polygon(Polygon.box(14, 14)));
      }
      body.space = sp;
    }
  }
}

// ---------------------------------------------------------------------------
// Demo definition
// ---------------------------------------------------------------------------

export default {
  id: "deterministic",
  label: "Deterministic Mode",
  tags: ["Deterministic", "Multiplayer", "Constraint", "Polygon", "Circle"],
  desc: 'Two identical simulations run side by side with <code>space.deterministic = true</code>. Every position matches bit-for-bit. <b>Click</b> to drop shapes into both.',
  walls: false,
  noCodePen: true,

  setup(space, W, H) {
    _W = W;
    _H = H;
    _frame = 0;
    _matched = 0;
    _mismatched = 0;

    const rngA = mulberry32(42);
    buildScene(space, W / 2, H, rngA);

    _spaceB = new Space();
    const rngB = mulberry32(42);
    buildScene(_spaceB, W / 2, H, rngB);
  },

  step(space, W, H) {
    // Step Space B in sync (Space A is stepped by the runner)
    _spaceB.step(1 / 60, 8, 3);

    _frame++;
    if (spacesMatch(space, _spaceB)) {
      _matched++;
    } else {
      _mismatched++;
    }
  },

  click(x, y, space, W, H) {
    const halfW = W / 2;
    const localX = x < halfW ? x : x - halfW;
    spawnInBoth(localX, y, space, _spaceB, halfW);
  },

  render(ctx, space, W, H, showOutlines) {
    const halfW = W / 2;

    // --- Left half: Space A ---
    ctx.save();
    ctx.beginPath();
    ctx.rect(0, 0, halfW, H);
    ctx.clip();
    drawGrid(ctx, halfW, H);
    for (const body of space.bodies) drawBody(ctx, body, showOutlines);
    ctx.restore();

    // --- Divider ---
    ctx.save();
    ctx.strokeStyle = "rgba(88,166,255,0.4)";
    ctx.lineWidth = 2;
    ctx.setLineDash([6, 4]);
    ctx.beginPath();
    ctx.moveTo(halfW, 0);
    ctx.lineTo(halfW, H);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.restore();

    // --- Right half: Space B (translated) ---
    ctx.save();
    ctx.beginPath();
    ctx.rect(halfW, 0, halfW, H);
    ctx.clip();
    ctx.translate(halfW, 0);
    drawGrid(ctx, halfW, H);
    for (const body of _spaceB.bodies) drawBody(ctx, body, showOutlines);
    ctx.restore();

    // --- Labels ---
    ctx.save();
    ctx.font = "bold 13px monospace";
    ctx.textBaseline = "top";

    // "Space A" label
    ctx.fillStyle = "rgba(88,166,255,0.8)";
    ctx.fillText("Space A", 12, 10);

    // "Space B" label
    ctx.fillText("Space B", halfW + 12, 10);

    // --- Status overlay ---
    const statusY = 34;
    ctx.font = "11px monospace";

    // Frame counter
    ctx.fillStyle = "rgba(200,220,255,0.6)";
    ctx.fillText(`Frame: ${_frame}`, 12, statusY);

    // Match status
    const allMatch = _mismatched === 0;
    if (allMatch) {
      ctx.fillStyle = "rgba(63,185,80,0.9)";
      ctx.fillText(`MATCH  ${_matched}/${_frame}`, 12, statusY + 16);
    } else {
      ctx.fillStyle = "rgba(248,81,73,0.9)";
      ctx.fillText(`MISMATCH  ${_mismatched}/${_frame}`, 12, statusY + 16);
    }

    // Hint
    ctx.fillStyle = "rgba(200,220,255,0.4)";
    ctx.fillText("Click to drop shapes", 12, H - 20);

    ctx.restore();
  },

  code2d: `// Deterministic Twin-Simulation
const W = canvas.width, H = canvas.height;
const halfW = W / 2;

// Seeded PRNG for identical setup
function mulberry32(seed) {
  return function () {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function buildScene(space, w, h, rng) {
  space.gravity = new Vec2(0, 600);
  space.deterministic = true;

  // Floor
  const floor = new Body(BodyType.STATIC, new Vec2(w / 2, h - 20));
  floor.shapes.add(new Polygon(Polygon.box(w - 10, 20)));
  floor.space = space;

  // Ramp
  const ramp = new Body(BodyType.STATIC, new Vec2(w * 0.6, h * 0.45));
  ramp.shapes.add(new Polygon(Polygon.box(w * 0.55, 12)));
  ramp.rotation = -0.25;
  ramp.space = space;

  // Dynamic bodies
  for (let i = 0; i < 20; i++) {
    const x = w * 0.2 + rng() * w * 0.6;
    const y = 40 + rng() * h * 0.25;
    const body = new Body(BodyType.DYNAMIC, new Vec2(x, y));
    if (rng() < 0.5) {
      body.shapes.add(new Circle(6 + rng() * 10));
    } else {
      body.shapes.add(new Polygon(Polygon.box(
        10 + rng() * 16, 10 + rng() * 16,
      )));
    }
    body.space = space;
  }
}

// Create two identical spaces
const spaceA = new Space();
const spaceB = new Space();
buildScene(spaceA, halfW, H, mulberry32(42));
buildScene(spaceB, halfW, H, mulberry32(42));

let frame = 0;
let matched = 0;

function loop() {
  spaceA.step(1 / 60, 8, 3);
  spaceB.step(1 / 60, 8, 3);
  frame++;

  // Check if all positions match
  const aBodies = [...spaceA.bodies].filter(b => b.isDynamic());
  const bBodies = [...spaceB.bodies].filter(b => b.isDynamic());
  let match = aBodies.length === bBodies.length;
  if (match) {
    for (let i = 0; i < aBodies.length; i++) {
      if (aBodies[i].position.x !== bBodies[i].position.x
       || aBodies[i].position.y !== bBodies[i].position.y) {
        match = false;
        break;
      }
    }
  }
  if (match) matched++;

  ctx.clearRect(0, 0, W, H);

  // Draw Space A (left half)
  ctx.save();
  ctx.beginPath();
  ctx.rect(0, 0, halfW, H);
  ctx.clip();
  drawGrid(halfW, H);
  for (const body of spaceA.bodies) drawBody(body);
  ctx.restore();

  // Divider
  ctx.strokeStyle = "rgba(88,166,255,0.4)";
  ctx.lineWidth = 2;
  ctx.setLineDash([6, 4]);
  ctx.beginPath();
  ctx.moveTo(halfW, 0);
  ctx.lineTo(halfW, H);
  ctx.stroke();
  ctx.setLineDash([]);

  // Draw Space B (right half)
  ctx.save();
  ctx.beginPath();
  ctx.rect(halfW, 0, halfW, H);
  ctx.clip();
  ctx.translate(halfW, 0);
  drawGrid(halfW, H);
  for (const body of spaceB.bodies) drawBody(body);
  ctx.restore();

  // Status
  ctx.font = "bold 13px monospace";
  ctx.fillStyle = "rgba(88,166,255,0.8)";
  ctx.fillText("Space A", 12, 14);
  ctx.fillText("Space B", halfW + 12, 14);

  ctx.font = "11px monospace";
  ctx.fillStyle = match
    ? "rgba(63,185,80,0.9)"
    : "rgba(248,81,73,0.9)";
  ctx.fillText(
    match ? \`MATCH \${matched}/\${frame}\` : "MISMATCH",
    12, 34,
  );

  requestAnimationFrame(loop);
}
loop();`,
};
