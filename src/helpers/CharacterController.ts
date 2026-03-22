import { Body } from "../phys/Body";
import { BodyType } from "../phys/BodyType";
import { Vec2 } from "../geom/Vec2";
import { Ray } from "../geom/Ray";
import type { Space } from "../space/Space";
import type { Shape } from "../shape/Shape";
import { InteractionFilter } from "../dynamics/InteractionFilter";
import type { CbType } from "../callbacks/CbType";
import { InteractionType } from "../callbacks/InteractionType";
import { PreListener } from "../callbacks/PreListener";
import { PreFlag } from "../callbacks/PreFlag";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** A single collision encountered during a `move()` call. */
export interface CharacterCollision {
  /** Surface normal at the collision point (pointing away from the surface). */
  normal: Vec2;
  /** World-space position of the collision. */
  point: Vec2;
  /** The body that was hit. */
  body: Body;
  /** The shape that was hit. */
  shape: Shape;
}

/** Result returned by {@link CharacterController.move}. */
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
  /** Number of collisions encountered during this move. */
  numCollisions: number;
  /** Retrieve collision info by index. */
  getCollision(index: number): CharacterCollision;
}

/** Configuration options for {@link CharacterController}. */
export interface CharacterControllerOptions {
  /**
   * Maximum climbable slope angle in radians.
   * Surfaces steeper than this block horizontal movement.
   * @default Math.PI / 4 (45 degrees)
   */
  maxSlopeAngle?: number;

  /**
   * Maximum step height the character can automatically climb.
   * Set to 0 to disable step climbing.
   * @default 0
   */
  stepHeight?: number;

  /**
   * Small gap maintained between the character and surfaces to prevent
   * floating-point tunneling. Applied to ray/query distances.
   * @default 0.5
   */
  skinWidth?: number;

  /**
   * Maximum distance to snap the character down to the ground each frame.
   * Prevents bouncing on slopes and stair edges. Set to 0 to disable.
   * @default 4
   */
  snapToGround?: number;

  /**
   * CbType for one-way platforms. When set, the controller automatically
   * creates a PreListener that ignores collisions when the character
   * approaches from below.
   *
   * One-way platform shapes must set `filter.collisionGroup = oneWayGroupBit`
   * (exclusively, not OR'd with the default group) so the controller can
   * exclude them from upward raycasts.
   */
  oneWayPlatformTag?: CbType;

  /**
   * CbType assigned to the character body (required if oneWayPlatformTag is set).
   */
  characterTag?: CbType;

  /**
   * Collision group bit used for one-way platform shapes.
   * The controller excludes this group from upward raycasts so the character
   * passes through from below. Must match the bit set on platform shapes.
   * @default 1 << 9 (512)
   */
  oneWayGroupBit?: number;

  /**
   * When true, the character inherits the velocity of kinematic platforms
   * it stands on.
   * @default true
   */
  trackMovingPlatforms?: boolean;

  /**
   * InteractionFilter used for ray/shape queries. When null, no filter is applied.
   * @default null
   */
  filter?: InteractionFilter | null;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Maximum collide-and-slide iterations per move. */
const MAX_SLIDE_ITERATIONS = 3;

/** Minimum movement magnitude below which we stop iterating. */
const MIN_MOVE_THRESHOLD = 0.001;

/** Dot-product threshold for considering two normals as opposing (corner). */
const CORNER_DOT_THRESHOLD = 0.05;

// ---------------------------------------------------------------------------
// CharacterController
// ---------------------------------------------------------------------------

/**
 * Geometric character controller for 2D platformers.
 *
 * Uses raycasting and the "collide-and-slide" algorithm for pixel-perfect,
 * single-frame movement resolution. The controlled body should be
 * `BodyType.KINEMATIC` (recommended) or `BodyType.DYNAMIC` with
 * `allowRotation = false`.
 *
 * @example
 * ```ts
 * const body = new Body(BodyType.KINEMATIC, new Vec2(100, 100));
 * body.shapes.add(new Circle(12));
 * body.space = space;
 *
 * const cc = new CharacterController(space, body, {
 *   maxSlopeAngle: Math.PI / 4,
 *   snapToGround: 4,
 * });
 *
 * // Game loop:
 * const result = cc.move(new Vec2(moveX, moveY));
 * if (result.grounded && jumpPressed) {
 *   cc.move(new Vec2(0, -jumpSpeed));
 * }
 * ```
 */
export class CharacterController {
  /** The physics space. */
  readonly space: Space;

