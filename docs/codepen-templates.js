/**
 * Consolidated CodePen generation for nape-js demo pages.
 *
 * Provides templates for each renderer and a single openInCodePen() function
 * used by both app.js (homepage) and examples.js (grid page).
 */

const NAPE_CDN = "https://cdn.jsdelivr.net/npm/@newkrok/nape-js/dist/index.js";
const THREE_CDN = "https://cdn.jsdelivr.net/npm/three@0.170.0/build/three.module.js";

// =========================================================================
// Shared renderer helper code (embedded in CodePen output)
// =========================================================================

const RENDERER_2D = `// ── Renderer ────────────────────────────────────────────────────────────────
const COLORS = [
  { fill: "rgba(88,166,255,0.18)",  stroke: "#58a6ff" },
  { fill: "rgba(210,153,34,0.18)",  stroke: "#d29922" },
  { fill: "rgba(63,185,80,0.18)",   stroke: "#3fb950" },
  { fill: "rgba(248,81,73,0.18)",   stroke: "#f85149" },
  { fill: "rgba(163,113,247,0.18)", stroke: "#a371f7" },
  { fill: "rgba(219,171,255,0.18)", stroke: "#dbabff" },
];
function bodyColor(body) {
  if (body.isStatic()) return { fill: "rgba(120,160,200,0.15)", stroke: "#607888" };
  const idx = (body.userData?._colorIdx ?? Math.abs(Math.round(body.position.x * 0.1))) % COLORS.length;
  return COLORS[idx];
}
function drawBody(body) {
  const px = body.position.x, py = body.position.y;
  ctx.save(); ctx.translate(px, py); ctx.rotate(body.rotation);
  const { fill, stroke } = bodyColor(body);
  for (const shape of body.shapes) {
    if (shape.isCircle()) {
      const r = shape.castCircle.radius;
      ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI * 2);
      ctx.fillStyle = fill; ctx.fill();
      ctx.strokeStyle = stroke; ctx.lineWidth = 1.2; ctx.stroke();
      ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(r, 0);
      ctx.strokeStyle = stroke + "55"; ctx.stroke();
    } else if (shape.isCapsule()) {
      const cap = shape.castCapsule;
      const hl = cap.halfLength, r = cap.radius;
      const x0 = -hl, x1 = hl, top = -r, bot = r;
      ctx.beginPath();
      ctx.moveTo(x1, top);
      ctx.arc(x1, 0, r, -Math.PI / 2, Math.PI / 2);
      ctx.lineTo(x0, bot);
      ctx.arc(x0, 0, r, Math.PI / 2, -Math.PI / 2);
      ctx.closePath();
      ctx.fillStyle = fill; ctx.fill();
      ctx.strokeStyle = stroke; ctx.lineWidth = 1.2; ctx.stroke();
    } else if (shape.isPolygon()) {
      const verts = shape.castPolygon.localVerts;
      const len = verts.length; if (len < 3) continue;
      ctx.beginPath(); ctx.moveTo(verts.at(0).x, verts.at(0).y);
      for (let i = 1; i < len; i++) ctx.lineTo(verts.at(i).x, verts.at(i).y);
      ctx.closePath(); ctx.fillStyle = fill; ctx.fill();
      ctx.strokeStyle = stroke; ctx.lineWidth = 1.2; ctx.stroke();
    }
  }
  ctx.restore();
}
function drawGrid() {
  ctx.strokeStyle = "#1a2030"; ctx.lineWidth = 0.5;
  for (let x = 0; x < W; x += 50) { ctx.beginPath(); ctx.moveTo(x,0); ctx.lineTo(x,H); ctx.stroke(); }
  for (let y = 0; y < H; y += 50) { ctx.beginPath(); ctx.moveTo(0,y); ctx.lineTo(W,y); ctx.stroke(); }
}
function drawConstraintLines() {
  try {
    const raw = space.constraints;
    for (let i = 0; i < raw.length; i++) {
      const c = raw.at(i);
      if (c.body1 && c.body2) {
        ctx.beginPath();
        ctx.moveTo(c.body1.position.x, c.body1.position.y);
        ctx.lineTo(c.body2.position.x, c.body2.position.y);
        ctx.strokeStyle = "#d2992233"; ctx.lineWidth = 1; ctx.stroke();
      }
    }
  } catch(_) {}
}
// ── End Renderer ─────────────────────────────────────────────────────────────
`;

