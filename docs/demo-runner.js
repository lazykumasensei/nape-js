/**
 * DemoRunner — shared physics demo runtime for nape-js demo pages.
 *
 * Handles:
 *  - rAF loop with FPS / step-time measurement
 *  - Pointer event interaction forwarding to demo callbacks
 *  - Live stats DOM wiring
 *  - Pluggable renderer adapters (Canvas2D, Three.js, PixiJS, etc.)
 *  - Automatic wall creation from demo config
 *
 * Usage:
 *   import { Canvas2DAdapter } from "./renderers/canvas2d-adapter.js";
 *   import { ThreeJSAdapter } from "./renderers/threejs-adapter.js";
 *
 *   const runner = new DemoRunner(canvasWrapEl, { W: 900, H: 500 });
 *   runner.registerAdapter(new Canvas2DAdapter());
 *   runner.registerAdapter(new ThreeJSAdapter());
 *   runner.setMode("canvas2d");
 *   runner.wireStats({ fps, bodies, step });
 *   runner.wireInteraction(canvasWrapEl);
 *   runner.load(demoDef);
 *   runner.start();
 */
import {
  Space, Body, BodyType, Vec2, Circle, Polygon,
} from "./nape-js.esm.js";
import { createWalls } from "./walls.js";
import { WorkerPhysicsBridge } from "./worker-bridge.js";

// =========================================================================
// Shared helpers — exported so demo files can import them
// =========================================================================

/** Per-space color counters so multiple DemoRunner instances don't interfere. */
const _spaceCounts = new WeakMap();

/**
 * Legacy addWalls() — kept for backward compatibility during migration.
 * New demos should use `walls: true` config instead.
 * @deprecated Use demo `walls` config instead
 */
export function addWalls(space, W, H) {
  createWalls(space, W, H, true);
}

export function spawnRandomShape(space, x, y, opts = {}) {
  const { minR = 5, maxR = 20, minW = 8, maxW = 34 } = opts;
  const body = new Body(BodyType.DYNAMIC, new Vec2(x, y));
  if (Math.random() < 0.5) {
    body.shapes.add(new Circle(minR + Math.random() * (maxR - minR)));
  } else {
    const w = minW + Math.random() * (maxW - minW);
    const h = minW + Math.random() * (maxW - minW);
    body.shapes.add(new Polygon(Polygon.box(w, h)));
  }
  const count = _spaceCounts.get(space) ?? 0;
  _spaceCounts.set(space, count + 1);
  try { body.userData._colorIdx = count; } catch (_) {}
  body.space = space;
  return body;
}

// =========================================================================
// Syntax highlighter — exported for app.js code panel + examples view-code
// =========================================================================

export function highlightCode(code) {
  code = code
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");

  const re = new RegExp([
    "(\\/\\/.*)",
    '("(?:[^"\\\\]|\\\\.)*")',
    "('(?:[^'\\\\]|\\\\.)*')",
    "(`(?:[^`\\\\]|\\\\.)*`)",
    "\\b(import|from|export|const|let|var|new|for|if|else|return|function|class|extends|of|in|true|false|null|undefined|typeof|this|continue|break)\\b",
    "\\b(\\d+\\.?\\d*)\\b",
    "\\b(Space|Body|BodyType|Vec2|Circle|Polygon|Capsule|PivotJoint|DistanceJoint|AngleJoint|WeldJoint|MotorJoint|LineJoint|PulleyJoint|Material|InteractionFilter|InteractionGroup|CbType|CbEvent|InteractionType|InteractionListener|PreListener|PreFlag|MarchingSquares|AABB|GeomPoly|FluidProperties|Broadphase|Math|THREE|PIXI|Map)\\b",
  ].join("|"), "g");

  return code.replace(re, (match, comment, dStr, sStr, tStr, kw, num, type) => {
    if (comment !== undefined) return `<span class="cm">${comment}</span>`;
    if (dStr !== undefined)   return `<span class="str">${dStr}</span>`;
    if (sStr !== undefined)   return `<span class="str">${sStr}</span>`;
    if (tStr !== undefined)   return `<span class="str">${tStr}</span>`;
    if (kw !== undefined)     return `<span class="kw">${kw}</span>`;
    if (num !== undefined)    return `<span class="num">${num}</span>`;
    if (type !== undefined)   return `<span class="type">${type}</span>`;
    return match;
  });
}

// =========================================================================
// DemoRunner
// =========================================================================

