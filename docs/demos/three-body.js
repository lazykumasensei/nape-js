import { Body, BodyType, Vec2, Circle } from "../nape-js.esm.js";

// ===== module state =====
let _bodies = [];
let _trails = [];
let _G = 5000;
let _currentPreset = "figure8";
let _W = 900, _H = 500;
let _space = null;
let _stepCount = 0;

const TRAIL_LEN = 240;

const BODY_COLORS = [
  { core: "#ffd166", glow: "rgba(255,209,102,0.55)" },
  { core: "#06d6a0", glow: "rgba(6,214,160,0.55)" },
  { core: "#ef476f", glow: "rgba(239,71,111,0.55)" },
  { core: "#9b8cff", glow: "rgba(155,140,255,0.55)" },
];

// ===== presets =====
// Each preset returns { G, bodies: [{ x, y, vx, vy, r, m, color }, ...] }.

// Chenciner–Montgomery (2000) periodic 3-body figure-8.
// Normalized initial conditions (G=m=1) scaled to viewport units.
function makeFigure8(W, H) {
  const cx = W / 2, cy = H / 2;
  const L = 180;
  const r = 12;
  const m = Math.PI * r * r;
  const G = 5000;
  const vScale = Math.sqrt(G * m / L);
  const px = 0.97000436, py = -0.24308753;
  const vx3 = -0.93240737, vy3 = -0.86473146;
  return {
    G,
    bodies: [
      { x: cx + px * L, y: cy + py * L, vx: -vx3 / 2 * vScale, vy: -vy3 / 2 * vScale, r, m, color: 0 },
      { x: cx - px * L, y: cy - py * L, vx: -vx3 / 2 * vScale, vy: -vy3 / 2 * vScale, r, m, color: 1 },
      { x: cx,          y: cy,          vx:  vx3     * vScale, vy:  vy3     * vScale, r, m, color: 2 },
    ],
  };
}

// Lagrange equilateral configuration: 3 equal masses at the vertices of an
// equilateral triangle, all rotating around the common centre at the same
// angular velocity. Unstable on long timescales but visually clean for ~minutes.
function makeLagrange(W, H) {
  const cx = W / 2, cy = H / 2;
  const R = 150;                                // circumradius
  const r = 12;
  const m = Math.PI * r * r;
  const G = 5000;
  // Net force on each body points toward origin with magnitude G·m²/(R²·√3).
  // Setting m·v²/R equal to that gives v = √(G·m/(R·√3)).
  const v = Math.sqrt(G * m / (R * Math.sqrt(3)));
  return {
    G,
    bodies: [0, 1, 2].map((i) => {
      const a = i * (2 * Math.PI / 3) - Math.PI / 2;
      return {
        x: cx + Math.cos(a) * R,
        y: cy + Math.sin(a) * R,
        vx: -Math.sin(a) * v,
        vy:  Math.cos(a) * v,
        r, m, color: i,
      };
    }),
  };
}

// Heavy central body + two light planets on different orbits. The two planets
// share a "sun" but interact gravitationally with each other too — the close
// approach periodically nudges their orbits, producing slow precession.
function makeSunPlanets(W, H) {
  const cx = W / 2, cy = H / 2;
  const G = 5000;
  const Rsun = 18;
  const Rp = 9;
  const Msun = Math.PI * Rsun * Rsun * 25;     // density 25 → dominant mass
  const Mp   = Math.PI * Rp   * Rp;
  const r1 = 110;
  const r2 = 200;
  const v1 = Math.sqrt(G * Msun / r1);
  const v2 = Math.sqrt(G * Msun / r2);
  const a2 = Math.PI * 0.7;                     // off-axis to add interaction
  // Recoil sun so net momentum is zero (system stays put on screen).
  const px = Mp * 0           + Mp * (-Math.sin(a2) * v2);
  const py = Mp * v1          + Mp * ( Math.cos(a2) * v2);
  return {
    G,
    bodies: [
      { x: cx, y: cy, vx: -px / Msun, vy: -py / Msun, r: Rsun, m: Msun, color: 3 },
      { x: cx + r1, y: cy, vx: 0, vy: v1, r: Rp, m: Mp, color: 0 },
      {
        x: cx + Math.cos(a2) * r2,
        y: cy + Math.sin(a2) * r2,
        vx: -Math.sin(a2) * v2,
        vy:  Math.cos(a2) * v2,
        r: Rp, m: Mp, color: 1,
      },
    ],
  };
}

