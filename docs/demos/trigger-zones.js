import { Body, BodyType, Vec2, Circle, Polygon, Material, TriggerZone } from "../nape-js.esm.js";
import { spawnRandomShape } from "../demo-runner.js";

/**
 * Each zone tracks how many bodies are currently inside it,
 * and how many total entries occurred. The demo stores this
 * state in body.userData so the renderer can color them.
 */
const ZONE_COLORS = [
  { name: "green",  idx: 2 },
  { name: "red",    idx: 3 },
  { name: "blue",   idx: 0 },
];

export default {
  id: "trigger-zones",
  label: "Trigger Zones",
  tags: ["TriggerZone", "Sensor", "Callback"],
  featured: false,
  desc: "Bodies fall through colored trigger zones. Counters show <b>enter/exit</b> events and current <b>occupancy</b> — powered by the high-level <code>TriggerZone</code> API.",
  walls: true,
  workerCompatible: false,

  /** @type {{ zones: { zone: TriggerZone, count: number, total: number, label: string }[] }} */
  _state: null,

  setup(space, W, H) {
    space.gravity = new Vec2(0, 300);

    const zones = [];

    // Create three trigger zones across the scene
    const zoneConfigs = [
      { x: 160, y: 260, w: 140, h: 100, color: ZONE_COLORS[0] },
      { x: W / 2, y: 320, w: 160, h: 120, color: ZONE_COLORS[1] },
      { x: W - 160, y: 260, w: 140, h: 100, color: ZONE_COLORS[2] },
    ];

    for (const cfg of zoneConfigs) {
      const body = new Body(BodyType.STATIC, new Vec2(cfg.x, cfg.y));
      body.shapes.add(new Polygon(Polygon.box(cfg.w, cfg.h)));
      try {
        body.userData._colorIdx = cfg.color.idx;
        body.userData._isZone = true;
        body.userData._zoneW = cfg.w;
        body.userData._zoneH = cfg.h;
      } catch (_) {}
      body.space = space;

      const state = { zone: null, count: 0, total: 0, label: cfg.color.name };

      const zone = new TriggerZone(space, body, {
        onEnter: () => {
          state.count++;
          state.total++;
        },
        onExit: () => {
          state.count = Math.max(0, state.count - 1);
        },
      });

      state.zone = zone;
      zones.push(state);
    }

    this._state = { zones };

    // Spawn initial bodies above the zones
    for (let i = 0; i < 30; i++) {
      spawnRandomShape(
        space,
        80 + Math.random() * (W - 160),
        20 + Math.random() * 120,
      );
    }
  },

  step(space) {
    // Recycle bodies that fall below the scene — move them back to the top
    for (const body of space.bodies) {
      if (body.isDynamic() && body.position.y > 550) {
        body.position = new Vec2(
          80 + Math.random() * 740,
          -20 - Math.random() * 60,
        );
        body.velocity = new Vec2(0, 0);
        body.angularVel = 0;
      }
    }
  },

  click(x, y, space) {
    for (let i = 0; i < 5; i++) {
      spawnRandomShape(
        space,
        x + (Math.random() - 0.5) * 40,
        y + (Math.random() - 0.5) * 40,
      );
    }
  },

  code2d: `// Trigger Zones — high-level onEnter/onStay/onExit API
const W = canvas.width, H = canvas.height;
const space = new Space(new Vec2(0, 300));

addWalls();

// --- Create a trigger zone ---
const zoneBody = new Body(BodyType.STATIC, new Vec2(W / 2, 300));
zoneBody.shapes.add(new Polygon(Polygon.box(160, 120)));
zoneBody.space = space;

let inside = 0;
let totalEntered = 0;

// TriggerZone auto-enables sensor and manages listeners
const zone = new TriggerZone(space, zoneBody, {
  onEnter: (other) => {
    inside++;
    totalEntered++;
    console.log("Body entered! Total:", totalEntered);
  },
  onStay: (other) => {
    // Called every step while bodies are inside
  },
  onExit: (other) => {
    inside--;
    console.log("Body left! Still inside:", inside);
  },
});

// Spawn falling bodies
for (let i = 0; i < 30; i++) {
  const body = new Body(BodyType.DYNAMIC, new Vec2(
    80 + Math.random() * (W - 160),
    20 + Math.random() * 120,
  ));
  if (Math.random() < 0.5) {
    body.shapes.add(new Circle(6 + Math.random() * 14));
  } else {
    const w = 10 + Math.random() * 24;
    const h = 10 + Math.random() * 24;
    body.shapes.add(new Polygon(Polygon.box(w, h)));
  }
  body.space = space;
}

function loop() {
  space.step(1 / 60, 8, 3);

  // Recycle bodies that fall off-screen
  for (const body of space.bodies) {
    if (body.isDynamic() && body.position.y > H + 50) {
      body.position = new Vec2(
        80 + Math.random() * (W - 160), -20,
      );
      body.velocity = new Vec2(0, 0);
    }
  }

  ctx.clearRect(0, 0, W, H);
  drawGrid();

  // Draw zone rectangle
  ctx.save();
  ctx.globalAlpha = 0.2;
  ctx.fillStyle = "#3fb950";
  ctx.fillRect(W / 2 - 80, 300 - 60, 160, 120);
  ctx.globalAlpha = 1;
  ctx.strokeStyle = "#3fb950";
  ctx.lineWidth = 2;
  ctx.strokeRect(W / 2 - 80, 300 - 60, 160, 120);
  ctx.fillStyle = "#e6edf3";
  ctx.font = "bold 14px monospace";
  ctx.textAlign = "center";
  ctx.fillText("inside: " + inside + "  total: " + totalEntered,
    W / 2, 300 - 60 - 10);
  ctx.restore();

  for (const body of space.bodies) drawBody(body);
  requestAnimationFrame(loop);
}
loop();`,

  codePixi: `// Trigger Zones — high-level onEnter/onStay/onExit API
const space = new Space(new Vec2(0, 300));

addWalls();

// --- Create a trigger zone ---
const zoneBody = new Body(BodyType.STATIC, new Vec2(W / 2, 300));
zoneBody.shapes.add(new Polygon(Polygon.box(160, 120)));
zoneBody.space = space;

let inside = 0;
let totalEntered = 0;

const zone = new TriggerZone(space, zoneBody, {
  onEnter: (other) => { inside++; totalEntered++; },
  onExit:  (other) => { inside--; },
});

// Spawn falling bodies
for (let i = 0; i < 30; i++) {
  const body = new Body(BodyType.DYNAMIC, new Vec2(
    80 + Math.random() * (W - 160),
    20 + Math.random() * 120,
  ));
  if (Math.random() < 0.5) {
    body.shapes.add(new Circle(6 + Math.random() * 14));
  } else {
    body.shapes.add(new Polygon(Polygon.box(
      10 + Math.random() * 24, 10 + Math.random() * 24,
    )));
  }
  body.space = space;
}

function loop() {
  space.step(1 / 60, 8, 3);

  for (const body of space.bodies) {
    if (body.isDynamic() && body.position.y > H + 50) {
      body.position = new Vec2(
        80 + Math.random() * (W - 160), -20,
      );
      body.velocity = new Vec2(0, 0);
    }
  }

  drawGrid();
  syncBodies(space);
  app.render();
  requestAnimationFrame(loop);
}
loop();`,
};
