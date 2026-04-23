import {
  Body, BodyType, Vec2, Circle, Polygon, Material, InteractionFilter,
  CbType, CbEvent, InteractionListener, InteractionType,
} from "../nape-js.esm.js";

// ── Collision groups ─────────────────────────────────────────────────────
// Units of each team share a group so they collide with everything by default.
// Projectiles restrict their mask so they only hit the opposing team's units
// (and buildings — buildings also wear the team's unit group bit).
const GROUP_BLUE = 2;
const GROUP_RED = 4;
const GROUP_BLUE_PROJ = 8;
const GROUP_RED_PROJ = 16;
const GROUP_WALL = 32;
// Buildings wear both a team bit AND a wall bit so projectiles stop on their
// own towers too (reduces accidental cross-lane sniping through a tower).
const BLUE_UNIT_MASK = -1;
const RED_UNIT_MASK = -1;
const BLUE_PROJ_MASK = GROUP_RED | GROUP_WALL;
const RED_PROJ_MASK = GROUP_BLUE | GROUP_WALL;

// ── World ────────────────────────────────────────────────────────────────
const WORLD_W = 1800;
const WORLD_H = 1000;
const VIEW_W = 900;
const VIEW_H = 500;
const HUD_H = 32;
const WT = 4;

// ── Lanes (blue-to-red waypoints; red creeps walk them in reverse) ───────
const LANES = {
  top: [
    { x: 220, y: 820 },
    { x: 220, y: 180 },
    { x: 1580, y: 180 },
  ],
  mid: [
    { x: 220, y: 820 },
    { x: 900, y: 500 },
    { x: 1580, y: 180 },
  ],
  bot: [
    { x: 220, y: 820 },
    { x: 1580, y: 820 },
    { x: 1580, y: 180 },
  ],
};

// ── Buildings ────────────────────────────────────────────────────────────
const BLUE_ANCIENT = { x: 150, y: 890 };
const RED_ANCIENT = { x: 1650, y: 110 };
const ANCIENT_HP = 40;
const ANCIENT_SIZE = 70;
const ANCIENT_RANGE = 160;
const ANCIENT_DAMAGE = 4;
const ANCIENT_COOLDOWN = 45;

const TOWER_SIZE = 32;
const TOWER_HP = 18;
const TOWER_RANGE = 200;
const TOWER_DAMAGE = 3;
const TOWER_COOLDOWN = 45;

// Tower positions — 2 per lane per side, roughly along each lane.
// Top lane runs along x=220 column, then across the top. Bot mirrors.
// Mid is diagonal so towers sit near the two-thirds marks.
const TOWER_DEFS = [
  // Blue side
  { side: "blue", lane: "top", x: 220, y: 640 },
  { side: "blue", lane: "top", x: 220, y: 380 },
  { side: "blue", lane: "mid", x: 400, y: 700 },
  { side: "blue", lane: "mid", x: 630, y: 580 },
  { side: "blue", lane: "bot", x: 560, y: 820 },
  { side: "blue", lane: "bot", x: 960, y: 820 },
  // Red side
  { side: "red", lane: "top", x: 1160, y: 180 },
  { side: "red", lane: "top", x: 1420, y: 180 },
  { side: "red", lane: "mid", x: 1170, y: 420 },
  { side: "red", lane: "mid", x: 1400, y: 300 },
  { side: "red", lane: "bot", x: 1580, y: 420 },
  { side: "red", lane: "bot", x: 1580, y: 680 },
];

// ── Creep config ─────────────────────────────────────────────────────────
const CREEP_MELEE = {
  hp: 7, damage: 1, speed: 55, range: 32, cooldown: 48, radius: 10, colorIdx: null,
};
const CREEP_RANGED = {
  hp: 5, damage: 1, speed: 50, range: 140, cooldown: 70, radius: 9, colorIdx: null,
};
const CREEPS_PER_WAVE = { melee: 3, ranged: 1 };
const WAVE_INTERVAL = 900;      // 15s @ 60fps
const WAVE_SPAWN_STAGGER = 18;  // frames between units in one wave

// ── Hero config ──────────────────────────────────────────────────────────
const HERO_RADIUS = 13;
const HERO_BASE_HP = 120;
const HERO_BASE_DAMAGE = 9;
const HERO_HP_PER_LVL = 18;
const HERO_DMG_PER_LVL = 2;
const HERO_RANGE = 170;
const HERO_ATTACK_COOLDOWN = 28;
const HERO_SPEED = 190;
const HERO_PROJ_SPEED = 640;
const HERO_XP_PER_CREEP = 14;
const HERO_XP_PER_TOWER = 60;
const HERO_XP_PER_HERO = 140;
const HERO_XP_CURVE = [0, 80, 210, 400, 650, 960]; // lvl 1..6 thresholds
const HERO_MAX_LEVEL = 6;
const HERO_RESPAWN_FRAMES = 420; // 7s

// ── Abilities ────────────────────────────────────────────────────────────
const MINE_RADIUS = 85;
const MINE_DAMAGE = 28;
const MINE_FUSE = 120;        // 2s arm→detonate
const MINE_IMPULSE = 45;
const MINE_COOLDOWN = 420;    // 7s
const DASH_DISTANCE = 230;
const DASH_DURATION = 12;
const DASH_IFRAMES = 16;
const DASH_COOLDOWN = 480;    // 8s

// ── Economy ──────────────────────────────────────────────────────────────
const GOLD_START = 0;
const GOLD_PER_CREEP = 2;
const GOLD_PER_TOWER = 20;
const GOLD_PER_HERO = 60;
const GOLD_PER_ANCIENT = 100;
const GOLD_PASSIVE_INTERVAL = 120; // 2s
const GOLD_PASSIVE = 1;

const SHOP_ITEMS = {
  dmg:  { cost: 30, gain: 3,  label: "+3 DMG", color: "#f85149" },
  heal: { cost: 25, gain: 50, label: "Heal 50", color: "#3fb950" },
};

// ── Input ────────────────────────────────────────────────────────────────
const STICK_MAX_R = 60;

// ── Tower/ancient targeting priorities ──────────────────────────────────
// Prefer creeps first, then towers, then heroes (dota-esque aggro table).
const PRIORITY = { creep: 0, tower: 1, ancient: 2, hero: 3 };

// ── Module state (all reset in setup/reset) ─────────────────────────────
let _space = null;
let _lastCamX = 0;
let _lastCamY = 0;
let _isTouch = false;

let _gameOver = false;
let _victory = null; // "blue" | "red" | null
let _waveTimer = 120; // delay first wave slightly
let _goldTimer = GOLD_PASSIVE_INTERVAL;

// Hero records — one per side. Body may be null during respawn countdown.
const _heroes = {
  blue: null,
  red: null,
};

// Listener callback types
let _cbBlueUnit, _cbRedUnit, _cbBlueProj, _cbRedProj, _cbWall;

// Deferred actions — never mutate the body graph inside a listener; queue
// everything and drain at the top of step().
const _pending = {
  damage: [],        // { victim, amount, attackerSide }
  removeProj: [],    // projectile bodies to despawn
  detonateMine: [],  // mine bodies
};

// Keyboard / touch state
const _keys = Object.create(null);
let _onKeyDown = null;
let _onKeyUp = null;
let _stickActive = false;
let _stickOrigin = { x: 0, y: 0 };
let _stickVec = { x: 0, y: 0 };
const _moveDir = { x: 0, y: 0 };

// HUD/shop/ability hit-test rectangles, rebuilt each frame in screen space.
let _shopButtons = [];
let _abilityButtons = [];

// ── Helpers ──────────────────────────────────────────────────────────────
function bodyFromInt(intObj) {
  return intObj.castBody ?? intObj.castShape?.body ?? null;
}

function distSq(ax, ay, bx, by) {
  const dx = ax - bx, dy = ay - by;
  return dx * dx + dy * dy;
}

function otherSide(side) {
  return side === "blue" ? "red" : "blue";
}

function sideColor(side) {
  return side === "blue" ? "#58a6ff" : "#f85149";
}

function sideColorIdx(side) {
  return side === "blue" ? 0 : 3;
}

function cbForUnit(side) {
  return side === "blue" ? _cbBlueUnit : _cbRedUnit;
}

function cbForProj(side) {
  return side === "blue" ? _cbBlueProj : _cbRedProj;
}

function filterForUnit(side) {
  return new InteractionFilter(side === "blue" ? GROUP_BLUE : GROUP_RED, -1);
}

function filterForProj(side) {
  return side === "blue"
    ? new InteractionFilter(GROUP_BLUE_PROJ, BLUE_PROJ_MASK)
    : new InteractionFilter(GROUP_RED_PROJ, RED_PROJ_MASK);
}