const RENDERER_PIXI = `// ── PixiJS Renderer (Sprite + Texture) ──────────────────────────────────────
const FILL_COLORS = [0x58a6ff, 0xd29922, 0x3fb950, 0xf85149, 0xa371f7, 0xdbabff];
const STATIC_FILL = 0x607888;
const bodySprites = new Map();

function bodyFill(body) {
  if (body.isStatic()) return STATIC_FILL;
  const idx = (body.userData?._colorIdx ?? Math.abs(Math.round(body.position.x * 0.1))) % FILL_COLORS.length;
  return FILL_COLORS[idx];
}

// Draw body shapes into a temporary Graphics, bake to texture, return Sprite
function addGfx(body) {
  if (bodySprites.has(body)) return bodySprites.get(body);

  const gfx = new PIXI.Graphics();
  const color = bodyFill(body);
  const alpha = body.isStatic() ? 0.15 : 0.25;

  for (const shape of body.shapes) {
    if (shape.isCircle()) {
      const r = shape.castCircle.radius;
      gfx.circle(0, 0, r);
      gfx.fill({ color, alpha });
      gfx.circle(0, 0, r);
      gfx.stroke({ color, width: 1.2, alpha: 0.8 });
      gfx.moveTo(0, 0); gfx.lineTo(r, 0);
      gfx.stroke({ color, width: 1, alpha: 0.4 });
    } else if (shape.isPolygon()) {
      const verts = shape.castPolygon.localVerts;
      const len = verts.length; if (len < 3) continue;
      const pts = [];
      for (let i = 0; i < len; i++) pts.push(verts.at(i).x, verts.at(i).y);
      gfx.poly(pts, true);
      gfx.fill({ color, alpha });
      gfx.poly(pts, true);
      gfx.stroke({ color, width: 1.2, alpha: 0.8 });
    } else if (shape.isCapsule()) {
      const cap = shape.castCapsule;
      const hl = cap.halfLength, r = cap.radius;
      gfx.roundRect(-hl - r, -r, (hl + r) * 2, r * 2, r);
      gfx.fill({ color, alpha });
      gfx.roundRect(-hl - r, -r, (hl + r) * 2, r * 2, r);
      gfx.stroke({ color, width: 1.2, alpha: 0.8 });
    }
  }

  // Bake Graphics → Texture → Sprite (GPU-friendly batched quad)
  const bounds = gfx.getLocalBounds();
  const texture = app.renderer.generateTexture({ target: gfx, resolution: 2 });
  const sprite = new PIXI.Sprite(texture);
  sprite.anchor.set(-bounds.x / bounds.width, -bounds.y / bounds.height);
  sprite.x = body.position.x;
  sprite.y = body.position.y;
  sprite.rotation = body.rotation;

  gfx.destroy();
  app.stage.addChild(sprite);
  bodySprites.set(body, sprite);
  return sprite;
}

function syncBodies(space) {
  const alive = new Set();
  for (const body of space.bodies) alive.add(body);
  for (const [body, sprite] of bodySprites) {
    if (!alive.has(body)) {
      app.stage.removeChild(sprite);
      sprite.texture.destroy(true);
      sprite.destroy();
      bodySprites.delete(body);
    }
  }
  for (const body of space.bodies) {
    const sprite = addGfx(body);
    sprite.x = body.position.x;
    sprite.y = body.position.y;
    sprite.rotation = body.rotation;
  }
  // Keep overlays on top of body sprites
  if (constraintGfx) app.stage.addChild(constraintGfx);
}

let gridGfx = null;
function drawGrid() {
  if (gridGfx) return;
  gridGfx = new PIXI.Graphics();
  for (let x = 0; x < W; x += 50) { gridGfx.moveTo(x, 0); gridGfx.lineTo(x, H); }
  for (let y = 0; y < H; y += 50) { gridGfx.moveTo(0, y); gridGfx.lineTo(W, y); }
  gridGfx.stroke({ color: 0x1a2030, width: 0.5 });
  app.stage.addChildAt(gridGfx, 0);
}

let constraintGfx = null;
function drawConstraintLines() {
  if (!constraintGfx) { constraintGfx = new PIXI.Graphics(); app.stage.addChild(constraintGfx); }
  constraintGfx.clear();
  try {
    const raw = space.constraints;
    for (let i = 0; i < raw.length; i++) {
      const c = raw.at(i);
      if (c.body1 && c.body2) {
        constraintGfx.moveTo(c.body1.position.x, c.body1.position.y);
        constraintGfx.lineTo(c.body2.position.x, c.body2.position.y);
      }
    }
    constraintGfx.stroke({ color: 0xd29922, width: 1, alpha: 0.2 });
  } catch(_) {}
}
// ── End PixiJS Renderer ─────────────────────────────────────────────────────
`;

