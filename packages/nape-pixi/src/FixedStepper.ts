import type { Space } from "@newkrok/nape-js";

/** Options for {@link FixedStepper}. */
export interface FixedStepperOptions {
  /** Physics rate in Hz (default 60). The step size is `1 / hz`. */
  hz?: number;
  /**
   * Upper bound on physics steps executed in a single {@link FixedStepper.step}
   * call. Prevents a slow frame from triggering an unbounded catch-up loop
   * (a.k.a. the "spiral of death"). Default 5.
   */
  maxStepsPerFrame?: number;
  /** Forwarded to {@link Space.step}. Default 10. */
  velocityIterations?: number;
  /** Forwarded to {@link Space.step}. Default 10. */
  positionIterations?: number;
}

type BeforeHook = (space: Space) => void;
type AfterHook = (space: Space, dt: number) => void;

/**
 * Fixed-timestep driver for a nape {@link Space}, with hooks for the
 * before/after of each step and an interpolation factor for smooth rendering.
 *
 * Pattern — call once per render frame:
 *
 * ```ts
 * const stepper = new FixedStepper({ hz: 60 });
 * const alpha = stepper.step(space, deltaSec);
 * binding.update(alpha);
 * app.render();
 * ```
 *
 * The returned `alpha` is the fraction of a physics step that has accumulated
 * but not yet been simulated. Pass it to {@link BodySpriteBinding.update} to
 * interpolate sprite positions and avoid jitter when render rate ≠ physics
 * rate.
 */
export class FixedStepper {
  readonly hz: number;
  readonly dt: number;
  readonly maxStepsPerFrame: number;
  readonly velocityIterations: number;
  readonly positionIterations: number;

  #accumulator = 0;
  #beforeHooks: BeforeHook[] = [];
  #afterHooks: AfterHook[] = [];

  constructor(opts: FixedStepperOptions = {}) {
    const hz = opts.hz ?? 60;
    if (!(hz > 0) || !Number.isFinite(hz)) {
      throw new RangeError(`FixedStepper: 'hz' must be a positive finite number, got ${hz}`);
    }
    this.hz = hz;
    this.dt = 1 / hz;
    this.maxStepsPerFrame = opts.maxStepsPerFrame ?? 5;
    this.velocityIterations = opts.velocityIterations ?? 10;
    this.positionIterations = opts.positionIterations ?? 10;
  }

  /**
   * Advance the simulation by `deltaSec` seconds of wall-clock time, running
   * zero or more fixed-size physics steps.
   *
   * @returns Interpolation factor in [0, 1): how far into the next step the
   *          accumulator has progressed.
   */
  step(space: Space, deltaSec: number): number {
    if (!Number.isFinite(deltaSec) || deltaSec < 0) return this.#accumulator / this.dt;
    this.#accumulator += deltaSec;
    let executed = 0;
    while (this.#accumulator >= this.dt && executed < this.maxStepsPerFrame) {
      for (const cb of this.#beforeHooks) cb(space);
      space.step(this.dt, this.velocityIterations, this.positionIterations);
      for (const cb of this.#afterHooks) cb(space, this.dt);
      this.#accumulator -= this.dt;
      executed++;
    }
    // Spiral-of-death guard: if the cap was reached and there's still a
    // backlog, discard it rather than letting it grow without bound.
    if (executed >= this.maxStepsPerFrame && this.#accumulator > this.dt) {
      this.#accumulator = 0;
    }
    return this.#accumulator / this.dt;
  }

  /**
   * Register a callback fired before each physics step. Use this to snapshot
   * body state for interpolation. Returns an unsubscribe function.
   */
  onBeforeStep(cb: BeforeHook): () => void {
    this.#beforeHooks.push(cb);
    return () => {
      const i = this.#beforeHooks.indexOf(cb);
      if (i >= 0) this.#beforeHooks.splice(i, 1);
    };
  }

  /**
   * Register a callback fired after each physics step. Returns an unsubscribe
   * function.
   */
  onAfterStep(cb: AfterHook): () => void {
    this.#afterHooks.push(cb);
    return () => {
      const i = this.#afterHooks.indexOf(cb);
      if (i >= 0) this.#afterHooks.splice(i, 1);
    };
  }

  /** Discard the accumulated time. */
  reset(): void {
    this.#accumulator = 0;
  }

  /** Current interpolation factor in [0, 1) without advancing the simulation. */
  get alpha(): number {
    return this.#accumulator / this.dt;
  }

  /** Internal: exposed for tests and for diagnostics. */
  get accumulatorSeconds(): number {
    return this.#accumulator;
  }
}
