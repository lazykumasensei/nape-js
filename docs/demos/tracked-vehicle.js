import { Body, BodyType, Vec2, Circle, Polygon, Material, PivotJoint, MotorJoint, InteractionFilter } from "../nape-js.esm.js";

import { drawBody, drawGrid } from "../renderer.js";

// ── Constants ──────────────────────────────────────────────────────────────
const WORLD_W = 3200;
const MOTOR_RATE = 22;
const WHEEL_R = 18;
const WHEEL_DX = 58;
const CHASSIS_HW = WHEEL_DX + 8;
const CHASSIS_HH = 12;
const TREAD_SEGMENTS = 38;
const TREAD_THICK = 4;

// ── Module-level refs ──────────────────────────────────────────────────────
let _chassis = null;
let _leftMotor = null;
let _rightMotor = null;
const keys = {};

// ── Terrain generation ─────────────────────────────────────────────────────
function buildTerrain(space, worldW, groundY) {
  const segW = 50;
  const numSegs = Math.ceil(worldW / segW);
  for (let i = 0; i < numSegs; i++) {
    const x = i * segW;
    const y0 = groundY + Math.sin(x * 0.006) * 28 + Math.sin(x * 0.017) * 10;
    const x1 = x + segW;
    const y1 = groundY + Math.sin(x1 * 0.006) * 28 + Math.sin(x1 * 0.017) * 10;
    const bottom = groundY + 120;
    const verts = [new Vec2(x, y0), new Vec2(x1, y1), new Vec2(x1, bottom), new Vec2(x, bottom)];
    const seg = new Body(BodyType.STATIC);
    seg.shapes.add(new Polygon(verts));
    seg.space = space;
  }
}

