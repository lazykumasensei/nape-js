import { Body, BodyType, Vec2, Circle, Polygon, Material, SpringJoint, LineJoint, MotorJoint } from "../nape-js.esm.js";

import { drawBody, drawGrid } from "../renderer.js";

// ── Drawing helpers ────────────────────────────────────────────────────────
function drawSpring(ctx, x1, y1, x2, y2, color = '#d29922', coils = 8, amp = 5) {
  const dx = x2 - x1, dy = y2 - y1;
  const len = Math.sqrt(dx * dx + dy * dy);
  if (len < 2) return;
  const ux = dx / len, uy = dy / len;
  const px = -uy, py = ux;
  const n = coils * 2;
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(x1 + ux * len * 0.08, y1 + uy * len * 0.08);
  for (let i = 1; i <= n; i++) {
    const t = 0.08 + (i / n) * 0.84;
    const sign = i % 2 === 0 ? 1 : -1;
    ctx.lineTo(x1 + ux * len * t + px * amp * sign, y1 + uy * len * t + py * amp * sign);
  }
  ctx.lineTo(x2, y2);
  ctx.strokeStyle = color;
  ctx.lineWidth = 1.5;
  ctx.setLineDash([]);
  ctx.stroke();
}

// Module-level refs
let _chassis = null;
let _fWheel = null;
let _rWheel = null;
let _rMotor = null;
const WHEEL_OFFSET_X = 38;
const CHASSIS_H = 16;
const MOTOR_RATE = 8;
const keys = {};

