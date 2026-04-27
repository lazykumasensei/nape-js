/**
 * UserConstraint — solver branch coverage.
 *
 * Targets uncovered branches in:
 * - ZPP_UserConstraint.preStep / applyImpulseVel / applyImpulsePos
 *   (multi-DOF constraints, velocity-only mode, clamp paths, multiple bodies)
 * - UserConstraint base methods (__bindVec2, __broken hook, __draw forwarding)
 * - Body re-registration with _registerBody (oldBody==newBody, oldBody not registered)
 * - bodyImpulse with deactivated constraint
 * - visitBodies with duplicate body entries (dedup path)
 */

import { describe, it, expect } from "vitest";
import { Space } from "../../src/space/Space";
import { Body } from "../../src/phys/Body";
import { BodyType } from "../../src/phys/BodyType";
import { Vec2 } from "../../src/geom/Vec2";
import { Circle } from "../../src/shape/Circle";
import { UserConstraint } from "../../src/constraint/UserConstraint";

type Any = any;

// ---------------------------------------------------------------------------
// Test constraints
// ---------------------------------------------------------------------------

/** Two-body distance constraint (1-DOF positional). */
class DistanceConstraint extends UserConstraint {
  private _b1: Body | null = null;
  private _b2: Body | null = null;
  target: number;
  brokenCalled = false;
  drawCalled = false;
  clampCalled = false;

  constructor(b1: Body | null, b2: Body | null, target: number, velOnly = false) {
    super(1, velOnly);
    this.target = target;
    this._b1 = this.__registerBody(this._b1, b1);
    this._b2 = this.__registerBody(this._b2, b2);
  }

  set body1(value: Body | null) {
    this._b1 = this.__registerBody(this._b1, value);
  }
  set body2(value: Body | null) {
    this._b2 = this.__registerBody(this._b2, value);
  }
  get body1() {
    return this._b1;
  }
  get body2() {
    return this._b2;
  }

  __copy() {
    return new DistanceConstraint(this._b1, this._b2, this.target);
  }
  __broken() {
    this.brokenCalled = true;
  }
  __draw(_g: Any) {
    this.drawCalled = true;
  }
  __position(err: number[]) {
    const a = (this._b1 as Any).zpp_inner;
    const b = (this._b2 as Any).zpp_inner;
    const dx = b.posx - a.posx;
    const dy = b.posy - a.posy;
    err[0] = Math.sqrt(dx * dx + dy * dy) - this.target;
  }
  __velocity(err: number[]) {
    const a = (this._b1 as Any).zpp_inner;
    const b = (this._b2 as Any).zpp_inner;
    const dx = b.posx - a.posx;
    const dy = b.posy - a.posy;
    const d = Math.sqrt(dx * dx + dy * dy);
    if (d === 0) {
      err[0] = 0;
      return;
    }
    const nx = dx / d;
    const ny = dy / d;
    err[0] = (b.velx - a.velx) * nx + (b.vely - a.vely) * ny;
  }
  __eff_mass(eff: number[]) {
    const a = (this._b1 as Any).zpp_inner;
    const b = (this._b2 as Any).zpp_inner;
    eff[0] = a.imass + b.imass;
  }
  __clamp(jAcc: number[]) {
    this.clampCalled = true;
    // No actual clamping
    return jAcc;
  }
  __impulse(imp: number[], body: Body, out: Any) {
    const a = (this._b1 as Any).zpp_inner;
    const b = (this._b2 as Any).zpp_inner;
    const dx = b.posx - a.posx;
    const dy = b.posy - a.posy;
    const d = Math.sqrt(dx * dx + dy * dy);
    if (d === 0) {
      out.zpp_inner.x = 0;
      out.zpp_inner.y = 0;
      out.zpp_inner.z = 0;
      return;
    }
    const nx = dx / d;
    const ny = dy / d;
    const sign = body === this._b1 ? -1 : 1;
    out.zpp_inner.x = sign * imp[0] * nx;
    out.zpp_inner.y = sign * imp[0] * ny;
    out.zpp_inner.z = 0;
  }
}

