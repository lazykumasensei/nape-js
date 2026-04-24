import type { Body } from "@newkrok/nape-js";
import type { FixedStepper } from "./FixedStepper.js";

/**
 * Minimal structural type for the PIXI display object fields we write to.
 * Matches `PIXI.Container` from pixi.js v8 (and any subclass, e.g. `Sprite`,
 * `Graphics`). Kept structural so tests can use plain objects.
 */
export interface PixiDisplayTarget {
  x: number;
  y: number;
  rotation: number;
}

/** Options passed to {@link BodySpriteBinding.bind}. */
export interface BindOptions {
  /** Body-local X offset of the sprite's origin (rotates with the body). */
  offsetX?: number;
  /** Body-local Y offset of the sprite's origin (rotates with the body). */
  offsetY?: number;
}

/** Options passed to the {@link BodySpriteBinding} constructor. */
export interface BodySpriteBindingOptions {
  /**
   * Optional {@link FixedStepper}. When provided, the binding subscribes to
   * its `onBeforeStep` hook to snapshot body state, enabling interpolation
   * via `update(alpha)`. Without a stepper, `update()` always writes the
   * current body state and the `alpha` argument is ignored.
   */
  stepper?: FixedStepper;
  /**
   * When true (default), bindings whose body has been removed from its space
   * (`body.space === null`) are dropped automatically on the next `update()`
   * or snapshot pass. Set false if you manage lifetimes manually.
   */
  autoCleanup?: boolean;
}

interface BindingItem {
  sprite: PixiDisplayTarget;
  offsetX: number;
  offsetY: number;
  prevX: number;
  prevY: number;
  prevRotation: number;
}

const TAU = Math.PI * 2;

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

/** Shortest-path angle lerp; handles unbounded nape rotations. */
function lerpAngle(a: number, b: number, t: number): number {
  let diff = b - a;
  if (diff > Math.PI) diff -= TAU;
  else if (diff < -Math.PI) diff += TAU;
  return a + diff * t;
}

function writeSprite(item: BindingItem, x: number, y: number, rotation: number): void {
  const { sprite, offsetX, offsetY } = item;
  if (offsetX !== 0 || offsetY !== 0) {
    const cos = Math.cos(rotation);
    const sin = Math.sin(rotation);
    sprite.x = x + cos * offsetX - sin * offsetY;
    sprite.y = y + sin * offsetX + cos * offsetY;
  } else {
    sprite.x = x;
    sprite.y = y;
  }
  sprite.rotation = rotation;
}

/**
 * Keeps PIXI display objects in sync with nape {@link Body} transforms.
 *
 * Basic usage:
 *
 * ```ts
 * const binding = new BodySpriteBinding();
 * binding.bind(body, sprite);
 * function frame() {
 *   space.step(1 / 60);
 *   binding.update();
 *   app.render();
 * }
 * ```
 *
 * With fixed-step interpolation (recommended for variable-rate render loops):
 *
 * ```ts
 * const stepper = new FixedStepper({ hz: 60 });
 * const binding = new BodySpriteBinding({ stepper });
 * binding.bind(body, sprite);
 * function frame(deltaSec) {
 *   const alpha = stepper.step(space, deltaSec);
 *   binding.update(alpha);
 *   app.render();
 * }
 * ```
 *
 * The sprite's rotation is written in radians, matching nape's convention.
 * Bindings are auto-removed when the body leaves its space (disable via
 * `{ autoCleanup: false }`).
 */
export class BodySpriteBinding {
  readonly #items = new Map<Body, BindingItem>();
  readonly #autoCleanup: boolean;
  readonly #unsubscribeStepper?: () => void;

  constructor(opts: BodySpriteBindingOptions = {}) {
    this.#autoCleanup = opts.autoCleanup ?? true;
    if (opts.stepper) {
      this.#unsubscribeStepper = opts.stepper.onBeforeStep(() => this.#snapshot());
    }
  }

  /** Number of active bindings. */
  get size(): number {
    return this.#items.size;
  }

  /**
   * Attach `sprite` to `body`. Subsequent `update()` calls will write the
   * body's interpolated position and rotation onto the sprite. If the same
   * body is bound twice, the previous binding is replaced.
   */
  bind(body: Body, sprite: PixiDisplayTarget, opts: BindOptions = {}): void {
    const offsetX = opts.offsetX ?? 0;
    const offsetY = opts.offsetY ?? 0;
    const item: BindingItem = {
      sprite,
      offsetX,
      offsetY,
      prevX: body.position.x,
      prevY: body.position.y,
      prevRotation: body.rotation,
    };
    this.#items.set(body, item);
    writeSprite(item, body.position.x, body.position.y, body.rotation);
  }

  /** Remove the binding for `body`. Returns `true` if a binding was removed. */
  unbind(body: Body): boolean {
    return this.#items.delete(body);
  }

  /** Whether `body` currently has a binding. */
  has(body: Body): boolean {
    return this.#items.has(body);
  }

  /** Iterate the bound bodies. */
  bodies(): IterableIterator<Body> {
    return this.#items.keys();
  }

  /**
   * Write body transforms into their sprites.
   *
   * @param alpha Interpolation factor in [0, 1]. Defaults to 1 (no
   *              interpolation). When a {@link FixedStepper} has not been
   *              supplied the value is ignored — sprites always follow the
   *              current body state.
   */
  update(alpha = 1): void {
    const interpolated = this.#unsubscribeStepper !== undefined && alpha < 1;
    for (const [body, item] of this.#items) {
      if (this.#autoCleanup && body.space === null) {
        this.#items.delete(body);
        continue;
      }
      const curX = body.position.x;
      const curY = body.position.y;
      const curR = body.rotation;
      if (interpolated) {
        writeSprite(
          item,
          lerp(item.prevX, curX, alpha),
          lerp(item.prevY, curY, alpha),
          lerpAngle(item.prevRotation, curR, alpha),
        );
      } else {
        writeSprite(item, curX, curY, curR);
      }
    }
  }

  /**
   * Drop all bindings and detach from the stepper (if any). The binding is
   * unusable after this call.
   */
  dispose(): void {
    this.#items.clear();
    this.#unsubscribeStepper?.();
  }

  /** Internal: snapshot body state as the interpolation source. */
  #snapshot(): void {
    for (const [body, item] of this.#items) {
      if (this.#autoCleanup && body.space === null) {
        this.#items.delete(body);
        continue;
      }
      item.prevX = body.position.x;
      item.prevY = body.position.y;
      item.prevRotation = body.rotation;
    }
  }
}
