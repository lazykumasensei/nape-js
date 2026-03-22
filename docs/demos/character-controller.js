import {
  Body, BodyType, Vec2, Circle, Polygon, Material, CbType,
  InteractionType, PreListener, PreFlag, CharacterController,
  FluidProperties, InteractionFilter,
} from "../nape-js.esm.js";
import { drawBody, drawConstraints, drawGrid, COLORS } from "../renderer.js";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const WORLD_W = 3200;
const WORLD_H = 600;
const PLAYER_R = 14;
const ONEWAY_GROUP = 1 << 9; // must match CharacterController default
const GRAVITY = 980;
const MOVE_SPEED = 180;
const JUMP_SPEED = 420;
const COYOTE_MS = 100;
const JUMP_BUFFER_MS = 100;
const DT = 1 / 60;

// ---------------------------------------------------------------------------
// State
// ---------------------------------------------------------------------------

let player = null;
let cc = null; // CharacterController
let keys = {};
let prevJumpKey = false; // for edge detection
let jumpBufferTimer = 0;
let velY = 0; // vertical velocity (px/s), positive = downward
let playerFacingRight = true;

// ---------------------------------------------------------------------------
// Demo definition
// ---------------------------------------------------------------------------

export default {
  id: "character-controller",
  label: "Character Controller",
  featured: true,
  featuredOrder: 11,
  tags: ["CharacterController", "Platformer", "Camera", "One-Way", "Slope"],
  desc: "WASD/Arrow keys to move, <b>Space</b> to jump. Features: slopes, one-way platforms, step climbing, moving platforms, coyote time. Uses the built-in <code>CharacterController</code> class.",
  walls: false,
  canvas2dOnly: true,

  // Camera config — follow the player, clamp to world bounds
  camera: null, // set in setup() after player body is created

  setup(space, W, H) {
    space.gravity = new Vec2(0, GRAVITY);

    const platformTag = new CbType();
    const playerTag = new CbType();

    // ---- Floor ----
    const floorY = WORLD_H - 10;
    addStaticBox(space, WORLD_W / 2, floorY, WORLD_W, 20);

    // ---- Left/right walls ----
    addStaticBox(space, -10, WORLD_H / 2, 20, WORLD_H);
    addStaticBox(space, WORLD_W + 10, WORLD_H / 2, 20, WORLD_H);

    // ---- Section 1: Flat platforms + one-way platforms (x: 0–600) ----
    addStaticBox(space, 150, 500, 200, 16);
    // One-way platforms — staggered for jumping
    addOneWay(space, 100, 440, 120, platformTag);
    addOneWay(space, 280, 370, 100, platformTag);
    addOneWay(space, 130, 300, 120, platformTag);
    addOneWay(space, 380, 330, 80, platformTag);

    // Coins on one-way platforms
    addCoin(space, 100, 418);
    addCoin(space, 280, 348);
    addCoin(space, 380, 308);

    // ---- Section 2: Steps / stair climbing (x: 500–900) ----
    const stepBase = floorY - 10;
    for (let i = 0; i < 6; i++) {
      addStaticBox(space, 580 + i * 36, stepBase - i * 10, 34, 10 + i * 10);
    }
    addCoin(space, 760, stepBase - 80);

    // ---- Section 3: Slopes (x: 900–1500) ----
    addSlopeRamp(space, 950, floorY - 10, 300, 80, false);
    addStaticBox(space, 1200, floorY - 80, 200, 16); // Flat top
    addSlopeRamp(space, 1400, floorY - 10, 200, 80, true); // Down slope
    addCoin(space, 1200, floorY - 110);
    addCoin(space, 1100, floorY - 50);

    // ---- Section 4: Moving platforms (x: 1500–2100) ----
    addStaticBox(space, 1550, floorY, 100, 20);

    // Horizontal moving platform
    const hPlat = new Body(BodyType.KINEMATIC, new Vec2(1750, floorY - 50));
    hPlat.shapes.add(new Polygon(Polygon.box(100, 12)));
    hPlat.space = space;
    hPlat._hMoving = { minX: 1650, maxX: 1900, speed: 80 };

    // Vertical moving platform
    const vPlat = new Body(BodyType.KINEMATIC, new Vec2(2000, floorY - 100));
    vPlat.shapes.add(new Polygon(Polygon.box(80, 12)));
    vPlat.space = space;
    vPlat._vMoving = { minY: floorY - 200, maxY: floorY - 50, speed: 60 };

    addStaticBox(space, 2100, floorY - 200, 100, 16);
    addCoin(space, 2100, floorY - 230);
    addCoin(space, 1750, floorY - 80);

    // ---- Section 5: Water / fluid zone (x: 2200–2600) ----
    addStaticBox(space, 2400, floorY + 100, 500, 20); // Deep floor
    addStaticBox(space, 2150, floorY + 40, 20, 100); // Left wall of pool
    addStaticBox(space, 2650, floorY + 40, 20, 100); // Right wall of pool

    // Water zone (sensor with fluid properties)
    const water = new Body(BodyType.STATIC, new Vec2(2400, floorY + 30));
    const waterShape = new Polygon(Polygon.box(480, 80));
    waterShape.fluidEnabled = true;
    waterShape.fluidProperties = new FluidProperties(2, 4);
    waterShape.sensorEnabled = true;
    water.shapes.add(waterShape);
    water.space = space;
    water._isWater = true;

    addCoin(space, 2300, floorY + 20);
    addCoin(space, 2500, floorY + 20);

    // ---- Section 6: Wall jump zone (x: 2600–2900) ----
    addStaticBox(space, 2700, floorY - 80, 16, 160);
    addStaticBox(space, 2800, floorY - 80, 16, 160);
    addOneWay(space, 2750, floorY - 170, 80, platformTag);
    addCoin(space, 2750, floorY - 200);

    // ---- Section 7: Final stretch with mixed obstacles (x: 2900–3100) ----
    addOneWay(space, 2950, 400, 100, platformTag);
    addOneWay(space, 3050, 330, 80, platformTag);
    addStaticBox(space, 3100, 280, 100, 16);
    addCoin(space, 3100, 250);

    // ---- Player (circle) ----
    player = new Body(BodyType.KINEMATIC, new Vec2(100, floorY - 30));
    const playerShape = new Circle(PLAYER_R);
    playerShape.cbTypes.add(playerTag);
    player.shapes.add(playerShape);
    player.allowRotation = false;
    player.space = space;
    try { player.userData._colorIdx = 3; } catch (_) {}

    // ---- Character Controller ----
    cc = new CharacterController(space, player, {
      maxSlopeAngle: Math.PI / 3, // 60 degrees
      stepHeight: 12,
      skinWidth: 0.5,
      snapToGround: 6,
      oneWayPlatformTag: platformTag,
      characterTag: playerTag,
      trackMovingPlatforms: true,
    });

    // Set camera config — read by DemoRunner after setup()
    this.camera = {
      follow: player,
      offsetX: 0,
      offsetY: -30,
      bounds: { minX: 0, minY: 0, maxX: WORLD_W, maxY: WORLD_H },
      lerp: 0.12,
    };

    // Reset state
    keys = {};
    prevJumpKey = false;
    jumpBufferTimer = 0;
    velY = 0;
    playerFacingRight = true;

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
        body.position = new Vec2(px + m._dir * m.speed * DT, body.position.y);
      }
      if (body._vMoving) {
        const m = body._vMoving;
        const py = body.position.y;
        if (!m._dir) m._dir = 1;
        if (py >= m.maxY) m._dir = -1;
        if (py <= m.minY) m._dir = 1;
        body.position = new Vec2(body.position.x, py + m._dir * m.speed * DT);
      }
    }

    // ---- Input ----
    const left = keys["ArrowLeft"] || keys["KeyA"];
    const right = keys["ArrowRight"] || keys["KeyD"];
    const jumpKey = keys["Space"] || keys["ArrowUp"] || keys["KeyW"];

    // Jump edge detection — only trigger on key-down, not hold
    const jumpJustPressed = jumpKey && !prevJumpKey;
    prevJumpKey = jumpKey;

    let moveX = 0;
    if (left) { moveX = -MOVE_SPEED * DT; playerFacingRight = false; }
    if (right) { moveX = MOVE_SPEED * DT; playerFacingRight = true; }

    // ---- Vertical velocity with gravity ----
    // Apply gravity
    velY += GRAVITY * DT;

    // Jump buffering — set buffer when jump pressed
    if (jumpJustPressed) {
      jumpBufferTimer = JUMP_BUFFER_MS;
    } else {
      jumpBufferTimer = Math.max(0, jumpBufferTimer - 1000 * DT);
    }

    // Jump (with coyote time)
    const canJump = cc.grounded || cc.timeSinceGrounded * 1000 < COYOTE_MS;
    if (jumpBufferTimer > 0 && canJump) {
      velY = -JUMP_SPEED; // upward
      jumpBufferTimer = 0;
    }

    // Variable jump height — release early = cut velocity
    if (!jumpKey && velY < 0) {
      velY *= 0.7;
    }

    // Reset vertical velocity when grounded and not jumping
    if (cc.grounded && velY > 0) {
      velY = 0;
    }

    const moveY = velY * DT;

    // ---- Move ----
    const result = cc.move(new Vec2(moveX, moveY));

    // If we hit a ceiling, stop upward velocity
    if (velY < 0 && result.numCollisions > 0) {
      for (let i = 0; i < result.numCollisions; i++) {
        const col = result.getCollision(i);
        if (col.normal.y > 0.5) { // ceiling hit
          velY = 0;
          break;
        }
      }
    }

    // If grounded, clamp velY to 0
    if (result.grounded) {
      velY = Math.max(0, velY);
    }

    // Clamp player to world bounds
    const px = Math.max(PLAYER_R, Math.min(WORLD_W - PLAYER_R, player.position.x));
    const py = Math.max(PLAYER_R, Math.min(WORLD_H - PLAYER_R, player.position.y));
    if (px !== player.position.x || py !== player.position.y) {
      player.position = new Vec2(px, py);
    }
  },

  // ---- Custom render (camera-aware) ----
  render(ctx, space, W, H, showOutlines, camX = 0, camY = 0) {
    ctx.save();
    ctx.translate(-camX, -camY);

    // Grid
    drawGrid(ctx, W, H, camX, camY);

    // Water zones (draw before bodies)
    for (const body of space.bodies) {
      if (body._isWater) {
        const px = body.position.x;
        const py = body.position.y;
        ctx.fillStyle = "rgba(50,120,220,0.15)";
        ctx.fillRect(px - 240, py - 40, 480, 80);
        // Wave effect
        ctx.strokeStyle = "rgba(80,160,255,0.3)";
        ctx.lineWidth = 1;
        ctx.beginPath();
        const waveY = py - 40;
        for (let x = px - 240; x <= px + 240; x += 4) {
          const wy = waveY + Math.sin((x + performance.now() * 0.003) * 0.05) * 3;
          x === px - 240 ? ctx.moveTo(x, wy) : ctx.lineTo(x, wy);
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

    // Player direction indicator (eye dot)
    if (player) {
      const px = player.position.x;
      const py = player.position.y;
      ctx.fillStyle = cc?.grounded ? "#3fb950" : "#f85149";
      ctx.beginPath();
      ctx.arc(px + (playerFacingRight ? 5 : -5), py - 6, 2, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.restore();

    // ---- HUD (screen space) ----
    ctx.fillStyle = "rgba(255,255,255,0.7)";
    ctx.font = "12px monospace";
    ctx.fillText("WASD / Arrow keys to move, Space to jump", 10, 20);

    if (cc) {
      const state = cc.grounded ? "GROUNDED" : "AIRBORNE";
      ctx.fillStyle = cc.grounded ? "#3fb950" : "#f85149";
      ctx.fillText(state, 10, 40);
      if (cc.timeSinceGrounded > 0 && cc.timeSinceGrounded * 1000 < COYOTE_MS) {
        ctx.fillStyle = "#d29922";
        ctx.fillText("COYOTE", 100, 40);
      }
    }

    // Legend (bottom-left)
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
  // Set one-way group exclusively so CC can exclude from upward raycasts.
  // Must not include default group (1) — otherwise the filter mask cannot exclude it.
  shape.filter.collisionGroup = ONEWAY_GROUP;
  b.shapes.add(shape);
  b.space = space;
  try { b.userData._colorIdx = 4; } catch (_) {} // purple for one-way
  return b;
}

function addCoin(space, cx, cy) {
  const b = new Body(BodyType.STATIC, new Vec2(cx, cy));
  const shape = new Circle(5);
  shape.sensorEnabled = true;
  b.shapes.add(shape);
  b.space = space;
  try { b.userData._colorIdx = 1; } catch (_) {} // orange for coins
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
