import { Body } from "../phys/Body";
import { BodyType } from "../phys/BodyType";
import { Vec2 } from "../geom/Vec2";
import { Ray } from "../geom/Ray";
import type { Space } from "../space/Space";
import { InteractionFilter } from "../dynamics/InteractionFilter";
import type { CbType } from "../callbacks/CbType";
import { InteractionType } from "../callbacks/InteractionType";
import { PreListener } from "../callbacks/PreListener";
import { PreFlag } from "../callbacks/PreFlag";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Result returned by {@link CharacterController.update}. */
export interface MoveResult {
  /** True if the character is standing on a surface within slope limits. */
  grounded: boolean;
  /** Ground surface normal, or null if not grounded. */
  groundNormal: Vec2 | null;
  /** The body the character is standing on, or null. */
  groundBody: Body | null;
  /** True if standing on a kinematic (moving) platform. */
  onMovingPlatform: boolean;
  /** Angle of the ground slope in radians (0 = flat). */
  slopeAngle: number;
  /** True if touching a wall on the left side. */
  wallLeft: boolean;
  /** True if touching a wall on the right side. */
  wallRight: boolean;
  /** Seconds since the character was last grounded (for coyote-time). */
  timeSinceGrounded: number;
}

/** Configuration options for {@link CharacterController}. */
export interface CharacterControllerOptions {
  /**
   * Maximum climbable slope angle in radians.
   * @default Math.PI / 4 (45 degrees)
   */
  maxSlopeAngle?: number;

  /**
   * CbType for one-way platforms. When set, the controller automatically
   * creates a PreListener that ignores collisions when the character
   * approaches from below — matching the original nape Haxe engine pattern.
   */
  oneWayPlatformTag?: CbType;

  /**
   * CbType assigned to the character body (required if oneWayPlatformTag is set).
   */
  characterTag?: CbType;

  /**
   * InteractionFilter used for ground/wall detection raycasts.
   * When null, an auto-generated filter excluding the character's own
   * shapes is used.
   * @default null
   */
  filter?: InteractionFilter | null;
}

// ---------------------------------------------------------------------------
// CharacterController
// ---------------------------------------------------------------------------

/**
 * Velocity-based character controller for 2D platformers.
 *
 * The character uses a **dynamic body** whose velocity is set each frame.
 * Collision response (including one-way platforms) is handled entirely by
 * the physics engine via `space.step()` and `PreListener` callbacks —
 * matching the original nape Haxe engine pattern.
 *
 * The controller provides:
 * - Velocity application (`setVelocity`)
 * - Ground/slope detection (raycast queries)
 * - Wall detection (raycast queries)
 * - One-way platform support (auto-configured PreListener)
 * - Moving platform tracking
 * - Coyote time helper (`timeSinceGrounded`)
 *
 * @example
 * ```ts
 * const body = new Body(BodyType.DYNAMIC, new Vec2(100, 100));
 * body.shapes.add(new Circle(14));
 * body.allowRotation = false;
 * body.isBullet = true;
 * body.space = space;
 *
 * const cc = new CharacterController(space, body, {
 *   maxSlopeAngle: Math.PI / 4,
 *   oneWayPlatformTag: platformCbType,
 *   characterTag: playerCbType,
 * });
 *
 * // Each frame (before space.step):
 * cc.setVelocity(moveX, velY);
 * space.step(1/60);
 * const result = cc.update();
 * if (result.grounded) velY = 0;
 * ```
 */
export class CharacterController {
  /** The physics space. */
  readonly space: Space;

  /** The character body being controlled. */
  readonly body: Body;

  // Configuration
  private _maxSlopeAngle: number;
  private _maxSlopeCos: number;
  private _filter: InteractionFilter | null;

  // One-way platform support
  private _oneWayListener: PreListener | null = null;