export default {
  id: "car-sideview",
  label: "2D Car — Side View",
  featured: false,
  tags: ["SpringJoint", "LineJoint", "MotorJoint"],
  desc: "A car with SpringJoint suspension and LineJoint-constrained wheels. Use <b>← →</b> arrow keys or tap left/right to drive.",
  walls: false,

  setup(space, W, H) {
    space.gravity = new Vec2(0, 600);

    // Ground with bumps
    const ground = new Body(BodyType.STATIC, new Vec2(W / 2, H - 10));
    ground.shapes.add(new Polygon(Polygon.box(W + 400, 20)));
    ground.space = space;

    // Add ramp bumps
    for (let i = 0; i < 5; i++) {
      const bump = new Body(BodyType.STATIC, new Vec2(80 + i * 90, H - 25));
      bump.shapes.add(new Polygon(Polygon.regular(8 + Math.random() * 8, 6 + Math.random() * 6, 3 + Math.floor(Math.random() * 4))));
      bump.space = space;
    }

    const cx = W / 2 - 60, cy = H - 80;

    // Car body (chassis)
    const chassis = new Body(BodyType.DYNAMIC, new Vec2(cx, cy));
    chassis.shapes.add(new Polygon(Polygon.box(80, CHASSIS_H)));
    try { chassis.userData._colorIdx = 0; } catch(_) {}
    chassis.space = space;

    // Front wheel
    const fWheel = new Body(BodyType.DYNAMIC, new Vec2(cx + WHEEL_OFFSET_X, cy + 45));
    fWheel.shapes.add(new Circle(14, undefined, new Material(0.8, 0.5, 0.5, 2)));
    try { fWheel.userData._colorIdx = 3; } catch(_) {}
    fWheel.space = space;

    // Rear wheel
    const rWheel = new Body(BodyType.DYNAMIC, new Vec2(cx - WHEEL_OFFSET_X, cy + 45));
    rWheel.shapes.add(new Circle(14, undefined, new Material(0.8, 0.5, 0.5, 2)));
    try { rWheel.userData._colorIdx = 3; } catch(_) {}
    rWheel.space = space;

    // SpringJoint suspension
    const fSusp = new SpringJoint(
      chassis, fWheel,
      new Vec2(WHEEL_OFFSET_X, CHASSIS_H / 2), new Vec2(0, 0),
      30,
    );
    fSusp.frequency = 4;
    fSusp.damping = 0.6;
    fSusp.space = space;

    const rSusp = new SpringJoint(
      chassis, rWheel,
      new Vec2(-WHEEL_OFFSET_X, CHASSIS_H / 2), new Vec2(0, 0),
      30,
    );
    rSusp.frequency = 4;
    rSusp.damping = 0.6;
    rSusp.space = space;

    // LineJoints to constrain wheels to vertical travel
    new LineJoint(
      chassis, fWheel,
      new Vec2(WHEEL_OFFSET_X, CHASSIS_H / 2), new Vec2(0, 0),
      new Vec2(0, 1), -5, 40,
    ).space = space;

    new LineJoint(
      chassis, rWheel,
      new Vec2(-WHEEL_OFFSET_X, CHASSIS_H / 2), new Vec2(0, 0),
      new Vec2(0, 1), -5, 40,
    ).space = space;

    // Motor on rear wheel (rate controlled in step)
    _rMotor = new MotorJoint(chassis, rWheel, 0);
    _rMotor.space = space;

    _chassis = chassis;
    _fWheel = fWheel;
    _rWheel = rWheel;

    // Keyboard controls
    window.addEventListener("keydown", (e) => {
      keys[e.code] = true;
      if (e.code === "ArrowLeft" || e.code === "ArrowRight") e.preventDefault();
    });
    window.addEventListener("keyup", (e) => { keys[e.code] = false; });
  },

  step(space, W, H) {
    if (!_rMotor) return;
    const left = keys["ArrowLeft"] || keys["KeyA"] || keys._touchLeft;
    const right = keys["ArrowRight"] || keys["KeyD"] || keys._touchRight;
    if (right) {
      _rMotor.rate = -MOTOR_RATE;
    } else if (left) {
      _rMotor.rate = MOTOR_RATE;
    } else {
      _rMotor.rate = 0;
    }
  },

  click(x, y, space, W, H) {
    // Touch: left half = drive left, right half = drive right
    if (x < W / 2) {
      keys._touchLeft = true;
    } else {
      keys._touchRight = true;
    }
  },

  release() {
    keys._touchLeft = false;
    keys._touchRight = false;
  },

  render(ctx, space, W, H, debugDraw) {
    drawGrid(ctx, W, H);

    // Draw all bodies
    for (const body of space.bodies) drawBody(ctx, body, debugDraw);

    // Draw suspension springs
    if (_chassis && _fWheel && _rWheel) {
      const cp = _chassis.position;
      const ca = _chassis.rotation;
      const cos = Math.cos(ca), sin = Math.sin(ca);
      const offY = CHASSIS_H / 2;

      // Front suspension spring visual
      const fax = cp.x + (WHEEL_OFFSET_X * cos - offY * sin);
      const fay = cp.y + (WHEEL_OFFSET_X * sin + offY * cos);
      drawSpring(ctx, fax, fay, _fWheel.position.x, _fWheel.position.y, '#d2992288', 5, 6);

      // Rear suspension spring visual
      const rax = cp.x + (-WHEEL_OFFSET_X * cos - offY * sin);
      const ray = cp.y + (-WHEEL_OFFSET_X * sin + offY * cos);
      drawSpring(ctx, rax, ray, _rWheel.position.x, _rWheel.position.y, '#d2992288', 5, 6);
    }
  },

  code2d: `// 2D Car — side view with SpringJoint suspension
const space = new Space(new Vec2(0, 600));
const W = canvas.width, H = canvas.height;

// Spring drawing helper
function drawSpring(x1, y1, x2, y2, color = '#d29922', coils = 8, amp = 5) {
  const dx = x2 - x1, dy = y2 - y1;
  const len = Math.sqrt(dx * dx + dy * dy);
  if (len < 2) return;
  const ux = dx / len, uy = dy / len;
  const px = -uy, py = ux;
  const n = coils * 2;
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(x1 + ux * len * 0.08, y1 + uy * len * 0.08);
  for (let i = 1; i <= n; i++) {
    const t = 0.08 + (i / n) * 0.84;
    const sign = i % 2 === 0 ? 1 : -1;
    ctx.lineTo(x1 + ux * len * t + px * amp * sign, y1 + uy * len * t + py * amp * sign);
  }
  ctx.lineTo(x2, y2);
  ctx.strokeStyle = color;
  ctx.lineWidth = 1.5;
  ctx.setLineDash([]);
  ctx.stroke();
}

// Ground with bumps
const ground = new Body(BodyType.STATIC, new Vec2(W / 2, H - 10));
ground.shapes.add(new Polygon(Polygon.box(W + 400, 20)));
ground.space = space;

for (let i = 0; i < 5; i++) {
  const bump = new Body(BodyType.STATIC, new Vec2(80 + i * 90, H - 25));
  bump.shapes.add(new Polygon(Polygon.regular(8 + Math.random() * 8, 6 + Math.random() * 6, 3 + Math.floor(Math.random() * 4))));
  bump.space = space;
}

const cx = W / 2 - 60, cy = H - 80;
const offX = 38, chassisH = 16;

// Car body
const chassis = new Body(BodyType.DYNAMIC, new Vec2(cx, cy));
chassis.shapes.add(new Polygon(Polygon.box(80, chassisH)));
chassis.space = space;

// Wheels
const fWheel = new Body(BodyType.DYNAMIC, new Vec2(cx + offX, cy + 45));
fWheel.shapes.add(new Circle(14, undefined, new Material(0.8, 0.5, 0.5, 2)));
fWheel.space = space;

const rWheel = new Body(BodyType.DYNAMIC, new Vec2(cx - offX, cy + 45));
rWheel.shapes.add(new Circle(14, undefined, new Material(0.8, 0.5, 0.5, 2)));
rWheel.space = space;

// SpringJoint suspension
const fSusp = new SpringJoint(chassis, fWheel, new Vec2(offX, chassisH/2), new Vec2(0,0), 30);
fSusp.frequency = 4; fSusp.damping = 0.6; fSusp.space = space;
const rSusp = new SpringJoint(chassis, rWheel, new Vec2(-offX, chassisH/2), new Vec2(0,0), 30);
rSusp.frequency = 4; rSusp.damping = 0.6; rSusp.space = space;

// LineJoints — constrain wheels to vertical travel
new LineJoint(chassis, fWheel, new Vec2(offX, chassisH/2), new Vec2(0,0), new Vec2(0,1), -5, 40).space = space;
new LineJoint(chassis, rWheel, new Vec2(-offX, chassisH/2), new Vec2(0,0), new Vec2(0,1), -5, 40).space = space;

// Motor (rate controlled by keyboard)
const motor = new MotorJoint(chassis, rWheel, 0);
motor.space = space;
const RATE = 8;

// Keyboard + touch controls
const keys = {};
window.addEventListener("keydown", (e) => {
  keys[e.code] = true;
  if (e.code === "ArrowLeft" || e.code === "ArrowRight") e.preventDefault();
});
window.addEventListener("keyup", (e) => { keys[e.code] = false; });
canvas.addEventListener("pointerdown", (e) => {
  const r = canvas.getBoundingClientRect();
  if ((e.clientX - r.left) < r.width / 2) keys._touchLeft = true;
  else keys._touchRight = true;
});
canvas.addEventListener("pointerup", () => { keys._touchLeft = false; keys._touchRight = false; });

function loop() {
  const left = keys["ArrowLeft"] || keys["KeyA"] || keys._touchLeft;
  const right = keys["ArrowRight"] || keys["KeyD"] || keys._touchRight;
  motor.rate = right ? -RATE : left ? RATE : 0;

  space.step(1 / 60, 8, 3);
  ctx.clearRect(0, 0, W, H);
  drawGrid();
  drawConstraintLines();
  for (const body of space.bodies) drawBody(body);

  // Suspension spring visuals
  const cp = chassis.position, ca = chassis.rotation;
  const cos = Math.cos(ca), sin = Math.sin(ca);
  const oy = chassisH / 2;
  drawSpring(cp.x+(offX*cos-oy*sin), cp.y+(offX*sin+oy*cos), fWheel.position.x, fWheel.position.y, '#d2992288', 5, 6);
  drawSpring(cp.x+(-offX*cos-oy*sin), cp.y+(-offX*sin+oy*cos), rWheel.position.x, rWheel.position.y, '#d2992288', 5, 6);

  requestAnimationFrame(loop);
}
loop();`,

  codePixi: `// 2D Car — side view with SpringJoint suspension
const space = new Space(new Vec2(0, 600));

// Ground with bumps
const ground = new Body(BodyType.STATIC, new Vec2(W / 2, H - 10));
ground.shapes.add(new Polygon(Polygon.box(W + 400, 20)));
ground.space = space;

for (let i = 0; i < 5; i++) {
  const bump = new Body(BodyType.STATIC, new Vec2(80 + i * 90, H - 25));
  bump.shapes.add(new Polygon(Polygon.regular(8 + Math.random() * 8, 6 + Math.random() * 6, 3 + Math.floor(Math.random() * 4))));
  bump.space = space;
}

const cx = W / 2 - 60, cy = H - 80;
const offX = 38, chassisH = 16;

// Car body
const chassis = new Body(BodyType.DYNAMIC, new Vec2(cx, cy));
chassis.shapes.add(new Polygon(Polygon.box(80, chassisH)));
chassis.space = space;

// Wheels
const fWheel = new Body(BodyType.DYNAMIC, new Vec2(cx + offX, cy + 45));
fWheel.shapes.add(new Circle(14, undefined, new Material(0.8, 0.5, 0.5, 2)));
fWheel.space = space;

const rWheel = new Body(BodyType.DYNAMIC, new Vec2(cx - offX, cy + 45));
rWheel.shapes.add(new Circle(14, undefined, new Material(0.8, 0.5, 0.5, 2)));
rWheel.space = space;

// SpringJoint suspension
const fSusp = new SpringJoint(chassis, fWheel, new Vec2(offX, chassisH/2), new Vec2(0,0), 30);
fSusp.frequency = 4; fSusp.damping = 0.6; fSusp.space = space;
const rSusp = new SpringJoint(chassis, rWheel, new Vec2(-offX, chassisH/2), new Vec2(0,0), 30);
rSusp.frequency = 4; rSusp.damping = 0.6; rSusp.space = space;

// LineJoints — constrain wheels to vertical travel
new LineJoint(chassis, fWheel, new Vec2(offX, chassisH/2), new Vec2(0,0), new Vec2(0,1), -5, 40).space = space;
new LineJoint(chassis, rWheel, new Vec2(-offX, chassisH/2), new Vec2(0,0), new Vec2(0,1), -5, 40).space = space;

// Motor (rate controlled by keyboard)
const motor = new MotorJoint(chassis, rWheel, 0);
motor.space = space;
const RATE = 8;

const keys = {};
window.addEventListener("keydown", (e) => {
  keys[e.code] = true;
  if (e.code === "ArrowLeft" || e.code === "ArrowRight") e.preventDefault();
});
window.addEventListener("keyup", (e) => { keys[e.code] = false; });

function loop() {
  const left = keys["ArrowLeft"] || keys["KeyA"];
  const right = keys["ArrowRight"] || keys["KeyD"];
  motor.rate = right ? -RATE : left ? RATE : 0;

  space.step(1 / 60, 8, 3);
  drawGrid();
  drawConstraintLines();
  syncBodies(space);
  app.render();
  requestAnimationFrame(loop);
}
loop();`,
};
