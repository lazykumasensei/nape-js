/**
 * Sub-Stepping Solver demo — Pyramid Stability.
 *
 * A 14-row pyramid of boxes settles under gravity with low solver iterations.
 *   Left:  subSteps = 1 — pyramid jitters endlessly, bodies never sleep (orange)
 *   Right: subSteps = 4 — pyramid settles quickly, all bodies sleep (green)
 * Click to drop extra boxes onto the pyramids.
 */
import {
  Space, Body, BodyType, Vec2, Circle, Polygon,
} from "../nape-js.esm.js";
import { drawGrid } from "../renderer.js";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const ROWS     = 14;
const BOX_W    = 24;
const BOX_H    = 12;
const GRAVITY  = 1500;

// ---------------------------------------------------------------------------
// State
// ---------------------------------------------------------------------------

let _spaceB = null;
let _W      = 0;
let _H      = 0;
let _frame  = 0;
let _awakeA = 0;
let _awakeB = 0;
let _totalA = 0;
let _totalB = 0;

// ---------------------------------------------------------------------------
// Custom body drawing — color based on awake/sleeping state
// ---------------------------------------------------------------------------

function drawColoredBody(ctx, body) {
  if (body.isStatic()) {
    // Static = neutral gray
    ctx.save();
    ctx.translate(body.position.x, body.position.y);
    ctx.rotate(body.rotation);
    for (const shape of body.shapes) {
      if (shape.isPolygon()) {
        const verts = shape.castPolygon.localVerts;
        const len = verts.length;
        if (len < 3) continue;
        ctx.beginPath();
        const v0 = verts.at(0);
        ctx.moveTo(v0.x, v0.y);
        for (let vi = 1; vi < len; vi++) {
          const v = verts.at(vi);
          ctx.lineTo(v.x, v.y);
        }
        ctx.closePath();
        ctx.fillStyle = "rgba(100,120,140,0.25)";
        ctx.fill();
        ctx.strokeStyle = "rgba(100,120,140,0.5)";
        ctx.lineWidth = 1;
        ctx.stroke();
      }
    }
    ctx.restore();
    return;
  }

  const sleeping = body.isSleeping;

  // Awake = orange/red glow, Sleeping = green/teal
  const fill = sleeping
    ? "rgba(50,180,80,0.3)"
    : "rgba(255,120,40,0.35)";
  const stroke = sleeping
    ? "rgba(50,200,80,0.7)"
    : "rgba(255,80,30,0.8)";

  ctx.save();
  ctx.translate(body.position.x, body.position.y);
  ctx.rotate(body.rotation);

  for (const shape of body.shapes) {
    if (shape.isCircle()) {
      const r = shape.castCircle.radius;
      ctx.beginPath();
      ctx.arc(0, 0, r, 0, Math.PI * 2);
      ctx.fillStyle = fill;
      ctx.fill();
      ctx.strokeStyle = stroke;
      ctx.lineWidth = 1.2;
      ctx.stroke();
    } else if (shape.isPolygon()) {
      const verts = shape.castPolygon.localVerts;
      const len = verts.length;
      if (len < 3) continue;
      ctx.beginPath();
      const v0 = verts.at(0);
      ctx.moveTo(v0.x, v0.y);
      for (let vi = 1; vi < len; vi++) {
        const v = verts.at(vi);
        ctx.lineTo(v.x, v.y);
      }
      ctx.closePath();
      ctx.fillStyle = fill;
      ctx.fill();
      ctx.strokeStyle = stroke;
      ctx.lineWidth = 1.2;
      ctx.stroke();
    }
  }

  ctx.restore();
}

// ---------------------------------------------------------------------------
// Scene builder
// ---------------------------------------------------------------------------

function buildScene(space, halfW, H, subSteps) {
  space.gravity = new Vec2(0, GRAVITY);
  space.subSteps = subSteps;

  // Floor
  const floor = new Body(BodyType.STATIC, new Vec2(halfW / 2, H - 10));
  floor.shapes.add(new Polygon(Polygon.box(halfW - 10, 10)));
  floor.space = space;

  // Side walls
  const lw = new Body(BodyType.STATIC, new Vec2(6, H / 2));
  lw.shapes.add(new Polygon(Polygon.box(6, H)));
  lw.space = space;

  const rw = new Body(BodyType.STATIC, new Vec2(halfW - 6, H / 2));
  rw.shapes.add(new Polygon(Polygon.box(6, H)));
  rw.space = space;

  // Build pyramid
  const cx = halfW / 2;
  const baseY = H - 10 - BOX_H / 2;

  for (let row = 0; row < ROWS; row++) {
    const count = ROWS - row;
    const startX = cx - (count - 1) * BOX_W / 2;
    for (let col = 0; col < count; col++) {
      const x = startX + col * BOX_W;
      const y = baseY - row * BOX_H;
      const box = new Body(BodyType.DYNAMIC, new Vec2(x, y));
      box.shapes.add(new Polygon(Polygon.box(BOX_W, BOX_H)));
      box.space = space;
    }
  }
}

