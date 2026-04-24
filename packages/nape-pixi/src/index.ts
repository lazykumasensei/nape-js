/**
 * `@newkrok/nape-pixi` — PixiJS v8 integration for `@newkrok/nape-js`.
 *
 * Phase 1 surface:
 * - {@link FixedStepper} — fixed-timestep driver with before/after hooks
 *   and an interpolation factor
 * - {@link BodySpriteBinding} — keeps PIXI display objects in sync with
 *   nape {@link Body} transforms, with optional sub-step interpolation
 *
 * Planned (later phases):
 * - `PixiDebugDraw` — on-demand shape / constraint / AABB overlay
 * - `WorkerBridge` — main-thread Pixi + worker-thread physics helper
 */

export { FixedStepper } from "./FixedStepper.js";
export type { FixedStepperOptions } from "./FixedStepper.js";

export { BodySpriteBinding } from "./BodySpriteBinding.js";
export type {
  BindOptions,
  BodySpriteBindingOptions,
  PixiDisplayTarget,
} from "./BodySpriteBinding.js";

export const VERSION = "0.1.0-alpha.0";