// Random chaotic — 3 equal masses, random positions and velocities with the
// total momentum subtracted so the system stays roughly centred.
function makeChaos(W, H) {
  const cx = W / 2, cy = H / 2;
  const G = 5000;
  const r = 12;
  const m = Math.PI * r * r;
  const bodies = [];
  let totalVx = 0, totalVy = 0;
  for (let i = 0; i < 3; i++) {
    const a = Math.random() * Math.PI * 2;
    const dist = 90 + Math.random() * 110;
    const vmag = 50 + Math.random() * 50;
    const va = Math.random() * Math.PI * 2;
    const vx = Math.cos(va) * vmag;
    const vy = Math.sin(va) * vmag;
    totalVx += vx;
    totalVy += vy;
    bodies.push({
      x: cx + Math.cos(a) * dist,
      y: cy + Math.sin(a) * dist,
      vx, vy, r, m, color: i,
    });
  }
  const avgVx = totalVx / 3, avgVy = totalVy / 3;
  for (const b of bodies) { b.vx -= avgVx; b.vy -= avgVy; }
  return { G, bodies };
}

const PRESETS = {
  "figure8":     makeFigure8,
  "lagrange":    makeLagrange,
  "sun-planets": makeSunPlanets,
  "chaos":       makeChaos,
};

const PRESET_LABELS = {
  "figure8":     "Figure-8 — Chenciner–Montgomery periodic orbit",
  "lagrange":    "Lagrange triangle — three equal masses, equilateral",
  "sun-planets": "Sun + 2 planets — quasi-Keplerian orbits",
  "chaos":       "Random chaos — sensitive to initial conditions",
};

// ===== body construction =====
// `removeOld` is true only when switching presets at runtime (same Space).
// On a fresh setup() the previous bodies belong to a Space that was already
// torn down by the runner, so we just drop the references.
function spawnPreset(space, W, H, name, { removeOld = false } = {}) {
  if (removeOld) {
    for (const b of _bodies) b.space = null;
  }
  _bodies = [];
  _trails = [];
  _stepCount = 0;

  const preset = PRESETS[name](W, H);
  _G = preset.G;

  for (const def of preset.bodies) {
    const body = new Body(BodyType.DYNAMIC, new Vec2(def.x, def.y));
    body.shapes.add(new Circle(def.r));
    body.mass = def.m;
    body.velocity = new Vec2(def.vx, def.vy);
    body.userData._colorIdx = def.color;
    body.userData._radius = def.r;
    body.space = space;
    _bodies.push(body);
    _trails.push({
      x: new Float32Array(TRAIL_LEN),
      y: new Float32Array(TRAIL_LEN),
      idx: 0,
      count: 0,
    });
  }
}