const WALLS_HELPER = `function addWalls() {
  const t = 20;
  const floor = new Body(BodyType.STATIC, new Vec2(W / 2, H - t / 2));
  floor.shapes.add(new Polygon(Polygon.box(W, t))); floor.space = space;
  const left = new Body(BodyType.STATIC, new Vec2(t / 2, H / 2));
  left.shapes.add(new Polygon(Polygon.box(t, H))); left.space = space;
  const right = new Body(BodyType.STATIC, new Vec2(W - t / 2, H / 2));
  right.shapes.add(new Polygon(Polygon.box(t, H))); right.space = space;
  const ceil = new Body(BodyType.STATIC, new Vec2(W / 2, t / 2));
  ceil.shapes.add(new Polygon(Polygon.box(W, t))); ceil.space = space;
  return floor;
}
`;

// =========================================================================
// Template definitions by adapter ID
// =========================================================================

const TEMPLATES = {
  canvas2d: {
    html: `<canvas id="demoCanvas" width="900" height="500" style="background:#0a0e14;display:block;max-width:100%;border:1px solid #30363d;border-radius:8px"></canvas>`,

    buildJS(code) {
      return `import {
  Space, Body, BodyType, Vec2, Circle, Polygon, Capsule,
  PivotJoint, DistanceJoint, AngleJoint, WeldJoint, MotorJoint, LineJoint,
  Material, FluidProperties, InteractionFilter, InteractionGroup, AABB, MarchingSquares,
  CbType, CbEvent, InteractionType, InteractionListener, PreListener, PreFlag,
  CharacterController,
} from "${NAPE_CDN}";

const canvas = document.getElementById("demoCanvas");
const canvasWrap = canvas;
const ctx = canvas.getContext("2d");

${RENDERER_2D}
${WALLS_HELPER}
${code}`;
    },
  },

  threejs: {
    html: `<div id="container" style="width:900px;max-width:100%;height:500px;border:1px solid #30363d;border-radius:8px;overflow:hidden"></div>`,

    buildJS(code) {
      return `import * as THREE from "${THREE_CDN}";
import {
  Space, Body, BodyType, Vec2, Circle, Polygon, Capsule,
  PivotJoint, DistanceJoint, AngleJoint, WeldJoint, MotorJoint, LineJoint,
  Material, FluidProperties, InteractionFilter, InteractionGroup,
  CbType, CbEvent, InteractionType, InteractionListener, PreListener, PreFlag,
  CharacterController,
} from "${NAPE_CDN}";

${WALLS_HELPER}
${code}`;
    },
  },

  pixijs: {
    html: `<div id="container" style="width:900px;max-width:100%;height:500px;border:1px solid #30363d;border-radius:8px;overflow:hidden"></div>`,

    buildJS(code) {
      return `import * as PIXI from "https://cdn.jsdelivr.net/npm/pixi.js@8/dist/pixi.min.mjs";
import {
  Space, Body, BodyType, Vec2, Circle, Polygon, Capsule,
  PivotJoint, DistanceJoint, AngleJoint, WeldJoint, MotorJoint, LineJoint,
  Material, FluidProperties, InteractionFilter, InteractionGroup, AABB, MarchingSquares,
  CbType, CbEvent, InteractionType, InteractionListener, PreListener, PreFlag,
  CharacterController,
} from "${NAPE_CDN}";

const container = document.getElementById("container");
const W = 900, H = 500;
const app = new PIXI.Application();
await app.init({ width: W, height: H, backgroundColor: 0x0d1117, antialias: true });
container.appendChild(app.canvas);

${RENDERER_PIXI}
${WALLS_HELPER}
${code}`;
    },
  },
};

