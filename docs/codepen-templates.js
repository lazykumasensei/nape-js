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
  Space, Body, BodyType, Vec2, Circle, Polygon,
  PivotJoint, DistanceJoint, AngleJoint, WeldJoint, MotorJoint, LineJoint,
  Material, InteractionFilter, InteractionGroup,
  CbType, CbEvent, InteractionType, InteractionListener, PreListener, PreFlag,
} from "${NAPE_CDN}";

${WALLS_HELPER}
${code}`;
    },
  },

  // PixiJS template — ready for Phase E
  pixijs: {
    html: `<div id="container" style="width:900px;max-width:100%;height:500px;border:1px solid #30363d;border-radius:8px;overflow:hidden"></div>`,

    buildJS(code) {
      return `import * as PIXI from "https://cdn.jsdelivr.net/npm/pixi.js@8/dist/pixi.min.mjs";
import {
  Space, Body, BodyType, Vec2, Circle, Polygon, Capsule,
  PivotJoint, DistanceJoint, AngleJoint, WeldJoint, MotorJoint, LineJoint,
  Material, FluidProperties, InteractionFilter, InteractionGroup, AABB,
  CbType, CbEvent, InteractionType, InteractionListener, PreListener, PreFlag,
} from "${NAPE_CDN}";

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
 *   2. For threejs mode: demo.code3d (legacy) → demo.code
 *   3. For canvas2d mode: demo.code2d (legacy) → demo.code
 *   4. For pixijs mode: demo.code → demo.code2d
 *
 * @param {Object} demo — demo definition
 * @param {string} adapterId — "canvas2d" | "threejs" | "pixijs"
 * @returns {string}
 */
export function getDemoCode(demo, adapterId) {
  if (demo.codepenOverride) return demo.codepenOverride;

  if (adapterId === "threejs") {
    return demo.code3d ?? demo.code ?? demo.code2d ?? null;
  }
  if (adapterId === "pixijs") {
    return demo.code ?? demo.code2d ?? null;
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
    description: `Interactive physics demo using nape-js TypeScript wrapper.\nhttps://github.com/NewKrok/nape-js`,
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
 * @param {Object} demo — demo definition
 * @param {string} adapterId — current adapter ID
 * @returns {string}
 */
export function getPreviewCode(demo, adapterId) {
  const code = getDemoCode(demo, adapterId);
  return code ?? "// No source code available for this demo.";
}