function filterForBuilding(side) {
  // Buildings wear ONLY the team bit (no wall bit) — otherwise friendly
  // projectiles whose mask includes GROUP_WALL would collide with their own
  // team's buildings. Opposite-team projectiles still hit via the team bit.
  const teamBit = side === "blue" ? GROUP_BLUE : GROUP_RED;
  return new InteractionFilter(teamBit, -1);
}

// Horizontal or vertical axis-aligned thin wall used for the arena perimeter.
function addWallSegment(space, ax, ay, bx, by) {
  const dx = bx - ax, dy = by - ay;
  const len = Math.hypot(dx, dy);
  if (len < 0.5) return;
  const ux = dx / len, uy = dy / len;
  const nx = -uy, ny = ux;
  const hl = len / 2;
  const hw = WT / 2;
  const cx = (ax + bx) / 2, cy = (ay + by) / 2;
  const verts = [
    new Vec2(-ux * hl - nx * hw, -uy * hl - ny * hw),
    new Vec2( ux * hl - nx * hw,  uy * hl - ny * hw),
    new Vec2( ux * hl + nx * hw,  uy * hl + ny * hw),
    new Vec2(-ux * hl + nx * hw, -uy * hl + ny * hw),
  ];
  const wall = new Body(BodyType.STATIC, new Vec2(cx, cy));
  // Omit Material (Polygon+Material tunneling bug P53).
  const wallShape = new Polygon(verts);
  wallShape.filter = new InteractionFilter(GROUP_WALL, -1);
  wall.shapes.add(wallShape);
  wall.cbTypes.add(_cbWall);
  wall.userData._wall = true;
  wall.space = space;
}

function buildArenaWalls(space) {
  // Outer perimeter only; lanes themselves are open terrain.
  addWallSegment(space, 0, 0, WORLD_W, 0);
  addWallSegment(space, WORLD_W, 0, WORLD_W, WORLD_H);
  addWallSegment(space, WORLD_W, WORLD_H, 0, WORLD_H);
  addWallSegment(space, 0, WORLD_H, 0, 0);
}

// ── Entity spawning ──────────────────────────────────────────────────────
function spawnAncient(side) {
  const pos = side === "blue" ? BLUE_ANCIENT : RED_ANCIENT;
  const body = new Body(BodyType.STATIC, new Vec2(pos.x, pos.y));
  const shape = new Polygon(Polygon.box(ANCIENT_SIZE, ANCIENT_SIZE));
  shape.filter = filterForBuilding(side);
  body.shapes.add(shape);
  body.userData._colorIdx = sideColorIdx(side);
  body.userData._side = side;
  body.userData._kind = "ancient";
  body.userData._hp = ANCIENT_HP;
  body.userData._maxHp = ANCIENT_HP;
  body.userData._range = ANCIENT_RANGE;
  body.userData._damage = ANCIENT_DAMAGE;
  body.userData._cooldown = ANCIENT_COOLDOWN;
  body.userData._attackTimer = 0;
  body.userData._priority = PRIORITY.ancient;
  body.cbTypes.add(cbForUnit(side));
  body.space = _space;
  return body;
}

function spawnTower(def) {
  const body = new Body(BodyType.STATIC, new Vec2(def.x, def.y));
  const shape = new Polygon(Polygon.box(TOWER_SIZE, TOWER_SIZE));
  shape.filter = filterForBuilding(def.side);
  body.shapes.add(shape);
  body.userData._colorIdx = sideColorIdx(def.side);
  body.userData._side = def.side;
  body.userData._lane = def.lane;
  body.userData._kind = "tower";
  body.userData._hp = TOWER_HP;
  body.userData._maxHp = TOWER_HP;
  body.userData._range = TOWER_RANGE;
  body.userData._damage = TOWER_DAMAGE;
  body.userData._cooldown = TOWER_COOLDOWN;
  body.userData._attackTimer = 0;
  body.userData._priority = PRIORITY.tower;
  body.cbTypes.add(cbForUnit(def.side));
  body.space = _space;
  return body;
}

function spawnCreep(side, lane, kind) {
  const cfg = kind === "ranged" ? CREEP_RANGED : CREEP_MELEE;
  const waypoints = LANES[lane];
  // Blue creeps start at waypoint 0, red creeps start at the last waypoint.
  const startIdx = side === "blue" ? 0 : waypoints.length - 1;
  const nextStep = side === "blue" ? 1 : -1;
  const start = waypoints[startIdx];
  const jx = (Math.random() - 0.5) * 30;
  const jy = (Math.random() - 0.5) * 30;
  const body = new Body(BodyType.DYNAMIC, new Vec2(start.x + jx, start.y + jy));
  const shape = new Circle(cfg.radius, undefined, new Material(0.3, 0.3, 0.4, 1));
  shape.filter = filterForUnit(side);
  body.shapes.add(shape);
  body.allowRotation = false;
  body.userData._colorIdx = sideColorIdx(side);
  body.userData._side = side;
  body.userData._lane = lane;
  body.userData._kind = kind === "ranged" ? "creep_ranged" : "creep_melee";
  body.userData._hp = cfg.hp;
  body.userData._maxHp = cfg.hp;
  body.userData._damage = cfg.damage;
  body.userData._range = cfg.range;
  body.userData._speed = cfg.speed;
  body.userData._cooldown = cfg.cooldown;
  body.userData._attackTimer = 0;
  body.userData._priority = PRIORITY.creep;
  body.userData._wpIdx = startIdx + nextStep; // head toward the next waypoint
  body.userData._wpStep = nextStep;
  body.cbTypes.add(cbForUnit(side));
  body.space = _space;
}

function spawnHero(side) {
  const anchor = side === "blue" ? BLUE_ANCIENT : RED_ANCIENT;
  // Offset a bit so the hero doesn't spawn inside the Ancient collider.
  const ox = side === "blue" ? 90 : -90;
  const oy = side === "blue" ? -60 : 60;
  const body = new Body(BodyType.DYNAMIC, new Vec2(anchor.x + ox, anchor.y + oy));
  const shape = new Circle(HERO_RADIUS, undefined, new Material(0.3, 0.3, 0.4, 1));
  shape.filter = filterForUnit(side);
  body.shapes.add(shape);
  body.allowRotation = false;
  body.isBullet = true;
  body.userData._colorIdx = sideColorIdx(side);
  body.userData._side = side;
  body.userData._kind = "hero";
  body.userData._priority = PRIORITY.hero;
  body.cbTypes.add(cbForUnit(side));
  body.space = _space;
  return body;
}

function makeHeroRecord(side) {
  return {
    side,
    body: null,
    level: 1,
    xp: 0,
    maxHp: HERO_BASE_HP,
    hp: HERO_BASE_HP,
    damage: HERO_BASE_DAMAGE,
    gold: side === "blue" ? GOLD_START : 0,
    attackCd: 0,
    mineCd: 0,
    dashCd: 0,
    dashTimer: 0,
    dashDirX: 0,
    dashDirY: 0,
    iframes: 0,
    respawnTimer: 0,
    // Enemy AI state
    aiLane: side === "red" ? "mid" : null,
    aiState: "lane", // "lane" | "flee"
    aiLaneReassign: 0,
  };
}

// ── Projectiles ──────────────────────────────────────────────────────────
// Attacker → target homing projectile. Damage is carried on the body; hit
// is resolved in the proj↔unit listener.
function fireProjectile(shooter, target, damage) {
  const side = shooter.userData._side;
  const dx = target.position.x - shooter.position.x;
  const dy = target.position.y - shooter.position.y;
  const d = Math.hypot(dx, dy) || 1;
  const nx = dx / d, ny = dy / d;
  // Spawn just outside the shooter — otherwise BEGIN fires at point blank
  // against the shooter's own shape when the filter is permissive.
  const shooterR = shooter.shapes.at(0).castCircle?.radius
    ?? (shooter.userData._kind === "tower" ? TOWER_SIZE / 2 : ANCIENT_SIZE / 2);
  const off = shooterR + 4;
  const body = new Body(
    BodyType.DYNAMIC,
    new Vec2(shooter.position.x + nx * off, shooter.position.y + ny * off),
  );
  const shape = new Circle(3, undefined, new Material(0.1, 0.1, 0.1, 0.01));
  shape.filter = filterForProj(side);
  body.shapes.add(shape);
  body.isBullet = true;
  body.userData._colorIdx = sideColorIdx(side);
  body.userData._side = side;
  body.userData._kind = "proj";
  body.userData._damage = damage;
  body.userData._life = 90;
  body.cbTypes.add(cbForProj(side));
  body.velocity = new Vec2(nx * HERO_PROJ_SPEED, ny * HERO_PROJ_SPEED);
  body.space = _space;
}

