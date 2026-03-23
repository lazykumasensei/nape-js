import {
  Body, BodyType, Vec2, Circle, Polygon, Material, CbType, CbEvent,
  InteractionType, InteractionListener, PreListener, PreFlag,
  CharacterController, FluidProperties,
} from "../nape-js.esm.js";
import { drawBody, drawConstraints, drawGrid, COLORS } from "../renderer.js";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const WORLD_W = 3200;
const WORLD_H = 600;
const PLAYER_R = 14;
const ONEWAY_GROUP = 1 << 9;
const GRAVITY = 600;
const MOVE_SPEED = 180;
const JUMP_SPEED = 380;
const COYOTE_MS = 100;
const JUMP_BUFFER_MS = 100;
const DT = 1 / 60;

// ---------------------------------------------------------------------------
// State
// ---------------------------------------------------------------------------

let player = null;
let cc = null;
let keys = {};
let prevJumpKey = false;
let jumpBufferTimer = 0;
let velY = 0;
let playerFacingRight = true;
let coinCount = 0;
let coinPopups = []; // { x, y, timer }

// ---------------------------------------------------------------------------
// Demo definition
// ---------------------------------------------------------------------------

export default {
  id: "character-controller",
  label: "Character Controller",
  featured: true,
  featuredOrder: 11,
  tags: ["CharacterController", "Platformer", "Camera", "One-Way", "Slope"],
  desc: "WASD/Arrow keys to move, <b>Space</b> to jump. Features: slopes, one-way platforms, moving platforms, coyote time. Uses the built-in <code>CharacterController</code> class with dynamic body physics.",
  walls: false,
  canvas2dOnly: true,

  camera: null,

  setup(space, W, H) {
    space.gravity = new Vec2(0, GRAVITY);

    const platformTag = new CbType();
    const playerTag = new CbType();
    const coinTag = new CbType();

    const floorY = WORLD_H - 10;

    // ---- Floor (with gaps for hPlat zone and water) ----
    // x: 0–1600 | gap 1600–1950 (hPlat) | 1950–2160 | gap 2160–2640 (water) | 2640–3200
    addStaticBox(space, 800, floorY, 1600, 20);
    addStaticBox(space, 2055, floorY, 210, 20);
    addStaticBox(space, 2920, floorY, 560, 20);

    // ---- Left/right walls ----
    addStaticBox(space, -10, WORLD_H / 2, 20, WORLD_H);
    addStaticBox(space, WORLD_W + 10, WORLD_H / 2, 20, WORLD_H);

    // ---- Section 1: One-way platforms (x: 0–600) ----
    addStaticBox(space, 150, 500, 200, 16);
    addOneWay(space, 100, 440, 120, platformTag);
    addOneWay(space, 280, 370, 100, platformTag);
    addOneWay(space, 130, 300, 120, platformTag);
    addOneWay(space, 380, 330, 80, platformTag);

    // Ground-level coins (easy to reach)
    addCoin(space, 200, floorY - 30, coinTag);
    addCoin(space, 300, floorY - 30, coinTag);
    addCoin(space, 400, floorY - 30, coinTag);
    // Platform coins
    addCoin(space, 100, 418, coinTag);
    addCoin(space, 280, 348, coinTag);
    addCoin(space, 380, 308, coinTag);

    // ---- Section 2: Steps (x: 500–900) ----
    const stepBase = floorY - 10;
    for (let i = 0; i < 6; i++) {
      addStaticBox(space, 580 + i * 36, stepBase - i * 10, 34, 10 + i * 10);
    }
    addCoin(space, 760, stepBase - 90, coinTag);

    // ---- Section 3: Slopes (x: 900–1500) ----
    addSlopeRamp(space, 950, floorY - 10, 300, 80, false);
    addStaticBox(space, 1200, floorY - 80, 200, 16);
    addSlopeRamp(space, 1400, floorY - 10, 200, 80, true);
    addCoin(space, 1200, floorY - 110, coinTag);
    addCoin(space, 1050, floorY - 50, coinTag);

    // ---- Section 4: Moving platforms (x: 1500–2100) ----
    addStaticBox(space, 1550, floorY, 100, 20);

    // Catch floor under hPlat gap
    addStaticBox(space, 1775, floorY + 80, 350, 20);

    const hPlat = new Body(BodyType.KINEMATIC, new Vec2(1750, floorY + 20));
    hPlat.shapes.add(new Polygon(Polygon.box(100, 12), new Material(0, 2, 2, 1)));
    hPlat.space = space;
    hPlat._hMoving = { minX: 1650, maxX: 1900, speed: 80 };

    const vPlat = new Body(BodyType.KINEMATIC, new Vec2(2000, floorY - 100));
    vPlat.shapes.add(new Polygon(Polygon.box(80, 12)));
    vPlat.space = space;
    vPlat._vMoving = { minY: floorY - 200, maxY: floorY - 50, speed: 60 };

    addStaticBox(space, 2100, floorY - 200, 100, 16);
    addCoin(space, 2100, floorY - 230, coinTag);
    addCoin(space, 1750, floorY - 80, coinTag);

    // ---- Section 5: Water (x: 2160–2640) ----
    const poolL = 2160, poolR = 2640, poolCX = 2400;
    const poolTop = floorY, poolBot = floorY + 110;
    const poolH = poolBot - poolTop;
    addStaticBox(space, poolCX, poolBot, poolR - poolL + 20, 20);
    addStaticBox(space, poolL - 10, poolTop + poolH / 2, 20, poolH);
    addStaticBox(space, poolR + 10, poolTop + poolH / 2, 20, poolH);

    const water = new Body(BodyType.STATIC, new Vec2(poolCX, poolTop + poolH / 2));
    const waterShape = new Polygon(Polygon.box(poolR - poolL, poolH));
    waterShape.fluidEnabled = true;
    waterShape.fluidProperties = new FluidProperties(1.5, 3);
    water.shapes.add(waterShape);
    water.space = space;
    water._isWater = true;
    water._waterW = poolR - poolL;
    water._waterH = poolH;

    addCoin(space, 2300, floorY + 20, coinTag);
    addCoin(space, 2500, floorY + 20, coinTag);

    // ---- Section 6: Wall zone (x: 2600–2900) ----
    addStaticBox(space, 2700, floorY - 80, 16, 160);
    addStaticBox(space, 2800, floorY - 80, 16, 160);
    addOneWay(space, 2750, floorY - 170, 80, platformTag);
    addCoin(space, 2750, floorY - 200, coinTag);

    // ---- Section 7: Final stretch (x: 2900–3100) ----
    addOneWay(space, 2950, 400, 100, platformTag);
    addOneWay(space, 3050, 330, 80, platformTag);
    addStaticBox(space, 3100, 280, 100, 16);
    addCoin(space, 3100, 250, coinTag);

    // ---- Player (dynamic body) ----
    player = new Body(BodyType.DYNAMIC, new Vec2(100, floorY - 30));
    const playerShape = new Circle(PLAYER_R, undefined, new Material(0, 0.3, 0.3, 1));
    playerShape.cbTypes.add(playerTag);
    player.shapes.add(playerShape);
    player.allowRotation = false;
    player.isBullet = true;
    player.space = space;
    try { player.userData._colorIdx = 3; } catch (_) {}

    // ---- Coin pickup listener ----
    const coinListener = new InteractionListener(
      CbEvent.BEGIN,
      InteractionType.SENSOR,
      playerTag,
      coinTag,
      (cb) => {
        // int1/int2 may be Shape (cbType on shape) — get the body via .castShape.body
        let coinBody = null;
        const i1 = cb.int1;
        const i2 = cb.int2;
        const b1 = i1.castBody ?? i1.castShape?.body ?? null;
        const b2 = i2.castBody ?? i2.castShape?.body ?? null;
        coinBody = (b1 && b1 !== player) ? b1 : (b2 && b2 !== player) ? b2 : null;
        if (coinBody && coinBody.space) {
          const cx = coinBody.position.x;
          const cy = coinBody.position.y;
          coinBody.space = null;
          coinCount++;
          coinPopups.push({ x: cx, y: cy - 10, timer: 1.0 });
        }
      },
    );
    coinListener.space = space;

    // ---- Character Controller ----
    cc = new CharacterController(space, player, {
      maxSlopeAngle: Math.PI / 3,
      oneWayPlatformTag: platformTag,
      characterTag: playerTag,
    });

    // Camera
    this.camera = {
      follow: player,
      offsetX: 0,
      offsetY: -30,
      bounds: { minX: 0, minY: 0, maxX: WORLD_W, maxY: WORLD_H + 120 },
      lerp: 0.12,
    };

    // Reset state
    keys = {};
    prevJumpKey = false;
    jumpBufferTimer = 0;
    velY = 0;
    playerFacingRight = true;
    coinCount = 0;
    coinPopups = [];

    // Keyboard handling
    this._onKeyDown = (e) => {
      keys[e.code] = true;
      if (e.code === "Space" || e.code === "ArrowUp" || e.code === "KeyW") {
        e.preventDefault();
      }
    };
    this._onKeyUp = (e) => { keys[e.code] = false; };
    window.addEventListener("keydown", this._onKeyDown);
    window.addEventListener("keyup", this._onKeyUp);
  },

  // step() runs BEFORE space.step() in DemoRunner
  step(space, W, H) {
    if (!cc || !player) return;

    // ---- Update moving platforms ----
    for (const body of space.bodies) {
      if (body._hMoving) {
        const m = body._hMoving;
        const px = body.position.x;
        if (!m._dir) m._dir = 1;
        if (px >= m.maxX) m._dir = -1;
        if (px <= m.minX) m._dir = 1;
        body.velocity = new Vec2(m._dir * m.speed, 0);
        body.surfaceVel = new Vec2(-m._dir * m.speed, 0);
      }
      if (body._vMoving) {
        const m = body._vMoving;
        const py = body.position.y;
        if (!m._dir) m._dir = 1;
        if (py >= m.maxY) m._dir = -1;
        if (py <= m.minY) m._dir = 1;
        body.velocity = new Vec2(0, m._dir * m.speed);
      }
    }

    // ---- Input ----
    const left = keys["ArrowLeft"] || keys["KeyA"];
    const right = keys["ArrowRight"] || keys["KeyD"];
    const jumpKey = keys["Space"] || keys["ArrowUp"] || keys["KeyW"];

    const jumpJustPressed = jumpKey && !prevJumpKey;
    prevJumpKey = jumpKey;

    let moveX = 0;
    if (left) { moveX = -MOVE_SPEED; playerFacingRight = false; }
    if (right) { moveX = MOVE_SPEED; playerFacingRight = true; }

    // ---- Query state from last frame ----
    const result = cc.update();

    // Check if player is in water (has active fluid arbiters)
    let inWater = false;
    try {
      const arbs = space.arbiters;
      const arbCount = arbs.zpp_gl();
      for (let i = 0; i < arbCount; i++) {
        const a = arbs.at(i);
        if (a.isFluidArbiter() && (a.body1 === player || a.body2 === player)) {
          inWater = true;
          break;
        }
      }
    } catch (_) {}

    // ---- Vertical velocity ----
    velY = player.velocity.y;

    // Jump buffering
    if (jumpJustPressed) {
      jumpBufferTimer = JUMP_BUFFER_MS;
    } else {
      jumpBufferTimer = Math.max(0, jumpBufferTimer - 1000 * DT);
    }

    // Jump / swim
    const canJump = result.grounded || result.timeSinceGrounded * 1000 < COYOTE_MS || inWater;
    let jumped = false;
    if (jumpBufferTimer > 0 && canJump) {
      velY = inWater ? -JUMP_SPEED * 0.7 : -JUMP_SPEED;
      jumpBufferTimer = 0;
      jumped = true;
    }

    // Variable jump height — cut upward velocity on release (not in water)
    if (!inWater && !jumpKey && velY < 0) {
      velY *= 0.85;
    }

    // Apply velocity — only override what's needed, preserve engine physics
    const curVx = player.velocity.x;
    const curVy = player.velocity.y;

    // Horizontal: blend input toward desired speed without killing friction
    let targetVx = moveX; // desired input velocity
    let newVx;
    if (result.grounded) {
      // On ground: snap to desired speed (friction handles platform carry)
      newVx = targetVx || curVx; // if no input, keep engine velocity (friction)
    } else {
      // In air: direct control
      newVx = targetVx;
    }

    // Vertical
    let newVy = curVy; // default: let engine handle gravity/buoyancy
    if (jumped) {
      newVy = velY;
    } else if (!jumpKey && curVy < 0 && !inWater) {
      newVy = velY; // variable jump height cut
    }

    player.velocity = new Vec2(newVx, newVy);

    // Clamp player to world bounds
    const px = player.position.x;
    const py = player.position.y;
    if (px < PLAYER_R || px > WORLD_W - PLAYER_R) {
      player.position = new Vec2(
        Math.max(PLAYER_R, Math.min(WORLD_W - PLAYER_R, px)),
        py,
      );
    }

    // Update coin popups
    for (let i = coinPopups.length - 1; i >= 0; i--) {
      coinPopups[i].timer -= DT;
      coinPopups[i].y -= 30 * DT; // float upward
      if (coinPopups[i].timer <= 0) coinPopups.splice(i, 1);
    }
  },

  // ---- Custom render (camera-aware) ----
  render(ctx, space, W, H, showOutlines, camX = 0, camY = 0) {
    ctx.save();
    ctx.translate(-camX, -camY);

    drawGrid(ctx, W, H, camX, camY);

    // Water zones
    for (const body of space.bodies) {
      if (body._isWater) {
        const px = body.position.x;
        const py = body.position.y;
        const hw = (body._waterW || 480) / 2;
        const hh = (body._waterH || 80) / 2;
        ctx.fillStyle = "rgba(50,120,220,0.15)";
        ctx.fillRect(px - hw, py - hh, hw * 2, hh * 2);
        ctx.strokeStyle = "rgba(80,160,255,0.3)";
        ctx.lineWidth = 1;
        ctx.beginPath();
        const waveY = py - hh;
        for (let x = px - hw; x <= px + hw; x += 4) {
          const wy = waveY + Math.sin((x + performance.now() * 0.003) * 0.05) * 3;
          x === px - hw ? ctx.moveTo(x, wy) : ctx.lineTo(x, wy);
        }
        ctx.stroke();
      }
    }

    // Bodies
    drawConstraints(ctx, space);
    for (const body of space.bodies) {
      if (body._isWater) continue;
      drawBody(ctx, body, showOutlines);
    }

    // Player eye
    if (player) {
      const px = player.position.x;
      const py = player.position.y;
      ctx.fillStyle = cc?.grounded ? "#3fb950" : "#f85149";
      ctx.beginPath();
      ctx.arc(px + (playerFacingRight ? 5 : -5), py - 6, 2, 0, Math.PI * 2);
      ctx.fill();
    }

    // Coin pickup popups (world space)
    for (const p of coinPopups) {
      const alpha = Math.min(1, p.timer * 2);
      ctx.fillStyle = `rgba(210,153,34,${alpha})`;
      ctx.font = "bold 14px monospace";
      ctx.textAlign = "center";
      ctx.fillText("+1", p.x, p.y);
    }
    ctx.textAlign = "left";

    ctx.restore();

    // ---- HUD (screen space) ----
    ctx.fillStyle = "rgba(255,255,255,0.7)";
    ctx.font = "12px monospace";
    ctx.fillText("WASD / Arrow keys to move, Space to jump", 10, 20);

    // Coin counter
    ctx.fillStyle = "#d29922";
    ctx.fillText(`\u25CF ${coinCount}`, W - 60, 20);

    if (cc) {
      const state = cc.grounded ? "GROUNDED" : "AIRBORNE";
      ctx.fillStyle = cc.grounded ? "#3fb950" : "#f85149";
      ctx.fillText(state, 10, 40);
      if (cc.timeSinceGrounded > 0 && cc.timeSinceGrounded * 1000 < COYOTE_MS) {
        ctx.fillStyle = "#d29922";
        ctx.fillText("COYOTE", 100, 40);
      }
    }

    // Legend
    const ly = H - 12;
    ctx.font = "10px monospace";
    ctx.fillStyle = "#a371f7";
    ctx.fillText("\u25AC one-way (jump through)", 10, ly);
    ctx.fillStyle = "#607888";
    ctx.fillText("\u25AC solid", 200, ly);
    ctx.fillStyle = "#d29922";
    ctx.fillText("\u25CF coin", 260, ly);
  },

  click(x, y, space, W, H) {
    const b = new Body(BodyType.DYNAMIC, new Vec2(x, y));
    b.shapes.add(new Circle(8));
    b.space = space;
  },
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function addStaticBox(space, cx, cy, w, h) {
  const b = new Body(BodyType.STATIC, new Vec2(cx, cy));
  b.shapes.add(new Polygon(Polygon.box(w, h)));
  b.space = space;
  return b;
}

function addOneWay(space, cx, cy, w, platformTag) {
  const b = new Body(BodyType.STATIC, new Vec2(cx, cy));
  const shape = new Polygon(Polygon.box(w, 8));
  shape.cbTypes.add(platformTag);
  shape.filter.collisionGroup = ONEWAY_GROUP;
  b.shapes.add(shape);
  b.space = space;
  try { b.userData._colorIdx = 4; } catch (_) {}
  return b;
}

function addCoin(space, cx, cy, coinTag) {
  const b = new Body(BodyType.STATIC, new Vec2(cx, cy));
  const shape = new Circle(5);
  shape.sensorEnabled = true;
  if (coinTag) shape.cbTypes.add(coinTag);
  b.shapes.add(shape);
  b.space = space;
  try { b.userData._colorIdx = 1; } catch (_) {}
  return b;
}

function addSlopeRamp(space, startX, baseY, length, height, goingDown) {
  const cx = startX + length / 2;
  const cy = baseY - height / 2;
  const angle = Math.atan2(goingDown ? height : -height, length);
  const len = Math.sqrt(length * length + height * height);

  const b = new Body(BodyType.STATIC, new Vec2(cx, cy));
  b.shapes.add(new Polygon(Polygon.box(len, 12)));
  b.rotation = angle;
  b.space = space;
  return b;
}
