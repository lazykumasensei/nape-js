import {
  Body, BodyType, Vec2, Polygon, Circle, Material,
  CbType, CbEvent, InteractionType, InteractionListener,
  CharacterController,
  buildTilemapBody,
  fractureBody,
  ParticleEmitter,
} from "../nape-js.esm.js";
import { drawBody } from "../renderer.js";

// 2D side-view shooter that uses ParticleEmitter twice:
//
//   1) BULLETS — every projectile is a 2-radius circle body emitted on
//      each click. Collision callback hands HP off to the target it
//      hits and immediately requests the bullet's death.
//   2) DEBRIS — every kill detonates the target with `fractureBody` and
//      a 40-particle radial burst from the impact point.
//
// Movement is `CharacterController`. The level geometry comes from
// `buildTilemapBody` (greedy-meshed grid).

const DT = 1 / 60;
const W = 900;
const H = 500;
const TILE = 30;

// 30x16 grid: 1 = solid, 0 = empty
// row 0 is top.
const LEVEL = [
  "111111111111111111111111111111",
  "100000000000000000000000000001",
  "100000000000000000000000000001",
  "100000000000000000000000000001",
  "100000000000000000000000000001",
  "100000000111000000111100000001",
  "100000000000000000000000000001",
  "100000000000000000000000000001",
  "100001111100000011000000110001",
  "100000000000000000000000000001",
  "100000000000000000000111110001",
  "100000000111111000000000000001",
  "100000000000000000000000000001",
  "100000111000000000000011110001",
  "100000000000000000000000000001",
  "111111111111111111111111111111",
];

const PLAYER_W = 14;
const PLAYER_H = 22;
const MOVE_SPEED = 200;
const JUMP_SPEED = 380;
const BULLET_SPEED = 700;
const BULLET_COOLDOWN = 0.08;

// Module state (re-init on every setup).
let _player = null;
let _cc = null;
let _targets = [];
let _bullets = null;     // ParticleEmitter — projectiles
let _debris = null;      // ParticleEmitter — explosion sparks
let _space = null;
let _bulletCbType = null;
let _targetCbType = null;
let _keys = {};
let _aim = { x: W / 2, y: H / 2 };
let _mouseDown = false;
let _cooldown = 0;
let _stats = { fired: 0, kills: 0, fragments: 0 };
let _onKeyDown = null;
let _onKeyUp = null;
let _onMouseMove = null;
let _onMouseDown = null;
let _onMouseUp = null;
let _canvas = null;

function gridFromLevel() {
  const grid = LEVEL.map((row) => row.split("").map((c) => (c === "1" ? 1 : 0)));
  return grid;
}

function spawnTargets(space) {
  // Hand-picked positions on top of solid floor sections.
  const defs = [
    { x: 220, y: 360, w: 32, h: 32, hp: 1 },
    { x: 260, y: 360, w: 32, h: 32, hp: 1 },
    { x: 300, y: 360, w: 32, h: 32, hp: 1 },
    { x: 410, y: 240, w: 32, h: 32, hp: 2 },
    { x: 450, y: 240, w: 32, h: 32, hp: 2 },
    { x: 600, y: 240, w: 36, h: 36, hp: 2 },
    { x: 640, y: 240, w: 36, h: 36, hp: 3 },
    { x: 730, y: 360, w: 32, h: 32, hp: 1 },
    { x: 770, y: 360, w: 32, h: 32, hp: 1 },
    { x: 810, y: 360, w: 32, h: 32, hp: 2 },
    { x: 195, y: 150, w: 36, h: 36, hp: 2 },
    { x: 235, y: 150, w: 36, h: 36, hp: 1 },
  ];
  const out = [];
  for (const def of defs) {
    const body = new Body(BodyType.DYNAMIC, new Vec2(def.x, def.y));
    const half = { x: def.w / 2, y: def.h / 2 };
    body.shapes.add(
      new Polygon(
        [
          new Vec2(-half.x, -half.y),
          new Vec2(half.x, -half.y),
          new Vec2(half.x, half.y),
          new Vec2(-half.x, half.y),
        ],
        new Material(0.1, 0.6, 0.9, 1.5),
      ),
    );
    const shape = body.shapes.at(0);
    shape.cbTypes.add(_targetCbType);
    body.userData._hp = def.hp;
    body.userData._hpMax = def.hp;
    try { body.userData._colorIdx = (def.hp % 5) + 1; } catch (_) {}
    body.space = space;
    out.push(body);
  }
  return out;
}

