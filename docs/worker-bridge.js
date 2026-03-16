/**
 * WorkerPhysicsBridge — runs any demo's physics in a Web Worker.
 *
 * The worker runs setup() + space.step() off-thread.
 * Main thread reads body transforms via SharedArrayBuffer (or postMessage fallback)
 * and renders them through the active adapter.
 *
 * Usage:
 *   const bridge = new WorkerPhysicsBridge(demo, { W: 900, H: 500 });
 *   await bridge.init();
 *   bridge.start();
 *   // In rAF loop:
 *   const { transforms, shapeDescs, stepMs, bodyCount } = bridge.getState();
 *   adapter.renderFromTransforms(transforms, shapeDescs, W, H, opts);
 *   // On user interaction:
 *   bridge.sendClick(x, y);
 *   // On cleanup:
 *   bridge.destroy();
 */

const FLOATS_PER_BODY = 3;  // x, y, rotation
const HEADER_FLOATS = 3;    // bodyCount, timeStamp, stepMs
const DEFAULT_MAX_BODIES = 1024;

export class WorkerPhysicsBridge {
  #worker = null;
  #transforms = null;
  #shapeDescs = null;
  #useShared = false;
  #ready = false;
  #stepMs = 0;
  #napeUrl;
  #demo;
  #W;
  #H;
  #maxBodies;

  /**
   * @param {Object} demo — demo definition (must have setup function)
   * @param {{ W: number, H: number, maxBodies?: number }} opts
   */
  constructor(demo, { W, H, maxBodies = DEFAULT_MAX_BODIES }) {
    this.#demo = demo;
    this.#W = W;
    this.#H = H;
    this.#maxBodies = maxBodies;
    this.#napeUrl = new URL("./nape-js.esm.js", import.meta.url).href;
  }