export default {
  id: "tracked-vehicle",
  label: "Tracked Vehicle",
  featured: false,
  tags: ["PivotJoint", "MotorJoint", "InteractionFilter", "Chain"],
  desc: "A tank-style tracked vehicle: two sprocket wheels with a closed chain of tread segments wrapped around them, driven by a <code>MotorJoint</code>. Use <b>← →</b> arrow keys or tap left/right to drive.",
  walls: false,
  camera: null,

  setup(space, W, H) {
    space.gravity = new Vec2(0, 700);
    const groundY = H - 40;

    buildTerrain(space, WORLD_W, groundY);

    // Side walls
    const wallL = new Body(BodyType.STATIC, new Vec2(-10, H / 2));
    wallL.shapes.add(new Polygon(Polygon.box(20, H * 2)));
    wallL.space = space;
    const wallR = new Body(BodyType.STATIC, new Vec2(WORLD_W + 10, H / 2));
    wallR.shapes.add(new Polygon(Polygon.box(20, H * 2)));
    wallR.space = space;

    // Collision groups: 1=world, 2=chassis, 4=wheels, 8=tread.
    // Tread self-collision is disabled; chassis ignores tread & wheels
    // (they're constraint-coupled), wheels grip tread + ground.
    const fChassis = new InteractionFilter(2, 1);
    const fWheel   = new InteractionFilter(4, 1 | 8);
    const fTread   = new InteractionFilter(8, 1 | 4);

    const cx = 260;
    const cy = groundY - 120;

    // --- Chassis (hull + cabin) ---
    const hullMat = new Material(0.2, 0.4, 0.6, 1.4);
    const chassis = new Body(BodyType.DYNAMIC, new Vec2(cx, cy));
    chassis.shapes.add(new Polygon([
      new Vec2(-CHASSIS_HW, -CHASSIS_HH),
      new Vec2( CHASSIS_HW, -CHASSIS_HH),
      new Vec2( CHASSIS_HW,  CHASSIS_HH),
      new Vec2(-CHASSIS_HW,  CHASSIS_HH),
    ], undefined, hullMat, fChassis));
    chassis.shapes.add(new Polygon([
      new Vec2(-32, -CHASSIS_HH - 16),
      new Vec2( 16, -CHASSIS_HH - 16),
      new Vec2( 22, -CHASSIS_HH),
      new Vec2(-32, -CHASSIS_HH),
    ], undefined, hullMat, fChassis));
    try { chassis.userData._colorIdx = 0; } catch (_) {}
    chassis.space = space;
    _chassis = chassis;

    // --- Sprocket wheels ---
    const wheelMat = new Material(0.1, 2.0, 2.4, 1.2);
    const wheelY = cy + CHASSIS_HH + 2;

    const leftWheel = new Body(BodyType.DYNAMIC, new Vec2(cx - WHEEL_DX, wheelY));
    leftWheel.shapes.add(new Circle(WHEEL_R, undefined, wheelMat, fWheel));
    try { leftWheel.userData._colorIdx = 3; } catch (_) {}
    leftWheel.space = space;

    const rightWheel = new Body(BodyType.DYNAMIC, new Vec2(cx + WHEEL_DX, wheelY));
    rightWheel.shapes.add(new Circle(WHEEL_R, undefined, wheelMat, fWheel));
    try { rightWheel.userData._colorIdx = 3; } catch (_) {}
    rightWheel.space = space;

    new PivotJoint(chassis, leftWheel,  new Vec2(-WHEEL_DX, CHASSIS_HH + 2), new Vec2(0, 0)).space = space;
    new PivotJoint(chassis, rightWheel, new Vec2( WHEEL_DX, CHASSIS_HH + 2), new Vec2(0, 0)).space = space;

    _leftMotor  = new MotorJoint(chassis, leftWheel,  0);
    _rightMotor = new MotorJoint(chassis, rightWheel, 0);
    _leftMotor.space = space;
    _rightMotor.space = space;

    // --- Tread loop ---
    // Path: upper straight → right arc (CCW, top→bottom via right) →
    // lower straight → left arc (bottom→top via left). Closed perimeter.
    const w1 = leftWheel.position;
    const w2 = rightWheel.position;
    const wheelDist = Math.hypot(w2.x - w1.x, w2.y - w1.y);
    const straightAng = Math.atan2(w2.y - w1.y, w2.x - w1.x);
    const arcLen = Math.PI * WHEEL_R;
    const perim = 2 * wheelDist + 2 * arcLen;
    const segSpacing = perim / TREAD_SEGMENTS;
    const segHalfLen = (segSpacing / 2) * 1.02;

    function pathAt(s) {
      s = ((s % perim) + perim) % perim;
      if (s < wheelDist) {
        const t = s / wheelDist;
        return { x: w1.x + (w2.x - w1.x) * t, y: w1.y - WHEEL_R + (w2.y - w1.y) * t, ang: straightAng };
      }
      s -= wheelDist;
      if (s < arcLen) {
        const a = -Math.PI / 2 + (s / arcLen) * Math.PI;
        return { x: w2.x + WHEEL_R * Math.cos(a), y: w2.y + WHEEL_R * Math.sin(a), ang: a + Math.PI / 2 };
      }
      s -= arcLen;
      if (s < wheelDist) {
        const t = s / wheelDist;
        return { x: w2.x + (w1.x - w2.x) * t, y: w2.y + WHEEL_R + (w1.y - w2.y) * t, ang: straightAng + Math.PI };
      }
      s -= wheelDist;
      const a = Math.PI / 2 + (s / arcLen) * Math.PI;
      return { x: w1.x + WHEEL_R * Math.cos(a), y: w1.y + WHEEL_R * Math.sin(a), ang: a + Math.PI / 2 };
    }

    const treadMat = new Material(0.05, 1.8, 2.2, 0.6);
    const segments = [];
    for (let i = 0; i < TREAD_SEGMENTS; i++) {
      const p = pathAt((i + 0.5) * segSpacing);
      const seg = new Body(BodyType.DYNAMIC, new Vec2(p.x, p.y));
      seg.rotation = p.ang;
      seg.shapes.add(new Polygon(Polygon.box(segHalfLen * 2, TREAD_THICK), undefined, treadMat, fTread));
      try { seg.userData._colorIdx = 2; } catch (_) {}
      seg.space = space;
      segments.push(seg);
    }

    for (let i = 0; i < TREAD_SEGMENTS; i++) {
      const a = segments[i];
      const b = segments[(i + 1) % TREAD_SEGMENTS];
      new PivotJoint(a, b, new Vec2(segHalfLen, 0), new Vec2(-segHalfLen, 0)).space = space;
    }

    this.camera = {
      follow: chassis,
      offsetX: 0,
      offsetY: -20,
      bounds: { minX: 0, minY: -200, maxX: WORLD_W, maxY: H + 200 },
      lerp: 0.08,
    };

    window.addEventListener("keydown", (e) => {
      keys[e.code] = true;
      if (e.code === "ArrowLeft" || e.code === "ArrowRight") e.preventDefault();
    });
    window.addEventListener("keyup", (e) => { keys[e.code] = false; });
  },

  step(_space, _W, _H) {
    if (!_leftMotor || !_rightMotor) return;
    const left = keys["ArrowLeft"] || keys["KeyA"] || keys._touchLeft;
    const right = keys["ArrowRight"] || keys["KeyD"] || keys._touchRight;
    let rate = 0;
    if (left) rate = -MOTOR_RATE;
    else if (right) rate = MOTOR_RATE;
    _leftMotor.rate = rate;
    _rightMotor.rate = rate;
  },

  click(x, _y, _space, _W, _H) {
    if (!_chassis) return;
    if (x < _chassis.position.x) keys._touchLeft = true;
    else keys._touchRight = true;
  },

  release() {
    keys._touchLeft = false;
    keys._touchRight = false;
  },

  render(ctx, space, W, H, debugDraw, camX, camY) {
    ctx.save();
    ctx.translate(-camX, -camY);
    drawGrid(ctx, W, H, camX, camY);
    for (const body of space.bodies) drawBody(ctx, body, debugDraw);
    ctx.restore();
  },

  renderPixi(adapter, space, _W, _H, _showOutlines, camX, camY) {
    const { app } = adapter.getEngine();
    if (!app) return;
    adapter.syncBodies(space);
    app.stage.x = -camX;
    app.stage.y = -camY;
    app.render();
  },
};