function countAwake(space) {
  let awake = 0;
  let total = 0;
  for (const b of space.bodies) {
    if (!b.isDynamic()) continue;
    total++;
    if (!b.isSleeping) awake++;
  }
  return { awake, total };
}

// ---------------------------------------------------------------------------
// Demo definition
// ---------------------------------------------------------------------------

export default {
  id: "sub-stepping",
  label: "Sub-Stepping Solver",
  tags: ["SubSteps", "Stacking", "Stability", "Performance"],
  desc: 'A 14-row pyramid under low solver iterations. Left: <code>subSteps=1</code> — jitters endlessly (<b style="color:#ff5020">orange</b>). Right: <code>subSteps=4</code> — settles to sleep (<b style="color:#32b450">green</b>). <b>Click</b> to drop more boxes.',
  walls: false,
  noCodePen: true,
  velocityIterations: 1,
  positionIterations: 1,

  setup(space, W, H) {
    _W = W;
    _H = H;
    _frame = 0;
    _awakeA = _awakeB = 0;
    _totalA = _totalB = 0;

    const halfW = W / 2;

    // Space A — subSteps=1 (left)
    buildScene(space, halfW, H, 1);

    // Space B — subSteps=4 (right)
    _spaceB = new Space();
    buildScene(_spaceB, halfW, H, 4);
  },

  step(space, W, H) {
    _frame++;

    // Step Space B with same low iterations
    _spaceB.step(1 / 60, 1, 1);

    // Count awake bodies
    const a = countAwake(space);
    const b = countAwake(_spaceB);
    _awakeA = a.awake;
    _totalA = a.total;
    _awakeB = b.awake;
    _totalB = b.total;

  },

  click(x, y, space, W, H) {
    const halfW = W / 2;
    const cx = halfW / 2;

    for (let i = 0; i < 3; i++) {
      const offX = (Math.random() - 0.5) * halfW * 0.6;
      const dropY = 20 + Math.random() * 30;

      const boxA = new Body(BodyType.DYNAMIC, new Vec2(cx + offX, dropY));
      boxA.shapes.add(new Polygon(Polygon.box(BOX_W, BOX_H)));
      boxA.space = space;

      const boxB = new Body(BodyType.DYNAMIC, new Vec2(cx + offX, dropY));
      boxB.shapes.add(new Polygon(Polygon.box(BOX_W, BOX_H)));
      boxB.space = _spaceB;
    }
  },

  render(ctx, space, W, H, showOutlines) {
    const halfW = W / 2;

    // --- Left half: Space A (subSteps=1) ---
    ctx.save();
    ctx.beginPath();
    ctx.rect(0, 0, halfW, H);
    ctx.clip();
    drawGrid(ctx, halfW, H);
    for (const body of space.bodies) drawColoredBody(ctx, body);
    ctx.restore();

    // --- Divider ---
    ctx.save();
    ctx.strokeStyle = "rgba(255,140,50,0.5)";
    ctx.lineWidth = 2;
    ctx.setLineDash([6, 4]);
    ctx.beginPath();
    ctx.moveTo(halfW, 0);
    ctx.lineTo(halfW, H);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.restore();

    // --- Right half: Space B (subSteps=4) ---
    ctx.save();
    ctx.beginPath();
    ctx.rect(halfW, 0, halfW, H);
    ctx.clip();
    ctx.translate(halfW, 0);
    drawGrid(ctx, halfW, H);
    for (const body of _spaceB.bodies) drawColoredBody(ctx, body);
    ctx.restore();

    // --- Legend bar ---
    ctx.save();
    ctx.font = "bold 13px monospace";
    ctx.textBaseline = "top";

    ctx.fillStyle = "rgba(255,80,30,0.9)";
    ctx.fillText("subSteps = 1", 12, 10);

    ctx.fillStyle = "rgba(50,200,80,0.9)";
    ctx.fillText("subSteps = 4", halfW + 12, 10);

    // Awake counters
    ctx.font = "11px monospace";

    const awakeColorA = _awakeA > 0 ? "rgba(255,120,40,0.9)" : "rgba(50,200,80,0.8)";
    ctx.fillStyle = awakeColorA;
    ctx.fillText(`Awake: ${_awakeA} / ${_totalA}`, 12, 32);

    const awakeColorB = _awakeB > 0 ? "rgba(255,120,40,0.9)" : "rgba(50,200,80,0.8)";
    ctx.fillStyle = awakeColorB;
    ctx.fillText(`Awake: ${_awakeB} / ${_totalB}`, halfW + 12, 32);

    // Legend
    ctx.fillStyle = "rgba(200,220,255,0.35)";
    ctx.fillText("Solver: 1 vel / 1 pos iteration", 12, 50);

    // Color legend
    ctx.fillStyle = "rgba(255,120,40,0.7)";
    ctx.fillRect(12, 66, 10, 10);
    ctx.fillStyle = "rgba(200,220,255,0.5)";
    ctx.fillText("= awake (jittering)", 26, 66);

    ctx.fillStyle = "rgba(50,180,80,0.7)";
    ctx.fillRect(12, 82, 10, 10);
    ctx.fillStyle = "rgba(200,220,255,0.5)";
    ctx.fillText("= sleeping (stable)", 26, 82);

    ctx.fillStyle = "rgba(200,220,255,0.3)";
    ctx.fillText("Click to drop more boxes", 12, H - 18);

    ctx.restore();
  },

  code2d: `// Sub-Stepping: pyramid stability comparison
const W = canvas.width, H = canvas.height;
const halfW = W / 2;

// Low solver iterations to stress-test stability
const VEL_ITER = 1, POS_ITER = 1;

const spaceA = new Space(new Vec2(0, 1500));
// subSteps=1 (default) — pyramid jitters

const spaceB = new Space(new Vec2(0, 1500));
spaceB.subSteps = 4; // pyramid settles cleanly

function buildPyramid(space, w, h) {
  const floor = new Body(BodyType.STATIC, new Vec2(w / 2, h - 10));
  floor.shapes.add(new Polygon(Polygon.box(w - 10, 10)));
  floor.space = space;

  const cx = w / 2;
  const baseY = h - 10 - 6;
  for (let row = 0; row < 14; row++) {
    const count = 14 - row;
    const startX = cx - (count - 1) * 12;
    for (let col = 0; col < count; col++) {
      const box = new Body(BodyType.DYNAMIC,
        new Vec2(startX + col * 24, baseY - row * 12));
      box.shapes.add(new Polygon(Polygon.box(24, 12)));
      box.space = space;
    }
  }
}

buildPyramid(spaceA, halfW, H);
buildPyramid(spaceB, halfW, H);

function loop() {
  spaceA.step(1 / 60, VEL_ITER, POS_ITER);
  spaceB.step(1 / 60, VEL_ITER, POS_ITER);
  ctx.clearRect(0, 0, W, H);

  for (const [sp, offX] of [[spaceA, 0], [spaceB, halfW]]) {
    ctx.save();
    ctx.beginPath();
    ctx.rect(offX, 0, halfW, H);
    ctx.clip();
    ctx.translate(offX, 0);
    drawGrid(halfW, H);
    for (const body of sp.bodies) {
      if (body.isStatic()) continue;
      const sleeping = body.isSleeping;
      ctx.save();
      ctx.translate(body.position.x, body.position.y);
      ctx.rotate(body.rotation);
      for (const shape of body.shapes) {
        const verts = shape.castPolygon.localVerts;
        const len = verts.length;
        if (len < 3) continue;
        ctx.beginPath();
        const v0 = verts.at(0);
        ctx.moveTo(v0.x, v0.y);
        for (let vi = 1; vi < len; vi++) {
          const v = verts.at(vi);
          ctx.lineTo(v.x, v.y);
        }
        ctx.closePath();
        ctx.fillStyle = sleeping
          ? "rgba(50,180,80,0.3)" : "rgba(255,120,40,0.35)";
        ctx.fill();
        ctx.strokeStyle = sleeping
          ? "rgba(50,200,80,0.7)" : "rgba(255,80,30,0.8)";
        ctx.lineWidth = 1.2;
        ctx.stroke();
      }
      ctx.restore();
    }
    ctx.restore();
  }

  ctx.font = "bold 13px monospace";
  ctx.fillStyle = "rgba(255,80,30,0.9)";
  ctx.fillText("subSteps = 1", 12, 14);
  ctx.fillStyle = "rgba(50,200,80,0.9)";
  ctx.fillText("subSteps = 4", halfW + 12, 14);

  requestAnimationFrame(loop);
}
loop();`,
};
