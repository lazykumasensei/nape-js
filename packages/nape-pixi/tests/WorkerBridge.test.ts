import { describe, expect, it, vi } from "vitest";
import { WorkerBridge } from "../src/WorkerBridge.js";
import type { WorkerLike } from "../src/WorkerBridge.js";
import {
  TRANSFORM_FLOATS_PER_BODY,
  TRANSFORM_HEADER,
  TRANSFORM_HEADER_FLOATS,
  createTransformsBuffer,
} from "../src/workerProtocol.js";

// ---------------------------------------------------------------------------
// Fake worker — captures postMessage + allows tests to fire "messages" back.
// ---------------------------------------------------------------------------

class FakeWorker implements WorkerLike {
  posted: Array<{ message: unknown; transfer?: Transferable[] }> = [];
  terminated = false;
  #listeners = new Set<(event: { data: unknown }) => void>();

  postMessage(message: unknown, transfer?: Transferable[]) {
    this.posted.push({ message, transfer });
  }

  terminate() {
    this.terminated = true;
  }

  addEventListener(_type: "message", listener: (event: { data: unknown }) => void) {
    this.#listeners.add(listener);
  }

  removeEventListener(_type: "message", listener: (event: { data: unknown }) => void) {
    this.#listeners.delete(listener);
  }