export default {
  id: "three-body",
  label: "Three-Body Problem",
  tags: ["Zero Gravity", "Custom Force", "Orbital", "Chaos", "N-Body"],
  featured: true,
  featuredOrder: 6,
  desc: 'Three masses, mutual gravity, no closed-form solution. Switch between the famous <b>figure-8</b> orbit, the rotating <b>Lagrange triangle</b>, a sun + planets system, or pure <b>chaos</b>. <b>Click</b> a body to perturb it.',
  walls: false,
  canvas2dOnly: true,
  moduleState: `let _bodies = [];
let _trails = [];
let _G = 5000;
let _currentPreset = "figure8";
let _W = 900, _H = 500;
let _space = null;
let _stepCount = 0;
const TRAIL_LEN = 240;`,

  setup(space, W, H) {
    _space = space;
    _W = W; _H = H;
    space.gravity = new Vec2(0, 0);
    spawnPreset(space, W, H, _currentPreset);
  },

  init(container) {
    if (container.querySelector(".three-body-presets")) return;
    const bar = document.createElement("div");
    bar.className = "three-body-presets";
    bar.style.cssText =
      "position:absolute;bottom:8px;left:8px;z-index:10;display:flex;gap:6px;flex-wrap:wrap;";
    bar.addEventListener("pointerdown", (e) => e.stopPropagation());

    const presets = [
      ["figure8",     "Figure-8"],
      ["lagrange",    "Triangle"],
      ["sun-planets", "Sun + Planets"],
      ["chaos",       "Chaos"],
    ];

    const refresh = () => {
      for (const b of bar.querySelectorAll("button")) {
        const active = b.dataset.preset === _currentPreset;
        b.style.background = active ? "rgba(88,166,255,0.25)" : "rgba(13,17,23,0.75)";
        b.style.borderColor = active ? "rgba(88,166,255,0.6)" : "rgba(255,255,255,0.12)";
        b.style.color = active ? "#fff" : "#c9d1d9";
      }
    };

    for (const [id, label] of presets) {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.textContent = label;
      btn.dataset.preset = id;
      btn.style.cssText =
        "background:rgba(13,17,23,0.75);color:#c9d1d9;border:1px solid rgba(255,255,255,0.12);" +
        "padding:5px 10px;border-radius:5px;font:11px/1 system-ui;cursor:pointer;" +
        "backdrop-filter:blur(4px);-webkit-backdrop-filter:blur(4px);";
      btn.addEventListener("click", (e) => {
        e.stopPropagation();
        _currentPreset = id;
        if (_space) spawnPreset(_space, _W, _H, id, { removeOld: true });
        refresh();
      });
      bar.appendChild(btn);
    }
    refresh();
    container.appendChild(bar);
  },

  step(space, W, H) {
    _stepCount++;

    // Pairwise gravity with a small softening term to avoid singularities
    // when two bodies pass extremely close (the chaotic preset can do this).
    const eps2 = 25;
    const n = _bodies.length;
    const fx = [0, 0, 0, 0], fy = [0, 0, 0, 0];

    for (let i = 0; i < n; i++) {
      for (let j = i + 1; j < n; j++) {
        const a = _bodies[i], b = _bodies[j];
        const dx = b.position.x - a.position.x;
        const dy = b.position.y - a.position.y;
        const d2 = dx * dx + dy * dy + eps2;
        const d = Math.sqrt(d2);
        const f = _G * a.mass * b.mass / d2;
        const ix = f * dx / d, iy = f * dy / d;
        fx[i] += ix;  fy[i] += iy;
        fx[j] -= ix;  fy[j] -= iy;
      }
    }
    for (let i = 0; i < n; i++) _bodies[i].force = new Vec2(fx[i], fy[i]);

    // Trail sampling — every other frame keeps the buffer covering more time.
    if (_stepCount % 2 === 0) {
      for (let i = 0; i < n; i++) {
        const t = _trails[i];
        t.x[t.idx] = _bodies[i].position.x;
        t.y[t.idx] = _bodies[i].position.y;
        t.idx = (t.idx + 1) % TRAIL_LEN;
        if (t.count < TRAIL_LEN) t.count++;
      }
    }

    // Auto-reset if a body is ejected far off-screen.
    for (const b of _bodies) {
      if (b.position.x < -W || b.position.x > 2 * W ||
          b.position.y < -H || b.position.y > 2 * H) {
        spawnPreset(space, W, H, _currentPreset);
        break;
      }
    }
  },

  click(x, y) {
    let best = null, bestD2 = Infinity;
    for (const b of _bodies) {
      const dx = b.position.x - x;
      const dy = b.position.y - y;
      const d2 = dx * dx + dy * dy;
      if (d2 < bestD2) { bestD2 = d2; best = b; }
    }
    if (!best) return;
    const dx = best.position.x - x;
    const dy = best.position.y - y;
    const d = Math.sqrt(dx * dx + dy * dy) || 1;
    const kick = 80;
    best.velocity = new Vec2(
      best.velocity.x + dx / d * kick,
      best.velocity.y + dy / d * kick,
    );
  },

  render(ctx, space, W, H, showOutlines) {
    ctx.fillStyle = "#05080f";
    ctx.fillRect(0, 0, W, H);

    // Static starfield (deterministic so it doesn't shimmer).
    ctx.fillStyle = "rgba(255,255,255,0.18)";
    for (let i = 0; i < 90; i++) {
      const sx = (i * 9301 + 49297) % W;
      const sy = (i * 49297 + 9301) % H;
      ctx.fillRect(sx, sy, 1, 1);
    }

    // Trails — draw oldest-to-newest with rising alpha for a comet tail.
    for (let i = 0; i < _bodies.length; i++) {
      const t = _trails[i];
      if (t.count < 2) continue;
      const colorIdx = _bodies[i].userData._colorIdx ?? i;
      const col = BODY_COLORS[colorIdx % BODY_COLORS.length];
      ctx.strokeStyle = col.core;
      ctx.lineWidth = 2;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      const start = (t.idx - t.count + TRAIL_LEN) % TRAIL_LEN;
      for (let k = 1; k < t.count; k++) {
        const aIdx = (start + k - 1) % TRAIL_LEN;
        const bIdx = (start + k) % TRAIL_LEN;
        ctx.globalAlpha = (k / t.count) * 0.7;
        ctx.beginPath();
        ctx.moveTo(t.x[aIdx], t.y[aIdx]);
        ctx.lineTo(t.x[bIdx], t.y[bIdx]);
        ctx.stroke();
      }
    }
    ctx.globalAlpha = 1;

    // Bodies — radial glow + solid core.
    for (const body of _bodies) {
      const colorIdx = body.userData._colorIdx ?? 0;
      const col = BODY_COLORS[colorIdx % BODY_COLORS.length];
      const r = body.userData._radius ?? 12;
      const x = body.position.x, y = body.position.y;
      const grad = ctx.createRadialGradient(x, y, 0, x, y, r * 4);
      grad.addColorStop(0, col.glow);
      grad.addColorStop(1, "rgba(0,0,0,0)");
      ctx.fillStyle = grad;
      ctx.beginPath(); ctx.arc(x, y, r * 4, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = col.core;
      ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();
      if (showOutlines) {
        ctx.strokeStyle = "rgba(255,255,255,0.5)";
        ctx.lineWidth = 1;
        ctx.stroke();
      }
    }

    // Caption
    ctx.font = "12px system-ui, sans-serif";
    ctx.fillStyle = "rgba(255,255,255,0.55)";
    ctx.textAlign = "left";
    ctx.fillText(PRESET_LABELS[_currentPreset] ?? "", 12, 22);
  },
};