  // State
  private _grounded = false;
  private _groundNormal: Vec2 | null = null;
  private _groundBody: Body | null = null;
  private _onMovingPlatform = false;
  private _slopeAngle = 0;
  private _wallLeft = false;
  private _wallRight = false;
  private _timeSinceGrounded = 0;

  constructor(space: Space, body: Body, options: CharacterControllerOptions = {}) {
    this.space = space;
    this.body = body;

    this._maxSlopeAngle = options.maxSlopeAngle ?? Math.PI / 4;
    this._maxSlopeCos = Math.cos(this._maxSlopeAngle);

    // Auto-setup raycast filter to exclude the character's own shapes.
    const CHAR_GROUP = 1 << 8;
    if (options.filter) {
      this._filter = options.filter;
    } else {
      const shapes = body.shapes;
      for (let i = 0; i < shapes.length; i++) {
        const s = shapes.at(i);
        const f = s.filter;
        f.collisionGroup = f.collisionGroup | CHAR_GROUP;
      }
      this._filter = new InteractionFilter(1, ~CHAR_GROUP);
    }

    // Auto-setup one-way platform PreListener
    if (options.oneWayPlatformTag && options.characterTag) {
      this._setupOneWayPlatforms(options.oneWayPlatformTag, options.characterTag);
    }
  }

  // -----------------------------------------------------------------------
  // Public getters
  // -----------------------------------------------------------------------

  get grounded(): boolean {
    return this._grounded;
  }

  get groundNormal(): Vec2 | null {
    return this._groundNormal;
  }

  get groundBody(): Body | null {
    return this._groundBody;
  }

  get timeSinceGrounded(): number {
    return this._timeSinceGrounded;
  }

  get maxSlopeAngle(): number {
    return this._maxSlopeAngle;
  }

  set maxSlopeAngle(v: number) {
    this._maxSlopeAngle = v;
    this._maxSlopeCos = Math.cos(v);
  }

  // -----------------------------------------------------------------------
  // Core API
  // -----------------------------------------------------------------------

  /**
   * Set the character body's velocity. Call this each frame **before**
   * `space.step()`.
   *
   * @param vx - Horizontal velocity (px/s). Set to 0 for no horizontal input.
   * @param vy - Vertical velocity (px/s). Typically includes gravity accumulation.
   */
  setVelocity(vx: number, vy: number): void {
    this.body.velocity = new Vec2(vx, vy);
  }

  /**
   * Query the character's state after `space.step()` has run.
   * Detects ground, walls, slope angle, moving platforms, etc.
   *
   * Call this each frame **after** `space.step()`.
   */
  update(): MoveResult {
    this._wallLeft = false;
    this._wallRight = false;

    const px = this.body.position.x;
    const py = this.body.position.y;

    // Ground detection
    this._detectGround(px, py);

    // Wall detection
    this._detectWalls(px, py);

    // Moving platform tracking
    if (this._grounded && this._groundBody) {
      this._onMovingPlatform = this._groundBody.type === BodyType.KINEMATIC;
    } else {
      this._onMovingPlatform = false;
    }

    // Coyote time
    if (this._grounded) {
      this._timeSinceGrounded = 0;
    } else {
      this._timeSinceGrounded += 1 / 60;
    }

    return {
      grounded: this._grounded,
      groundNormal: this._groundNormal,
      groundBody: this._groundBody,
      onMovingPlatform: this._onMovingPlatform,
      slopeAngle: this._slopeAngle,
      wallLeft: this._wallLeft,
      wallRight: this._wallRight,
      timeSinceGrounded: this._timeSinceGrounded,
    };
  }

  /**
   * Remove the one-way platform PreListener and detach from space.
   */
  destroy(): void {
    if (this._oneWayListener) {
      this._oneWayListener.space = null;
      this._oneWayListener = null;
    }
  }

  // -----------------------------------------------------------------------
  // Private: ground detection
  // -----------------------------------------------------------------------