  /** The character body being controlled. */
  readonly body: Body;

  // Configuration
  private _maxSlopeAngle: number;
  private _maxSlopeCos: number; // cos(maxSlopeAngle) — precomputed
  private _stepHeight: number;
  private _skinWidth: number;
  private _snapToGround: number;
  private _trackMovingPlatforms: boolean;
  private _filter: InteractionFilter | null;

  // One-way platform support
  private _oneWayListener: PreListener | null = null;
  private _filterNoOneWay: InteractionFilter | null = null; // excludes one-way platforms
  private _oneWayGroup = 0; // collision group bit for one-way platforms

  // State
  private _grounded = false;
  private _groundNormal: Vec2 | null = null;
  private _groundBody: Body | null = null;
  private _onMovingPlatform = false;
  private _slopeAngle = 0;
  private _wallLeft = false;
  private _wallRight = false;
  private _timeSinceGrounded = 0;
  private _collisions: CharacterCollision[] = [];

  // Platform tracking
  private _lastPlatformPos: Vec2 | null = null;
  private _platformBody: Body | null = null;

  constructor(space: Space, body: Body, options: CharacterControllerOptions = {}) {
    this.space = space;
    this.body = body;

    this._maxSlopeAngle = options.maxSlopeAngle ?? Math.PI / 4;
    this._maxSlopeCos = Math.cos(this._maxSlopeAngle);
    this._stepHeight = options.stepHeight ?? 0;
    this._skinWidth = options.skinWidth ?? 0.5;
    this._snapToGround = options.snapToGround ?? 4;
    this._trackMovingPlatforms = options.trackMovingPlatforms ?? true;

    // Auto-setup raycast filter to exclude the character's own shapes.
    // Uses collision group bit 8 for the character; raycast mask excludes it.
    const CHAR_GROUP = 1 << 8;
    const ONEWAY_GROUP = 1 << 9;

    if (options.filter) {
      this._filter = options.filter;
    } else {
      // Tag character shapes so raycasts skip them
      const shapes = body.shapes;
      for (let i = 0; i < shapes.length; i++) {
        const s = shapes.at(i);
        const f = s.filter;
        f.collisionGroup = f.collisionGroup | CHAR_GROUP;
      }
      // Raycast filter: match all groups except character
      this._filter = new InteractionFilter(1, ~CHAR_GROUP);
    }

    // Auto-setup one-way platform PreListener + filter
    if (options.oneWayPlatformTag && options.characterTag) {
      const owGroup = options.oneWayGroupBit ?? ONEWAY_GROUP;
      this._oneWayGroup = owGroup;
      // Create a second filter that also excludes one-way platforms (for upward rays)
      this._filterNoOneWay = new InteractionFilter(1, ~(CHAR_GROUP | owGroup));
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

  // -----------------------------------------------------------------------
  // Configuration setters
  // -----------------------------------------------------------------------

  get maxSlopeAngle(): number {
    return this._maxSlopeAngle;
  }

  set maxSlopeAngle(v: number) {
    this._maxSlopeAngle = v;
    this._maxSlopeCos = Math.cos(v);
  }

  get stepHeight(): number {
    return this._stepHeight;
  }

  set stepHeight(v: number) {
    this._stepHeight = v;
  }

  get skinWidth(): number {
    return this._skinWidth;
  }

  set skinWidth(v: number) {
    this._skinWidth = v;
  }

  get snapToGround(): number {
    return this._snapToGround;
  }

  set snapToGround(v: number) {
    this._snapToGround = v;
  }

  // -----------------------------------------------------------------------
  // Core movement
  // -----------------------------------------------------------------------

  /**
   * Move the character by `delta` in world units, resolving collisions via
   * the collide-and-slide algorithm.
   *
   * Call this once per frame with your desired movement vector (gravity +
   * player input combined).
   */
  move(delta: Vec2): MoveResult {
    this._collisions.length = 0;
    this._wallLeft = false;
    this._wallRight = false;

    const pos = this.body.position;
    let px = pos.x;
    let py = pos.y;
    const dx = delta.x;
    const dy = delta.y;

    // --- Moving platform compensation ---
    if (this._trackMovingPlatforms && this._platformBody && this._lastPlatformPos) {
      const platPos = this._platformBody.position;
      const pdx = platPos.x - this._lastPlatformPos.x;
      const pdy = platPos.y - this._lastPlatformPos.y;
      if (pdx !== 0 || pdy !== 0) {
        px += pdx;
        py += pdy;
      }
    }

    // --- Horizontal movement (collide-and-slide) ---
    if (Math.abs(dx) > MIN_MOVE_THRESHOLD) {
      const hResult = this._slideMove(px, py, dx, 0);
      px = hResult.x;
      py = hResult.y;
    }

    // --- Step climbing ---
    // If horizontal movement was blocked and stepHeight > 0, try stepping up
    if (this._stepHeight > 0 && Math.abs(delta.x) > MIN_MOVE_THRESHOLD) {
      const lastHCollision =
        this._collisions.length > 0 ? this._collisions[this._collisions.length - 1] : null;
      if (lastHCollision && Math.abs(lastHCollision.normal.x) > 0.7) {
        const stepped = this._tryStepClimb(px, py, delta.x, this._stepHeight);
        if (stepped) {
          px = stepped.x;
          py = stepped.y;
        }
      }
    }

    // --- Vertical movement (collide-and-slide) ---
    if (Math.abs(dy) > MIN_MOVE_THRESHOLD) {
      const vResult = this._slideMove(px, py, 0, dy);
      px = vResult.x;
      py = vResult.y;
    }

    // --- Snap to ground ---
    if (this._snapToGround > 0 && this._grounded && dy >= 0) {
      const snapped = this._snapDown(px, py, this._snapToGround);
      if (snapped) {
        py = snapped.y;
      }
    }

    // --- Ground detection ---
    this._detectGround(px, py);

    // --- Update time since grounded ---
    if (this._grounded) {
      this._timeSinceGrounded = 0;
    } else {
      this._timeSinceGrounded += 1 / 60; // assumes 60fps step
    }

    // --- Track platform for next frame ---
    if (this._trackMovingPlatforms && this._groundBody) {
      if (this._groundBody.type === BodyType.KINEMATIC) {
        this._onMovingPlatform = true;
        this._platformBody = this._groundBody;
        this._lastPlatformPos = new Vec2(this._groundBody.position.x, this._groundBody.position.y);
      } else {
        this._onMovingPlatform = false;
        this._platformBody = null;
        this._lastPlatformPos = null;
      }
    } else {
      this._onMovingPlatform = false;
      this._platformBody = null;
      this._lastPlatformPos = null;
    }

    // --- Apply final position ---
    this.body.position = new Vec2(px, py);

    // --- Build result ---
    const collisions = this._collisions;
    return {
      grounded: this._grounded,
      groundNormal: this._groundNormal,
      groundBody: this._groundBody,
      onMovingPlatform: this._onMovingPlatform,
      slopeAngle: this._slopeAngle,
      wallLeft: this._wallLeft,
      wallRight: this._wallRight,
      timeSinceGrounded: this._timeSinceGrounded,
      numCollisions: collisions.length,
      getCollision(index: number) {
        return collisions[index];
      },
    };
  }

  /**
   * Remove the one-way platform PreListener and detach from space.
   * Call this when the controller is no longer needed.
   */
  destroy(): void {
    if (this._oneWayListener) {
      this._oneWayListener.space = null;
      this._oneWayListener = null;
    }
  }

  // -----------------------------------------------------------------------
  // Private: collide-and-slide
  // -----------------------------------------------------------------------

  /**
   * Slide movement with collision resolution.
   * Casts rays in the movement direction, slides along surfaces.
   */
  private _slideMove(
    startX: number,
    startY: number,
    dx: number,
    dy: number,
  ): { x: number; y: number } {
    let px = startX;
    let py = startY;
    let remX = dx;
    let remY = dy;

    const normals: { nx: number; ny: number }[] = [];

    for (let iter = 0; iter < MAX_SLIDE_ITERATIONS; iter++) {
      const mag = Math.sqrt(remX * remX + remY * remY);
      if (mag < MIN_MOVE_THRESHOLD) break;

      // Normalize direction
      const dirX = remX / mag;
      const dirY = remY / mag;

      // Cast ray from body center in movement direction.
      // When moving upward, exclude one-way platforms so the character
      // passes through them from below.
      const movingUp = dirY < -0.1;
      const filter = movingUp && this._filterNoOneWay ? this._filterNoOneWay : this._filter;

      // Determine the effective radius of the character shape in the ray direction.
      const charRadius = this._getCharacterRadius(dirX, dirY);

      // Cast ray from body center. maxDistance must account for the character
      // radius so we detect surfaces that the character edge would reach.
      const ray = new Ray(new Vec2(px, py), new Vec2(dirX, dirY));
      ray.maxDistance = mag + charRadius + this._skinWidth;

      const hit = this.space.rayCast(ray, false, filter);

      if (!hit) {
        // No collision — apply full remaining movement
        px += remX;
        py += remY;
        break;
      }

      const hitDist = hit.distance;
      const shape = hit.shape;
      const hitBody = shape?.body ?? null;

      // Safe distance: how far the center can move before the edge overlaps
      const safeDistance = hitDist - charRadius - this._skinWidth;

      if (safeDistance > mag) {
        // Hit is beyond our movement — no collision
        px += remX;
        py += remY;
        break;
      }

      if (safeDistance < 0) {
        // Already overlapping. Only push out if the surface faces us
        // (normal opposes movement). If normal aligns with movement
        // direction, we are exiting the shape — skip it entirely.
        const normalDot = hit.normal.x * dirX + hit.normal.y * dirY;
        if (normalDot < 0) {
          // Surface faces us — push out along hit normal
          const pushDist = -safeDistance;
          px += hit.normal.x * pushDist;
          py += hit.normal.y * pushDist;
        } else {
          // Moving away from surface — ignore hit, apply full movement
          px += remX;
          py += remY;
          break;
        }
      } else {
        // Advance to safe distance
        px += dirX * safeDistance;
        py += dirY * safeDistance;
      }

      // Record collision
      const nx = hit.normal.x;
      const ny = hit.normal.y;

      if (hitBody && shape) {
        this._collisions.push({
          normal: new Vec2(nx, ny),
          point: new Vec2(px + nx * charRadius, py + ny * charRadius),
          body: hitBody,
          shape,
        });
      }

      // Wall detection
      if (Math.abs(nx) > 0.7 && Math.abs(ny) < 0.3) {
        if (nx > 0) this._wallLeft = true;
        else this._wallRight = true;
      }

      // Compute remaining movement after collision
      const usedDist = Math.max(0, safeDistance);
      const leftover = mag - usedDist;
      if (leftover < MIN_MOVE_THRESHOLD) break;

      // Project remaining velocity onto the surface (remove normal component)
      let slideX = dirX * leftover;
      let slideY = dirY * leftover;
      const dot = slideX * nx + slideY * ny;
      slideX -= dot * nx;
      slideY -= dot * ny;

      // Check for corner case: if we hit two opposing normals, stop
      normals.push({ nx, ny });
      if (normals.length >= 2) {
        const prev = normals[normals.length - 2];
        const cornerDot = prev.nx * nx + prev.ny * ny;
        if (cornerDot < CORNER_DOT_THRESHOLD) {
          // Wedged between two surfaces — stop
          break;
        }
      }

      remX = slideX;
      remY = slideY;
    }

    return { x: px, y: py };
  }

  // -----------------------------------------------------------------------
  // Private: ground detection
  // -----------------------------------------------------------------------

  private _detectGround(px: number, py: number): void {
    const charRadius = this._getCharacterRadiusDown();
    const castDist = charRadius + this._skinWidth + 2; // 2px tolerance

    const ray = new Ray(new Vec2(px, py), new Vec2(0, 1));
    ray.maxDistance = castDist;

    const hit = this.space.rayCast(ray, false, this._filter);

    if (hit && hit.distance <= castDist) {
      const ny = hit.normal.y;
      // Ground normal should point upward (negative y in screen coords)
      if (ny < 0) {
        // Check slope angle — cos of angle between normal and up vector
        const cosAngle = -ny; // dot(normal, (0,-1)) = -ny
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
  // Private: step climbing
  // -----------------------------------------------------------------------

  /**
   * Attempt to step over a small obstacle.
   * Algorithm: cast up → cast forward → cast down.
   * Returns new position if step succeeded, null otherwise.
   */
  private _tryStepClimb(
    px: number,
    py: number,
    moveX: number,
    maxStepH: number,
  ): { x: number; y: number } | null {
    const dirX = moveX > 0 ? 1 : -1;
    const charRadius = this._getCharacterRadiusDown();

    // 1. Cast up — check clearance above
    const upRay = new Ray(new Vec2(px, py), new Vec2(0, -1));
    upRay.maxDistance = maxStepH + charRadius;
    const upHit = this.space.rayCast(upRay, false, this._filter);
    const upClearance = upHit
      ? Math.max(0, upHit.distance - charRadius - this._skinWidth)
      : maxStepH;
    if (upClearance < 1) return null; // Not enough headroom

    const stepUpY = py - Math.min(upClearance, maxStepH);

    // 2. Cast forward from elevated position
    const fwdDist = Math.abs(moveX) + charRadius + this._skinWidth;
    const fwdRay = new Ray(new Vec2(px, stepUpY), new Vec2(dirX, 0));
    fwdRay.maxDistance = fwdDist;
    const fwdHit = this.space.rayCast(fwdRay, false, this._filter);
    if (fwdHit && fwdHit.distance < fwdDist) return null; // Blocked above step

    const stepX = px + moveX;

    // 3. Cast down to land on top of step
    const downRay = new Ray(new Vec2(stepX, stepUpY), new Vec2(0, 1));
    downRay.maxDistance = maxStepH + charRadius + this._skinWidth;
    const downHit = this.space.rayCast(downRay, false, this._filter);
    if (!downHit) return null; // No ground to land on

    const landY = stepUpY + downHit.distance - charRadius - this._skinWidth;

    // Verify we actually stepped up (landed higher than started)
    if (landY >= py - 1) return null;

    return { x: stepX, y: landY };
  }

  // -----------------------------------------------------------------------
  // Private: snap to ground
  // -----------------------------------------------------------------------

  private _snapDown(px: number, py: number, maxDist: number): { y: number } | null {
    const charRadius = this._getCharacterRadiusDown();
    const castDist = charRadius + maxDist + this._skinWidth;

    const ray = new Ray(new Vec2(px, py), new Vec2(0, 1));
    ray.maxDistance = castDist;

    const hit = this.space.rayCast(ray, false, this._filter);
    if (!hit) return null;

    const ny = hit.normal.y;
    if (ny >= 0) return null; // Not a floor

    const cosAngle = -ny;
    if (cosAngle < this._maxSlopeCos) return null; // Too steep

    const snapY = py + hit.distance - charRadius - this._skinWidth;
    // Only snap if we'd move downward (not upward)
    if (snapY <= py) return null;

    return { y: snapY };
  }

  // -----------------------------------------------------------------------
  // Private: one-way platforms
  // -----------------------------------------------------------------------

  private _setupOneWayPlatforms(platformTag: CbType, characterTag: CbType): void {
    const body = this.body;
    const listener = new PreListener(InteractionType.COLLISION, platformTag, characterTag, (cb) => {
      try {
        const colArb = cb.arbiter.collisionArbiter;
        if (!colArb) return PreFlag.ACCEPT;

        // Determine normal direction relative to the character body
        const normal = colArb.normal;
        let ny = normal.y;
        // Flip normal if character is body2
        if (colArb.body2 === body) ny = -ny;

        // Accept only if surface normal points up (character is above platform)
        return ny < -0.3 ? PreFlag.ACCEPT : PreFlag.IGNORE;
      } catch {
        return PreFlag.ACCEPT;
      }
    });
    listener.space = this.space;
    this._oneWayListener = listener;
  }

  // -----------------------------------------------------------------------
  // Private: shape helpers
  // -----------------------------------------------------------------------

  /**
   * Get the approximate radius of the character's first shape in a given direction.
   * For circles this is exact; for capsules we account for spine + radius;
   * for others we use AABB half-extents.
   */
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
        // Capsule is oriented by body.rotation — project spine onto direction
        const rot = this.body.rotation;
        const sx = Math.cos(rot);
        const sy = Math.sin(rot);
        // Half-extent along direction = spine projection + radius
        const spineDot = Math.abs(dirX * sx + dirY * sy) * hl;
        return spineDot + r;
      }
    }
    // Fallback: AABB half-extents
    const b = shape.bounds;
    const hw = b.width / 2;
    const hh = b.height / 2;
    return Math.abs(dirX) * hw + Math.abs(dirY) * hh;
  }

  /** Shorthand for downward radius (used for ground detection). */
  private _getCharacterRadiusDown(): number {
    return this._getCharacterRadius(0, 1);
  }
}