// Melee damage — no projectile, just instant damage + a brief attack flash
// drawn in render via _attackFlash on the attacker userData.
function resolveMeleeHit(attacker, target) {
  _pending.damage.push({ victim: target, amount: attacker.userData._damage, attackerSide: attacker.userData._side });
  attacker.userData._attackFlash = { tx: target.position.x, ty: target.position.y, life: 6 };
}

// ── Target selection ─────────────────────────────────────────────────────
// Returns the highest-priority-then-nearest opposite-team unit within radius.
// Lower priority value wins; ties broken by distance.
function pickTarget(fromX, fromY, mySide, range, priorityOverride = null) {
  const r2 = range * range;
  let best = null, bestPrio = Infinity, bestD2 = Infinity;
  for (const body of _space.bodies) {
    const ud = body.userData;
    if (!ud || !ud._side) continue;
    if (ud._side === mySide) continue;
    // Only consider things we can damage
    if (ud._kind !== "creep_melee" && ud._kind !== "creep_ranged"
      && ud._kind !== "tower" && ud._kind !== "ancient" && ud._kind !== "hero") continue;
    const d2 = distSq(fromX, fromY, body.position.x, body.position.y);
    if (d2 > r2) continue;
    const prio = priorityOverride != null ? priorityOverride(ud) : ud._priority;
    if (prio < bestPrio || (prio === bestPrio && d2 < bestD2)) {
      bestPrio = prio;
      bestD2 = d2;
      best = body;
    }
  }
  return best;
}

// Tower/ancient targeting — dota-esque: creeps first, heroes last unless a
// hero is the only thing in range or is directly attacking an ally. We don't
// track ally-attack state, so heroes are simply lowest priority.
function pickBuildingTarget(building) {
  const ud = building.userData;
  return pickTarget(building.position.x, building.position.y, ud._side, ud._range);
}

// ── Creep AI ─────────────────────────────────────────────────────────────
function steerCreeps() {
  const toRemove = [];
  for (const body of _space.bodies) {
    const ud = body.userData;
    if (!ud || (ud._kind !== "creep_melee" && ud._kind !== "creep_ranged")) continue;

    if (ud._attackTimer > 0) ud._attackTimer--;

    // Target scan — creeps aggro onto the nearest enemy within attack range
    // (slightly extended so they pause early before bumping).
    const engageRange = ud._range + 20;
    const target = pickTarget(body.position.x, body.position.y, ud._side, engageRange);

    if (target) {
      const dx = target.position.x - body.position.x;
      const dy = target.position.y - body.position.y;
      const d = Math.hypot(dx, dy) || 1;
      if (d <= ud._range) {
        // In range: stand and fire.
        body.velocity = new Vec2(body.velocity.x * 0.6, body.velocity.y * 0.6);
        if (ud._attackTimer <= 0) {
          if (ud._kind === "creep_ranged") {
            fireProjectile(body, target, ud._damage);
          } else {
            resolveMeleeHit(body, target);
          }
          ud._attackTimer = ud._cooldown;
        }
        continue;
      }
      // Move toward the target if slightly out of range.
      const nx = dx / d, ny = dy / d;
      const speed = ud._speed;
      const v = body.velocity;
      const blend = 0.08;
      body.velocity = new Vec2(v.x + (nx * speed - v.x) * blend, v.y + (ny * speed - v.y) * blend);
      continue;
    }

    // No target → advance along waypoints.
    const waypoints = LANES[ud._lane];
    if (ud._wpIdx < 0 || ud._wpIdx >= waypoints.length) {
      // Reached the far end without dying — detach (shouldn't usually happen
      // because the Ancient is along the waypoint path).
      toRemove.push(body);
      continue;
    }
    const tgt = waypoints[ud._wpIdx];
    const dx = tgt.x - body.position.x;
    const dy = tgt.y - body.position.y;
    const d2 = dx * dx + dy * dy;
    if (d2 < 22 * 22) {
      ud._wpIdx += ud._wpStep;
      continue;
    }
    const d = Math.sqrt(d2) || 1;
    const nx = dx / d, ny = dy / d;
    const speed = ud._speed;
    const v = body.velocity;
    const blend = 0.06;
    body.velocity = new Vec2(v.x + (nx * speed - v.x) * blend, v.y + (ny * speed - v.y) * blend);
  }
  for (const b of toRemove) { if (b.space) b.space = null; }
}

// ── Tower / Ancient AI ───────────────────────────────────────────────────
function tickBuildings() {
  for (const body of _space.bodies) {
    const ud = body.userData;
    if (!ud) continue;
    if (ud._kind !== "tower" && ud._kind !== "ancient") continue;
    if (ud._attackTimer > 0) { ud._attackTimer--; continue; }
    const target = pickBuildingTarget(body);
    if (!target) continue;
    fireProjectile(body, target, ud._damage);
    ud._attackTimer = ud._cooldown;
  }
}

// ── Mines ────────────────────────────────────────────────────────────────
function spawnMine(hero) {
  const side = hero.side;
  const body = new Body(BodyType.STATIC, new Vec2(hero.body.position.x, hero.body.position.y));
  const shape = new Circle(10);
  // Sensor + zero mask so it doesn't block anyone — purely a timed bomb.
  shape.filter = new InteractionFilter(side === "blue" ? GROUP_BLUE : GROUP_RED, 0);
  shape.sensorEnabled = true;
  body.shapes.add(shape);
  body.userData._kind = "mine";
  body.userData._side = side;
  body.userData._fuse = MINE_FUSE;
  body.userData._colorIdx = side === "blue" ? 4 : 3; // purple for blue's mine, red for red's
  body.space = _space;
}

function detonateMine(mine) {
  const ms = mine.userData._side;
  const bx = mine.position.x, by = mine.position.y;
  const r2 = MINE_RADIUS * MINE_RADIUS;
  const targets = [];
  for (const body of _space.bodies) {
    const ud = body.userData;
    if (!ud || !ud._side) continue;
    if (ud._side === ms) continue;
    if (ud._kind !== "creep_melee" && ud._kind !== "creep_ranged"
      && ud._kind !== "tower" && ud._kind !== "ancient" && ud._kind !== "hero") continue;
    const dx = body.position.x - bx, dy = body.position.y - by;
    const d2 = dx * dx + dy * dy;
    if (d2 > r2) continue;
    targets.push({ body, dx, dy, d: Math.sqrt(d2) });
  }
  for (const { body, dx, dy, d } of targets) {
    const dd = d || 1;
    const falloff = 1 - dd / MINE_RADIUS;
    // Only dynamic bodies get knocked back (towers/ancients are static).
    if (!body.isStatic() && MINE_IMPULSE > 0) {
      body.applyImpulse(new Vec2((dx / dd) * MINE_IMPULSE * falloff, (dy / dd) * MINE_IMPULSE * falloff));
    }
    _pending.damage.push({
      victim: body,
      amount: Math.round(MINE_DAMAGE * falloff),
      attackerSide: ms,
    });
  }
  mine.space = null;
}

// ── Hero abilities & upkeep ──────────────────────────────────────────────
function tryCastMine(hero) {
  if (!hero.body?.space) return false;
  if (hero.mineCd > 0) return false;
  if (hero.dashTimer > 0) return false; // can't cast mid-dash
  spawnMine(hero);
  hero.mineCd = MINE_COOLDOWN;
  return true;
}

function tryCastDash(hero, dirX, dirY) {
  if (!hero.body?.space) return false;
  if (hero.dashCd > 0) return false;
  if (hero.dashTimer > 0) return false;
  let ndx = dirX, ndy = dirY;
  const mag = Math.hypot(ndx, ndy);
  if (mag < 0.01) {
    // No input direction: dash toward own Ancient (safety default).
    const home = hero.side === "blue" ? BLUE_ANCIENT : RED_ANCIENT;
    const hdx = home.x - hero.body.position.x;
    const hdy = home.y - hero.body.position.y;
    const hmag = Math.hypot(hdx, hdy) || 1;
    ndx = hdx / hmag; ndy = hdy / hmag;
  } else {
    ndx /= mag; ndy /= mag;
  }
  hero.dashDirX = ndx;
  hero.dashDirY = ndy;
  hero.dashTimer = DASH_DURATION;
  hero.iframes = Math.max(hero.iframes, DASH_IFRAMES);
  hero.dashCd = DASH_COOLDOWN;
  return true;
}