export class DemoRunner {
  #container;
  #W; #H;

  // Adapter system
  #adapters = new Map();     // id -> RendererAdapter instance
  #activeAdapter = null;     // Currently active adapter
  #defaultAdapterId = null;  // First registered adapter ID

  // Runtime state
  #space   = null;
  #demo    = null;
  #animId  = null;
  #debugDraw = true;

  // Worker bridge
  #workerBridge = null;
  #workerMode = false;

  // FPS tracking
  #lastTime   = 0;
  #frameCount = 0;
  #fpsAccum   = 0;

  // Stats DOM elements
  #statsFps    = null;
  #statsBodies = null;
  #statsStep   = null;

  /**
   * @param {Element} container - wrapping element (holds canvases)
   * @param {{ W?: number, H?: number }} options
   */
  constructor(container, { W, H } = {}) {
    this.#container = container;
    this.#W = W ?? 900;
    this.#H = H ?? 500;
  }

  // -----------------------------------------------------------------------
  // Public API
  // -----------------------------------------------------------------------

  get isRunning()    { return this.#animId !== null; }
  get currentDemo()  { return this.#demo; }
  get space()        { return this.#space; }
  get debugDraw()    { return this.#debugDraw; }

  /** Returns the active adapter ID (e.g. "canvas2d", "threejs", "pixijs"). */
  get mode() {
    return this.#activeAdapter?.id ?? this.#defaultAdapterId ?? "canvas2d";
  }

  set debugDraw(val) {
    this.#debugDraw = val;
    this.#activeAdapter?.setOutlines(val);
  }

  get workerMode() { return this.#workerMode; }

  /** Returns an array of registered adapter IDs. */
  getAvailableAdapters() {
    return [...this.#adapters.values()].map(a => ({
      id: a.id,
      displayName: a.displayName,
    }));
  }

  /**
   * Toggle Web Worker mode. When enabled, physics runs off-thread.
   * Only works for demos with `workerCompatible: true`.
   */
  async toggleWorker(enable) {
    if (enable === this.#workerMode) return;

    const wasRunning = this.isRunning;
    this.stop();

    if (enable && this.#demo) {
      // Clear adapter state from main-thread mode before switching to worker
      this.#activeAdapter?.onDemoUnload();

      // Create and init worker bridge
      this.#workerBridge = new WorkerPhysicsBridge(this.#demo, {
        W: this.#W,
        H: this.#H,
      });
      await this.#workerBridge.init();
      this.#workerMode = true;
      if (wasRunning) {
        this.#workerBridge.start();
        this.start();
      }
    } else {
      // Destroy worker bridge and reload demo on main thread
      if (this.#workerBridge) {
        this.#workerBridge.destroy();
        this.#workerBridge = null;
      }
      this.#workerMode = false;
      // Reload demo in main thread
      if (this.#demo) {
        this.load(this.#demo);
        if (wasRunning) this.start();
      }
    }
  }

  // -----------------------------------------------------------------------
  // Adapter registration
  // -----------------------------------------------------------------------

  /**
   * Register a renderer adapter. The first adapter registered becomes the
   * default and is immediately attached.
   */
  registerAdapter(adapter) {
    this.#adapters.set(adapter.id, adapter);
    if (!this.#defaultAdapterId) {
      this.#defaultAdapterId = adapter.id;
      // Attach the first adapter immediately
      adapter.attach(this.#container, this.#W, this.#H);
      this.#activeAdapter = adapter;
      adapter.setOutlines(this.#debugDraw);
    }
  }

  /**
   * Switch render mode to a different adapter.
   * @param {string} adapterId — e.g. "canvas2d", "threejs", "pixijs"
   */
  async setMode(adapterId) {
    if (this.#activeAdapter?.id === adapterId) return;

    const adapter = this.#adapters.get(adapterId);
    if (!adapter) throw new Error(`Adapter "${adapterId}" not registered`);

    const wasRunning = this.isRunning;
    this.stop();

    // Pin container height before detaching, so new adapter can read it
    if (this.#container) {
      const cr = this.#container.getBoundingClientRect();
      this.#container.style.height = `${cr.height}px`;
    }

    // Detach old adapter
    if (this.#activeAdapter) {
      this.#activeAdapter.onDemoUnload();
      // For canvas2d: hide instead of detach (to preserve the canvas element)
      if (this.#activeAdapter.hide) {
        this.#activeAdapter.hide();
      } else {
        this.#activeAdapter.detach();
      }
    }

    // Attach new adapter (if not already attached).
    // Await in case attach() is async (e.g. PixiJS app.init()).
    if (!adapter.isAttached()) {
      await adapter.attach(this.#container, this.#W, this.#H);
    } else if (adapter.show) {
      adapter.show();
    }
    this.#activeAdapter = adapter;
    adapter.setOutlines(this.#debugDraw);

    // Rebuild demo state in new renderer
    if (this.#space && this.#demo) {
      const hasOverride = this.#demo.renderOverrides?.[adapterId];
      if (!hasOverride) {
        adapter.onDemoLoad(this.#space, this.#W, this.#H);
      }
    }

    if (wasRunning) this.start();
  }

  // -----------------------------------------------------------------------
  // Demo loading
  // -----------------------------------------------------------------------

  /** Load a demo definition. Tears down the old space and runs setup(). */
  load(demoDef, { preview = false } = {}) {
    this.stop();

    // Tear down worker bridge if active
    if (this.#workerBridge) {
      this.#workerBridge.destroy();
      this.#workerBridge = null;
      this.#workerMode = false;
    }

    // Unload previous demo from adapter
    this.#activeAdapter?.onDemoUnload();

    this.#demo  = demoDef;
    this.#space = null;

    // Create space
    const space = new Space();
    this.#space = space;

    // Create walls from demo config (before setup).
    // Only auto-create walls if the demo explicitly defines a `walls` property.
    // Legacy demos that call addWalls() manually in setup() won't have this property.
    if (demoDef.walls !== undefined) {
      createWalls(space, this.#W, this.#H, demoDef.walls);
    }

    // Run demo setup
    demoDef.setup(space, this.#W, this.#H);

    // Optional init hook (DOM-level listeners, overlays)
    if (!preview) demoDef.init?.(this.#container, this.#W, this.#H);

    // Tell the active adapter about the new demo
    if (this.#activeAdapter) {
      const adapterId = this.#activeAdapter.id;
      const hasOverride = demoDef.renderOverrides?.[adapterId];
      if (!hasOverride) {
        this.#activeAdapter.onDemoLoad(space, this.#W, this.#H);
      }
    }
  }

  /**
   * Async variant of load(). Awaits preload() if present before setup().
   */
  async loadAsync(demoDef) {
    if (demoDef.preload) await demoDef.preload();
    this.load(demoDef);
  }

  // -----------------------------------------------------------------------
  // Loop control
  // -----------------------------------------------------------------------

  /** Begin the rAF loop. */
  start() {
    if (this.#animId) return;
    this.#lastTime  = performance.now();
    this.#frameCount = 0;
    this.#fpsAccum  = 0;
    this.#tick();
  }

  /** Pause the rAF loop (space and state are preserved). */
  stop() {
    if (this.#animId) {
      cancelAnimationFrame(this.#animId);
      this.#animId = null;
    }
  }

  // -----------------------------------------------------------------------
  // Preview rendering
  // -----------------------------------------------------------------------

  /**
   * Load a demo, run one physics step, render a single frame, then stop.
   * Used for generating static preview thumbnails on the examples grid.
   */
  renderPreview(demoDef) {
    this.load(demoDef, { preview: true });
    this.#space.step(1 / 60, demoDef.velocityIterations ?? 8, demoDef.positionIterations ?? 3);
    if (this.#activeAdapter) {
      this.#activeAdapter.renderFrame(this.#space, this.#W, this.#H, {
        showOutlines: this.#debugDraw,
        overrides: demoDef.renderOverrides ?? null,
      });
    }
  }

  /**
   * Async variant of renderPreview().
   */
  async renderPreviewAsync(demoDef) {
    if (demoDef.preload) await demoDef.preload();
    this.renderPreview(demoDef);
  }

  // -----------------------------------------------------------------------
  // Stats wiring
  // -----------------------------------------------------------------------

  wireStats({ fps, bodies, step } = {}) {
    this.#statsFps    = fps    ?? null;
    this.#statsBodies = bodies ?? null;
    this.#statsStep   = step   ?? null;
  }

  // -----------------------------------------------------------------------
  // Interaction
  // -----------------------------------------------------------------------

  wireInteraction(el) {
    el.style.touchAction = "none";
    el.style.userSelect  = "none";

    let isDragging = false;

    const getPos = (e) => {
      const rect = el.getBoundingClientRect();
      const aspect  = this.#W / this.#H;
      const fitW    = Math.min(rect.width, rect.height * aspect);
      const fitH    = fitW / aspect;
      const padX    = (rect.width  - fitW) / 2;
      const padY    = (rect.height - fitH) / 2;
      return {
        x: ((e.clientX - rect.left) - padX) * (this.#W / fitW),
        y: ((e.clientY - rect.top)  - padY) * (this.#H / fitH),
      };
    };

    el.addEventListener("pointerdown", (e) => {
      if (!this.#demo) return;
      if (!this.#space && !this.#workerBridge) return;
      if (e.target.closest(".canvas-controls")) return;
      e.preventDefault();
      el.setPointerCapture(e.pointerId);
      isDragging = true;
      const { x, y } = getPos(e);
      if (this.#workerMode && this.#workerBridge) {
        this.#workerBridge.sendClick(x, y);
      } else {
        this.#demo.click?.(x, y, this.#space, this.#W, this.#H);
      }
    });

    el.addEventListener("pointermove", (e) => {
      if (!this.#demo) return;
      if (!this.#space && !this.#workerBridge) return;
      const { x, y } = getPos(e);
      this.#demo.hover?.(x, y, this.#space, this.#W, this.#H);
      if (!isDragging) return;
      e.preventDefault();
      if (this.#workerMode && this.#workerBridge) {
        this.#workerBridge.sendDrag(x, y);
      } else {
        this.#demo.drag?.(x, y, this.#space, this.#W, this.#H);
      }
    });

    const endDrag = () => {
      if (!isDragging) return;
      isDragging = false;
      if (this.#workerMode && this.#workerBridge) {
        this.#workerBridge.sendRelease();
      } else {
        this.#demo?.release?.(this.#space);
      }
    };
    el.addEventListener("pointerup",     endDrag);
    el.addEventListener("pointercancel", endDrag);

    el.addEventListener("wheel", (e) => {
      if (!this.#space || !this.#demo?.wheel) return;
      e.preventDefault();
      this.#demo.wheel(e.deltaY, this.#space, this.#W, this.#H);
    }, { passive: false });
  }

  // -----------------------------------------------------------------------
  // rAF loop
  // -----------------------------------------------------------------------

  #tick() {
    const now = performance.now();
    const dt  = now - this.#lastTime;
    this.#lastTime = now;

    // FPS (update every 500ms)
    this.#frameCount++;
    this.#fpsAccum += dt;
    if (this.#fpsAccum >= 500) {
      const fps = Math.round((this.#frameCount / this.#fpsAccum) * 1000);
      if (this.#statsFps) this.#statsFps.textContent = `FPS: ${fps}`;
      this.#frameCount = 0;
      this.#fpsAccum   = 0;
    }

    if (this.#activeAdapter) {
      if (this.#workerMode && this.#workerBridge) {
        // Worker mode: read transforms from bridge, render via adapter
        const state = this.#workerBridge.getState();
        if (state.ready) {
          if (this.#statsStep)   this.#statsStep.textContent   = `Step: ${state.stepMs.toFixed(2)}ms (worker)`;
          if (this.#statsBodies) this.#statsBodies.textContent = `Bodies: ${state.bodyCount}`;
          this.#activeAdapter.renderFromTransforms(
            state.transforms, state.shapeDescs, this.#W, this.#H,
            { showOutlines: this.#debugDraw, overrides: this.#demo?.renderOverrides ?? null },
          );
        }
      } else if (this.#space) {
        // Main-thread mode: step physics locally, render via adapter
        this.#demo?.step?.(this.#space, this.#W, this.#H);

        const stepStart = performance.now();
        this.#space.step(
          1 / 60,
          this.#demo?.velocityIterations ?? 8,
          this.#demo?.positionIterations ?? 3,
        );
        const stepMs = performance.now() - stepStart;

        if (this.#statsStep)   this.#statsStep.textContent   = `Step: ${stepMs.toFixed(2)}ms`;
        if (this.#statsBodies) this.#statsBodies.textContent = `Bodies: ${this.#space.bodies.length}`;

        this.#activeAdapter.renderFrame(this.#space, this.#W, this.#H, {
          showOutlines: this.#debugDraw,
          overrides: this.#demo?.renderOverrides ?? null,
        });
      }
    }

    this.#animId = requestAnimationFrame(() => this.#tick());
  }
}
