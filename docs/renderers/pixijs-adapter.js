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
  #bodySprites = new Map(); // Body|number -> PIXI.Sprite

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
      "display:block;position:absolute;inset:0;width:100%;height:100%";
    container.appendChild(this.#app.canvas);
  }

  detach() {
    if (this.#app && this.#container) {
      this.#container.removeChild(this.#app.canvas);
      this.#app.destroy(true);
      this.#app = null;
    }
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
    for (const [, sprite] of this.#bodySprites) {
      this.#app.stage.removeChild(sprite);
      sprite.texture.destroy(true);
      sprite.destroy();
    }
    this.#bodySprites.clear();
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
    for (const [body, sprite] of this.#bodySprites) {
      sprite.x = body.position.x;
      sprite.y = body.position.y;
      sprite.rotation = body.rotation;
    }

    // Ticker is stopped; we drive rendering manually from DemoRunner's rAF loop
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

    // Ensure sprites exist for all shapes
    this.#ensureWorkerSprites(shapeDescs);

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
    // Regenerate all textures with/without outlines
    for (const [body, sprite] of this.#bodySprites) {
      if (typeof body === "number") continue; // worker mode index keys
      const oldTex = sprite.texture;
      const gfx = new _PIXI.Graphics();
      this.#drawBodyShapes(body, gfx, show);
      const bounds = gfx.getLocalBounds();
      const texture = this.#app.renderer.generateTexture({ target: gfx, resolution: 2 });
      sprite.texture = texture;
      sprite.anchor.set(-bounds.x / bounds.width, -bounds.y / bounds.height);
      gfx.destroy();
      oldTex.destroy(true);
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
  // Internal: body sprite management (Sprite + generateTexture pattern)
  // ---------------------------------------------------------------------------

  #addBodySprite(body) {
    if (this.#bodySprites.has(body)) return;
    if (body.userData?._hidden3d) return;

    const gfx = new _PIXI.Graphics();
    this.#drawBodyShapes(body, gfx, this.#showOutlines);

    // Bake Graphics → Texture → Sprite
    const bounds = gfx.getLocalBounds();
    const texture = this.#app.renderer.generateTexture({ target: gfx, resolution: 2 });
    const sprite = new _PIXI.Sprite(texture);
    sprite.anchor.set(-bounds.x / bounds.width, -bounds.y / bounds.height);

    sprite.x = body.position.x;
    sprite.y = body.position.y;
    sprite.rotation = body.rotation;

    gfx.destroy();
    this.#app.stage.addChild(sprite);
    this.#bodySprites.set(body, sprite);
  }

  #syncBodies(space) {
    // Remove stale
    const spaceBodies = new Set();
    for (const body of space.bodies) spaceBodies.add(body);

    for (const [body, sprite] of this.#bodySprites) {
      if (!spaceBodies.has(body)) {
        this.#app.stage.removeChild(sprite);
        sprite.texture.destroy(true);
        sprite.destroy();
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

  #ensureWorkerSprites(shapeDescs) {
    // Rebuild all sprites when shapeDescs changes (body order may shift)
    if (this.#lastWorkerDescs !== shapeDescs) {
      this.#lastWorkerDescs = shapeDescs;
      for (const [, sprite] of this.#bodySprites) {
        this.#app.stage.removeChild(sprite);
        sprite.texture.destroy(true);
        sprite.destroy();
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

      // Bake to texture + sprite
      const bounds = gfx.getLocalBounds();
      const texture = this.#app.renderer.generateTexture({ target: gfx, resolution: 2 });
      const sprite = new _PIXI.Sprite(texture);
      sprite.anchor.set(-bounds.x / bounds.width, -bounds.y / bounds.height);
      gfx.destroy();

      this.#app.stage.addChild(sprite);
      // Use index as key since we don't have body references in worker mode
      this.#bodySprites.set(i, sprite);
    }
  }
}