function updateHeroTimers(hero) {
  if (hero.attackCd > 0) hero.attackCd--;
  if (hero.mineCd > 0) hero.mineCd--;
  if (hero.dashCd > 0) hero.dashCd--;
  if (hero.iframes > 0) hero.iframes--;
  if (hero.dashTimer > 0) {
    // Apply dash velocity this frame; clamp to world bounds via natural wall.
    const speed = (DASH_DISTANCE / DASH_DURATION) * 60; // per-second
    if (hero.body?.space) {
      hero.body.velocity = new Vec2(hero.dashDirX * speed, hero.dashDirY * speed);
    }
    hero.dashTimer--;
  }
}

function heroAutoAttack(hero) {
  if (!hero.body?.space) return;
  if (hero.dashTimer > 0) return; // focus on dashing
  if (hero.attackCd > 0) return;
  const target = pickTarget(hero.body.position.x, hero.body.position.y, hero.side, HERO_RANGE);
  if (!target) return;
  fireProjectile(hero.body, target, hero.damage);
  hero.attackCd = HERO_ATTACK_COOLDOWN;
}

function addHeroXP(hero, amount) {
  if (hero.level >= HERO_MAX_LEVEL) return;
  hero.xp += amount;
  // Check level-up thresholds in order (handles multi-level gains).
  while (hero.level < HERO_MAX_LEVEL && hero.xp >= HERO_XP_CURVE[hero.level]) {
    hero.level++;
    const hpGain = HERO_HP_PER_LVL;
    hero.maxHp += hpGain;
    hero.hp = Math.min(hero.maxHp, hero.hp + hpGain); // heal on level-up
    hero.damage += HERO_DMG_PER_LVL;
  }
}

// ── Enemy hero AI ────────────────────────────────────────────────────────
// Extremely simple: pick a lane, walk it toward the enemy base following the
// waypoint chain, auto-attack. Dash to flee when low HP; drop a mine when
// engaged with at least one enemy unit nearby.
function pickAILane(hero) {
  const lanes = ["top", "mid", "bot"];
  return lanes[Math.floor(Math.random() * lanes.length)];
}

function nearestAlliedCreep(hero) {
  let best = null, bestD2 = Infinity;
  for (const body of _space.bodies) {
    const ud = body.userData;
    if (!ud || ud._side !== hero.side) continue;
    if (ud._kind !== "creep_melee" && ud._kind !== "creep_ranged") continue;
    const d2 = distSq(hero.body.position.x, hero.body.position.y, body.position.x, body.position.y);
    if (d2 < bestD2) { bestD2 = d2; best = body; }
  }
  return best;
}

function runEnemyHeroAI(hero) {
  if (!hero.body?.space) return;
  const body = hero.body;

  // Reassign lane periodically for variety.
  hero.aiLaneReassign--;
  if (!hero.aiLane || hero.aiLaneReassign <= 0) {
    hero.aiLane = pickAILane(hero);
    hero.aiLaneReassign = 900; // ~15s
  }

  // HP-triggered flee
  if (hero.hp < hero.maxHp * 0.3) hero.aiState = "flee";
  else if (hero.hp > hero.maxHp * 0.75) hero.aiState = "lane";

  const lane = LANES[hero.aiLane];
  // Red hero travels lane in reverse; blue AI (not used) would go forward.
  const forward = hero.side === "blue" ? 1 : -1;

  // Base target: nearest enemy within attack range (for auto-attack).
  const enemy = pickTarget(body.position.x, body.position.y, hero.side, HERO_RANGE * 1.2);

  // Desired movement direction
  let dx = 0, dy = 0;
  if (hero.aiState === "flee") {
    // Dash if possible, else walk toward own base.
    const home = hero.side === "blue" ? BLUE_ANCIENT : RED_ANCIENT;
    dx = home.x - body.position.x;
    dy = home.y - body.position.y;
    const mag = Math.hypot(dx, dy) || 1;
    dx /= mag; dy /= mag;
    if (hero.dashCd <= 0 && hero.dashTimer <= 0) tryCastDash(hero, dx, dy);
  } else {
    // Lane push — find the furthest-advanced own creep on this lane, walk
    // toward its position but nudged further down the lane; if no creep,
    // aim for the next waypoint.
    const ally = nearestAlliedCreep(hero);
    if (ally && ally.userData._lane === hero.aiLane) {
      dx = ally.position.x - body.position.x;
      dy = ally.position.y - body.position.y;
    } else {
      // Walk from current position toward the lane's end.
      const endIdx = hero.side === "blue" ? lane.length - 1 : 0;
      const tgt = lane[endIdx];
      dx = tgt.x - body.position.x;
      dy = tgt.y - body.position.y;
    }
    const mag = Math.hypot(dx, dy) || 1;
    dx /= mag; dy /= mag;

    // If currently in a fight (enemy within range) and a melee target is
    // close, drop a mine right now — it arms in 2s, so by then the creeps
    // will have clustered around the hero.
    if (enemy && hero.mineCd <= 0) {
      const enemyIsClose = distSq(body.position.x, body.position.y, enemy.position.x, enemy.position.y)
        < (HERO_RANGE * 0.6) * (HERO_RANGE * 0.6);
      if (enemyIsClose) tryCastMine(hero);
    }

    // Back off a touch if too close to an enemy tower (heuristic: stay out
    // of tower range when no allied creeps are around to tank).
    const enemyTower = pickTarget(body.position.x, body.position.y, hero.side, TOWER_RANGE + 30,
      (ud) => (ud._kind === "tower" || ud._kind === "ancient") ? 0 : 999);
    if (enemyTower) {
      const allyInLane = ally && ally.userData._lane === hero.aiLane
        && distSq(body.position.x, body.position.y, ally.position.x, ally.position.y) < 140 * 140;
      if (!allyInLane) {
        // Retreat a bit along the lane (opposite of forward).
        const retreat = hero.side === "blue" ? 0 : lane.length - 1;
        const tgt = lane[retreat];
        const rdx = tgt.x - body.position.x;
        const rdy = tgt.y - body.position.y;
        const rmag = Math.hypot(rdx, rdy) || 1;
        dx = rdx / rmag; dy = rdy / rmag;
      }
    }
  }

  // Apply velocity (unless currently dashing — tryCastDash handles that).
  if (hero.dashTimer <= 0) {
    const speed = HERO_SPEED * 0.85; // AI slightly slower than player, keeps it fair
    const v = body.velocity;
    const blend = 0.2;
    body.velocity = new Vec2(v.x + (dx * speed - v.x) * blend, v.y + (dy * speed - v.y) * blend);
  }
  // Silence unused var — forward direction is implicit in lane-end selection.
  void forward;
}

// ── Player input → movement ──────────────────────────────────────────────
function computeMoveDir() {
  if (_stickActive && (_stickVec.x !== 0 || _stickVec.y !== 0)) {
    _moveDir.x = _stickVec.x;
    _moveDir.y = _stickVec.y;
    return;
  }
  let x = 0, y = 0;
  if (_keys["KeyW"] || _keys["ArrowUp"])    y -= 1;
  if (_keys["KeyS"] || _keys["ArrowDown"])  y += 1;
  if (_keys["KeyA"] || _keys["ArrowLeft"])  x -= 1;
  if (_keys["KeyD"] || _keys["ArrowRight"]) x += 1;
  const len = Math.hypot(x, y);
  if (len > 0) { x /= len; y /= len; }
  _moveDir.x = x;
  _moveDir.y = y;
}

function applyPlayerVelocity() {
  const hero = _heroes.blue;
  if (!hero?.body?.space) return;
  if (hero.dashTimer > 0) return; // dash owns velocity
  const tvx = _moveDir.x * HERO_SPEED;
  const tvy = _moveDir.y * HERO_SPEED;
  const v = hero.body.velocity;
  const blend = 0.3;
  hero.body.velocity = new Vec2(v.x + (tvx - v.x) * blend, v.y + (tvy - v.y) * blend);
}

// ── Damage resolution & death ────────────────────────────────────────────
function resolveDamage(victim, amount, attackerSide) {
  if (!victim.space) return;
  const ud = victim.userData;
  if (!ud) return;
  // Heroes: damage goes through the hero record, not the body (iframes etc).
  if (ud._kind === "hero") {
    const hero = _heroes[ud._side];
    if (!hero || !hero.body || hero.body !== victim) return;
    if (hero.iframes > 0) return;
    hero.hp -= amount;
    if (hero.hp <= 0) {
      hero.hp = 0;
      // Award kill gold / xp to the opposite hero.
      const killer = _heroes[attackerSide];
      if (killer) {
        killer.gold += GOLD_PER_HERO;
        addHeroXP(killer, HERO_XP_PER_HERO);
      }
      // Remove body, start respawn timer.
      hero.body.space = null;
      hero.body = null;
      hero.respawnTimer = HERO_RESPAWN_FRAMES;
      hero.attackCd = 0;
      hero.dashTimer = 0;
    }
    return;
  }
  // Buildings / creeps — HP lives on userData.
  ud._hp -= amount;
  if (ud._hp <= 0) {
    onUnitDeath(victim, attackerSide);
  }
}