  private _detectGround(px: number, py: number): void {
    const charRadius = this._getCharacterRadius(0, 1);
    const castDist = charRadius + 4; // small tolerance

    const ray = new Ray(new Vec2(px, py), new Vec2(0, 1));
    ray.maxDistance = castDist;

    const hit = this.space.rayCast(ray, false, this._filter);

    if (hit && hit.distance <= castDist) {
      const ny = hit.normal.y;
      if (ny < 0) {
        const cosAngle = -ny;
        if (cosAngle >= this._maxSlopeCos) {
          this._grounded = true;
          this._groundNormal = new Vec2(hit.normal.x, hit.normal.y);
          this._groundBody = hit.shape?.body ?? null;
          this._slopeAngle = Math.acos(Math.min(1, cosAngle));
          return;
        }
      }
    }

    this._grounded = false;
    this._groundNormal = null;
    this._groundBody = null;
    this._slopeAngle = 0;
  }

  // -----------------------------------------------------------------------
  // Private: wall detection
  // -----------------------------------------------------------------------

  private _detectWalls(px: number, py: number): void {
    const charRadius = this._getCharacterRadius(1, 0);
    const castDist = charRadius + 2;

    // Left
    const leftRay = new Ray(new Vec2(px, py), new Vec2(-1, 0));
    leftRay.maxDistance = castDist;
    const leftHit = this.space.rayCast(leftRay, false, this._filter);
    if (leftHit && leftHit.distance <= castDist && Math.abs(leftHit.normal.x) > 0.7) {
      this._wallLeft = true;
    }

    // Right
    const rightRay = new Ray(new Vec2(px, py), new Vec2(1, 0));
    rightRay.maxDistance = castDist;
    const rightHit = this.space.rayCast(rightRay, false, this._filter);
    if (rightHit && rightHit.distance <= castDist && Math.abs(rightHit.normal.x) > 0.7) {
      this._wallRight = true;
    }
  }

  // -----------------------------------------------------------------------
  // Private: one-way platforms
  // -----------------------------------------------------------------------

  private _setupOneWayPlatforms(platformTag: CbType, characterTag: CbType): void {
    const listener = new PreListener(
      InteractionType.COLLISION,
      platformTag,
      characterTag,
      (cb) => {
        try {
          const colArb = cb.arbiter.collisionArbiter;
          if (!colArb) return PreFlag.ACCEPT;

          // Mirror original nape pattern: check normal direction relative
          // to swapped flag. Normal points from int1 to int2 when not swapped.
          // We want to IGNORE when normal points downward from the platform
          // (character is below), and ACCEPT when it points upward (character above).
          const ny = colArb.normal.y;
          const swapped = cb.swapped;

          // If swapped, normal direction is flipped
          if (ny > 0 !== swapped) {
            return PreFlag.IGNORE;
          }
          return PreFlag.ACCEPT;
        } catch {
          return PreFlag.ACCEPT;
        }
      },
      0,
      true, // pure — allows sleeping on the platform
    );
    listener.space = this.space;
    this._oneWayListener = listener;
  }

  // -----------------------------------------------------------------------
  // Private: shape helpers
  // -----------------------------------------------------------------------

  private _getCharacterRadius(dirX: number, dirY: number): number {
    const shape = this.body.shapes.at(0);
    if (!shape) return 0;
    if (shape.isCircle()) {
      return (shape.castCircle as any)?.radius ?? 0;
    }
    if (shape.isCapsule()) {
      const cap = shape.castCapsule as any;
      if (cap) {
        const r = cap.radius as number;
        const hl = cap.halfLength as number;
        const rot = this.body.rotation;
        const sx = Math.cos(rot);
        const sy = Math.sin(rot);
        const spineDot = Math.abs(dirX * sx + dirY * sy) * hl;
        return spineDot + r;
      }
    }
    const b = shape.bounds;
    const hw = b.width / 2;
    const hh = b.height / 2;
    return Math.abs(dirX) * hw + Math.abs(dirY) * hh;
  }
}
