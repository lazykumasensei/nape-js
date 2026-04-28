import {
  Body, BodyType, Vec2, Circle, Capsule, Material, CbType, CbEvent,
  InteractionType, InteractionListener,
  CharacterController, RadialGravityField, RadialGravityFieldGroup,
} from "../nape-js.esm.js";
import { drawBody, drawGrid } from "../renderer.js";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const PLAYER_W = 14;
const PLAYER_H = 26;
const MOVE_SPEED = 130;
const JUMP_SPEED = 280;
const COYOTE_MS = 100;
const JUMP_BUFFER_MS = 100;
const DT = 1 / 60;
const ROTATE_LERP = 0.18;        // capsule rotation smoothing
const NEAREST_HYSTERESIS = 0.9;  // new planet must be < 0.9× current distance to switch

// Planet definitions — pos, radius, field strength + maxRadius
const PLANETS = [
  { x: 220, y: 360, r: 60, strength:  900, maxRadius: 200 },  // A — start
  { x: 470, y: 150, r: 50, strength:  650, maxRadius: 180 },  // B — top, holds the star
  { x: 720, y: 340, r: 42, strength:  500, maxRadius: 160 },  // C — right
];

// Coin / star positions (world space). type: 1 = coin, 5 = star
const PICKUPS = [
  // around Planet A
  { x: 165, y: 290, v: 1 },
  { x: 280, y: 285, v: 1 },
  { x: 220, y: 285, v: 1 },
  // arc between A and B
  { x: 320, y: 200, v: 1 },
  { x: 380, y: 140, v: 1 },
  // around Planet B (and the star on top)
  { x: 470, y:  85, v: 5 }, // ★ goal
  { x: 540, y: 130, v: 1 },
  // arc between B and C
  { x: 600, y: 200, v: 1 },
  // around Planet C
  { x: 720, y: 285, v: 1 },
];

// ---------------------------------------------------------------------------
// State (reset in setup)
// ---------------------------------------------------------------------------

let _planets = [];      // Body[]
let _fields = null;     // RadialGravityFieldGroup
let _player = null;
let _cc = null;
let _coinTag = null;
let _playerTag = null;
let _keys = {};
let _prevJumpKey = false;
let _jumpBufferTimer = 0;
let _coinCount = 0;
let _coinTotal = 0;
let _starCollected = false;
let _winTimer = 0;
let _coinPopups = [];   // { x, y, timer, value }
let _currentPlanet = null;
let _currentRotation = 0;
let _coinCount_byBody = new WeakMap(); // body -> value (used in begin listener)

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function nearestPlanet(px, py) {
  let best = _currentPlanet;
  let bestD = Infinity;
  for (const p of _planets) {
    const dx = p.position.x - px;
    const dy = p.position.y - py;
    const d = Math.sqrt(dx * dx + dy * dy);
    // Hysteresis — only switch if the candidate is meaningfully closer than the
    // current planet, so the player doesn't flip-flop on equidistant boundaries.
    if (p === _currentPlanet) {
      bestD = d;
      best = p;
      break;
    }
  }
  for (const p of _planets) {
    if (p === _currentPlanet) continue;
    const dx = p.position.x - px;
    const dy = p.position.y - py;
    const d = Math.sqrt(dx * dx + dy * dy);
    if (d < bestD * NEAREST_HYSTERESIS) {
      bestD = d;
      best = p;
    }
  }
  return best;
}

function shortestAngleDelta(from, to) {
  let d = to - from;
  while (d > Math.PI) d -= 2 * Math.PI;
  while (d < -Math.PI) d += 2 * Math.PI;
  return d;
}

// ---------------------------------------------------------------------------
// Demo
// ---------------------------------------------------------------------------