  /** Test helper: dispatch a message event to every subscribed listener. */
  dispatch(data: unknown) {
    for (const listener of this.#listeners) listener({ data });
  }
}

function makeSprite() {
  return { x: 0, y: 0, rotation: 0 };
}

// ---------------------------------------------------------------------------

describe("WorkerBridge — construction", () => {
  it("allocates its own buffer when none is supplied", () => {
    const bridge = new WorkerBridge({ worker: new FakeWorker(), maxBodies: 8 });
    expect(bridge.maxBodies).toBe(8);
    expect(bridge.transforms).toBeInstanceOf(Float32Array);
    expect(bridge.transforms.length).toBe(TRANSFORM_HEADER_FLOATS + 8 * TRANSFORM_FLOATS_PER_BODY);
  });

  it("accepts a pre-allocated buffer and infers maxBodies from its length", () => {
    const alloc = createTransformsBuffer(12);
    const bridge = new WorkerBridge({ worker: new FakeWorker(), transforms: alloc.transforms });
    expect(bridge.transforms).toBe(alloc.transforms);
    expect(bridge.maxBodies).toBe(12);
  });

  it("defaults maxBodies to 1024 when neither option is set", () => {
    const bridge = new WorkerBridge({ worker: new FakeWorker() });
    expect(bridge.maxBodies).toBe(1024);
  });
});

describe("WorkerBridge — message handling", () => {
  it("resolves ready on a { type: 'ready' } message", async () => {
    const worker = new FakeWorker();
    const bridge = new WorkerBridge({ worker });
    let done = false;
    bridge.ready.then(() => (done = true));
    expect(done).toBe(false);
    worker.dispatch({ type: "ready" });
    await bridge.ready;
    expect(done).toBe(true);
  });

  it("resolves ready immediately when readyMessageType is null", async () => {
    const bridge = new WorkerBridge({ worker: new FakeWorker(), readyMessageType: null });
    await expect(bridge.ready).resolves.toBeUndefined();
  });

  it("swaps transforms reference on a frame message with a fresh buffer (postMessage fallback)", () => {
    const worker = new FakeWorker();
    const bridge = new WorkerBridge({ worker, maxBodies: 4 });
    const fresh = createTransformsBuffer(4).transforms;
    fresh[TRANSFORM_HEADER.BODY_COUNT] = 3;
    worker.dispatch({ type: "frame", transforms: fresh });
    expect(bridge.transforms).toBe(fresh);
    expect(bridge.bodyCount).toBe(3);
  });

  it("keeps its own transforms on a frame with no payload (shared-buffer mode)", () => {
    const worker = new FakeWorker();
    const bridge = new WorkerBridge({ worker, maxBodies: 4 });
    const original = bridge.transforms;
    worker.dispatch({ type: "frame" });
    expect(bridge.transforms).toBe(original);
  });

  it("ignores messages with unknown types", () => {
    const worker = new FakeWorker();
    const bridge = new WorkerBridge({ worker });
    const original = bridge.transforms;
    worker.dispatch({ type: "something-else", transforms: new Float32Array(10) });
    expect(bridge.transforms).toBe(original);
  });

  it("uses a custom frameMessageType when provided", () => {
    const worker = new FakeWorker();
    const bridge = new WorkerBridge({
      worker,
      maxBodies: 4,
      frameMessageType: "physicsFrame",
    });
    const fresh = createTransformsBuffer(4).transforms;
    worker.dispatch({ type: "frame", transforms: fresh });
    expect(bridge.transforms).not.toBe(fresh);
    worker.dispatch({ type: "physicsFrame", transforms: fresh });
    expect(bridge.transforms).toBe(fresh);
  });
});

describe("WorkerBridge — applyTransforms", () => {
  it("writes x / y / rotation from the buffer to registered sprites", () => {
    const worker = new FakeWorker();
    const bridge = new WorkerBridge({ worker, maxBodies: 4 });

    const s0 = makeSprite();
    const s1 = makeSprite();
    const s2 = makeSprite();
    bridge.setSprite(0, s0);
    bridge.setSprite(1, s1);
    bridge.setSprite(2, s2);

    // Simulate worker-written transforms:
    const t = bridge.transforms;
    t[TRANSFORM_HEADER.BODY_COUNT] = 3;
    const writeBody = (i: number, x: number, y: number, r: number) => {
      const off = TRANSFORM_HEADER_FLOATS + i * TRANSFORM_FLOATS_PER_BODY;
      t[off] = x;
      t[off + 1] = y;
      t[off + 2] = r;
    };
    writeBody(0, 10, 20, 0.1);
    writeBody(1, 30, 40, 0.2);
    writeBody(2, 50, 60, 0.3);

    bridge.applyTransforms();
    expect(s0.x).toBe(10);
    expect(s0.y).toBe(20);
    expect(s0.rotation).toBeCloseTo(0.1, 6);
    expect(s1.x).toBe(30);
    expect(s2.rotation).toBeCloseTo(0.3, 6);
  });

  it("only writes up to min(bodyCount, registered sprites)", () => {
    const bridge = new WorkerBridge({ worker: new FakeWorker(), maxBodies: 4 });
    const s0 = makeSprite();
    const s1 = makeSprite();
    bridge.setSprite(0, s0);
    bridge.setSprite(1, s1);

    const t = bridge.transforms;
    // Worker says 3 bodies, but we only have 2 sprites — no out-of-range writes.
    t[TRANSFORM_HEADER.BODY_COUNT] = 3;
    t[TRANSFORM_HEADER_FLOATS + 0] = 1;
    t[TRANSFORM_HEADER_FLOATS + 1 * TRANSFORM_FLOATS_PER_BODY] = 2;
    t[TRANSFORM_HEADER_FLOATS + 2 * TRANSFORM_FLOATS_PER_BODY] = 3;
    bridge.applyTransforms();
    expect(s0.x).toBe(1);
    expect(s1.x).toBe(2);
  });

  it("skips null slots", () => {
    const bridge = new WorkerBridge({ worker: new FakeWorker(), maxBodies: 4 });
    const s0 = makeSprite();
    const s2 = makeSprite();
    bridge.setSprite(0, s0);
    bridge.setSprite(1, null);
    bridge.setSprite(2, s2);

    const t = bridge.transforms;
    t[TRANSFORM_HEADER.BODY_COUNT] = 3;
    t[TRANSFORM_HEADER_FLOATS + 2 * TRANSFORM_FLOATS_PER_BODY] = 99;
    // Should not throw; slot 1 is null.
    expect(() => bridge.applyTransforms()).not.toThrow();
    expect(s2.x).toBe(99);
  });

  it("clearing a slot via setSprite(i, null) stops updates there", () => {
    const bridge = new WorkerBridge({ worker: new FakeWorker(), maxBodies: 4 });
    const s = makeSprite();
    bridge.setSprite(0, s);
    const t = bridge.transforms;
    t[TRANSFORM_HEADER.BODY_COUNT] = 1;
    t[TRANSFORM_HEADER_FLOATS] = 5;
    bridge.applyTransforms();
    expect(s.x).toBe(5);

    bridge.setSprite(0, null);
    t[TRANSFORM_HEADER_FLOATS] = 999;
    bridge.applyTransforms();
    expect(s.x).toBe(5); // unchanged
  });

  it("rejects out-of-range or non-integer slot indices", () => {
    const bridge = new WorkerBridge({ worker: new FakeWorker(), maxBodies: 2 });
    expect(() => bridge.setSprite(-1, makeSprite())).toThrow(RangeError);
    expect(() => bridge.setSprite(2, makeSprite())).toThrow(RangeError);
    expect(() => bridge.setSprite(0.5, makeSprite())).toThrow(RangeError);
  });
});

describe("WorkerBridge — header getters", () => {
  it("reflects bodyCount / timeStamp / stepMs from the header slots", () => {
    const bridge = new WorkerBridge({ worker: new FakeWorker(), maxBodies: 4 });
    bridge.transforms[TRANSFORM_HEADER.BODY_COUNT] = 5.9; // should floor
    bridge.transforms[TRANSFORM_HEADER.TIME_STAMP] = 42;
    bridge.transforms[TRANSFORM_HEADER.STEP_MS] = 0.75;
    expect(bridge.bodyCount).toBe(5);
    expect(bridge.timeStamp).toBe(42);
    expect(bridge.stepMs).toBeCloseTo(0.75, 6);
  });
});

describe("WorkerBridge — lifecycle", () => {
  it("send() forwards to worker.postMessage", () => {
    const worker = new FakeWorker();
    const bridge = new WorkerBridge({ worker });
    bridge.send({ type: "hello" });
    expect(worker.posted).toEqual([{ message: { type: "hello" }, transfer: undefined }]);
  });

  it("dispose() removes the message listener and terminates the worker", () => {
    const worker = new FakeWorker();
    const terminateSpy = vi.spyOn(worker, "terminate");
    const removeSpy = vi.spyOn(worker, "removeEventListener");
    const bridge = new WorkerBridge({ worker });
    bridge.dispose();
    expect(terminateSpy).toHaveBeenCalledTimes(1);
    expect(removeSpy).toHaveBeenCalledTimes(1);
  });

  it("dispose() is idempotent", () => {
    const worker = new FakeWorker();
    const terminateSpy = vi.spyOn(worker, "terminate");
    const bridge = new WorkerBridge({ worker });
    bridge.dispose();
    bridge.dispose();
    expect(terminateSpy).toHaveBeenCalledTimes(1);
  });

  it("dispose() swallows terminate exceptions from structural stubs", () => {
    const worker = new FakeWorker();
    worker.terminate = () => {
      throw new Error("stub has no termination semantics");
    };
    const bridge = new WorkerBridge({ worker });
    expect(() => bridge.dispose()).not.toThrow();
  });
});
