/**
 * PixiJSAdapter — PixiJS renderer for nape-js demos.
 *
 * Uses Sprite + generateTexture pattern: shapes are drawn into a temporary
 * Graphics, baked into a GPU texture, then rendered as batched Sprite quads.
 * This is how real PixiJS games work — far more efficient than per-frame
 * Graphics tessellation.
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

import {
  BODY_COLORS_HEX, STATIC_COLOR_HEX, CONSTRAINT_COLOR_HEX,
  bodyColorHex, bodyFillAlpha,
} from "./shared-colors.js";

// Aliases for backward compatibility
const FILL_COLORS = BODY_COLORS_HEX;
const STATIC_FILL = STATIC_COLOR_HEX;
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
  #bodySprites = new Map(); // Body|number -> PIXI.Sprite

  // Background grid + constraint lines
  #gridGfx = null;
  #constraintGfx = null;

  // 2D overlay canvas for HUD (legend, cursor hints, etc.)
  #overlay = null;
  #overlayCtx = null;

  // ---------------------------------------------------------------------------
  // Lifecycle
  // ---------------------------------------------------------------------------

  async attach(container, W, H) {
    if (!_PIXI) throw new Error("PixiJS not loaded. Call loadPixi() first.");

    this.#container = container;
    this.#W = W;
    this.#H = H;

    this.#app = new _PIXI.Application();
    await this.#app.init({
      width: W,
      height: H,
      backgroundColor: 0x0d1117,
      antialias: true,
      resolution: window.devicePixelRatio || 1,
      autoDensity: true,
      autoStart: false,
    });
    // We drive rendering manually from DemoRunner's rAF loop,
    // so stop the built-in ticker to avoid double-rendering.
    this.#app.ticker.stop();

    this.#app.canvas.style.cssText =
      "display:block;position:absolute;inset:0;width:100%;height:100%;object-fit:contain";
    container.appendChild(this.#app.canvas);

    // Background grid (matching Canvas2D's 50px grid)
    this.#gridGfx = new _PIXI.Graphics();
    const step = 50;
    for (let x = 0; x <= W; x += step) {
      this.#gridGfx.moveTo(x, 0);
      this.#gridGfx.lineTo(x, H);
    }
    for (let y = 0; y <= H; y += step) {
      this.#gridGfx.moveTo(0, y);
      this.#gridGfx.lineTo(W, y);
    }
    this.#gridGfx.stroke({ color: 0x1a2030, width: 0.5 });
    this.#app.stage.addChildAt(this.#gridGfx, 0);

    // Constraint lines overlay (reused each frame)
    this.#constraintGfx = new _PIXI.Graphics();
    this.#app.stage.addChild(this.#constraintGfx);

    // 2D overlay canvas for HUD (legend, density labels, etc.)
    this.#overlay = document.createElement("canvas");
    this.#overlay.width = W;
    this.#overlay.height = H;
    this.#overlay.style.cssText =
      "display:block;position:absolute;inset:0;width:100%;height:100%;object-fit:contain;pointer-events:none;z-index:1";
    this.#overlayCtx = this.#overlay.getContext("2d");
    container.appendChild(this.#overlay);
  }

  detach() {
    if (this.#overlay && this.#container) {
      this.#container.removeChild(this.#overlay);
      this.#overlay = null;
      this.#overlayCtx = null;
    }
    if (this.#app && this.#container) {
      this.#container.removeChild(this.#app.canvas);
      this.#app.destroy(true);
      this.#app = null;
    }
    this.#gridGfx = null;
    this.#constraintGfx = null;
    this.#bodySprites.clear();
    this.#container = null;
  }

  isAttached() {
    return this.#app !== null;
  }

  // ---------------------------------------------------------------------------
  // Per-demo hooks
  // ---------------------------------------------------------------------------

  onDemoLoad(space, _W, _H) {
    if (!this.#app) return;
    // Build sprites for all existing bodies
    for (const body of space.bodies) {
      this.#addBodySprite(body);
    }
  }

  onDemoUnload() {
    if (!this.#app) return;
    for (const [, gfx] of this.#bodySprites) {
      this.#app.stage.removeChild(gfx);
      gfx.destroy();
    }
    this.#bodySprites.clear();
  }

  // ---------------------------------------------------------------------------
  // Per-frame rendering
  // ---------------------------------------------------------------------------

  renderFrame(space, W, H, { showOutlines, overrides, camX = 0, camY = 0 }) {
    if (!this.#app) return;

    if (overrides?.pixijs) {
      overrides.pixijs(this, space, W, H, showOutlines, camX, camY);
    } else {
      // Sync bodies: add new, remove stale
      this.#syncBodies(space);

      // Update positions
      for (const [body, sprite] of this.#bodySprites) {
        sprite.x = body.position.x;
        sprite.y = body.position.y;
        sprite.rotation = body.rotation;
      }

      // Draw constraint lines between connected bodies
      this.#drawConstraintLines(space);

      // Ticker is stopped; we drive rendering manually from DemoRunner's rAF loop
      this.#app.render();
    }

    // 2D overlay (legend, HUD, etc.)
    if (this.#overlayCtx) {
      this.#overlayCtx.clearRect(0, 0, W, H);
      if (overrides?.overlay) {
        overrides.overlay(this.#overlayCtx, space, W, H);
      }
    }
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
    this.#ensureWorkerGfx(shapeDescs);

    const HEADER = 3;
    const STRIDE = 3;
    const bodyCount = transforms[0] | 0;
    const entries = [...this.#bodySprites.values()];
    const count = Math.min(bodyCount, entries.length);

    for (let i = 0; i < count; i++) {
      const off = HEADER + i * STRIDE;
      const sprite = entries[i];
      sprite.x = transforms[off];
      sprite.y = transforms[off + 1];
      sprite.rotation = transforms[off + 2];
      sprite.visible = true;
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
    if (!this.#app) return;
    // Redraw all Graphics with/without outlines
    for (const [body, gfx] of this.#bodySprites) {
      if (typeof body === "number") continue; // worker mode index keys
      this.#drawBodyShapes(body, gfx, show);
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
  // Overlay
  // ---------------------------------------------------------------------------

  getOverlayCtx() {
    return this.#overlayCtx;
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

  /** Sync body graphics with the current space (add new, remove stale, update positions). */
  syncBodies(space) {
    if (!this.#app) return;
    this.#syncBodies(space);
    for (const [body, gfx] of this.#bodySprites) {
      gfx.x = body.position.x;
      gfx.y = body.position.y;
      gfx.rotation = body.rotation;
    }
  }

  // ---------------------------------------------------------------------------
  // Internal: constraint rendering
  // ---------------------------------------------------------------------------

  #drawConstraintLines(space) {
    if (!this.#constraintGfx) return;
    this.#constraintGfx.clear();
    try {
      const raw = space.constraints;
      const len = raw.length;
      if (len === 0) return;
      for (let i = 0; i < len; i++) {
        const c = raw.at(i);
        if (c.body1 && c.body2) {
          this.#constraintGfx.moveTo(c.body1.position.x, c.body1.position.y);
          this.#constraintGfx.lineTo(c.body2.position.x, c.body2.position.y);
        }
      }
      this.#constraintGfx.stroke({ color: CONSTRAINT_COLOR_HEX, width: 1, alpha: 0.2 });
    } catch (_) {}
    // Keep constraints on top of body sprites
    this.#app.stage.setChildIndex(this.#constraintGfx, this.#app.stage.children.length - 1);
  }

  // ---------------------------------------------------------------------------
  // Internal: body graphics management
  // ---------------------------------------------------------------------------

  #addBodySprite(body) {
    if (this.#bodySprites.has(body)) return;
    if (body.userData?._hidden3d) return;

    const gfx = new _PIXI.Graphics();
    this.#drawBodyShapes(body, gfx, this.#showOutlines);

    gfx.x = body.position.x;
    gfx.y = body.position.y;
    gfx.rotation = body.rotation;

    this.#app.stage.addChild(gfx);
    this.#bodySprites.set(body, gfx);
  }

  #syncBodies(space) {
    // Remove stale
    const spaceBodies = new Set();
    for (const body of space.bodies) spaceBodies.add(body);

    for (const [body, gfx] of this.#bodySprites) {
      if (!spaceBodies.has(body)) {
        this.#app.stage.removeChild(gfx);
        gfx.destroy();
        this.#bodySprites.delete(body);
      }
    }

    // Add new
    for (const body of space.bodies) {
      if (!this.#bodySprites.has(body)) {
        this.#addBodySprite(body);
      }
    }
  }

  #drawBodyShapes(body, gfx, showOutlines) {
    gfx.clear();

    for (const shape of body.shapes) {
      const isFluid = !!shape.fluidEnabled;
      const isSensor = !!shape.sensorEnabled;
      const fillColor = isFluid ? 0x1e90ff : bodyColorHex(body);
      const fillAlpha = isFluid ? 0.25 : isSensor ? 0.08 : bodyFillAlpha(body);
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

        gfx.roundRect(-hl - r, -r, (hl + r) * 2, r * 2, r);
        gfx.fill({ color: fillColor, alpha: fillAlpha });
        if (showOutlines) {
          gfx.roundRect(-hl - r, -r, (hl + r) * 2, r * 2, r);
          gfx.stroke({ color: fillColor, width: 1.2, alpha: OUTLINE_ALPHA });
        }
      }
    }
  }

  #lastWorkerDescs = null;

  #ensureWorkerGfx(shapeDescs) {
    // Rebuild all graphics when shapeDescs changes (body order may shift)
    if (this.#lastWorkerDescs !== shapeDescs) {
      this.#lastWorkerDescs = shapeDescs;
      for (const [, gfx] of this.#bodySprites) {
        this.#app.stage.removeChild(gfx);
        gfx.destroy();
      }
      this.#bodySprites.clear();
    }

    const entries = [...this.#bodySprites.values()];
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
      this.#bodySprites.set(i, gfx);
    }
  }
}