  /** Initialize the worker and physics space. Returns when ready. */
  async init() {
    const totalFloats = HEADER_FLOATS + this.#maxBodies * FLOATS_PER_BODY;

    // Try SharedArrayBuffer for zero-copy transforms
    if (typeof SharedArrayBuffer !== "undefined") {
      try {
        const sab = new SharedArrayBuffer(totalFloats * Float32Array.BYTES_PER_ELEMENT);
        this.#transforms = new Float32Array(sab);
        this.#useShared = true;
      } catch (_) {
        this.#transforms = new Float32Array(totalFloats);
        this.#useShared = false;
      }
    } else {
      this.#transforms = new Float32Array(totalFloats);
      this.#useShared = false;
    }

    // Build the worker script
    const script = this.#buildWorkerScript();
    const blob = new Blob([script], { type: "application/javascript" });
    const blobUrl = URL.createObjectURL(blob);
    this.#worker = new Worker(blobUrl, { type: "module" });
    URL.revokeObjectURL(blobUrl);

    // Wait for the worker to become ready
    return new Promise((resolve) => {
      this.#worker.onmessage = (e) => {
        const msg = e.data;
        if (msg.type === "ready") {
          this.#shapeDescs = msg.shapeDescs;
          this.#ready = true;
          resolve();
        } else if (msg.type === "frame") {
          if (!this.#useShared && msg.buffer) {
            this.#transforms = msg.buffer;
          }
          if (this.#transforms) this.#stepMs = this.#transforms[2] || 0;
        } else if (msg.type === "spawned") {
          if (this.#shapeDescs && msg.shapeDescs) {
            for (const sd of msg.shapeDescs) this.#shapeDescs.push(sd);
          }
        }
      };

      this.#worker.onerror = (err) => {
        console.error("[WorkerPhysicsBridge] Worker error:", err);
      };

      // Extract wall config
      const wallsConfig = this.#demo.walls;
      const wallsEnabled = wallsConfig !== false && wallsConfig !== undefined;

      this.#worker.postMessage({
        type: "init",
        napeUrl: this.#napeUrl,
        maxBodies: this.#maxBodies,
        timestep: 1 / 60,
        velIters: this.#demo.velocityIterations ?? 8,
        posIters: this.#demo.positionIterations ?? 3,
        W: this.#W,
        H: this.#H,
        walls: wallsEnabled,
        buffer: this.#useShared ? this.#transforms.buffer : null,
        // We pass the demo's setup code as a serialized string
        setupCode: this.#demo.setup.toString(),
        stepCode: this.#demo.step?.toString() ?? null,
        clickCode: this.#demo.click?.toString() ?? null,
      });
    });
  }

  /** Start the physics loop in the worker. */
  start() {
    if (!this.#ready) return;
    this.#worker.postMessage({ type: "start" });
  }

  /** Stop the physics loop. */
  stop() {
    if (this.#worker) this.#worker.postMessage({ type: "stop" });
  }

  /** Get the current state for rendering. */
  getState() {
    return {
      transforms: this.#transforms,
      shapeDescs: this.#shapeDescs,
      stepMs: this.#stepMs,
      bodyCount: this.#transforms ? (this.#transforms[0] | 0) : 0,
      ready: this.#ready,
      useShared: this.#useShared,
    };
  }

  /** Forward a click event to the worker. */
  sendClick(x, y) {
    if (!this.#worker || !this.#ready) return;
    this.#worker.postMessage({ type: "click", x, y });
  }

  /** Forward a drag event to the worker. */
  sendDrag(x, y) {
    if (!this.#worker || !this.#ready) return;
    this.#worker.postMessage({ type: "drag", x, y });
  }

  /** Forward a release event to the worker. */
  sendRelease() {
    if (!this.#worker || !this.#ready) return;
    this.#worker.postMessage({ type: "release" });
  }

  /** Tear down the worker and release resources. */
  destroy() {
    if (this.#worker) {
      this.#worker.postMessage({ type: "destroy" });
      this.#worker.terminate();
      this.#worker = null;
    }
    this.#transforms = null;
    this.#shapeDescs = null;
    this.#ready = false;
    this.#stepMs = 0;
  }

  get isReady() { return this.#ready; }
  get useShared() { return this.#useShared; }

  // ---------------------------------------------------------------------------
  // Worker script generation
  // ---------------------------------------------------------------------------

  #buildWorkerScript() {
    return `
const FLOATS_PER_BODY = ${FLOATS_PER_BODY};
const HEADER_FLOATS = ${HEADER_FLOATS};

let Space, Body, BodyType, Vec2, Circle, Polygon, Capsule;
let PivotJoint, DistanceJoint, AngleJoint, WeldJoint, MotorJoint, LineJoint;
let Material, FluidProperties, InteractionFilter, InteractionGroup;
let CbType, CbEvent, InteractionType, InteractionListener, PreListener, PreFlag;
let MarchingSquares, AABB;

let space = null;
let transforms = null;
let useShared = false;
let intervalId = null;
let timestep = 1/60;
let velIters = 8, posIters = 3;
let maxBodies = ${DEFAULT_MAX_BODIES};
let setupFn = null;
let stepFn = null;
let clickFn = null;

async function loadNape(url) {
  const mod = await import(url);
  Space = mod.Space; Body = mod.Body; BodyType = mod.BodyType;
  Vec2 = mod.Vec2; Circle = mod.Circle; Polygon = mod.Polygon;
  Capsule = mod.Capsule;
  PivotJoint = mod.PivotJoint; DistanceJoint = mod.DistanceJoint;
  AngleJoint = mod.AngleJoint; WeldJoint = mod.WeldJoint;
  MotorJoint = mod.MotorJoint; LineJoint = mod.LineJoint;
  Material = mod.Material; FluidProperties = mod.FluidProperties;
  InteractionFilter = mod.InteractionFilter; InteractionGroup = mod.InteractionGroup;
  CbType = mod.CbType; CbEvent = mod.CbEvent;
  InteractionType = mod.InteractionType; InteractionListener = mod.InteractionListener;
  PreListener = mod.PreListener; PreFlag = mod.PreFlag;
  MarchingSquares = mod.MarchingSquares; AABB = mod.AABB;
}

function addWalls(sp, W, H) {
  const t = 20;
  const floor = new Body(BodyType.STATIC, new Vec2(W / 2, H - t / 2));
  floor.shapes.add(new Polygon(Polygon.box(W, t))); floor.space = sp;
  const left = new Body(BodyType.STATIC, new Vec2(t / 2, H / 2));
  left.shapes.add(new Polygon(Polygon.box(t, H))); left.space = sp;
  const right = new Body(BodyType.STATIC, new Vec2(W - t / 2, H / 2));
  right.shapes.add(new Polygon(Polygon.box(t, H))); right.space = sp;
  const ceil = new Body(BodyType.STATIC, new Vec2(W / 2, t / 2));
  ceil.shapes.add(new Polygon(Polygon.box(W, t))); ceil.space = sp;
}

function collectShapeDescs() {
  const descs = [];
  for (const body of space.bodies) {
    for (const shape of body.shapes) {
      if (shape.isCircle()) {
        descs.push({
          circle: true,
          radius: shape.castCircle.radius,
          wall: body.isStatic(),
        });
      } else if (shape.isPolygon()) {
        const verts = shape.castPolygon.localVerts;
        const len = verts.length;
        if (len >= 3) {
          // Approximate bounding box for rendering
          let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
          for (let i = 0; i < len; i++) {
            const v = verts.at(i);
            if (v.x < minX) minX = v.x;
            if (v.x > maxX) maxX = v.x;
            if (v.y < minY) minY = v.y;
            if (v.y > maxY) maxY = v.y;
          }
          descs.push({
            box: true,
            hw: (maxX - minX) / 2,
            hh: (maxY - minY) / 2,
            wall: body.isStatic(),
          });
        }
      } else {
        descs.push({ box: true, hw: 10, hh: 10, wall: body.isStatic() });
      }
    }
  }
  return descs;
}

function writeTransforms() {
  if (!transforms || !space) return;
  let idx = 0;
  for (const body of space.bodies) {
    for (const shape of body.shapes) {
      if (idx >= maxBodies) break;
      const off = HEADER_FLOATS + idx * FLOATS_PER_BODY;
      transforms[off]     = body.position.x;
      transforms[off + 1] = body.position.y;
      transforms[off + 2] = body.rotation;
      idx++;
    }
  }
  transforms[0] = idx;
  transforms[1] = space.timeStamp;
}

function doStep() {
  if (!space) return;
  if (stepFn) {
    try { stepFn(space, self._W, self._H); } catch(_) {}
  }
  const t0 = performance.now();
  space.step(timestep, velIters, posIters);
  const ms = performance.now() - t0;
  writeTransforms();
  if (transforms) transforms[2] = ms;
  if (!useShared) {
    const copy = new Float32Array(transforms.length);
    copy.set(transforms);
    self.postMessage({ type: "frame", buffer: copy }, [copy.buffer]);
  } else {
    self.postMessage({ type: "frame" });
  }
}

self.onmessage = async (e) => {
  const msg = e.data;
  switch (msg.type) {
    case "init": {
      await loadNape(msg.napeUrl);
      timestep = msg.timestep;
      velIters = msg.velIters;
      posIters = msg.posIters;
      maxBodies = msg.maxBodies;
      self._W = msg.W;
      self._H = msg.H;

      const totalFloats = HEADER_FLOATS + msg.maxBodies * FLOATS_PER_BODY;
      if (msg.buffer) {
        transforms = new Float32Array(msg.buffer);
        useShared = true;
      } else {
        transforms = new Float32Array(totalFloats);
      }

      space = new Space();
      if (msg.walls) addWalls(space, msg.W, msg.H);

      // Reconstruct the demo functions
      try { setupFn = new Function("return " + msg.setupCode)(); } catch(_) {}
      try { stepFn = msg.stepCode ? new Function("return " + msg.stepCode)() : null; } catch(_) {}
      try { clickFn = msg.clickCode ? new Function("return " + msg.clickCode)() : null; } catch(_) {}

      // Run setup
      if (setupFn) {
        try { setupFn(space, msg.W, msg.H); } catch(e) { console.error("[Worker] setup error:", e); }
      }

      writeTransforms();
      const shapeDescs = collectShapeDescs();
      self.postMessage({ type: "ready", shapeDescs });
      break;
    }
    case "start":
      if (intervalId !== null) break;
      intervalId = setInterval(doStep, timestep * 1000);
      break;
    case "stop":
      if (intervalId !== null) { clearInterval(intervalId); intervalId = null; }
      break;
    case "click": {
      if (!space || !clickFn) break;
      try {
        clickFn(msg.x, msg.y, space, self._W, self._H);
      } catch(_) {}
      // Collect updated shape descs after spawn
      const newDescs = collectShapeDescs();
      if (newDescs.length > 0) {
        self.postMessage({ type: "spawned", shapeDescs: newDescs });
      }
      break;
    }
    case "destroy":
      if (intervalId !== null) { clearInterval(intervalId); intervalId = null; }
      if (space) space.clear();
      space = null; transforms = null;
      break;
  }
};
`;
  }
}

/** Re-export constants for adapters that need to read the transform buffer. */
export { FLOATS_PER_BODY, HEADER_FLOATS };