function onUnitDeath(body, attackerSide) {
  const ud = body.userData;
  if (!ud || !ud._kind) return;
  if (!body.space) return;
  const killerHero = _heroes[attackerSide];
  let gold = 0, xp = 0;
  if (ud._kind === "creep_melee" || ud._kind === "creep_ranged") {
    gold = GOLD_PER_CREEP; xp = HERO_XP_PER_CREEP;
  } else if (ud._kind === "tower") {
    gold = GOLD_PER_TOWER; xp = HERO_XP_PER_TOWER;
  } else if (ud._kind === "ancient") {
    gold = GOLD_PER_ANCIENT; xp = 0;
    _victory = attackerSide;
    _gameOver = true;
  }
  if (killerHero) {
    killerHero.gold += gold;
    if (xp > 0) addHeroXP(killerHero, xp);
  }
  body.space = null;
}

function processPending() {
  for (const { victim, amount, attackerSide } of _pending.damage) {
    resolveDamage(victim, amount, attackerSide);
  }
  _pending.damage.length = 0;

  for (const p of _pending.removeProj) {
    if (p.space) p.space = null;
  }
  _pending.removeProj.length = 0;

  for (const mine of _pending.detonateMine) {
    if (mine.space) detonateMine(mine);
  }
  _pending.detonateMine.length = 0;
}

// ── Hero respawn ─────────────────────────────────────────────────────────
function tickHeroRespawns() {
  for (const side of ["blue", "red"]) {
    const hero = _heroes[side];
    if (!hero || hero.body) continue;
    if (hero.respawnTimer > 0) {
      hero.respawnTimer--;
      if (hero.respawnTimer <= 0) {
        hero.body = spawnHero(side);
        hero.hp = hero.maxHp;
        hero.iframes = 60; // brief respawn i-frames
      }
    }
  }
}

// ── Shop ─────────────────────────────────────────────────────────────────
function tryBuy(hero, itemKey) {
  const item = SHOP_ITEMS[itemKey];
  if (!item) return false;
  if (hero.gold < item.cost) return false;
  if (!hero.body?.space) return false; // can't shop while dead
  hero.gold -= item.cost;
  if (itemKey === "dmg") {
    hero.damage += item.gain;
  } else if (itemKey === "heal") {
    hero.hp = Math.min(hero.maxHp, hero.hp + item.gain);
  }
  return true;
}

// ── Wave spawning ────────────────────────────────────────────────────────
// Each wave spawns 3 melee + 1 ranged creep per lane per side, staggered in
// time so they come out in a line rather than a clump.
let _waveSpawnQueue = []; // { side, lane, kind, at: frame }

function queueWave(atFrame) {
  const lanes = ["top", "mid", "bot"];
  for (const side of ["blue", "red"]) {
    for (const lane of lanes) {
      let t = atFrame;
      for (let i = 0; i < CREEPS_PER_WAVE.melee; i++) {
        _waveSpawnQueue.push({ side, lane, kind: "melee", at: t });
        t += WAVE_SPAWN_STAGGER;
      }
      for (let i = 0; i < CREEPS_PER_WAVE.ranged; i++) {
        _waveSpawnQueue.push({ side, lane, kind: "ranged", at: t });
        t += WAVE_SPAWN_STAGGER;
      }
    }
  }
}

let _frame = 0;
function tickWaves() {
  _frame++;
  _waveTimer--;
  if (_waveTimer <= 0) {
    queueWave(_frame);
    _waveTimer = WAVE_INTERVAL;
  }
  // Drain queue entries whose time has come.
  if (_waveSpawnQueue.length > 0) {
    const remain = [];
    for (const e of _waveSpawnQueue) {
      if (e.at <= _frame) {
        spawnCreep(e.side, e.lane, e.kind);
      } else {
        remain.push(e);
      }
    }
    _waveSpawnQueue = remain;
  }
}

function tickPassiveGold() {
  _goldTimer--;
  if (_goldTimer <= 0) {
    if (_heroes.blue) _heroes.blue.gold += GOLD_PASSIVE;
    if (_heroes.red) _heroes.red.gold += GOLD_PASSIVE;
    _goldTimer = GOLD_PASSIVE_INTERVAL;
  }
}

// ── Age projectiles & mines ──────────────────────────────────────────────
function tickProjectilesAndMines() {
  const expired = [];
  for (const body of _space.bodies) {
    const ud = body.userData;
    if (!ud) continue;
    if (ud._kind === "proj") {
      ud._life--;
      if (ud._life <= 0) expired.push(body);
    } else if (ud._kind === "mine") {
      ud._fuse--;
      if (ud._fuse <= 0) _pending.detonateMine.push(body);
    }
  }
  for (const b of expired) b.space = null;
}

function tickAttackFlashes() {
  // Attack flashes are stored on the attacker's userData for visual feedback.
  for (const body of _space.bodies) {
    const f = body.userData?._attackFlash;
    if (f && f.life > 0) f.life--;
  }
}

// ── Reset ────────────────────────────────────────────────────────────────
function clearAllEntities(space) {
  const toKill = [];
  for (const body of space.bodies) {
    const ud = body.userData;
    if (!ud) continue;
    if (ud._wall) continue; // keep arena walls
    toKill.push(body);
  }
  for (const b of toKill) b.space = null;
}

function resetGame(space) {
  clearAllEntities(space);

  // Rebuild buildings.
  spawnAncient("blue");
  spawnAncient("red");
  for (const def of TOWER_DEFS) spawnTower(def);

  // Heroes.
  _heroes.blue = makeHeroRecord("blue");
  _heroes.red = makeHeroRecord("red");
  _heroes.blue.body = spawnHero("blue");
  _heroes.blue.hp = _heroes.blue.maxHp;
  _heroes.red.body = spawnHero("red");
  _heroes.red.hp = _heroes.red.maxHp;

  _gameOver = false;
  _victory = null;
  _waveTimer = 120;
  _goldTimer = GOLD_PASSIVE_INTERVAL;
  _frame = 0;
  _waveSpawnQueue.length = 0;

  _stickActive = false;
  _stickVec = { x: 0, y: 0 };
  _moveDir.x = 0; _moveDir.y = 0;
  for (const k in _keys) delete _keys[k];
  _pending.damage.length = 0;
  _pending.removeProj.length = 0;
  _pending.detonateMine.length = 0;
}

// ── Rendering ────────────────────────────────────────────────────────────
function drawLaneVisuals(ctx) {
  // Faint lane ribbons (decorative) under the bodies.
  for (const laneKey of Object.keys(LANES)) {
    const waypoints = LANES[laneKey];
    ctx.strokeStyle = "rgba(255,255,255,0.05)";
    ctx.lineWidth = 60;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.beginPath();
    ctx.moveTo(waypoints[0].x, waypoints[0].y);
    for (let i = 1; i < waypoints.length; i++) ctx.lineTo(waypoints[i].x, waypoints[i].y);
    ctx.stroke();
  }
  // River — diagonal band through the center (purely visual).
  ctx.save();
  ctx.translate(WORLD_W / 2, WORLD_H / 2);
  ctx.rotate(-Math.PI / 4);
  ctx.fillStyle = "rgba(80, 140, 220, 0.09)";
  ctx.fillRect(-WORLD_W, -50, WORLD_W * 2, 100);
  ctx.restore();
  ctx.lineCap = "butt";
  ctx.lineJoin = "miter";
}

function drawUnitHpBar(ctx, body) {
  const ud = body.userData;
  if (!ud) return;
  const hp = ud._hp, max = ud._maxHp;
  if (hp == null || max == null) return;
  if (hp >= max) return;
  let r, w;
  if (ud._kind === "tower" || ud._kind === "ancient") {
    const size = ud._kind === "ancient" ? ANCIENT_SIZE : TOWER_SIZE;
    r = size / 2;
    w = size;
  } else {
    r = body.shapes.at(0).castCircle.radius;
    w = Math.max(14, r * 2);
  }
  const x = body.position.x, y = body.position.y - r - 6;
  ctx.fillStyle = "rgba(0,0,0,0.55)";
  ctx.fillRect(x - w / 2, y, w, 3);
  ctx.fillStyle = ud._side === "blue" ? "#58a6ff" : "#f85149";
  ctx.fillRect(x - w / 2, y, w * Math.max(0, hp / max), 3);
}

