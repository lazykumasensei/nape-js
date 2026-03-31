import { CbEvent } from "../callbacks/CbEvent";
import { CbType } from "../callbacks/CbType";
import { InteractionListener } from "../callbacks/InteractionListener";
import { InteractionType } from "../callbacks/InteractionType";
import type { InteractionCallback } from "../callbacks/InteractionCallback";
import type { OptionType } from "../callbacks/OptionType";
import type { Interactor } from "../phys/Interactor";
import type { Body } from "../phys/Body";
import type { Space } from "../space/Space";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Handler called when an interactor enters, stays in, or exits the zone. */
export type TriggerHandler = (interactor: Interactor) => void;

/** Configuration options for {@link TriggerZone}. */
export interface TriggerZoneOptions {
  /**
   * Filter for which interactors trigger the zone.
   * When `null`, any interactor triggers the zone.
   * @default null
   */
  filter?: CbType | OptionType | null;

  /**
   * The interaction type to listen for.
   * @default InteractionType.SENSOR
   */
  interactionType?: InteractionType;

  /** Called once when an interactor enters the zone. */
  onEnter?: TriggerHandler | null;

  /** Called every simulation step while an interactor remains in the zone. */
  onStay?: TriggerHandler | null;

  /** Called once when an interactor exits the zone. */
  onExit?: TriggerHandler | null;
}

// ---------------------------------------------------------------------------
// TriggerZone
// ---------------------------------------------------------------------------

/**
 * High-level trigger zone — Unity-style `onEnter`/`onStay`/`onExit` wrapper
 * over the nape callback system.
 *
 * Automatically creates sensor-based {@link InteractionListener}s and manages
 * their lifecycle. Assign handlers directly or via the constructor options.
 *
 * @example
 * ```ts
 * const zone = new TriggerZone(space, sensorBody, {
 *   onEnter: (other) => console.log("entered!", other),
 *   onStay:  (other) => console.log("inside",  other),
 *   onExit:  (other) => console.log("left!",   other),
 * });
 *
 * // Later: clean up all listeners
 * zone.dispose();
 * ```
 */
export class TriggerZone {
  /** The CbType automatically created for this zone. */
  readonly cbType: CbType;

  private _space: Space;
  private _body: Body;
  private _enabled = true;

  private _onEnter: TriggerHandler | null;
  private _onStay: TriggerHandler | null;
  private _onExit: TriggerHandler | null;

  private _enterListener: InteractionListener | null = null;
  private _stayListener: InteractionListener | null = null;
  private _exitListener: InteractionListener | null = null;

  private _filter: CbType | OptionType | null;
  private _interactionType: InteractionType;

  /**
   * @param space - The physics space to register listeners on.
   * @param body  - The body acting as the trigger zone. Its shapes should have
   *                `sensorEnabled = true` (the constructor enables it automatically
   *                for all shapes that don't already have it set).
   * @param options - Optional configuration and initial handlers.
   */
  constructor(space: Space, body: Body, options?: TriggerZoneOptions) {
    this._space = space;
    this._body = body;
    this._filter = options?.filter ?? null;
    this._interactionType = options?.interactionType ?? InteractionType.SENSOR;

    // Auto-enable sensor on all shapes
    for (let i = 0; i < body.shapes.length; i++) {
      const shape = body.shapes.at(i);
      if (!shape.sensorEnabled) {
        shape.sensorEnabled = true;
      }
    }

    // Create a unique CbType for this zone and tag the body
    this.cbType = new CbType();
    body.cbTypes.add(this.cbType);

    // Store handlers
    this._onEnter = options?.onEnter ?? null;
    this._onStay = options?.onStay ?? null;
    this._onExit = options?.onExit ?? null;

    // Create listeners for non-null handlers
    this._syncListeners();
  }

  /** Called once when an interactor enters the zone. */
  get onEnter(): TriggerHandler | null {
    return this._onEnter;
  }
  set onEnter(handler: TriggerHandler | null) {
    this._onEnter = handler;
    this._syncListeners();
  }

  /** Called every simulation step while an interactor remains in the zone. */
  get onStay(): TriggerHandler | null {
    return this._onStay;
  }
  set onStay(handler: TriggerHandler | null) {
    this._onStay = handler;
    this._syncListeners();
  }

  /** Called once when an interactor exits the zone. */
  get onExit(): TriggerHandler | null {
    return this._onExit;
  }
  set onExit(handler: TriggerHandler | null) {
    this._onExit = handler;
    this._syncListeners();
  }

  /** Whether the zone is active. When disabled, no callbacks fire. */
  get enabled(): boolean {
    return this._enabled;
  }
  set enabled(value: boolean) {
    if (this._enabled === value) return;
    this._enabled = value;
    this._syncListeners();
  }

  /** The body acting as the trigger zone. */
  get body(): Body {
    return this._body;
  }

  /** The space the zone is registered on. */
  get space(): Space {
    return this._space;
  }

  /**
   * Remove all listeners from the space and untag the body.
   * After disposal, the TriggerZone should not be reused.
   */
  dispose(): void {
    this._removeListener("enter");
    this._removeListener("stay");
    this._removeListener("exit");
    this._body.cbTypes.remove(this.cbType);
    this._enabled = false;
  }

  // -------------------------------------------------------------------------
  // Internal
  // -------------------------------------------------------------------------

  /**
   * Resolve which interactor is "the other" (not the zone body) from
   * the callback's int1/int2 pair.
   */
  private _resolveOther(cb: InteractionCallback): Interactor {
    const int1 = cb.int1;
    const int2 = cb.int2;
    // Compare by identity — the zone body is always one of the two
    if (int1 === this._body) return int2;
    if (int2 === this._body) return int1;
    // Fallback: compare by id
    if (int1.id === this._body.id) return int2;
    return int1;
  }

  private _syncListeners(): void {
    // Enter
    if (this._enabled && this._onEnter) {
      if (!this._enterListener) {
        this._enterListener = this._createListener(CbEvent.BEGIN, (cb) => {
          this._onEnter?.(this._resolveOther(cb));
        });
      }
    } else {
      this._removeListener("enter");
    }

    // Stay
    if (this._enabled && this._onStay) {
      if (!this._stayListener) {
        this._stayListener = this._createListener(CbEvent.ONGOING, (cb) => {
          this._onStay?.(this._resolveOther(cb));
        });
      }
    } else {
      this._removeListener("stay");
    }

    // Exit
    if (this._enabled && this._onExit) {
      if (!this._exitListener) {
        this._exitListener = this._createListener(CbEvent.END, (cb) => {
          this._onExit?.(this._resolveOther(cb));
        });
      }
    } else {
      this._removeListener("exit");
    }
  }

  private _createListener(
    event: CbEvent,
    handler: (cb: InteractionCallback) => void,
  ): InteractionListener {
    const filterOption = this._filter ?? CbType.ANY_BODY;
    const listener = new InteractionListener(
      event,
      this._interactionType,
      this.cbType,
      filterOption,
      handler,
    );
    this._space.listeners.add(listener);
    return listener;
  }

  private _removeListener(which: "enter" | "stay" | "exit"): void {
    const key =
      which === "enter" ? "_enterListener" : which === "stay" ? "_stayListener" : "_exitListener";
    const listener = this[key];
    if (listener) {
      listener.space = null;
      this[key] = null;
    }
  }
}