// =========================================================================
// CSS (shared across all templates)
// =========================================================================

const CODEPEN_CSS = `body { margin: 20px; background: #0d1117; font-family: sans-serif; color: #e6edf3; }`;

// =========================================================================
// Public API
// =========================================================================

/**
 * Get the code string for a demo in the specified renderer mode.
 *
 * Priority:
 *   1. demo.codepenOverride — complete custom CodePen code (escape hatch)
 *   2. For threejs mode: demo.code3d → demo.code (never falls back to code2d)
 *   3. For canvas2d mode: demo.code2d → demo.code
 *   4. For pixijs mode: demo.codePixi → demo.code (never falls back to code2d)
 *
 * @param {Object} demo — demo definition
 * @param {string} adapterId — "canvas2d" | "threejs" | "pixijs"
 * @returns {string}
 */
export function getDemoCode(demo, adapterId) {
  if (demo.codepenOverride) return demo.codepenOverride;

  if (adapterId === "threejs") {
    return demo.code3d ?? demo.code ?? null;
  }
  if (adapterId === "pixijs") {
    return demo.codePixi ?? demo.code ?? null;
  }
  // canvas2d (default)
  return demo.code ?? demo.code2d ?? null;
}

/**
 * Generate CodePen data for a demo + renderer combination.
 *
 * @param {Object} demo — demo definition
 * @param {string} adapterId — "canvas2d" | "threejs" | "pixijs"
 * @returns {{ title, description, html, css, js, js_module } | null}
 */
export function generateCodePen(demo, adapterId) {
  const template = TEMPLATES[adapterId] ?? TEMPLATES.canvas2d;
  const code = getDemoCode(demo, adapterId);

  if (!code) return null;

  const suffixes = { threejs: " (3D)", pixijs: " (PixiJS)" };
  const suffix = suffixes[adapterId] ?? "";

  return {
    title: `nape-js — ${demo.label ?? demo.id}${suffix}`,
    description: `Interactive physics demo powered by nape-js, a fully typed TypeScript 2D physics engine.\nhttps://github.com/NewKrok/nape-js`,
    tags: ["nape-js", "physics", "2d-physics", "typescript", "gamedev"],
    html: template.html,
    css: CODEPEN_CSS,
    js: template.buildJS(code),
    js_module: true,
  };
}

/**
 * Open a CodePen with the demo's code in a new tab.
 *
 * @param {Object} demo — demo definition
 * @param {string} adapterId — "canvas2d" | "threejs" | "pixijs"
 */
export function openInCodePen(demo, adapterId) {
  const data = generateCodePen(demo, adapterId);
  if (!data) return;

  const form = document.createElement("form");
  form.method = "POST";
  form.action = "https://codepen.io/pen/define";
  form.target = "_blank";
  const input = document.createElement("input");
  input.type = "hidden";
  input.name = "data";
  input.value = JSON.stringify(data);
  form.appendChild(input);
  document.body.appendChild(form);
  form.submit();
  document.body.removeChild(form);
}

/**
 * Get the active code for preview/copy based on demo + current adapter.
 *
 * Returns the full, self-contained code (imports + helpers + demo code)
 * so that the preview panel shows copy-pasteable, runnable code.
 *
 * @param {Object} demo — demo definition
 * @param {string} adapterId — current adapter ID
 * @returns {string}
 */
export function getPreviewCode(demo, adapterId) {
  const code = getDemoCode(demo, adapterId);
  if (!code) return "// No source code available for this demo.";

  const template = TEMPLATES[adapterId] ?? TEMPLATES.canvas2d;
  return template.buildJS(code);
}