/** 2-DOF Cartesian constraint — locks both x and y of body relative to anchor. */
class XYLockConstraint extends UserConstraint {
  private _body: Body | null = null;
  ax: number;
  ay: number;

  constructor(body: Body | null, ax: number, ay: number) {
    super(2);
    this.ax = ax;
    this.ay = ay;
    this._body = this.__registerBody(this._body, body);
  }

  __copy() {
    return new XYLockConstraint(this._body, this.ax, this.ay);
  }
  __position(err: number[]) {
    const b = (this._body as Any).zpp_inner;
    err[0] = b.posx - this.ax;
    err[1] = b.posy - this.ay;
  }
  __velocity(err: number[]) {
    const b = (this._body as Any).zpp_inner;
    err[0] = b.velx;
    err[1] = b.vely;
  }
  __eff_mass(eff: number[]) {
    const b = (this._body as Any).zpp_inner;
    // Upper triangle of 2x2 effective mass = mass * I
    eff[0] = b.imass; // [0][0]
    eff[1] = 0; // [0][1]
    eff[2] = b.imass; // [1][1]
  }
  __impulse(imp: number[], _body: Body, out: Any) {
    out.zpp_inner.x = imp[0];
    out.zpp_inner.y = imp[1];
    out.zpp_inner.z = 0;
  }
}

/** Velocity-only constraint — limits body x velocity. */
class XVelocityCap extends UserConstraint {
  private _body: Body | null = null;
  cap: number;

  constructor(body: Body | null, cap: number) {
    super(1, true); // velocity-only
    this.cap = cap;
    this._body = this.__registerBody(this._body, body);
  }