function detonate(target, impactX, impactY) {
  // Visual + structural break: fracture the body and spawn a debris burst.
  // Move the debris emitter origin to the impact point and burst.
  if (_debris) {
    if (_debris.origin instanceof Vec2) {
      _debris.origin.x = impactX;
      _debris.origin.y = impactY;
    } else {
      _debris.origin = new Vec2(impactX, impactY);
    }
    _debris.emit(40);
  }

  try {
    const result = fractureBody(target, new Vec2(impactX, impactY), {
      fragmentCount: 6,
      explosionImpulse: 220,
    });
    _stats.fragments += result.fragments.length;
    // Tag fragments with a short-lived flag so we can fade them out via
    // the regular renderer (they're just dynamic bodies after this).
    for (const f of result.fragments) {
      try { f.userData._colorIdx = 5; f.userData._isFragment = true; } catch (_) {}
    }
  } catch (_) {
    // fractureBody throws if the body has no polygon shape — should not
    // happen here, but keep the demo running if it does.
    target.space = null;
  }
  _stats.kills++;

  // Remove from our targets list.
  const idx = _targets.indexOf(target);
  if (idx >= 0) _targets.splice(idx, 1);
}

export default {
  id: "destructible-arena",
  label: "Destructible Arena (P62)",
  featured: true,
  featuredOrder: 9,
  tags: ["ParticleEmitter", "fractureBody", "CharacterController", "Tilemap", "Shooter", "P62"],
  desc:
    "Side-view shooter built from four nape-js helpers: <b>buildTilemapBody</b> for the level, <b>CharacterController</b> for movement, and two <b>ParticleEmitter</b>s — one for bullets, one for explosion debris. Hold <b>mouse</b> to fire toward the cursor; landing the killing shot triggers <b>fractureBody</b> + a 40-particle radial burst. <b>WASD/Arrows</b> move, <b>Space</b> jumps.",
  walls: false,

  setup(space, _w, _h) {
    _space = space;
    space.gravity = new Vec2(0, 900);

    _bulletCbType = new CbType();
    _targetCbType = new CbType();
    _stats = { fired: 0, kills: 0, fragments: 0 };
    _cooldown = 0;
    _keys = {};
    _aim = { x: W / 2, y: H / 2 };
    _mouseDown = false;

    // ---- Level geometry from a tile grid ----
    buildTilemapBody(gridFromLevel(), {
      space,
      tileSize: TILE,
      position: new Vec2(0, 0),
      material: new Material(0.05, 0.7, 0.9, 1),
      merge: "greedy",
    });

    // ---- Player ----
    _player = new Body(BodyType.DYNAMIC, new Vec2(80, 380));
    _player.shapes.add(
      new Polygon(
        [
          new Vec2(-PLAYER_W / 2, -PLAYER_H / 2),
          new Vec2(PLAYER_W / 2, -PLAYER_H / 2),
          new Vec2(PLAYER_W / 2, PLAYER_H / 2),
          new Vec2(-PLAYER_W / 2, PLAYER_H / 2),
        ],
        new Material(0, 0.5, 0.5, 1),
      ),
    );
    _player.allowRotation = false;
    _player.isBullet = true;
    _player.space = space;
    try { _player.userData._colorIdx = 3; } catch (_) {}

    _cc = new CharacterController(space, _player, {
      maxSlopeAngle: Math.PI / 3,
      down: new Vec2(0, 1),
    });

    // ---- Targets ----
    _targets = spawnTargets(space);

    // ---- Bullet emitter ----
    // Bullets are radius-2 circles. Velocity is set per-shot to point at the
    // cursor, so we use a fixed-velocity pattern that we'll mutate before
    // each emit.
    _bullets = new ParticleEmitter({
      space,
      origin: _player,
      velocity: { kind: "fixed", value: new Vec2(BULLET_SPEED, 0) },
      maxParticles: 64,
      lifetimeMin: 1.4,
      lifetimeMax: 1.4,
      particleRadius: 2,
      particleMaterial: new Material(0, 0.1, 0.1, 0.4),
      particleCbType: _bulletCbType,
      onCollide: (bullet, other) => {
        // Score a hit on the target this bullet just touched.
        const ix = bullet.position.x;
        const iy = bullet.position.y;
        const userData = other.userData;
        if (userData && typeof userData._hp === "number") {
          userData._hp -= 1;
          if (userData._hp <= 0) detonate(other, ix, iy);
        }
        // Bullet always dies on first contact — deferred kill is mandatory
        // because we're inside a collision callback.
        _bullets.requestKill(bullet);
      },
      selfCollision: false,
    });

    // ---- Debris emitter ----
    _debris = new ParticleEmitter({
      space,
      origin: new Vec2(0, 0),
      velocity: { kind: "radial", speedMin: 120, speedMax: 380 },
      maxParticles: 400,
      lifetimeMin: 0.5,
      lifetimeMax: 1.4,
      particleRadius: 1.7,
      particleMaterial: new Material(0.4, 0.5, 0.7, 0.4),
      selfCollision: false,
    });

    // ---- Input ----
    _onKeyDown = (e) => {
      _keys[e.code] = true;
      if (["Space", "ArrowUp", "KeyW", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(e.code)) {
        e.preventDefault();
      }
    };
    _onKeyUp = (e) => { _keys[e.code] = false; };
    _onMouseMove = (e) => {
      const t = e.target;
      if (!t || !t.getBoundingClientRect) return;
      const rect = t.getBoundingClientRect();
      _canvas = t;
      _aim.x = ((e.clientX - rect.left) / rect.width) * W;
      _aim.y = ((e.clientY - rect.top) / rect.height) * H;
    };
    _onMouseDown = (e) => {
      _mouseDown = true;
      _onMouseMove(e);
    };
    _onMouseUp = () => { _mouseDown = false; };
    window.addEventListener("keydown", _onKeyDown);
    window.addEventListener("keyup", _onKeyUp);
    window.addEventListener("mousemove", _onMouseMove);
    window.addEventListener("mousedown", _onMouseDown);
    window.addEventListener("mouseup", _onMouseUp);
  },

  cleanup() {
    if (_bullets) { _bullets.destroy(); _bullets = null; }
    if (_debris) { _debris.destroy(); _debris = null; }
    if (_onKeyDown) window.removeEventListener("keydown", _onKeyDown);
    if (_onKeyUp) window.removeEventListener("keyup", _onKeyUp);
    if (_onMouseMove) window.removeEventListener("mousemove", _onMouseMove);
    if (_onMouseDown) window.removeEventListener("mousedown", _onMouseDown);
    if (_onMouseUp) window.removeEventListener("mouseup", _onMouseUp);
    _onKeyDown = _onKeyUp = _onMouseMove = _onMouseDown = _onMouseUp = null;
    _player = _cc = null;
    _targets = [];
    _bulletCbType = _targetCbType = null;
  },

  step(_space, _w, _h) {
    if (!_cc || !_player) return;

    // ---- 1) Movement input ----
    const left = _keys["KeyA"] || _keys["ArrowLeft"];
    const right = _keys["KeyD"] || _keys["ArrowRight"];
    const jumpKey = _keys["Space"] || _keys["KeyW"] || _keys["ArrowUp"];

    // Query state from the previous step.
    const result = _cc.update();

    let vx = 0;
    if (left) vx -= MOVE_SPEED;
    if (right) vx += MOVE_SPEED;

    let vy = _player.velocity.y;
    const jumpJustPressed = jumpKey && !_keys._prevJump;
    _keys._prevJump = jumpKey;
    if (jumpJustPressed && (result.grounded || result.timeSinceGrounded * 1000 < 100)) {
      vy = -JUMP_SPEED;
    }
    // Variable jump height — release the key early to cut.
    if (!jumpKey && vy < 0) vy *= 0.85;

    _player.velocity = new Vec2(vx, vy);

    // ---- 2) Shooting ----
    _cooldown = Math.max(0, _cooldown - DT);
    if (_mouseDown && _cooldown <= 0 && _bullets) {
      const dx = _aim.x - _player.position.x;
      const dy = _aim.y - _player.position.y;
      const len = Math.hypot(dx, dy) || 1;
      const vxBullet = (dx / len) * BULLET_SPEED;
      const vyBullet = (dy / len) * BULLET_SPEED;
      // Mutate the fixed-velocity pattern in place — emitter reads `value`
      // each spawn.
      const pat = _bullets.velocity;
      if (pat.kind === "fixed") {
        pat.value = new Vec2(vxBullet, vyBullet);
      }
      _bullets.emit(1);
      _stats.fired++;
      _cooldown = BULLET_COOLDOWN;
    }

    // ---- 3) Advance emitters ----
    if (_bullets) _bullets.update(DT);
    if (_debris) _debris.update(DT);
  },

  render(ctx, space, _w, _h) {
    ctx.save();
    ctx.fillStyle = "#0d1117";
    ctx.fillRect(0, 0, W, H);

    // Draw all bodies via the standard renderer (player, fragments, tilemap,
    // targets). We skip particle bodies — their custom rendering below
    // looks better than the default circle outline.
    const skipBullet = _bullets ? new Set(_bullets.active) : null;
    const skipDebris = _debris ? new Set(_debris.active) : null;
    for (let i = 0; i < space.bodies.length; i++) {
      const b = space.bodies.at(i);
      if (skipBullet && skipBullet.has(b)) continue;
      if (skipDebris && skipDebris.has(b)) continue;
      drawBody(ctx, b, false);
    }

    // Targets — overlay an HP-tinted halo so the player can read remaining
    // hits at a glance.
    for (const t of _targets) {
      const ud = t.userData;
      if (!ud || ud._hp == null) continue;
      const cx = t.position.x;
      const cy = t.position.y;
      const ratio = ud._hp / Math.max(1, ud._hpMax);
      ctx.strokeStyle = `rgba(255,${Math.round(80 + 130 * ratio)},80,0.7)`;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(cx, cy, 22, 0, Math.PI * 2);
      ctx.stroke();
    }

    // Bullets — bright streaks.
    if (_bullets) {
      ctx.fillStyle = "#ffe066";
      for (const b of _bullets.active) {
        ctx.beginPath();
        ctx.arc(b.position.x, b.position.y, _bullets.particleRadius + 0.5, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    // Debris sparks — fade with age.
    if (_debris) {
      const live = _debris.active;
      const ages = _debris.ages;
      const lts = _debris.lifetimes;
      for (let i = 0; i < live.length; i++) {
        const t = Math.min(1, ages[i] / lts[i]);
        const a = (1 - t).toFixed(2);
        ctx.fillStyle = `rgba(245,180,80,${a})`;
        const b = live[i];
        ctx.beginPath();
        ctx.arc(b.position.x, b.position.y, _debris.particleRadius, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    // Aim reticle.
    ctx.strokeStyle = "rgba(255,80,80,0.6)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(_aim.x, _aim.y, 6, 0, Math.PI * 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(_aim.x - 10, _aim.y); ctx.lineTo(_aim.x + 10, _aim.y);
    ctx.moveTo(_aim.x, _aim.y - 10); ctx.lineTo(_aim.x, _aim.y + 10);
    ctx.stroke();

    drawHUD(ctx);
    ctx.restore();
  },

  render3dOverlay(ctx, _space, _w, _h) {
    drawHUD(ctx);
  },
};

function drawHUD(ctx) {
  ctx.save();
  ctx.fillStyle = "rgba(13,17,23,0.7)";
  ctx.fillRect(8, 8, 220, 60);
  ctx.fillStyle = "#e6edf3";
  ctx.font = "12px ui-monospace, monospace";
  ctx.fillText(`Fired:     ${_stats.fired}`, 16, 24);
  ctx.fillText(`Kills:     ${_stats.kills}`, 16, 40);
  ctx.fillText(`Fragments: ${_stats.fragments}`, 16, 56);
  ctx.restore();
}

