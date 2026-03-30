import {
  Body, BodyType, Vec2, Circle, Polygon, Material,
  CbType, CbEvent, InteractionType, InteractionListener,
} from "../nape-js.esm.js";

// ── Module-level state ───────────────────────────────────────────────────────
const keys = {};
let _lFlipper = null, _rFlipper = null;
let _lPivot = null, _rPivot = null;
let _flipW = 0;

const FLIP_REST = 0.4;       // resting angle (tips pointing down-outward)
const FLIP_ACTIVE = -0.4;    // flipped angle (tips pointing up-outward)
const FLIP_SPEED = 14;       // rad/s angular velocity cap
const BUMPER_IMPULSE = 350;

export default {
  id: "pinball",
  label: "Pinball",
  featured: false,
  tags: ["Circle", "Restitution", "Bumpers"],
  desc: "Pinball with active bumpers and flippers. Left/Right arrows or A/D to flip. Click left/right half to flip on mobile. Click upper area to spawn balls.",
  walls: false,
  workerCompatible: false,

  setup(space, W, H) {
    space.gravity = new Vec2(0, 600);

    const bumperType = new CbType();
    const ballType = new CbType();

    // ── Layout constants ─────────────────────────────────────────────────
    const wallT = 12;
    const flipY = H - 40;             // flipper Y position
    const drainGap = W * 0.28;        // gap width between flippers
    const lPivotX = W / 2 - drainGap / 2;  // left flipper pivot (inner)
    const rPivotX = W / 2 + drainGap / 2;  // right flipper pivot (inner)

    // Guide walls start from outer edge, angle down to the flipper pivot
    const guideTopY = H * 0.6;

    // ── Table walls ──────────────────────────────────────────────────────
    const wallB = (x, y, w, h) => {
      const b = new Body(BodyType.STATIC, new Vec2(x, y));
      b.shapes.add(new Polygon(Polygon.box(w, h)));
      b.space = space;
    };
    wallB(wallT / 2, H / 2, wallT, H);           // left
    wallB(W - wallT / 2, H / 2, wallT, H);       // right
    wallB(W / 2, wallT / 2, W, wallT);           // top

    // Bottom floor — two segments with drain gap in center
    const floorSegW = (W - drainGap) / 2;
    wallB(floorSegW / 2, H - wallT / 2, floorSegW, wallT);
    wallB(W - floorSegW / 2, H - wallT / 2, floorSegW, wallT);

    // ── Drain guides (angled walls leading to flipper pivots) ────────────
    // Left guide: from left wall area down to left flipper pivot
    const lGuide = new Body(BodyType.STATIC);
    lGuide.shapes.add(new Polygon([
      new Vec2(wallT, guideTopY),
      new Vec2(wallT + 8, guideTopY),
      new Vec2(lPivotX + 8, flipY),
      new Vec2(lPivotX, flipY),
    ]));
    lGuide.space = space;

    // Right guide: from right wall area down to right flipper pivot
    const rGuide = new Body(BodyType.STATIC);
    rGuide.shapes.add(new Polygon([
      new Vec2(W - wallT - 8, guideTopY),
      new Vec2(W - wallT, guideTopY),
      new Vec2(rPivotX, flipY),
      new Vec2(rPivotX - 8, flipY),
    ]));
    rGuide.space = space;

    // ── Bumpers — active impulse on contact ──────────────────────────────
    const bumperMat = new Material(1.2, 0, 0, 1);
    const bumpers = [
      { x: W * 0.3,  y: H * 0.15, r: 20 },
      { x: W * 0.7,  y: H * 0.15, r: 20 },
      { x: W * 0.5,  y: H * 0.28, r: 24 },
      { x: W * 0.22, y: H * 0.42, r: 18 },
      { x: W * 0.78, y: H * 0.42, r: 18 },
      { x: W * 0.5,  y: H * 0.52, r: 16 },
    ];

    for (const pos of bumpers) {
      const bumper = new Body(BodyType.STATIC, new Vec2(pos.x, pos.y));
      bumper.shapes.add(new Circle(pos.r, undefined, bumperMat));
      bumper.shapes.at(0).cbTypes.add(bumperType);
      bumper.space = space;
    }

    // Listener: on ball→bumper BEGIN, apply impulse away from bumper center
    const bumperListener = new InteractionListener(
      CbEvent.BEGIN,
      InteractionType.COLLISION,
      bumperType,
      ballType,
      (cb) => {
        const b1 = cb.int1.castBody ?? cb.int1.castShape?.body;
        const b2 = cb.int2.castBody ?? cb.int2.castShape?.body;
        const ball = b1?.isDynamic() ? b1 : b2;
        const bumper = b1?.isStatic() ? b1 : b2;
        if (!ball || !bumper) return;
        const dx = ball.position.x - bumper.position.x;
        const dy = ball.position.y - bumper.position.y;
        const dist = Math.sqrt(dx * dx + dy * dy) || 1;
        ball.applyImpulse(new Vec2(dx / dist * BUMPER_IMPULSE, dy / dist * BUMPER_IMPULSE));
      },
    );
    space.listeners.add(bumperListener);

    // ── Flippers (kinematic — driven via velocity each step) ─────────────
    //
    // Layout:
    //   Left flipper:  pivot at lPivotX, paddle extends LEFT (outward)
    //   Right flipper: pivot at rPivotX, paddle extends RIGHT (outward)
    //
    // Rest: tips hang down-outward (+FLIP_REST for left, -FLIP_REST for right)
    // Active: tips swing up-outward
    _flipW = W * 0.12;
    const flipH = 10;

    _lPivot = new Vec2(lPivotX, flipY);
    _rPivot = new Vec2(rPivotX, flipY);

    // Helper: given a rotation, compute body position so that a local
    // offset point stays fixed at the given world pivot.
    //   worldPivot = bodyPos + rotate(localOffset, rotation)
    //   bodyPos = worldPivot - rotate(localOffset, rotation)
    function posFromPivot(pivot, localX, localY, rot) {
      const c = Math.cos(rot), s = Math.sin(rot);
      return {
        x: pivot.x - (localX * c - localY * s),
        y: pivot.y - (localX * s + localY * c),
      };
    }

    // Left flipper — pivot at its LEFT end (-flipW/2, 0), paddle extends right
    _lFlipper = new Body(BodyType.KINEMATIC);
    _lFlipper.shapes.add(new Polygon(Polygon.box(_flipW, flipH)));
    _lFlipper.rotation = FLIP_REST;
    const lp = posFromPivot(_lPivot, -_flipW / 2, 0, FLIP_REST);
    _lFlipper.position.setxy(lp.x, lp.y);
    _lFlipper.space = space;

    // Right flipper — pivot at its RIGHT end (+flipW/2, 0), paddle extends left
    _rFlipper = new Body(BodyType.KINEMATIC);
    _rFlipper.shapes.add(new Polygon(Polygon.box(_flipW, flipH)));
    _rFlipper.rotation = -FLIP_REST;
    const rp = posFromPivot(_rPivot, _flipW / 2, 0, -FLIP_REST);
    _rFlipper.position.setxy(rp.x, rp.y);
    _rFlipper.space = space;

    // ── Balls ────────────────────────────────────────────────────────────
    const ballMat = new Material(0.5, 0.2, 0.1, 3);
    const b = new Body(BodyType.DYNAMIC, new Vec2(W * 0.35, H * 0.05));
    b.shapes.add(new Circle(8, undefined, ballMat));
    b.shapes.at(0).cbTypes.add(ballType);
    try { b.userData._colorIdx = 0; } catch (_) {}
    b.space = space;

    space._ballType = ballType;

    // ── Keyboard ─────────────────────────────────────────────────────────
    window.addEventListener("keydown", (e) => {
      keys[e.code] = true;
      if (e.code === "ArrowLeft" || e.code === "ArrowRight") e.preventDefault();
    });
    window.addEventListener("keyup", (e) => { keys[e.code] = false; });
  },

  step(space) {
    if (!_lFlipper || !_rFlipper) return;

    const lActive = keys["ArrowLeft"] || keys["KeyA"] || keys._touchLeft;
    const rActive = keys["ArrowRight"] || keys["KeyD"] || keys._touchRight;
    const hw = _flipW / 2;
    const dt = 1 / 60;

    // Helper: compute body center so that localOffset stays at worldPivot
    function pivotPos(pivot, lx, ly, rot) {
      const c = Math.cos(rot), s = Math.sin(rot);
      return {
        x: pivot.x - (lx * c - ly * s),
        y: pivot.y - (lx * s + ly * c),
      };
    }

    // Left flipper — pivot local offset is (-hw, 0)
    const lTarget = lActive ? FLIP_ACTIVE : FLIP_REST;
    const lDiff = lTarget - _lFlipper.rotation;
    const lAngVel = Math.max(-FLIP_SPEED, Math.min(FLIP_SPEED, lDiff * 30));
    _lFlipper.angularVel = lAngVel;
    const lNextRot = Math.max(FLIP_ACTIVE, Math.min(FLIP_REST, _lFlipper.rotation + lAngVel * dt));
    const lPos = pivotPos(_lPivot, -hw, 0, lNextRot);
    _lFlipper.velocity.setxy(
      (lPos.x - _lFlipper.position.x) / dt,
      (lPos.y - _lFlipper.position.y) / dt,
    );

    // Right flipper — pivot local offset is (+hw, 0)
    const rTarget = rActive ? -FLIP_ACTIVE : -FLIP_REST;
    const rDiff = rTarget - _rFlipper.rotation;
    const rAngVel = Math.max(-FLIP_SPEED, Math.min(FLIP_SPEED, rDiff * 30));
    _rFlipper.angularVel = rAngVel;
    const rNextRot = Math.max(-FLIP_REST, Math.min(-FLIP_ACTIVE, _rFlipper.rotation + rAngVel * dt));
    const rPos = pivotPos(_rPivot, hw, 0, rNextRot);
    _rFlipper.velocity.setxy(
      (rPos.x - _rFlipper.position.x) / dt,
      (rPos.y - _rFlipper.position.y) / dt,
    );

    // Respawn balls that fall through the drain
    for (const body of space.bodies) {
      if (!body.isDynamic()) continue;
      if (body.position.y > _lPivot.y + 80) {
        body.position.setxy(
          _lPivot.x + Math.random() * (_rPivot.x - _lPivot.x),
          30,
        );
        body.velocity.setxy(0, 0);
        body.angularVel = 0;
      }
    }
  },

  click(x, y, space, W, H) {
    if (y > H * 0.6) {
      // Hold flipper active until release
      if (x < W / 2) {
        keys._touchLeft = true;
      } else {
        keys._touchRight = true;
      }
      return;
    }
    const ballMat = new Material(0.5, 0.2, 0.1, 3);
    const b = new Body(BodyType.DYNAMIC, new Vec2(x, y));
    b.shapes.add(new Circle(8, undefined, ballMat));
    if (space._ballType) b.shapes.at(0).cbTypes.add(space._ballType);
    try { b.userData._colorIdx = Math.floor(Math.random() * 6); } catch (_) {}
    b.space = space;
  },

  release() {
    keys._touchLeft = false;
    keys._touchRight = false;
  },

  code2d: `// Pinball — active bumpers + kinematic flippers
const space = new Space(new Vec2(0, 600));
const W = canvas.width, H = canvas.height;
addWalls();

// Bumpers push balls away on contact
const bumperType = new CbType(), ballType = new CbType();
const bumperMat = new Material(1.2, 0, 0, 1);
[[W*0.3,H*0.15,20],[W*0.7,H*0.15,20],[W*0.5,H*0.28,24],
 [W*0.22,H*0.42,18],[W*0.78,H*0.42,18],[W*0.5,H*0.52,16]]
  .forEach(([x,y,r]) => {
    const b = new Body(BodyType.STATIC, new Vec2(x, y));
    b.shapes.add(new Circle(r, undefined, bumperMat));
    b.shapes.at(0).cbTypes.add(bumperType);
    b.space = space;
  });

space.listeners.add(new InteractionListener(
  CbEvent.BEGIN, InteractionType.COLLISION,
  bumperType, ballType, (cb) => {
    const b1 = cb.int1.castBody ?? cb.int1.castShape?.body;
    const b2 = cb.int2.castBody ?? cb.int2.castShape?.body;
    const ball = b1?.isDynamic() ? b1 : b2;
    const bumper = b1?.isStatic() ? b1 : b2;
    if (!ball || !bumper) return;
    const dx = ball.position.x - bumper.position.x;
    const dy = ball.position.y - bumper.position.y;
    const d = Math.sqrt(dx*dx+dy*dy)||1;
    ball.applyImpulse(new Vec2(dx/d*350, dy/d*350));
  }));

// Kinematic flippers — driven via angularVel + velocity each step
const flipW = W * 0.18, flipY = H - 40;
const lFlip = new Body(BodyType.KINEMATIC);
lFlip.shapes.add(new Polygon(Polygon.box(flipW, 10)));
lFlip.rotation = 0.4;
lFlip.position.setxy(W*0.36 - flipW/2, flipY);
lFlip.space = space;

for (let i = 0; i < 5; i++) {
  const b = new Body(BodyType.DYNAMIC, new Vec2(
    W*0.25+Math.random()*W*0.5, H*0.05+Math.random()*H*0.12));
  b.shapes.add(new Circle(8, undefined, new Material(0.5,0.2,0.1,3)));
  b.shapes.at(0).cbTypes.add(ballType);
  b.space = space;
}

const keys = {};
window.addEventListener("keydown", e => { keys[e.code] = true; });
window.addEventListener("keyup", e => { keys[e.code] = false; });

function loop() {
  const target = keys["ArrowLeft"] ? -0.4 : 0.4;
  lFlip.angularVel = Math.max(-14, Math.min(14, (target - lFlip.rotation) * 30));
  space.step(1/60,8,3);
  ctx.clearRect(0,0,W,H); drawGrid();
  for (const body of space.bodies) drawBody(body);
  requestAnimationFrame(loop);
}
loop();`,

  codePixi: `// Pinball — active bumpers + kinematic flippers
const space = new Space(new Vec2(0, 600));
addWalls();

const bumperType = new CbType(), ballType = new CbType();
const bumperMat = new Material(1.2, 0, 0, 1);
[[W*0.3,H*0.15,20],[W*0.7,H*0.15,20],[W*0.5,H*0.28,24],
 [W*0.22,H*0.42,18],[W*0.78,H*0.42,18],[W*0.5,H*0.52,16]]
  .forEach(([x,y,r]) => {
    const b = new Body(BodyType.STATIC, new Vec2(x, y));
    b.shapes.add(new Circle(r, undefined, bumperMat));
    b.shapes.at(0).cbTypes.add(bumperType);
    b.space = space;
  });

space.listeners.add(new InteractionListener(
  CbEvent.BEGIN, InteractionType.COLLISION,
  bumperType, ballType, (cb) => {
    const b1 = cb.int1.castBody ?? cb.int1.castShape?.body;
    const b2 = cb.int2.castBody ?? cb.int2.castShape?.body;
    const ball = b1?.isDynamic() ? b1 : b2;
    const bumper = b1?.isStatic() ? b1 : b2;
    if (!ball || !bumper) return;
    const dx = ball.position.x - bumper.position.x;
    const dy = ball.position.y - bumper.position.y;
    const d = Math.sqrt(dx*dx+dy*dy)||1;
    ball.applyImpulse(new Vec2(dx/d*350, dy/d*350));
  }));

const flipW = W * 0.18, flipY = H - 40;
const lFlip = new Body(BodyType.KINEMATIC);
lFlip.shapes.add(new Polygon(Polygon.box(flipW, 10)));
lFlip.rotation = 0.4;
lFlip.position.setxy(W*0.36 - flipW/2, flipY);
lFlip.space = space;

for (let i = 0; i < 5; i++) {
  const b = new Body(BodyType.DYNAMIC, new Vec2(
    W*0.25+Math.random()*W*0.5, H*0.05+Math.random()*H*0.12));
  b.shapes.add(new Circle(8, undefined, new Material(0.5,0.2,0.1,3)));
  b.shapes.at(0).cbTypes.add(ballType);
  b.space = space;
}

const keys = {};
window.addEventListener("keydown", e => { keys[e.code] = true; });
window.addEventListener("keyup", e => { keys[e.code] = false; });

function loop() {
  const target = keys["ArrowLeft"] ? -0.4 : 0.4;
  lFlip.angularVel = Math.max(-14, Math.min(14, (target - lFlip.rotation) * 30));
  space.step(1/60,8,3); drawGrid(); syncBodies(space);
  app.render(); requestAnimationFrame(loop);
}
loop();`,
};
