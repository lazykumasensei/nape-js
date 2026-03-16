/**
 * PixiJSAdapter — PixiJS renderer for nape-js demos.
 *
 * Implements the RendererAdapter interface using PixiJS (lazy-loaded via CDN).
 * This is the first extensibility proof for the pluggable renderer system.
 */

// ---------------------------------------------------------------------------
// PixiJS — lazy-loaded once, shared across all adapter instances
// ---------------------------------------------------------------------------

let _PIXI = null;

/** Pre-load PixiJS. Call before attach(). */
export async function loadPixi() {
  if (_PIXI) return _PIXI;
  _PIXI = await import("https://cdn.jsdelivr.net/npm/pixi.js@8/dist/pixi.min.mjs");
  return _PIXI;
}

export function getPixi() {
  return _PIXI;
}

// ---------------------------------------------------------------------------
// Colour palette (matching the 2D/3D adapters)
// ---------------------------------------------------------------------------

const FILL_COLORS = [
  0x58a6ff, 0xd29922, 0x3fb950, 0xf85149, 0xa371f7, 0xdbabff,
];
const STATIC_FILL = 0x607888;
const SLEEPING_FILL = 0x3fb950;
const OUTLINE_ALPHA = 0.8;

// ---------------------------------------------------------------------------
// PixiJSAdapter
// ---------------------------------------------------------------------------

export class PixiJSAdapter {
  id = "pixijs";
  displayName = "PixiJS";

  #container = null;
  #W = 0;
  #H = 0;
  #showOutlines = true;
  #app = null;
  #bodyGraphics = new Map(); // Body -> PIXI.Graphics

  // ---------------------------------------------------------------------------
  // Lifecycle
  // ---------------------------------------------------------------------------