export default {
  id: "planet-platformer",
  label: "Planet Platformer",
  featured: true,
  featuredOrder: 7,
  tags: ["RadialGravityField", "CharacterController", "Mario-Galaxy-style", "Pickups", "Platformer"],
  desc:
    "Walk around three planetoids — each with its own <b>RadialGravityField</b>. Gravity points toward the nearest planet, the <b>CharacterController.down</b> direction is updated each frame, so jumping, slope-walking and ground detection all work in any orientation. Collect coins and reach the <b>★ star</b> on top of the middle planet. <b>WASD/Arrows</b> + <b>Space</b>.",
  walls: false,

  setup(space, W, H) {
    space.gravity = new Vec2(0, 0); // only the radial fields

    _coinTag = new CbType();
    _playerTag = new CbType();

    // ---- Planets ----
    _planets = [];
    _fields = new RadialGravityFieldGroup();
    for (const def of PLANETS) {
      const planet = new Body(BodyType.STATIC, new Vec2(def.x, def.y));
      planet.shapes.add(new Circle(def.r, undefined, new Material(0, 0.7, 0.9, 1)));
      planet.userData._isPlanet = true;
      planet.userData._maxRadius = def.maxRadius;
      planet.space = space;
      _planets.push(planet);

      _fields.add(new RadialGravityField({
        source: planet,
        strength: def.strength,
        falloff: "constant",          // Mario-Galaxy style: pull is constant near the surface
        scaleByMass: false,           // direct accel — easier to tune
        maxRadius: def.maxRadius,
        minRadius: def.r,
        softening: 50,
      }));
    }

    // ---- Player (capsule on top of Planet A) ----
    const startPlanet = _planets[0];
    const startX = startPlanet.position.x;
    const startY = startPlanet.position.y - PLANETS[0].r - PLAYER_H / 2 - 1;
    _player = new Body(BodyType.DYNAMIC, new Vec2(startX, startY));
    const playerShape = new Capsule(PLAYER_H, PLAYER_W, undefined, new Material(0, 0.4, 0.4, 1));
    playerShape.cbTypes.add(_playerTag);
    _player.shapes.add(playerShape);
    _player.rotation = Math.PI / 2; // capsule spine vertical (feet pointing down)
    _player.allowRotation = false;
    _player.isBullet = true;
    _player.space = space;
    try { _player.userData._colorIdx = 3; } catch (_) {}
    _currentRotation = _player.rotation;

    // ---- Pickups ----
    _coinTotal = PICKUPS.length;
    _coinCount_byBody = new WeakMap();
    for (const p of PICKUPS) {
      const isStarVal = p.v === 5;
      const body = new Body(BodyType.STATIC, new Vec2(p.x, p.y));
      const shape = new Circle(isStarVal ? 8 : 5);
      shape.sensorEnabled = true;
      shape.cbTypes.add(_coinTag);
      body.shapes.add(shape);
      body.space = space;
      _coinCount_byBody.set(body, p.v);
      try { body.userData._colorIdx = isStarVal ? 2 : 1; body.userData._isStar = isStarVal; } catch (_) {}
    }

    // ---- Pickup listener (BEGIN, SENSOR) ----
    const pickupListener = new InteractionListener(
      CbEvent.BEGIN,
      InteractionType.SENSOR,
      _playerTag,
      _coinTag,
      (cb) => {
        let coinBody = null;
        const i1 = cb.int1, i2 = cb.int2;
        const b1 = i1.castBody ?? i1.castShape?.body ?? null;
        const b2 = i2.castBody ?? i2.castShape?.body ?? null;
        coinBody = (b1 && b1 !== _player) ? b1 : (b2 && b2 !== _player) ? b2 : null;
        if (coinBody && coinBody.space) {
          const v = _coinCount_byBody.get(coinBody) ?? 1;
          const cx = coinBody.position.x, cy = coinBody.position.y;
          const isStar = !!coinBody.userData?._isStar;
          coinBody.space = null;
          _coinCount += v;
          _coinPopups.push({ x: cx, y: cy - 10, timer: 1.2, value: v, star: isStar });
          if (isStar) {
            _starCollected = true;
            _winTimer = 3.0;
          }
        }
      },
    );
    pickupListener.space = space;

    // ---- Character Controller ----
    _cc = new CharacterController(space, _player, {
      maxSlopeAngle: Math.PI / 3,
      // Initial down points from player toward Planet A center.
      down: new Vec2(0, 1),
    });

    _currentPlanet = startPlanet;

    // ---- Reset transient state ----
    _keys = {};
    _prevJumpKey = false;
    _jumpBufferTimer = 0;
    _coinCount = 0;
    _starCollected = false;
    _winTimer = 0;
    _coinPopups = [];

    // Keyboard
    this._onKeyDown = (e) => {
      _keys[e.code] = true;
      if (e.code === "Space" || e.code === "ArrowUp" || e.code === "KeyW") e.preventDefault();
    };
    this._onKeyUp = (e) => { _keys[e.code] = false; };
    window.addEventListener("keydown", this._onKeyDown);
    window.addEventListener("keyup", this._onKeyUp);
  },

  cleanup() {
    if (this._onKeyDown) window.removeEventListener("keydown", this._onKeyDown);
    if (this._onKeyUp)   window.removeEventListener("keyup", this._onKeyUp);
  },

  step(space, W, H) {
    if (!_cc || !_player) return;

    // ---- 1) Apply gravity fields ----
    _fields.apply(space);

    // ---- 2) Choose nearest planet → derive "down" direction ----
    const px = _player.position.x;
    const py = _player.position.y;
    _currentPlanet = nearestPlanet(px, py);
    const dx = _currentPlanet.position.x - px;
    const dy = _currentPlanet.position.y - py;
    const d = Math.sqrt(dx * dx + dy * dy) || 1;
    const downX = dx / d;
    const downY = dy / d;
    _cc.setDown(downX, downY);

    // ---- 3) Smoothly rotate capsule so feet point along down ----
    // Capsule "down" in body-local frame is +X (spine along X-axis); body
    // rotation θ rotates the spine. We want body's local +X aligned with
    // world `(downX, downY)`, so rotation = atan2(downY, downX).
    const targetRot = Math.atan2(downY, downX);
    const delta = shortestAngleDelta(_currentRotation, targetRot);
    _currentRotation += delta * ROTATE_LERP;
    _player.rotation = _currentRotation;

    // ---- 4) Input ----
    const left  = _keys["ArrowLeft"]  || _keys["KeyA"];
    const right = _keys["ArrowRight"] || _keys["KeyD"];
    const jumpKey = _keys["Space"] || _keys["ArrowUp"] || _keys["KeyW"];
    const jumpJustPressed = jumpKey && !_prevJumpKey;
    _prevJumpKey = jumpKey;

    // ---- 5) Query controller state ----
    const result = _cc.update();

    // Jump buffering
    if (jumpJustPressed) _jumpBufferTimer = JUMP_BUFFER_MS;
    else _jumpBufferTimer = Math.max(0, _jumpBufferTimer - 1000 * DT);

    // ---- 6) Compose velocity in the local (tangential, normal) frame, then
    //      transform back to world space.
    // Local axes:
    //   normal (up)   = (-downX, -downY)
    //   tangent (right) = (downY, -downX)   ← +90° CCW of down
    const tx = downY;
    const ty = -downX;
    const nx = -downX;
    const ny = -downY;

    // Decompose current velocity into tangential / normal components.
    const vx = _player.velocity.x;
    const vy = _player.velocity.y;
    let vTan = vx * tx + vy * ty;
    let vNor = vx * nx + vy * ny;

    // Tangential input — overrides existing tangential velocity (snappy moves).
    if (left)  vTan = -MOVE_SPEED;
    if (right) vTan =  MOVE_SPEED;
    if (!left && !right && result.grounded) vTan *= 0.6; // friction-ish on planet

    // Jump (with coyote time)
    const canJump = result.grounded || result.timeSinceGrounded * 1000 < COYOTE_MS;
    let jumped = false;
    if (_jumpBufferTimer > 0 && canJump) {
      vNor = JUMP_SPEED;       // +normal = away from planet
      _jumpBufferTimer = 0;
      jumped = true;
    }
    // Variable jump height — release cuts upward velocity.
    if (!jumped && !jumpKey && vNor > 0) vNor *= 0.85;

    // Recompose velocity in world frame.
    const newVx = vTan * tx + vNor * nx;
    const newVy = vTan * ty + vNor * ny;
    _player.velocity = new Vec2(newVx, newVy);

    // ---- 7) Out-of-bounds respawn ----
    if (px < -200 || px > W + 200 || py < -200 || py > H + 200) {
      _player.position = new Vec2(
        _planets[0].position.x,
        _planets[0].position.y - PLANETS[0].r - PLAYER_H / 2 - 1,
      );
      _player.velocity = new Vec2(0, 0);
    }

    // ---- 8) Update popups + win banner ----
    for (let i = _coinPopups.length - 1; i >= 0; i--) {
      _coinPopups[i].timer -= DT;
      _coinPopups[i].y -= 30 * DT;
      if (_coinPopups[i].timer <= 0) _coinPopups.splice(i, 1);
    }
    if (_winTimer > 0) _winTimer = Math.max(0, _winTimer - DT);
  },

  render(ctx, space, W, H, showOutlines) {
    drawGrid(ctx, W, H);

    // ---- maxRadius rings (so the player sees gravity-well boundaries) ----
    ctx.lineWidth = 1;
    ctx.setLineDash([4, 6]);
    for (const planet of _planets) {
      const isCurrent = planet === _currentPlanet;
      ctx.strokeStyle = isCurrent ? "rgba(88,166,255,0.5)" : "rgba(120,150,200,0.18)";
      ctx.beginPath();
      ctx.arc(planet.position.x, planet.position.y, planet.userData._maxRadius, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.setLineDash([]);

    // ---- Bodies (planets, player, pickups) ----
    for (const body of space.bodies) {
      const isStar = body.userData?._isStar;
      if (isStar) {
        // Custom star render: orange filled circle with a glow.
        const cx = body.position.x, cy = body.position.y;
        ctx.fillStyle = "rgba(255,170,40,0.25)";
        ctx.beginPath(); ctx.arc(cx, cy, 14, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = "#ffaa28";
        ctx.beginPath(); ctx.arc(cx, cy, 8, 0, Math.PI * 2); ctx.fill();
        continue;
      }
      drawBody(ctx, body, showOutlines);
    }

    // ---- Coin popups ----
    ctx.font = "bold 12px ui-monospace, monospace";
    for (const p of _coinPopups) {
      const alpha = Math.min(1, p.timer);
      ctx.fillStyle = p.star ? `rgba(255,170,40,${alpha})` : `rgba(241,196,64,${alpha})`;
      ctx.fillText("+" + p.value, p.x, p.y);
    }

    // ---- HUD ----
    ctx.fillStyle = "rgba(13,17,23,0.7)";
    ctx.fillRect(8, 8, 200, 26);
    ctx.fillStyle = "#e6edf3";
    ctx.font = "12px ui-monospace, monospace";
    ctx.fillText(`Score: ${_coinCount}`, 16, 26);

    // Win banner
    if (_starCollected && _winTimer > 0) {
      const a = Math.min(1, _winTimer / 0.5);
      ctx.fillStyle = `rgba(13,17,23,${0.85 * a})`;
      ctx.fillRect(W / 2 - 130, H / 2 - 24, 260, 48);
      ctx.fillStyle = `rgba(255,170,40,${a})`;
      ctx.font = "bold 18px ui-monospace, monospace";
      ctx.textAlign = "center";
      ctx.fillText("★ Reached the star!", W / 2, H / 2 + 6);
      ctx.textAlign = "start";
    }
  },
};
