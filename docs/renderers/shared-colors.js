/**
 * Shared colour palette for all render adapters.
 *
 * Single source of truth — Canvas2D, Three.js, and PixiJS all import from here
 * so that bodies look consistent regardless of the active render mode.
 */

// ── Hex integers (used by Three.js and PixiJS) ─────────────────────────────

export const BODY_COLORS_HEX = [
  0x58a6ff, // blue
  0xd29922, // gold
  0x3fb950, // green
  0xf85149, // red
  0xa371f7, // purple
  0xdbabff, // lavender
];

export const STATIC_COLOR_HEX  = 0x607888;
export const SLEEPING_COLOR_HEX = 0x3fb950;
export const CONSTRAINT_COLOR_HEX = 0xd29922;

// ── CSS strings (used by Canvas2D) ──────────────────────────────────────────

export const BODY_COLORS_CSS = [
  { fill: "rgba(88,166,255,0.18)",  stroke: "#58a6ff" },
  { fill: "rgba(210,153,34,0.18)",  stroke: "#d29922" },
  { fill: "rgba(63,185,80,0.18)",   stroke: "#3fb950" },
  { fill: "rgba(248,81,73,0.18)",   stroke: "#f85149" },
  { fill: "rgba(163,113,247,0.18)", stroke: "#a371f7" },
  { fill: "rgba(219,171,255,0.18)", stroke: "#dbabff" },
];

export const STATIC_COLOR_CSS  = { fill: "rgba(120,160,200,0.15)", stroke: "#607888" };
export const SLEEPING_COLOR_CSS = { fill: "rgba(100,200,100,0.12)", stroke: "#3fb950" };

// ── Helper: resolve body colour index ───────────────────────────────────────

/**
 * Determine the palette index for a body, respecting userData overrides.
 * @param {*} body — nape-js Body
 * @returns {{ index: number, isStatic: boolean, isSleeping: boolean, isCustom: boolean, customColor: * }}
 */
export function resolveBodyColor(body) {
  const ud = body.userData;
  const customColor = ud?._color;
  if (customColor) return { index: 0, isStatic: false, isSleeping: false, isCustom: true, customColor };

  const overrideIdx = ud?._colorIdx;
  const isStatic = body.isStatic();
  const isSleeping = !isStatic && body.isSleeping;
  const hasOverride = overrideIdx != null && overrideIdx > 0;
  const index = (overrideIdx ?? 0) % BODY_COLORS_HEX.length;

  return { index, isStatic: hasOverride ? false : isStatic, isSleeping: hasOverride ? false : isSleeping, isCustom: false, customColor: null };
}

/**
 * Get a hex colour for a body (for Three.js / PixiJS).
 * @param {*} body
 * @returns {number}
 */
export function bodyColorHex(body) {
  const r = resolveBodyColor(body);
  if (r.isCustom) return parseInt(r.customColor.stroke.replace("#", ""), 16);
  if (r.isStatic)  return STATIC_COLOR_HEX;
  if (r.isSleeping) return SLEEPING_COLOR_HEX;
  return BODY_COLORS_HEX[r.index];
}

/**
 * Get a CSS fill/stroke pair for a body (for Canvas2D).
 * @param {*} body
 * @returns {{ fill: string, stroke: string }}
 */
export function bodyColorCSS(body) {
  const r = resolveBodyColor(body);
  if (r.isCustom) return r.customColor;
  if (r.isStatic)  return STATIC_COLOR_CSS;
  if (r.isSleeping) return SLEEPING_COLOR_CSS;
  return BODY_COLORS_CSS[r.index];
}

/**
 * Get body fill alpha (for PixiJS / Three.js transparency).
 * @param {*} body
 * @returns {number}
 */
export function bodyFillAlpha(body) {
  if (body.userData?._isZone) return 0.05;
  if (body.isStatic()) return 0.15;
  return 0.25;
}