  async attach(container, W, H) {
    if (!_PIXI) throw new Error("PixiJS not loaded. Call loadPixi() first.");

    this.#container = container;
    this.#W = W;
    this.#H = H;

    // Pin container height (same pattern as ThreeJS adapter)
    const cr = container.getBoundingClientRect();
    container.style.height = `${cr.height}px`;

    this.#app = new _PIXI.Application();
    await this.#app.init({
      width: W,
      height: H,
      backgroundColor: 0x0d1117,
      antialias: true,
      resolution: window.devicePixelRatio || 1,
      autoDensity: true,
    });

    this.#app.canvas.style.cssText =
      "display:block;position:absolute;inset:0;width:100%;height:100%;object-fit:contain";
    container.appendChild(this.#app.canvas);
  }

  detach() {
    if (this.#app && this.#container) {
      this.#container.removeChild(this.#app.canvas);
      this.#app.destroy(true);
      this.#app = null;
    }
    this.#bodyGraphics.clear();
    if (this.#container) {
      this.#container.style.height = "";
      this.#container = null;
    }
  }

  isAttached() {
    return this.#app !== null;
  }

  // ---------------------------------------------------------------------------
  // Per-demo hooks
  // ---------------------------------------------------------------------------

  onDemoLoad(space, _W, _H) {
    if (!this.#app) return;
    // Build graphics for all existing bodies
    for (const body of space.bodies) {
      this.#addBodyGraphics(body);
    }
  }

  onDemoUnload() {
    if (!this.#app) return;
    // Remove all body graphics
    for (const [, gfx] of this.#bodyGraphics) {
      this.#app.stage.removeChild(gfx);
      gfx.destroy();
    }
    this.#bodyGraphics.clear();
  }

  // ---------------------------------------------------------------------------
  // Per-frame rendering
  // ---------------------------------------------------------------------------

  renderFrame(space, W, H, { showOutlines, overrides }) {
    if (!this.#app) return;

    if (overrides?.pixijs) {
      overrides.pixijs(this, space, W, H, showOutlines);
      return;
    }

    // Sync bodies: add new, remove stale
    this.#syncBodies(space);

    // Update positions
    for (const [body, gfx] of this.#bodyGraphics) {
      gfx.x = body.position.x;
      gfx.y = body.position.y;
      gfx.rotation = body.rotation;
    }

    // PixiJS renders automatically via its ticker, but we force a manual render
    this.#app.render();
  }

  renderPreview(space, W, H) {
    this.renderFrame(space, W, H, { showOutlines: true, overrides: null });
  }

  // ---------------------------------------------------------------------------
  // Worker mode
  // ---------------------------------------------------------------------------

  renderFromTransforms(transforms, shapeDescs, W, H, { showOutlines, overrides }) {
    if (!this.#app) return;

    if (overrides?.pixijs) {
      overrides.pixijs(this, transforms, shapeDescs, W, H, showOutlines);
      return;
    }

    // Ensure graphics exist for all shapes
    this.#ensureWorkerGraphics(shapeDescs);

    const HEADER = 3;
    const STRIDE = 3;
    const bodyCount = transforms[0] | 0;
    const entries = [...this.#bodyGraphics.values()];
    const count = Math.min(bodyCount, entries.length);

    for (let i = 0; i < count; i++) {
      const off = HEADER + i * STRIDE;
      const gfx = entries[i];
      gfx.x = transforms[off];
      gfx.y = transforms[off + 1];
      gfx.rotation = transforms[off + 2];
      gfx.visible = true;
    }
    for (let i = count; i < entries.length; i++) {
      entries[i].visible = false;
    }

    this.#app.render();
  }

  // ---------------------------------------------------------------------------
  // Outline toggle
  // ---------------------------------------------------------------------------

  setOutlines(show) {
    this.#showOutlines = show;
    // Rebuild graphics with/without outlines
    if (this.#app) {
      for (const [body, gfx] of this.#bodyGraphics) {
        this.#redrawBodyGraphics(body, gfx, show);
      }
    }
  }

  // ---------------------------------------------------------------------------
  // Resize
  // ---------------------------------------------------------------------------

  onResize(displayW, displayH) {
    if (this.#app) {
      this.#app.renderer.resize(displayW, displayH);
    }
  }

  // ---------------------------------------------------------------------------
  // Overlay (not supported in PixiJS mode — returns null)
  // ---------------------------------------------------------------------------

  getOverlayCtx() {
    return null;
  }

  // ---------------------------------------------------------------------------
  // Engine access
  // ---------------------------------------------------------------------------

  getEngine() {
    return { PIXI: _PIXI, app: this.#app };
  }

  getElement() {
    return this.#app?.canvas ?? null;
  }

  // ---------------------------------------------------------------------------
  // Internal: body graphics management
  // ---------------------------------------------------------------------------

  #addBodyGraphics(body) {
    if (this.#bodyGraphics.has(body)) return;
    if (body.userData?._hidden3d) return; // Reuse the hidden flag

    const gfx = new _PIXI.Graphics();
    this.#drawBodyShapes(body, gfx, this.#showOutlines);

    gfx.x = body.position.x;
    gfx.y = body.position.y;
    gfx.rotation = body.rotation;

    this.#app.stage.addChild(gfx);
    this.#bodyGraphics.set(body, gfx);
  }

  #syncBodies(space) {
    // Remove stale
    const spaceBodies = new Set();
    for (const body of space.bodies) spaceBodies.add(body);

    for (const [body, gfx] of this.#bodyGraphics) {
      if (!spaceBodies.has(body)) {
        this.#app.stage.removeChild(gfx);
        gfx.destroy();
        this.#bodyGraphics.delete(body);
      }
    }

    // Add new
    for (const body of space.bodies) {
      if (!this.#bodyGraphics.has(body)) {
        this.#addBodyGraphics(body);
      }
    }
  }

  #drawBodyShapes(body, gfx, showOutlines) {
    gfx.clear();

    const colorIdx = (body.userData?._colorIdx ?? 0) % FILL_COLORS.length;
    const fillColor = body.isStatic()
      ? STATIC_FILL
      : body.isSleeping
        ? SLEEPING_FILL
        : FILL_COLORS[colorIdx];

    const fillAlpha = body.isStatic() ? 0.15 : 0.25;

    for (const shape of body.shapes) {
      if (shape.isCircle()) {
        const r = shape.castCircle.radius;
        gfx.circle(0, 0, r);
        gfx.fill({ color: fillColor, alpha: fillAlpha });
        if (showOutlines) {
          gfx.circle(0, 0, r);
          gfx.stroke({ color: fillColor, width: 1.2, alpha: OUTLINE_ALPHA });
          // Rotation indicator
          gfx.moveTo(0, 0);
          gfx.lineTo(r, 0);
          gfx.stroke({ color: fillColor, width: 1, alpha: 0.4 });
        }
      } else if (shape.isPolygon()) {
        const verts = shape.castPolygon.localVerts;
        const len = verts.length;
        if (len < 3) continue;

        const points = [];
        for (let i = 0; i < len; i++) {
          points.push(verts.at(i).x, verts.at(i).y);
        }
        gfx.poly(points, true);
        gfx.fill({ color: fillColor, alpha: fillAlpha });
        if (showOutlines) {
          gfx.poly(points, true);
          gfx.stroke({ color: fillColor, width: 1.2, alpha: OUTLINE_ALPHA });
        }
      } else if (shape.isCapsule()) {
        const cap = shape.castCapsule;
        const hl = cap.halfLength;
        const r = cap.radius;

        // Draw capsule as a rounded rectangle approximation
        gfx.roundRect(-hl - r, -r, (hl + r) * 2, r * 2, r);
        gfx.fill({ color: fillColor, alpha: fillAlpha });
        if (showOutlines) {
          gfx.roundRect(-hl - r, -r, (hl + r) * 2, r * 2, r);
          gfx.stroke({ color: fillColor, width: 1.2, alpha: OUTLINE_ALPHA });
        }
      }
    }
  }

  #redrawBodyGraphics(body, gfx, showOutlines) {
    this.#drawBodyShapes(body, gfx, showOutlines);
  }

  #ensureWorkerGraphics(shapeDescs) {
    const entries = [...this.#bodyGraphics.values()];
    for (let i = entries.length; i < shapeDescs.length; i++) {
      const sd = shapeDescs[i];
      const gfx = new _PIXI.Graphics();
      const isWall = !!sd.wall;
      const color = isWall ? STATIC_FILL : FILL_COLORS[i % FILL_COLORS.length];
      const alpha = isWall ? 0.15 : 0.25;

      if (sd.circle) {
        gfx.circle(0, 0, sd.radius);
        gfx.fill({ color, alpha });
        if (this.#showOutlines) {
          gfx.circle(0, 0, sd.radius);
          gfx.stroke({ color, width: 1.2, alpha: OUTLINE_ALPHA });
        }
      } else if (sd.box) {
        gfx.rect(-sd.hw, -sd.hh, sd.hw * 2, sd.hh * 2);
        gfx.fill({ color, alpha });
        if (this.#showOutlines) {
          gfx.rect(-sd.hw, -sd.hh, sd.hw * 2, sd.hh * 2);
          gfx.stroke({ color, width: 1.2, alpha: OUTLINE_ALPHA });
        }
      }

      this.#app.stage.addChild(gfx);
      // Use index as key since we don't have body references in worker mode
      this.#bodyGraphics.set(i, gfx);
    }
  }
}
