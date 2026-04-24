/**
 * Snapshot of per-step physics metrics collected when `Space.profilerEnabled` is true.
 *
 * All timing values are in **milliseconds**. Counter values are plain integers.
 * The object is reused across steps (no allocation per frame).
 */
export interface PhysicsMetricsData {
  // --- Phase timings (ms) ---

  /** Total wall-clock time of the last `step()` call. */
  totalStepTime: number;
  /** Time spent in broadphase collision pair detection. */
  broadphaseTime: number;
  /** Time spent in narrowphase (prestep: contact generation, arbiter setup). */
  narrowphaseTime: number;
  /** Time spent in velocity integration + warm-start + velocity solver iterations. */
  velocitySolverTime: number;
  /** Time spent in position integration + position solver iterations. */
  positionSolverTime: number;
  /** Time spent in continuous collision detection (CCD). */
  ccdTime: number;
  /** Time spent in sleep management and island/forest processing. */
  sleepTime: number;

  // --- Entity counters ---

  /** Total number of bodies in the space. */
  bodyCount: number;
  /** Number of dynamic (awake) bodies. */
  dynamicBodyCount: number;
  /** Number of static bodies. */
  staticBodyCount: number;
  /** Number of kinematic bodies. */
  kinematicBodyCount: number;
  /** Number of sleeping bodies. */
  sleepingBodyCount: number;
  /** Number of active collision arbiters. */
  contactCount: number;
  /** Number of active constraints. */
  constraintCount: number;
  /** Number of broadphase pairs tested. */
  broadphasePairCount: number;
}

/**
 * Mutable metrics container — reused each step to avoid GC pressure.
 * @internal
 */
export class PhysicsMetrics implements PhysicsMetricsData {
  totalStepTime = 0;
  broadphaseTime = 0;
  narrowphaseTime = 0;
  velocitySolverTime = 0;
  positionSolverTime = 0;
  ccdTime = 0;
  sleepTime = 0;

  bodyCount = 0;
  dynamicBodyCount = 0;
  staticBodyCount = 0;
  kinematicBodyCount = 0;
  sleepingBodyCount = 0;
  contactCount = 0;
  constraintCount = 0;
  broadphasePairCount = 0;

  /** Reset all values to zero (called at the start of each profiled step). */
  reset(): void {
    this.totalStepTime = 0;
    this.broadphaseTime = 0;
    this.narrowphaseTime = 0;
    this.velocitySolverTime = 0;
    this.positionSolverTime = 0;
    this.ccdTime = 0;
    this.sleepTime = 0;
    this.bodyCount = 0;
    this.dynamicBodyCount = 0;
    this.staticBodyCount = 0;
    this.kinematicBodyCount = 0;
    this.sleepingBodyCount = 0;
    this.contactCount = 0;
    this.constraintCount = 0;
    this.broadphasePairCount = 0;
  }

  /** Return a plain-object snapshot (useful for logging / JSON export). */
  toJSON(): PhysicsMetricsData {
    return {
      totalStepTime: this.totalStepTime,
      broadphaseTime: this.broadphaseTime,
      narrowphaseTime: this.narrowphaseTime,
      velocitySolverTime: this.velocitySolverTime,
      positionSolverTime: this.positionSolverTime,
      ccdTime: this.ccdTime,
      sleepTime: this.sleepTime,
      bodyCount: this.bodyCount,
      dynamicBodyCount: this.dynamicBodyCount,
      staticBodyCount: this.staticBodyCount,
      kinematicBodyCount: this.kinematicBodyCount,
      sleepingBodyCount: this.sleepingBodyCount,
      contactCount: this.contactCount,
      constraintCount: this.constraintCount,
      broadphasePairCount: this.broadphasePairCount,
    };
  }
}
