import type { PixiDisplayTarget } from "./BodySpriteBinding.js";
import {
  TRANSFORM_FLOATS_PER_BODY,
  TRANSFORM_HEADER,
  TRANSFORM_HEADER_FLOATS,
  createTransformsBuffer,
} from "./workerProtocol.js";

/**
 * Minimal `MessageEvent`-emitting surface.
 *
 * Structural so tests can pass a plain object with `postMessage`, `terminate`,
 * and `addEventListener`/`removeEventListener` hooks.
 */
export interface WorkerLike {
  postMessage(message: unknown, transfer?: Transferable[]): void;
  terminate(): void;
  addEventListener(type: "message", listener: (event: { data: unknown }) => void): void;
  removeEventListener(type: "message", listener: (event: { data: unknown }) => void): void;
}

/** Frame notification from the worker to the main thread. */
export interface WorkerFrameMessage {
  type: "frame";
  /**
   * When the worker cannot share memory (SAB unavailable or COOP/COEP not
   * set), it must include a fresh buffer with every frame. The bridge swaps
   * its `transforms` reference to this buffer on receipt.
   */
  transforms?: Float32Array;
}

/** Optional `{ type: "ready" }` signal the bridge listens for. */
export interface WorkerReadyMessage {
  type: "ready";
}

export interface WorkerBridgeOptions {
  /** The user's `Worker` (or a structural stand-in for testing). */
  worker: WorkerLike;
  /**
   * Maximum bodies the buffer can hold. Ignored when `transforms` is
   * supplied. Default 1024.
   */
  maxBodies?: number;
  /**
   * Pre-allocated transforms buffer. Use this to share a
   * {@link createTransformsBuffer} result with the worker-side init message.
   * When omitted, the bridge allocates its own.
   */
  transforms?: Float32Array;
  /**
   * Message `type` field the bridge treats as a frame notification.
   * Default `"frame"`. Change to avoid collision with your own protocol.
   */
  frameMessageType?: string;
  /**
   * Message `type` field the bridge treats as a "ready" signal.
   * Default `"ready"`. Set to `null` to disable ready handling.
   */
  readyMessageType?: string | null;
}

/**
 * Main-thread glue for a physics worker. Receives per-frame transforms,
 * applies them to registered PIXI display targets, and exposes diagnostic
 * counters.
 *
 * ```ts
 * import { Container, Sprite } from "pixi.js";
 * import { WorkerBridge } from "@newkrok/nape-pixi";
 *
 * const worker = new Worker(new URL("./physics-worker.ts", import.meta.url),
 *   { type: "module" });
 * const bridge = new WorkerBridge({ worker, maxBodies: 1024 });
 *
 * worker.postMessage({
 *   type: "init",
 *   buffer: bridge.transforms.buffer,
 *   maxBodies: 1024,
 * });
 * await bridge.ready;
 *
 * for (let i = 0; i < sprites.length; i++) bridge.setSprite(i, sprites[i]);
 *
 * function frame() {
 *   bridge.applyTransforms();
 *   app.render();
 * }
 * ```
 *
 * The bridge does **not** prescribe an init handshake — send whatever
 * message shape your worker expects. It only listens for frame notifications
 * (default `{ type: "frame" }`) and, optionally, a ready signal (default
 * `{ type: "ready" }`).
 */
export class WorkerBridge {
  /** Current transforms view. Swaps on each frame in postMessage-fallback mode. */
  transforms: Float32Array;
  /** Max bodies the buffer can carry. */
  readonly maxBodies: number;
  /** Resolves on the first `{ type: "ready" }` message (or immediately if disabled). */
  readonly ready: Promise<void>;

  readonly #worker: WorkerLike;
  readonly #sprites: Array<PixiDisplayTarget | null> = [];
  readonly #frameType: string;
  readonly #readyType: string | null;
  #disposed = false;
  #resolveReady!: () => void;

  constructor(opts: WorkerBridgeOptions) {
    this.#worker = opts.worker;
    this.#frameType = opts.frameMessageType ?? "frame";
    this.#readyType = opts.readyMessageType === null ? null : (opts.readyMessageType ?? "ready");

    if (opts.transforms) {
      this.transforms = opts.transforms;
      this.maxBodies = this.#inferMaxBodies(opts.transforms.length);
    } else {
      const alloc = createTransformsBuffer(opts.maxBodies ?? 1024);
      this.transforms = alloc.transforms;
      this.maxBodies = alloc.maxBodies;
    }

    this.ready = new Promise<void>((resolve) => {
      this.#resolveReady = resolve;
      if (this.#readyType === null) resolve();
    });

    this.#worker.addEventListener("message", this.#onMessage);
  }

  /** Number of bodies the worker wrote in the last frame. */
  get bodyCount(): number {
    return this.transforms[TRANSFORM_HEADER.BODY_COUNT] | 0;
  }

  /** Worker's space.timeStamp at the last write. */
  get timeStamp(): number {
    return this.transforms[TRANSFORM_HEADER.TIME_STAMP];
  }

  /** Measured step cost (ms) the worker reported in the last frame. */
  get stepMs(): number {
    return this.transforms[TRANSFORM_HEADER.STEP_MS];
  }

  /**
   * Register (or clear, when `sprite` is `null`) a display target at the
   * given body slot. Slots correspond to the iteration order of
   * `space.bodies` in the worker.
   */
  setSprite(index: number, sprite: PixiDisplayTarget | null): void {
    if (index < 0 || !Number.isInteger(index)) {
      throw new RangeError(
        `WorkerBridge.setSprite: index must be a non-negative integer, got ${index}`,
      );
    }
    if (index >= this.maxBodies) {
      throw new RangeError(
        `WorkerBridge.setSprite: index ${index} exceeds maxBodies=${this.maxBodies}`,
      );
    }
    this.#sprites[index] = sprite;
  }

  /** Write the latest transforms into every registered sprite. */
  applyTransforms(): void {
    const count = Math.min(this.bodyCount, this.#sprites.length);
    for (let i = 0; i < count; i++) {
      const sprite = this.#sprites[i];
      if (!sprite) continue;
      const off = TRANSFORM_HEADER_FLOATS + i * TRANSFORM_FLOATS_PER_BODY;
      sprite.x = this.transforms[off];
      sprite.y = this.transforms[off + 1];
      sprite.rotation = this.transforms[off + 2];
    }
  }

  /** Thin wrapper around `worker.postMessage` — added for convenience. */
  send(message: unknown, transfer?: Transferable[]): void {
    this.#worker.postMessage(message, transfer);
  }

  /** Detach the message listener and terminate the worker. Safe to call twice. */
  dispose(): void {
    if (this.#disposed) return;
    this.#disposed = true;
    this.#worker.removeEventListener("message", this.#onMessage);
    try {
      this.#worker.terminate();
    } catch {
      // noop — user may have supplied a stub without terminate semantics.
    }
    this.#sprites.length = 0;
  }

  // -------------------------------------------------------------------------

  #onMessage = (event: { data: unknown }) => {
    const data = event.data as { type?: string; transforms?: Float32Array } | null;
    if (!data || typeof data.type !== "string") return;
    if (data.type === this.#readyType) {
      this.#resolveReady();
      return;
    }
    if (data.type !== this.#frameType) return;
    if (data.transforms instanceof Float32Array) {
      this.transforms = data.transforms;
    }
  };

  #inferMaxBodies(length: number): number {
    return Math.max(0, Math.floor((length - TRANSFORM_HEADER_FLOATS) / TRANSFORM_FLOATS_PER_BODY));
  }
}