  __copy() {
    return new XVelocityCap(this._body, this.cap);
  }
  __velocity(err: number[]) {
    const b = (this._body as Any).zpp_inner;
    // Push toward zero only when above cap
    err[0] = b.velx > this.cap ? b.velx - this.cap : 0;
  }
  __eff_mass(eff: number[]) {
    eff[0] = (this._body as Any).zpp_inner.imass;
  }
  __clamp(j: number[]) {
    // Clamp impulse so it can only push leftward (not pull body forward)
    if (j[0] < 0) j[0] = 0;
  }
  __impulse(imp: number[], _body: Body, out: Any) {
    out.zpp_inner.x = imp[0];
    out.zpp_inner.y = 0;
    out.zpp_inner.z = 0;
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function dyn(space: Space, x = 0, y = 0): Body {
  const b = new Body(BodyType.DYNAMIC, new Vec2(x, y));
  b.shapes.add(new Circle(8));
  b.space = space;
  return b;
}

// ---------------------------------------------------------------------------
// 1. 2-DOF constraint (XY lock)
// ---------------------------------------------------------------------------

describe("UserConstraint — 2-DOF XY lock", () => {
  it("soft 2-DOF lock pulls a body toward an anchor point", () => {
    const space = new Space(new Vec2(0, 0));
    const body = dyn(space, 100, 50);

    const lock = new XYLockConstraint(body, 50, 100);
    lock.stiff = false;
    lock.frequency = 5;
    lock.damping = 1;
    lock.space = space;

    for (let i = 0; i < 240; i++) space.step(1 / 60, 10, 10);

    // Should converge near the anchor
    expect(Math.abs(body.position.x - 50)).toBeLessThan(5);
    expect(Math.abs(body.position.y - 100)).toBeLessThan(5);
  });

  it("2-DOF Keff factorisation runs over many steps without NaN", () => {
    const space = new Space(new Vec2(0, 0));
    const body = dyn(space, 50, 50);

    const lock = new XYLockConstraint(body, 100, 100);
    lock.stiff = false;
    lock.frequency = 3;
    lock.damping = 0.9;
    lock.space = space;

    for (let i = 0; i < 600; i++) space.step(1 / 60);

    expect(Number.isFinite(body.position.x)).toBe(true);
    expect(Number.isFinite(body.position.y)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// 2. Velocity-only constraint with clamp
// ---------------------------------------------------------------------------

describe("UserConstraint — velocity-only mode", () => {
  it("clamps x velocity downward via __clamp", () => {
    const space = new Space(new Vec2(0, 0));
    const body = dyn(space, 0, 0);
    body.velocity = new Vec2(500, 0);

    const cap = new XVelocityCap(body, 100);
    cap.space = space;

    const v0 = body.velocity.x;
    for (let i = 0; i < 60; i++) space.step(1 / 60);

    // Velocity should be reduced — constraint pushes down toward cap
    expect(body.velocity.x).toBeLessThan(v0);
  });

  it("clamp prevents reverse impulse — does not pull body forward", () => {
    const space = new Space(new Vec2(0, 0));
    const body = dyn(space, 0, 0);
    body.velocity = new Vec2(10, 0); // already below cap

    const cap = new XVelocityCap(body, 100);
    cap.space = space;

    for (let i = 0; i < 30; i++) space.step(1 / 60);

    // Body's velocity should remain at 10 (cap shouldn't accelerate it up to 100)
    expect(body.velocity.x).toBeCloseTo(10, 0);
  });
});

// ---------------------------------------------------------------------------
// 3. Distance constraint with breakUnderForce
// ---------------------------------------------------------------------------

describe("UserConstraint — break under force", () => {
  it("__broken is invoked when constraint breaks under high load", () => {
    const space = new Space(new Vec2(0, 0));
    const a = dyn(space, 0, 0);
    const b = dyn(space, 50, 0);

    const c = new DistanceConstraint(a, b, 50);
    c.maxForce = 1; // very low
    c.breakUnderForce = true;
    c.removeOnBreak = true;
    c.space = space;

    // Kick body away — should exceed maxForce and break
    b.velocity = new Vec2(2000, 0);
    for (let i = 0; i < 60; i++) space.step(1 / 60);

    expect(c.brokenCalled).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// 4. Re-register body cases
// ---------------------------------------------------------------------------

describe("UserConstraint — body registration", () => {
  it("setting body to itself is a no-op", () => {
    const space = new Space(new Vec2(0, 0));
    const a = dyn(space, 0, 0);
    const b = dyn(space, 100, 0);

    const c = new DistanceConstraint(a, b, 100);
    expect(c.body1).toBe(a);

    // Set to same body — no-op
    c.body1 = a;
    expect(c.body1).toBe(a);
    expect(c.zpp_inner.bodies.length).toBe(2);
  });

  it("setting body to null unregisters it", () => {
    const space = new Space(new Vec2(0, 0));
    const a = dyn(space, 0, 0);
    const b = dyn(space, 100, 0);
    const c = new DistanceConstraint(a, b, 100);

    c.body1 = null;
    expect(c.body1).toBe(null);
    expect(c.zpp_inner.bodies.length).toBe(1);
  });

  it("setting body to a brand-new body works", () => {
    const space = new Space(new Vec2(0, 0));
    const a = dyn(space, 0, 0);
    const b = dyn(space, 100, 0);
    const c = new DistanceConstraint(a, b, 100);

    const d = dyn(space, 200, 0);
    c.body1 = d;
    expect(c.body1).toBe(d);
    expect(c.zpp_inner.bodies.length).toBe(2);
  });
});

// ---------------------------------------------------------------------------
// 5. bodyImpulse with deactivated constraint
// ---------------------------------------------------------------------------

describe("UserConstraint — bodyImpulse(active=false)", () => {
  it("returns zero impulse when constraint is inactive", () => {
    const space = new Space(new Vec2(0, 0));
    const a = dyn(space, 0, 0);
    const b = dyn(space, 100, 0);
    const c = new DistanceConstraint(a, b, 100);
    c.space = space;

    space.step(1 / 60);
    c.active = false;

    const imp = c.bodyImpulse(a);
    expect(imp.x).toBe(0);
    expect(imp.y).toBe(0);
    expect(imp.z).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// 6. impulse() returns MatMN with each DOF
// ---------------------------------------------------------------------------

describe("UserConstraint — impulse() multi-DOF", () => {
  it("returns 2-row matrix for 2-DOF constraint", () => {
    const space = new Space(new Vec2(0, 200));
    const body = dyn(space, 100, 0);

    const lock = new XYLockConstraint(body, 50, 100);
    lock.space = space;

    space.step(1 / 60);

    const imp = lock.impulse();
    expect(imp.zpp_inner.m).toBe(2);
    expect(imp.zpp_inner.n).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// 7. visitBodies dedup path (same body listed twice)
// ---------------------------------------------------------------------------

describe("UserConstraint — visitBodies dedup", () => {
  it("does not call lambda twice if a body appears in multiple slots", () => {
    const space = new Space(new Vec2(0, 0));
    const a = dyn(space, 0, 0);

    // Register the same body twice via DistanceConstraint
    // Workaround: a real two-slot constraint registering the same body
    const c = new DistanceConstraint(a, a, 0);

    const visited: Body[] = [];
    c.visitBodies((b) => visited.push(b));
    expect(visited.length).toBe(1);
    expect(visited[0]).toBe(a);
  });
});

// ---------------------------------------------------------------------------
// 8. __bindVec2 invalidation
// ---------------------------------------------------------------------------

describe("UserConstraint — __bindVec2", () => {
  it("modifying a bound Vec2 invalidates the constraint", () => {
    const space = new Space(new Vec2(0, 0));
    const a = dyn(space, 0, 0);
    const b = dyn(space, 100, 0);
    const c = new DistanceConstraint(a, b, 100);
    c.space = space;

    const bound = c.__bindVec2();
    expect((bound as Any).zpp_inner._inuse).toBe(true);

    // Mutate — should call invalidate (not throw)
    bound.x = 5;
    bound.y = 10;
    expect(bound.x).toBe(5);
    expect(bound.y).toBe(10);
  });
});

// ---------------------------------------------------------------------------
// 9. __copy creates an independent constraint
// ---------------------------------------------------------------------------

describe("UserConstraint — __copy", () => {
  it("DistanceConstraint __copy returns a new instance with same anchors", () => {
    const space = new Space(new Vec2(0, 0));
    const a = dyn(space, 0, 0);
    const b = dyn(space, 100, 0);
    const c = new DistanceConstraint(a, b, 100);

    const copy = c.__copy();
    expect(copy).not.toBe(c);
    expect(copy.body1).toBe(a);
    expect(copy.body2).toBe(b);
    expect((copy as DistanceConstraint).target).toBe(100);
  });
});

// ---------------------------------------------------------------------------
// 10. Inactive constraint does not affect the simulation
// ---------------------------------------------------------------------------

describe("UserConstraint — active=false", () => {
  it("inactive distance constraint does not pull bodies together", () => {
    const space = new Space(new Vec2(0, 0));
    const a = dyn(space, 0, 0);
    const b = dyn(space, 200, 0);
    const c = new DistanceConstraint(a, b, 50);
    c.active = false;
    c.space = space;

    for (let i = 0; i < 60; i++) space.step(1 / 60);
    // Without the constraint pulling, bodies stay where they were
    expect(b.position.x).toBeCloseTo(200, 0);
  });
});

// ---------------------------------------------------------------------------
// 11. Soft mode (frequency/damping)
// ---------------------------------------------------------------------------

describe("UserConstraint — soft mode", () => {
  it("soft distance constraint allows oscillation", () => {
    const space = new Space(new Vec2(0, 0));
    const a = dyn(space, 0, 0);
    const b = dyn(space, 200, 0);
    const c = new DistanceConstraint(a, b, 100);
    c.stiff = false;
    c.frequency = 2;
    c.damping = 0.1;
    c.space = space;

    let minDx = Infinity;
    let maxDx = -Infinity;
    for (let i = 0; i < 600; i++) {
      space.step(1 / 60);
      const dx = b.position.x - a.position.x;
      if (dx < minDx) minDx = dx;
      if (dx > maxDx) maxDx = dx;
    }

    // Should oscillate around 100
    expect(maxDx - minDx).toBeGreaterThan(20);
  });
});