function drawHeroHpBar(ctx, hero) {
  if (!hero.body?.space) return;
  const body = hero.body;
  const r = HERO_RADIUS;
  const x = body.position.x, y = body.position.y - r - 8;
  const w = 40;
  ctx.fillStyle = "rgba(0,0,0,0.65)";
  ctx.fillRect(x - w / 2, y, w, 5);
  ctx.fillStyle = hero.hp <= hero.maxHp * 0.3 ? "#f85149" : "#3fb950";
  ctx.fillRect(x - w / 2, y, w * Math.max(0, hero.hp / hero.maxHp), 5);
  // Team outline ring
  ctx.beginPath();
  ctx.arc(body.position.x, body.position.y, r + 3, 0, Math.PI * 2);
  ctx.strokeStyle = sideColor(hero.side);
  ctx.lineWidth = 2;
  ctx.stroke();
  // Iframes pulse
  if (hero.iframes > 0 && Math.floor(hero.iframes / 3) % 2 === 0) {
    ctx.beginPath();
    ctx.arc(body.position.x, body.position.y, r + 1, 0, Math.PI * 2);
    ctx.fillStyle = "rgba(255,255,255,0.35)";
    ctx.fill();
  }
  // Level pip cluster
  ctx.fillStyle = "rgba(255,255,255,0.9)";
  const pipY = y - 3;
  for (let i = 0; i < hero.level; i++) {
    ctx.beginPath();
    ctx.arc(x - w / 2 + 2 + i * 5, pipY, 1.5, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawMines(ctx) {
  for (const body of _space.bodies) {
    const ud = body.userData;
    if (!ud?._kind || ud._kind !== "mine") continue;
    const x = body.position.x, y = body.position.y;
    const pulse = 1 + Math.sin(ud._fuse * 0.4) * 0.25;
    ctx.beginPath();
    ctx.arc(x, y, 9, 0, Math.PI * 2);
    ctx.fillStyle = "#30363d";
    ctx.fill();
    ctx.strokeStyle = ud._side === "blue" ? "#58a6ff" : "#f85149";
    ctx.lineWidth = 1.5;
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(x, y, 14 * pulse, 0, Math.PI * 2);
    ctx.strokeStyle = ud._side === "blue" ? "rgba(88,166,255,0.55)" : "rgba(248,81,73,0.55)";
    ctx.lineWidth = 1;
    ctx.stroke();
    const pct = ud._fuse / MINE_FUSE;
    ctx.beginPath();
    ctx.arc(x, y, 16, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * pct);
    ctx.strokeStyle = ud._side === "blue" ? "#58a6ff" : "#f85149";
    ctx.lineWidth = 2;
    ctx.stroke();
  }
}

function drawAttackFlashes(ctx) {
  for (const body of _space.bodies) {
    const f = body.userData?._attackFlash;
    if (!f || f.life <= 0) continue;
    const alpha = f.life / 6;
    ctx.strokeStyle = `rgba(255,255,255,${0.6 * alpha})`;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(body.position.x, body.position.y);
    ctx.lineTo(f.tx, f.ty);
    ctx.stroke();
  }
}

function drawAimLine(ctx) {
  const hero = _heroes.blue;
  if (!hero?.body?.space || _gameOver) return;
  const target = pickTarget(hero.body.position.x, hero.body.position.y, "blue", HERO_RANGE);
  if (!target) return;
  ctx.beginPath();
  ctx.moveTo(hero.body.position.x, hero.body.position.y);
  ctx.lineTo(target.position.x, target.position.y);
  ctx.strokeStyle = "rgba(255,255,255,0.2)";
  ctx.setLineDash([3, 5]);
  ctx.lineWidth = 1;
  ctx.stroke();
  ctx.setLineDash([]);
}

function drawBuildingBadge(ctx, body) {
  const ud = body.userData;
  const size = ud._kind === "ancient" ? ANCIENT_SIZE : TOWER_SIZE;
  const x = body.position.x, y = body.position.y;
  ctx.fillStyle = "#ffffff";
  ctx.font = ud._kind === "ancient" ? "bold 14px system-ui, sans-serif" : "bold 10px system-ui, sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(ud._kind === "ancient" ? "★" : "T", x, y);
  void size;
}

// ── Screen-space HUD ─────────────────────────────────────────────────────
function drawTopHUD(ctx) {
  const hero = _heroes.blue;
  const enemy = _heroes.red;
  ctx.fillStyle = "rgba(13,17,23,0.88)";
  ctx.fillRect(0, 0, VIEW_W, HUD_H);
  // Hero gold/level
  ctx.font = "13px system-ui, sans-serif";
  ctx.textAlign = "left";
  ctx.textBaseline = "middle";
  ctx.fillStyle = "#d29922";
  ctx.fillText(`${hero.gold}g`, 10, HUD_H / 2);
  ctx.fillStyle = "#58a6ff";
  ctx.fillText(`Lv ${hero.level}`, 70, HUD_H / 2);
  // XP bar
  if (hero.level < HERO_MAX_LEVEL) {
    const prev = HERO_XP_CURVE[hero.level - 1] ?? 0;
    const next = HERO_XP_CURVE[hero.level];
    const span = Math.max(1, next - prev);
    const pct = Math.max(0, Math.min(1, (hero.xp - prev) / span));
    ctx.fillStyle = "rgba(255,255,255,0.18)";
    ctx.fillRect(110, HUD_H / 2 - 4, 110, 8);
    ctx.fillStyle = "#a371f7";
    ctx.fillRect(110, HUD_H / 2 - 4, 110 * pct, 8);
  } else {
    ctx.fillStyle = "#a371f7";
    ctx.fillText("MAX", 110, HUD_H / 2);
  }
  // Hero HP
  ctx.fillStyle = hero.hp <= hero.maxHp * 0.3 ? "#f85149" : "#3fb950";
  ctx.fillText(`${Math.max(0, Math.round(hero.hp))}/${hero.maxHp}`, 235, HUD_H / 2);

  // Ancient HP bars (right side)
  const barW = 90, barH = 10;
  ctx.font = "10px system-ui, sans-serif";
  ctx.textAlign = "right";
  // Blue Ancient
  ctx.fillStyle = "#c9d1d9";
  ctx.fillText("Blue ★", VIEW_W - 200, HUD_H / 2);
  const blueHP = _findAncientHP("blue");
  ctx.fillStyle = "rgba(255,255,255,0.15)";
  ctx.fillRect(VIEW_W - 195, HUD_H / 2 - barH / 2, barW, barH);
  ctx.fillStyle = "#58a6ff";
  ctx.fillRect(VIEW_W - 195, HUD_H / 2 - barH / 2, barW * (blueHP / ANCIENT_HP), barH);
  // Red Ancient
  ctx.fillStyle = "#c9d1d9";
  ctx.fillText("Red ★", VIEW_W - 100, HUD_H / 2);
  const redHP = _findAncientHP("red");
  ctx.fillStyle = "rgba(255,255,255,0.15)";
  ctx.fillRect(VIEW_W - 95, HUD_H / 2 - barH / 2, barW, barH);
  ctx.fillStyle = "#f85149";
  ctx.fillRect(VIEW_W - 95, HUD_H / 2 - barH / 2, barW * (redHP / ANCIENT_HP), barH);

  // Enemy hero indicator
  if (enemy) {
    ctx.fillStyle = "#f85149";
    ctx.textAlign = "center";
    ctx.fillText(`Enemy Lv ${enemy.level}`, VIEW_W / 2, HUD_H / 2);
  }
}

function _findAncientHP(side) {
  for (const body of _space.bodies) {
    const ud = body.userData;
    if (ud?._kind === "ancient" && ud._side === side) return ud._hp;
  }
  return 0;
}

function drawShopAndAbilities(ctx) {
  _shopButtons = [];
  _abilityButtons = [];
  const hero = _heroes.blue;
  if (!hero) return;

  // Shop buttons — top-left below the HUD bar.
  const shopY = HUD_H + 6;
  const bw = 96, bh = 22, gap = 6;
  let bx = 10;
  for (const key of Object.keys(SHOP_ITEMS)) {
    const item = SHOP_ITEMS[key];
    const enabled = hero.gold >= item.cost && hero.body?.space;
    ctx.fillStyle = enabled ? "rgba(30,35,45,0.94)" : "rgba(30,35,45,0.55)";
    ctx.fillRect(bx, shopY, bw, bh);
    ctx.strokeStyle = enabled ? item.color : "rgba(255,255,255,0.15)";
    ctx.lineWidth = 1;
    ctx.strokeRect(bx + 0.5, shopY + 0.5, bw - 1, bh - 1);
    ctx.fillStyle = enabled ? "#ffffff" : "rgba(255,255,255,0.4)";
    ctx.font = "11px system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(`${item.label}  ${item.cost}g`, bx + bw / 2, shopY + bh / 2);
    _shopButtons.push({ x: bx, y: shopY, w: bw, h: bh, key });
    bx += bw + gap;
  }

  // Ability buttons — bottom-right. Q = mine, E = dash.
  const ay = VIEW_H - 58;
  const aw = 48, ah = 48;
  const spacing = 10;
  let axRight = VIEW_W - 14 - aw;
  const abilities = [
    { key: "dash", label: "E", desc: "Dash", cd: hero.dashCd, max: DASH_COOLDOWN, color: "#a371f7" },
    { key: "mine", label: "Q", desc: "Mine", cd: hero.mineCd, max: MINE_COOLDOWN, color: "#f85149" },
  ];
  for (const ab of abilities) {
    const ready = ab.cd <= 0 && hero.body?.space;
    ctx.fillStyle = ready ? "rgba(30,35,45,0.94)" : "rgba(30,35,45,0.55)";
    ctx.fillRect(axRight, ay, aw, ah);
    ctx.strokeStyle = ready ? ab.color : "rgba(255,255,255,0.15)";
    ctx.lineWidth = 1.5;
    ctx.strokeRect(axRight + 0.75, ay + 0.75, aw - 1.5, ah - 1.5);
    ctx.fillStyle = ready ? "#ffffff" : "rgba(255,255,255,0.45)";
    ctx.font = "bold 18px system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(ab.label, axRight + aw / 2, ay + aw / 2 - 4);
    ctx.font = "9px system-ui, sans-serif";
    ctx.fillText(ab.desc, axRight + aw / 2, ay + aw / 2 + 12);
    // Cooldown overlay
    if (ab.cd > 0 && ab.max > 0) {
      const pct = Math.min(1, ab.cd / ab.max);
      ctx.fillStyle = "rgba(0,0,0,0.55)";
      ctx.fillRect(axRight, ay + ah * (1 - pct), aw, ah * pct);
      ctx.fillStyle = "#ffffff";
      ctx.font = "bold 13px system-ui, sans-serif";
      ctx.fillText(`${(ab.cd / 60).toFixed(1)}`, axRight + aw / 2, ay + ah / 2);
    }
    _abilityButtons.push({ x: axRight, y: ay, w: aw, h: ah, key: ab.key });
    axRight -= aw + spacing;
  }
}

function drawDeathOverlay(ctx) {
  if (_gameOver) return; // game-over overlay takes precedence
  const hero = _heroes.blue;
  if (!hero) return;
  if (hero.body) return; // alive
  ctx.fillStyle = "rgba(0,0,0,0.55)";
  ctx.fillRect(0, 0, VIEW_W, VIEW_H);
  ctx.fillStyle = "#f85149";
  ctx.font = "bold 26px system-ui, sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText("You fell!", VIEW_W / 2, VIEW_H / 2 - 14);
  ctx.fillStyle = "#c9d1d9";
  ctx.font = "14px system-ui, sans-serif";
  const sec = Math.ceil(hero.respawnTimer / 60);
  ctx.fillText(`Respawn in ${sec}s`, VIEW_W / 2, VIEW_H / 2 + 14);
}

function drawJoystick(ctx) {
  if (!_isTouch) return;
  if (!_stickActive) {
    const cx = 70, cy = VIEW_H - 70;
    ctx.beginPath();
    ctx.arc(cx, cy, STICK_MAX_R, 0, Math.PI * 2);
    ctx.strokeStyle = "rgba(255,255,255,0.12)";
    ctx.lineWidth = 1.5;
    ctx.stroke();
    ctx.fillStyle = "rgba(255,255,255,0.25)";
    ctx.font = "10px system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("move", cx, cy);
    return;
  }
  const { x: ox, y: oy } = _stickOrigin;
  const kx = ox + _stickVec.x * STICK_MAX_R;
  const ky = oy + _stickVec.y * STICK_MAX_R;
  ctx.beginPath();
  ctx.arc(ox, oy, STICK_MAX_R, 0, Math.PI * 2);
  ctx.strokeStyle = "rgba(255,255,255,0.4)";
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(kx, ky, 18, 0, Math.PI * 2);
  ctx.fillStyle = "rgba(255,255,255,0.6)";
  ctx.fill();
}

function drawGameOver(ctx) {
  if (!_gameOver) return;
  ctx.fillStyle = "rgba(0,0,0,0.65)";
  ctx.fillRect(0, 0, VIEW_W, VIEW_H);
  const won = _victory === "blue";
  ctx.fillStyle = won ? "#3fb950" : "#f85149";
  ctx.font = "bold 34px system-ui, sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(won ? "Victory!" : "Defeat", VIEW_W / 2, VIEW_H / 2 - 18);
  ctx.fillStyle = "#c9d1d9";
  ctx.font = "14px system-ui, sans-serif";
  ctx.fillText(
    won ? "You destroyed the Red Ancient." : "The Red team destroyed your Ancient.",
    VIEW_W / 2, VIEW_H / 2 + 10,
  );
  ctx.fillStyle = "rgba(255,255,255,0.7)";
  ctx.fillText("Click / tap anywhere to restart", VIEW_W / 2, VIEW_H / 2 + 36);
}

// ── Click dispatch — screen-space HUD before world-space game actions ────
function screenCoords(worldX, worldY) {
  return { sx: worldX - _lastCamX, sy: worldY - _lastCamY };
}

function inStickZone(sx, sy) {
  return sx <= VIEW_W * 0.42 && sy >= VIEW_H * 0.55;
}

// ── Demo definition ──────────────────────────────────────────────────────
export default {
  id: "dota",
  label: "Dota-lite",
  tags: ["Gameplay", "Callbacks", "AOE", "Camera", "Mobile", "MOBA"],
  featured: true,
  featuredOrder: 6,
  desc:
    "Rough MOBA sketch — three lanes, creep waves, 12 towers and two Ancients. Move with <b>WASD</b> (or bottom-left virtual stick); auto-attack fires at the nearest enemy in range. <b>Q</b> drops a 2s <b>mine</b>, <b>E</b> is a <b>dash</b> with short i-frames. The enemy hero (red) pushes a random lane and flees at low HP. Shop buttons at the top-left buy <b>+3 DMG</b> or <b>heal 50</b>. Destroy the red Ancient ★ to win; lose if the blue Ancient falls. Camera follows the player across the 1800×1000 world.",
  walls: false,
  workerCompatible: false,
  canvas2dOnly: true,

  camera: null,

  setup(space) {
    _space = space;
    space.gravity = new Vec2(0, 0);

    _cbBlueUnit = new CbType();
    _cbRedUnit = new CbType();
    _cbBlueProj = new CbType();
    _cbRedProj = new CbType();
    _cbWall = new CbType();

    buildArenaWalls(space);
    resetGame(space);

    // Camera follows the player hero with a small deadzone so tiny moves
    // don't jitter the viewport.
    this.camera = {
      follow: () => {
        const h = _heroes.blue;
        // While respawning, linger on the Ancient so the player doesn't
        // stare into empty space.
        if (h?.body?.space) return { x: h.body.position.x, y: h.body.position.y };
        return { x: BLUE_ANCIENT.x, y: BLUE_ANCIENT.y };
      },
      bounds: { minX: 0, minY: 0, maxX: WORLD_W, maxY: WORLD_H },
      lerp: 0.12,
      deadzone: { halfW: 60, halfH: 50 },
    };

    _isTouch = typeof window !== "undefined" && (
      (typeof window.matchMedia === "function" && window.matchMedia("(pointer: coarse)").matches) ||
      ("ontouchstart" in window) ||
      (typeof navigator !== "undefined" && navigator.maxTouchPoints > 0)
    );

    // Blue projectile hits a red unit / building → queue damage + remove proj.
    space.listeners.add(new InteractionListener(
      CbEvent.BEGIN, InteractionType.COLLISION, _cbBlueProj, _cbRedUnit,
      (cb) => {
        const b1 = bodyFromInt(cb.int1), b2 = bodyFromInt(cb.int2);
        if (!b1 || !b2) return;
        const proj = b1.userData?._kind === "proj" ? b1 : b2;
        const victim = proj === b1 ? b2 : b1;
        if (!proj.space || !victim.space || proj.userData._spent) return;
        proj.userData._spent = true;
        _pending.removeProj.push(proj);
        _pending.damage.push({ victim, amount: proj.userData._damage, attackerSide: "blue" });
      },
    ));

    // Red projectile hits a blue unit / building.
    space.listeners.add(new InteractionListener(
      CbEvent.BEGIN, InteractionType.COLLISION, _cbRedProj, _cbBlueUnit,
      (cb) => {
        const b1 = bodyFromInt(cb.int1), b2 = bodyFromInt(cb.int2);
        if (!b1 || !b2) return;
        const proj = b1.userData?._kind === "proj" ? b1 : b2;
        const victim = proj === b1 ? b2 : b1;
        if (!proj.space || !victim.space || proj.userData._spent) return;
        proj.userData._spent = true;
        _pending.removeProj.push(proj);
        _pending.damage.push({ victim, amount: proj.userData._damage, attackerSide: "red" });
      },
    ));

    // Projectiles that hit the arena perimeter just despawn.
    const wallHit = (cb) => {
      const b1 = bodyFromInt(cb.int1), b2 = bodyFromInt(cb.int2);
      const proj = b1?.userData?._kind === "proj" ? b1 : b2?.userData?._kind === "proj" ? b2 : null;
      if (!proj?.space || proj.userData._spent) return;
      proj.userData._spent = true;
      _pending.removeProj.push(proj);
    };
    space.listeners.add(new InteractionListener(
      CbEvent.BEGIN, InteractionType.COLLISION, _cbBlueProj, _cbWall, wallHit,
    ));
    space.listeners.add(new InteractionListener(
      CbEvent.BEGIN, InteractionType.COLLISION, _cbRedProj, _cbWall, wallHit,
    ));

    // Keyboard handlers (guard against firing after teardown via _space check).
    _onKeyDown = (e) => {
      if (!_space) return;
      _keys[e.code] = true;
      // Cast-on-press for Q / E so holding the key doesn't retrigger.
      if (e.code === "KeyQ") tryCastMine(_heroes.blue);
      if (e.code === "KeyE") tryCastDash(_heroes.blue, _moveDir.x, _moveDir.y);
      if (e.code === "Digit1") tryBuy(_heroes.blue, "dmg");
      if (e.code === "Digit2") tryBuy(_heroes.blue, "heal");
    };
    _onKeyUp = (e) => {
      if (!_space) return;
      _keys[e.code] = false;
    };
    window.addEventListener("keydown", _onKeyDown);
    window.addEventListener("keyup", _onKeyUp);
  },

  step() {
    if (_gameOver) {
      processPending();
      return;
    }

    processPending();
    tickHeroRespawns();

    // Player & enemy hero upkeep
    updateHeroTimers(_heroes.blue);
    updateHeroTimers(_heroes.red);

    computeMoveDir();
    applyPlayerVelocity();
    heroAutoAttack(_heroes.blue);

    if (_heroes.red.body?.space) {
      runEnemyHeroAI(_heroes.red);
      heroAutoAttack(_heroes.red);
    }

    steerCreeps();
    tickBuildings();
    tickWaves();
    tickPassiveGold();
    tickProjectilesAndMines();
    tickAttackFlashes();
  },

  click(x, y, space) {
    if (_gameOver) {
      resetGame(space);
      return;
    }
    // Screen-space hit-tests first (HUD, shop, abilities, stick).
    const { sx, sy } = screenCoords(x, y);
    for (const btn of _shopButtons) {
      if (sx >= btn.x && sx <= btn.x + btn.w && sy >= btn.y && sy <= btn.y + btn.h) {
        tryBuy(_heroes.blue, btn.key);
        return;
      }
    }
    for (const btn of _abilityButtons) {
      if (sx >= btn.x && sx <= btn.x + btn.w && sy >= btn.y && sy <= btn.y + btn.h) {
        if (btn.key === "mine") tryCastMine(_heroes.blue);
        else if (btn.key === "dash") tryCastDash(_heroes.blue, _moveDir.x, _moveDir.y);
        return;
      }
    }
    // Virtual stick activation (touch only).
    if (_isTouch && inStickZone(sx, sy)) {
      _stickActive = true;
      _stickOrigin = { x: sx, y: sy };
      _stickVec = { x: 0, y: 0 };
    }
  },

  drag(x, y) {
    if (!_stickActive) return;
    const { sx, sy } = screenCoords(x, y);
    const dx = sx - _stickOrigin.x;
    const dy = sy - _stickOrigin.y;
    const d = Math.hypot(dx, dy);
    if (d < 1) {
      _stickVec = { x: 0, y: 0 };
      return;
    }
    const mag = Math.min(1, d / STICK_MAX_R);
    _stickVec = { x: (dx / d) * mag, y: (dy / d) * mag };
  },

  release() {
    _stickActive = false;
    _stickVec = { x: 0, y: 0 };
  },

  // Custom canvas2d render — camera-transformed world, then screen-space HUD.
  render(ctx, space, W, H, showOutlines, camX = 0, camY = 0) {
    _lastCamX = camX;
    _lastCamY = camY;

    // ── World space ──
    ctx.save();
    ctx.translate(-camX, -camY);
    // Faint grid + lane ribbons
    ctx.fillStyle = "#0d1117";
    ctx.fillRect(0, 0, WORLD_W, WORLD_H);
    drawLaneVisuals(ctx);

    // Bodies — manual draw so we don't pick up the default renderer's
    // grid (which would draw in a different style and clash with the lanes).
    for (const body of space.bodies) {
      drawBodySimple(ctx, body, showOutlines);
    }

    // World-space overlays (HP bars, mines, attack flashes, aim line)
    drawAttackFlashes(ctx);
    drawMines(ctx);
    drawAimLine(ctx);
    for (const body of space.bodies) {
      const ud = body.userData;
      if (!ud) continue;
      if (ud._kind === "creep_melee" || ud._kind === "creep_ranged"
        || ud._kind === "tower" || ud._kind === "ancient") {
        drawUnitHpBar(ctx, body);
      }
      if (ud._kind === "tower" || ud._kind === "ancient") {
        drawBuildingBadge(ctx, body);
      }
    }
    if (_heroes.blue) drawHeroHpBar(ctx, _heroes.blue);
    if (_heroes.red) drawHeroHpBar(ctx, _heroes.red);

    ctx.restore();

    // ── Screen space ──
    drawTopHUD(ctx);
    drawShopAndAbilities(ctx);
    drawJoystick(ctx);
    drawDeathOverlay(ctx);
    drawGameOver(ctx);
    void W; void H;
  },
};

// ── Minimal body drawing (mirror of renderer.js's drawBody with custom
// styling tweaks so the demo reads cleanly without the shared grid). ────
function drawBodySimple(ctx, body, showOutlines) {
  const ud = body.userData;
  const isProj = ud?._kind === "proj";
  const isMine = ud?._kind === "mine";
  if (isMine) return; // mines are drawn in drawMines with extra effects
  let fill, stroke;
  if (ud?._side === "blue") {
    fill = "rgba(88,166,255,0.22)"; stroke = "#58a6ff";
  } else if (ud?._side === "red") {
    fill = "rgba(248,81,73,0.22)"; stroke = "#f85149";
  } else if (ud?._wall) {
    fill = "rgba(120,160,200,0.15)"; stroke = "#607888";
  } else {
    fill = "rgba(120,160,200,0.15)"; stroke = "#607888";
  }
  const x = body.position.x, y = body.position.y;
  const rot = body.rotation;
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(rot);
  for (const shape of body.shapes) {
    const circle = shape.castCircle;
    const polygon = shape.castPolygon;
    if (circle) {
      ctx.beginPath();
      ctx.arc(0, 0, circle.radius, 0, Math.PI * 2);
      ctx.fillStyle = fill;
      ctx.fill();
      if (showOutlines || isProj) {
        ctx.strokeStyle = stroke;
        ctx.lineWidth = isProj ? 1 : 1.5;
        ctx.stroke();
      }
    } else if (polygon) {
      const verts = polygon.localVerts;
      ctx.beginPath();
      let first = true;
      for (const v of verts) {
        if (first) { ctx.moveTo(v.x, v.y); first = false; }
        else ctx.lineTo(v.x, v.y);
      }
      ctx.closePath();
      ctx.fillStyle = fill;
      ctx.fill();
      if (showOutlines) {
        ctx.strokeStyle = stroke;
        ctx.lineWidth = 1.5;
        ctx.stroke();
      }
    }
  }
  ctx.restore();
}






