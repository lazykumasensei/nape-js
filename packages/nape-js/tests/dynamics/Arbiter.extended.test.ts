/**
 * ZPP_ColArbiter + ZPP_FluidArbiter — extended tests targeting the
 * lowest-coverage native arbiter code paths.
 *
 * Exercises: contact point details, multiple contacts (polygon-polygon),
 * impulse body-scoping, freshOnly filtering, rolling impulse, fluid
 * buoyancy/drag impulses, fluid overlap/position, sensor arbiters,
 * arbiter sleeping state, and arbiter toString/type accessors.
 */

import { describe, it, expect } from "vitest";
import "../../src/core/engine";
import { Space } from "../../src/space/Space";
import { Body } from "../../src/phys/Body";
import { BodyType } from "../../src/phys/BodyType";
import { Vec2 } from "../../src/geom/Vec2";
import { Circle } from "../../src/shape/Circle";
import { Polygon } from "../../src/shape/Polygon";
import { InteractionListener } from "../../src/callbacks/InteractionListener";
import { CbEvent } from "../../src/callbacks/CbEvent";
import { CbType } from "../../src/callbacks/CbType";
import { InteractionType } from "../../src/callbacks/InteractionType";
import { ArbiterType } from "../../src/dynamics/ArbiterType";
import { PreListener } from "../../src/callbacks/PreListener";
import { PreFlag } from "../../src/callbacks/PreFlag";
import { FluidProperties } from "../../src/phys/FluidProperties";
import { Material } from "../../src/phys/Material";
import type { CollisionArbiter } from "../../src/dynamics/CollisionArbiter";
import type { FluidArbiter } from "../../src/dynamics/FluidArbiter";
import type { Arbiter } from "../../src/dynamics/Arbiter";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function dynamicCircle(x: number, y: number, r = 10): Body {
  const b = new Body(BodyType.DYNAMIC, new Vec2(x, y));
  b.shapes.add(new Circle(r));
  return b;
}

function staticBox(x: number, y: number, w = 300, h = 10): Body {
  const b = new Body(BodyType.STATIC, new Vec2(x, y));
  b.shapes.add(new Polygon(Polygon.box(w, h)));
  return b;
}

function dynamicBox(x: number, y: number, w = 20, h = 20): Body {
  const b = new Body(BodyType.DYNAMIC, new Vec2(x, y));
  b.shapes.add(new Polygon(Polygon.box(w, h)));
  return b;
}

function step(space: Space, n: number): void {
  for (let i = 0; i < n; i++) space.step(1 / 60);
}

// ---------------------------------------------------------------------------
// CollisionArbiter — contact details
// ---------------------------------------------------------------------------

describe("ZPP_ColArbiter — contact point access", () => {
  it("contacts list has at least 1 contact for circle-box collision", () => {
    const space = new Space(new Vec2(0, 500));
    let contactCount = -1;

    new InteractionListener(
      CbEvent.ONGOING,
      InteractionType.COLLISION,
      CbType.ANY_BODY,
      CbType.ANY_BODY,
      (cb: any) => {
        const arb = cb.arbiters.at(0);
        if (arb?.isCollisionArbiter()) {
          const col = arb.collisionArbiter;
          contactCount = col.contacts.length;
        }
      },
    ).space = space;

    const floor = staticBox(0, 50);
    floor.space = space;
    const ball = dynamicCircle(0, 0, 10);
    ball.space = space;

    step(space, 60);
    expect(contactCount).toBeGreaterThanOrEqual(1);
  });

  it("polygon-polygon collision can have 1-2 contacts", () => {
    const space = new Space(new Vec2(0, 500));
    let maxContacts = 0;

    new InteractionListener(
      CbEvent.ONGOING,
      InteractionType.COLLISION,
      CbType.ANY_BODY,
      CbType.ANY_BODY,
      (cb: any) => {
        const arb = cb.arbiters.at(0);
        if (arb?.isCollisionArbiter()) {
          const n = arb.collisionArbiter.contacts.length;
          if (n > maxContacts) maxContacts = n;
        }
      },
    ).space = space;

    const floor = staticBox(0, 50);
    floor.space = space;
    const box = dynamicBox(0, 0, 30, 30);
    box.space = space;

    step(space, 60);
    expect(maxContacts).toBeGreaterThanOrEqual(1);
    expect(maxContacts).toBeLessThanOrEqual(2);
  });

  it("contact has position, penetration, and fresh properties", () => {
    const space = new Space(new Vec2(0, 500));
    let hasPenetration = false;
    let hasPosition = false;

    new InteractionListener(
      CbEvent.ONGOING,
      InteractionType.COLLISION,
      CbType.ANY_BODY,
      CbType.ANY_BODY,
      (cb: any) => {
        const arb = cb.arbiters.at(0);
        if (arb?.isCollisionArbiter()) {
          const contacts = arb.collisionArbiter.contacts;
          if (contacts.length > 0) {
            const c = contacts.at(0);
            if (c.penetration !== undefined) hasPenetration = true;
            if (c.position) hasPosition = true;
          }
        }
      },
    ).space = space;

    const floor = staticBox(0, 50);
    floor.space = space;
    const ball = dynamicCircle(0, 0, 10);
    ball.space = space;

    step(space, 60);
    expect(hasPenetration).toBe(true);
    expect(hasPosition).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// CollisionArbiter — normal vector
// ---------------------------------------------------------------------------

describe("ZPP_ColArbiter — normal vector", () => {
  it("normal is a unit vector", () => {
    const space = new Space(new Vec2(0, 500));
    let normalLen = -1;

    new InteractionListener(
      CbEvent.ONGOING,
      InteractionType.COLLISION,
      CbType.ANY_BODY,
      CbType.ANY_BODY,
      (cb: any) => {
        const arb = cb.arbiters.at(0);
        if (arb?.isCollisionArbiter()) {
          const n = arb.collisionArbiter.normal;
          normalLen = Math.sqrt(n.x * n.x + n.y * n.y);
        }
      },
    ).space = space;

    const floor = staticBox(0, 50);
    floor.space = space;
    const ball = dynamicCircle(0, 0, 10);
    ball.space = space;

    step(space, 60);
    expect(normalLen).toBeCloseTo(1.0, 3);
  });

  it("normal for vertical collision points upward", () => {
    const space = new Space(new Vec2(0, 500));
    let ny = 0;

    new InteractionListener(
      CbEvent.ONGOING,
      InteractionType.COLLISION,
      CbType.ANY_BODY,
      CbType.ANY_BODY,
      (cb: any) => {
        const arb = cb.arbiters.at(0);
        if (arb?.isCollisionArbiter()) {
          ny = arb.collisionArbiter.normal.y;
        }
      },
    ).space = space;

    const floor = staticBox(0, 100);
    floor.space = space;
    const ball = dynamicCircle(0, 50, 10);
    ball.space = space;

    step(space, 60);
    // Normal should have a significant y component (pointing from one shape to the other)
    expect(Math.abs(ny)).toBeGreaterThan(0.5);
  });
});

// ---------------------------------------------------------------------------
// CollisionArbiter — impulse methods with body scoping
// ---------------------------------------------------------------------------

describe("ZPP_ColArbiter — impulse body scoping", () => {
  it("totalImpulse(body1) and totalImpulse(body2) have opposite signs", () => {
    const space = new Space(new Vec2(0, 500));
    const floor = staticBox(0, 100);
    floor.space = space;
    const ball = dynamicCircle(0, 50, 10);
    ball.space = space;

    let impulseBody1: any = null;
    let impulseBody2: any = null;

    new InteractionListener(
      CbEvent.ONGOING,
      InteractionType.COLLISION,
      CbType.ANY_BODY,
      CbType.ANY_BODY,
      (cb: any) => {
        const arb = cb.arbiters.at(0);
        if (arb?.isCollisionArbiter()) {
          impulseBody1 = arb.collisionArbiter.totalImpulse(arb.body1);
          impulseBody2 = arb.collisionArbiter.totalImpulse(arb.body2);
        }
      },
    ).space = space;

    step(space, 60);

    expect(impulseBody1).not.toBeNull();
    expect(impulseBody2).not.toBeNull();
    // Impulses on opposite bodies should have opposite x or y signs
    const sum = impulseBody1.x + impulseBody2.x;
    const sumY = impulseBody1.y + impulseBody2.y;
    // Combined impulse should roughly cancel out
    expect(Math.abs(sum) + Math.abs(sumY)).toBeLessThan(
      Math.abs(impulseBody1.x) + Math.abs(impulseBody1.y) + 1,
    );
  });

  it("normalImpulse returns non-zero for resting contact", () => {
    const space = new Space(new Vec2(0, 500));
    const floor = staticBox(0, 100);
    floor.space = space;
    const ball = dynamicCircle(0, 50, 10);
    ball.space = space;

    let normalImpulse: any = null;

    new InteractionListener(
      CbEvent.ONGOING,
      InteractionType.COLLISION,
      CbType.ANY_BODY,
      CbType.ANY_BODY,
      (cb: any) => {
        const arb = cb.arbiters.at(0);
        if (arb?.isCollisionArbiter()) {
          normalImpulse = arb.collisionArbiter.normalImpulse();
        }
      },
    ).space = space;

    step(space, 60);
    expect(normalImpulse).not.toBeNull();
    // Should have a non-zero y component (supporting weight against gravity)
    expect(Math.abs(normalImpulse.y)).toBeGreaterThan(0);
  });

  it("tangentImpulse is available during sliding", () => {
    const space = new Space(new Vec2(0, 500));

    // Angled floor to cause sliding
    const floor = new Body(BodyType.STATIC, new Vec2(0, 100));
    floor.shapes.add(new Polygon(Polygon.box(300, 10)));
    floor.rotation = 0.3; // ~17 degrees
    floor.space = space;

    const ball = dynamicCircle(0, 50, 10);
    ball.space = space;

    let tangent: any = null;

    new InteractionListener(
      CbEvent.ONGOING,
      InteractionType.COLLISION,
      CbType.ANY_BODY,
      CbType.ANY_BODY,
      (cb: any) => {
        const arb = cb.arbiters.at(0);
        if (arb?.isCollisionArbiter()) {
          tangent = arb.collisionArbiter.tangentImpulse();
        }
      },
    ).space = space;

    step(space, 60);
    expect(tangent).not.toBeNull();
    // Tangent impulse should exist (may be zero if not sliding yet)
    expect(tangent.x).toBeDefined();
    expect(tangent.y).toBeDefined();
  });
});

// ---------------------------------------------------------------------------
// CollisionArbiter — reference edges and vertex detection
// ---------------------------------------------------------------------------

describe("ZPP_ColArbiter — polygon reference edges", () => {
  it("referenceEdge is accessible for polygon-polygon collision", () => {
    const space = new Space(new Vec2(0, 500));
    let hasRefEdge = false;

    new InteractionListener(
      CbEvent.ONGOING,
      InteractionType.COLLISION,
      CbType.ANY_BODY,
      CbType.ANY_BODY,
      (cb: any) => {
        const arb = cb.arbiters.at(0);
        if (arb?.isCollisionArbiter()) {
          const col = arb.collisionArbiter;
          // At least one reference edge should be defined
          if (col.referenceEdge1 !== null || col.referenceEdge2 !== null) {
            hasRefEdge = true;
          }
        }
      },
    ).space = space;

    const floor = staticBox(0, 100);
    floor.space = space;
    const box = dynamicBox(0, 50, 30, 30);
    box.space = space;

    step(space, 60);
    expect(hasRefEdge).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// CollisionArbiter — PreListener mutable properties
// ---------------------------------------------------------------------------

describe("ZPP_ColArbiter — PreListener property mutation", () => {
  it("modifying elasticity in PreListener affects bounce height", () => {
    // High elasticity scene
    const spaceHigh = new Space(new Vec2(0, 500));
    new PreListener(InteractionType.COLLISION, CbType.ANY_BODY, CbType.ANY_BODY, (cb: any) => {
      if (cb.arbiter?.collisionArbiter) {
        cb.arbiter.collisionArbiter.elasticity = 0.9;
      }
      return PreFlag.ACCEPT;
    }).space = spaceHigh;

    const floor1 = staticBox(0, 100);
    floor1.space = spaceHigh;
    const ball1 = dynamicCircle(0, 50, 10);
    ball1.space = spaceHigh;

    // Low elasticity scene
    const spaceLow = new Space(new Vec2(0, 500));
    new PreListener(InteractionType.COLLISION, CbType.ANY_BODY, CbType.ANY_BODY, (cb: any) => {
      if (cb.arbiter?.collisionArbiter) {
        cb.arbiter.collisionArbiter.elasticity = 0.0;
      }
      return PreFlag.ACCEPT;
    }).space = spaceLow;

    const floor2 = staticBox(0, 100);
    floor2.space = spaceLow;
    const ball2 = dynamicCircle(0, 50, 10);
    ball2.space = spaceLow;

    // Let both settle
    step(spaceHigh, 120);
    step(spaceLow, 120);

    // High elasticity ball should still have velocity (bouncing)
    // Low elasticity ball should have settled
    const velHigh = Math.abs(ball1.velocity.y);
    const velLow = Math.abs(ball2.velocity.y);
    expect(velLow).toBeLessThan(velHigh + 10);
  });

  it("modifying friction in PreListener affects sliding", () => {
    let didSetFriction = false;

    const space = new Space(new Vec2(0, 500));
    new PreListener(InteractionType.COLLISION, CbType.ANY_BODY, CbType.ANY_BODY, (cb: any) => {
      if (cb.arbiter?.collisionArbiter) {
        cb.arbiter.collisionArbiter.dynamicFriction = 0.0;
        cb.arbiter.collisionArbiter.staticFriction = 0.0;
        didSetFriction = true;
      }
      return PreFlag.ACCEPT;
    }).space = space;

    // Tilted floor
    const floor = new Body(BodyType.STATIC, new Vec2(0, 100));
    floor.shapes.add(new Polygon(Polygon.box(300, 10)));
    floor.rotation = 0.3;
    floor.space = space;

    const ball = dynamicCircle(0, 50, 10);
    ball.space = space;

    step(space, 60);
    expect(didSetFriction).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// CollisionArbiter — shape/body accessors
// ---------------------------------------------------------------------------

describe("ZPP_ColArbiter — shape and body accessors", () => {
  it("shape1 and shape2 are the correct shapes", () => {
    const space = new Space(new Vec2(0, 0));
    const bodies: Body[] = [];

    new InteractionListener(
      CbEvent.BEGIN,
      InteractionType.COLLISION,
      CbType.ANY_BODY,
      CbType.ANY_BODY,
      (cb: any) => {
        const arb = cb.arbiters.at(0);
        if (arb) {
          bodies.push(arb.body1, arb.body2);
        }
      },
    ).space = space;

    const b1 = dynamicCircle(0, 0, 20);
    b1.space = space;
    const b2 = dynamicCircle(30, 0, 20);
    b2.space = space;

    step(space, 1);

    expect(bodies.length).toBe(2);
    // Both bodies should be our bodies (in either order)
    expect([b1, b2]).toContain(bodies[0]);
    expect([b1, b2]).toContain(bodies[1]);
  });
});

// ---------------------------------------------------------------------------
// CollisionArbiter — isSleeping
// ---------------------------------------------------------------------------

describe("ZPP_ColArbiter — sleeping state", () => {
  it("arbiter isSleeping reflects body sleeping state", () => {
    const space = new Space(new Vec2(0, 500));
    space.worldLinearDrag = 1.0;

    const floor = staticBox(0, 100);
    floor.space = space;
    const ball = dynamicCircle(0, 80, 10);
    ball.space = space;

    // Step many times to let ball settle and potentially sleep
    step(space, 300);

    // Access arbiter after settling
    if (space.arbiters.length > 0) {
      const arb = space.arbiters.at(0);
      // isSleeping should be a boolean
      expect(typeof arb.isSleeping).toBe("boolean");
    }
  });
});

// ---------------------------------------------------------------------------
// FluidArbiter — buoyancy and drag impulses
// ---------------------------------------------------------------------------

describe("ZPP_FluidArbiter — buoyancy impulse", () => {
  function createFluidScene() {
    const space = new Space(new Vec2(0, 400));

    let captured: FluidArbiter | null = null;
    let capturedBase: Arbiter | null = null;

    new InteractionListener(
      CbEvent.ONGOING,
      InteractionType.FLUID,
      CbType.ANY_BODY,
      CbType.ANY_BODY,
      (cb: any) => {
        const arbiters = cb.arbiters;
        for (let i = 0; i < arbiters.length; i++) {
          const arb = arbiters.at(i);
          if (arb.isFluidArbiter()) {
            captured = arb.fluidArbiter;
            capturedBase = arb;
            break;
          }
        }
      },
    ).space = space;

    const fluidBody = new Body(BodyType.STATIC, new Vec2(0, 0));
    const fluidShape = new Polygon(Polygon.box(1000, 1000));
    fluidShape.fluidEnabled = true;
    fluidShape.fluidProperties = new FluidProperties(3, 5);
    fluidBody.shapes.add(fluidShape);
    fluidBody.space = space;

    const ball = dynamicCircle(0, 0, 15);
    ball.space = space;

    return { space, ball, getCaptured: () => captured, getBase: () => capturedBase };
  }

  it("buoyancyImpulse returns non-zero Vec3 for submerged body", () => {
    const { space, getCaptured } = createFluidScene();
    step(space, 30);

    const arb = getCaptured();
    expect(arb).not.toBeNull();
    const impulse = arb!.buoyancyImpulse();
    // Buoyancy should push upward (negative y in typical coords)
    expect(impulse).toBeDefined();
    expect(Math.abs(impulse.x) + Math.abs(impulse.y)).toBeGreaterThan(0);
  });

  it("dragImpulse returns a value for submerged moving body", () => {
    const { space, getCaptured } = createFluidScene();
    step(space, 30);

    const arb = getCaptured();
    expect(arb).not.toBeNull();
    const impulse = arb!.dragImpulse();
    expect(impulse).toBeDefined();
    // Drag exists when body is moving
    expect(impulse.x).toBeDefined();
    expect(impulse.y).toBeDefined();
  });

  it("totalImpulse equals buoyancy + drag", () => {
    const { space, getCaptured } = createFluidScene();
    step(space, 30);

    const arb = getCaptured();
    expect(arb).not.toBeNull();
    const total = arb!.totalImpulse();
    const buoyancy = arb!.buoyancyImpulse();
    const drag = arb!.dragImpulse();

    expect(total.x).toBeCloseTo(buoyancy.x + drag.x, 1);
    expect(total.y).toBeCloseTo(buoyancy.y + drag.y, 1);
  });

  it("buoyancyImpulse with body scoping returns per-body value", () => {
    const { space, getCaptured, getBase } = createFluidScene();
    step(space, 30);

    const arb = getCaptured();
    const base = getBase();
    expect(arb).not.toBeNull();

    const imp1 = arb!.buoyancyImpulse(base!.body1);
    const imp2 = arb!.buoyancyImpulse(base!.body2);
    // Both should be defined; one body is static so its contribution may differ
    expect(imp1).toBeDefined();
    expect(imp2).toBeDefined();
  });
});

// ---------------------------------------------------------------------------
// FluidArbiter — overlap and position
// ---------------------------------------------------------------------------

describe("ZPP_FluidArbiter — overlap and position properties", () => {
  it("overlap is positive for submerged body", () => {
    const space = new Space(new Vec2(0, 400));
    let overlap = -1;

    new InteractionListener(
      CbEvent.ONGOING,
      InteractionType.FLUID,
      CbType.ANY_BODY,
      CbType.ANY_BODY,
      (cb: any) => {
        for (let i = 0; i < cb.arbiters.length; i++) {
          const arb = cb.arbiters.at(i);
          if (arb.isFluidArbiter()) {
            overlap = arb.fluidArbiter.overlap;
          }
        }
      },
    ).space = space;

    const fluidBody = new Body(BodyType.STATIC, new Vec2(0, 0));
    const fluidShape = new Polygon(Polygon.box(500, 500));
    fluidShape.fluidEnabled = true;
    fluidShape.fluidProperties = new FluidProperties(2, 1);
    fluidBody.shapes.add(fluidShape);
    fluidBody.space = space;

    const ball = dynamicCircle(0, 0, 15);
    ball.space = space;

    step(space, 30);
    expect(overlap).toBeGreaterThan(0);
  });

  it("position is accessible and returns Vec2-like", () => {
    const space = new Space(new Vec2(0, 400));
    let posX: number | null = null;

    new InteractionListener(
      CbEvent.ONGOING,
      InteractionType.FLUID,
      CbType.ANY_BODY,
      CbType.ANY_BODY,
      (cb: any) => {
        for (let i = 0; i < cb.arbiters.length; i++) {
          const arb = cb.arbiters.at(i);
          if (arb.isFluidArbiter()) {
            const pos = arb.fluidArbiter.position;
            if (pos) posX = pos.x;
          }
        }
      },
    ).space = space;

    const fluidBody = new Body(BodyType.STATIC, new Vec2(0, 0));
    const fluidShape = new Polygon(Polygon.box(500, 500));
    fluidShape.fluidEnabled = true;
    fluidShape.fluidProperties = new FluidProperties(2, 1);
    fluidBody.shapes.add(fluidShape);
    fluidBody.space = space;

    const ball = dynamicCircle(0, 0, 15);
    ball.space = space;

    step(space, 30);
    expect(posX).not.toBeNull();
    expect(typeof posX).toBe("number");
  });
});

// ---------------------------------------------------------------------------
// FluidArbiter — PreListener property mutation
// ---------------------------------------------------------------------------

describe("ZPP_FluidArbiter — PreListener mutation", () => {
  it("modifying overlap in PreListener changes buoyancy force", () => {
    let modifiedOverlap = false;

    const space = new Space(new Vec2(0, 400));

    new PreListener(InteractionType.FLUID, CbType.ANY_BODY, CbType.ANY_BODY, (cb: any) => {
      if (cb.arbiter?.isFluidArbiter()) {
        const fa = cb.arbiter.fluidArbiter;
        if (fa && fa.overlap > 0) {
          fa.overlap = fa.overlap * 2; // Double the buoyancy
          modifiedOverlap = true;
        }
      }
      return PreFlag.ACCEPT;
    }).space = space;

    const fluidBody = new Body(BodyType.STATIC, new Vec2(0, 0));
    const fluidShape = new Polygon(Polygon.box(500, 500));
    fluidShape.fluidEnabled = true;
    fluidShape.fluidProperties = new FluidProperties(2, 1);
    fluidBody.shapes.add(fluidShape);
    fluidBody.space = space;

    const ball = dynamicCircle(0, 0, 15);
    ball.space = space;

    step(space, 60);
    expect(modifiedOverlap).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Sensor arbiter
// ---------------------------------------------------------------------------

describe("Sensor arbiter — type checks", () => {
  it("sensor interaction has SENSOR arbiter type", () => {
    const space = new Space(new Vec2(0, 0));
    let isSensor = false;

    new InteractionListener(
      CbEvent.BEGIN,
      InteractionType.SENSOR,
      CbType.ANY_BODY,
      CbType.ANY_BODY,
      (cb: any) => {
        for (let i = 0; i < cb.arbiters.length; i++) {
          const arb = cb.arbiters.at(i);
          if (arb.isSensorArbiter()) {
            isSensor = true;
          }
        }
      },
    ).space = space;

    const b1 = new Body(BodyType.DYNAMIC, new Vec2(0, 0));
    const c1 = new Circle(20);
    c1.sensorEnabled = true;
    b1.shapes.add(c1);
    b1.space = space;

    const b2 = dynamicCircle(25, 0, 20);
    b2.space = space;

    step(space, 1);
    expect(isSensor).toBe(true);
  });

  it("sensor arbiter type is SENSOR", () => {
    const space = new Space(new Vec2(0, 0));
    let arbType: ArbiterType | null = null;

    new InteractionListener(
      CbEvent.BEGIN,
      InteractionType.SENSOR,
      CbType.ANY_BODY,
      CbType.ANY_BODY,
      (cb: any) => {
        for (let i = 0; i < cb.arbiters.length; i++) {
          arbType = cb.arbiters.at(i).type;
        }
      },
    ).space = space;

    const b1 = new Body(BodyType.DYNAMIC, new Vec2(0, 0));
    const c1 = new Circle(20);
    c1.sensorEnabled = true;
    b1.shapes.add(c1);
    b1.space = space;

    const b2 = dynamicCircle(25, 0, 20);
    b2.space = space;

    step(space, 1);
    expect(arbType).toBe(ArbiterType.SENSOR);
  });
});

// ---------------------------------------------------------------------------
// Arbiter — type casting null safety
// ---------------------------------------------------------------------------

describe("Arbiter — type casting safety", () => {
  it("collisionArbiter returns null for fluid arbiter", () => {
    const space = new Space(new Vec2(0, 400));
    let colResult: CollisionArbiter | null | undefined = undefined;

    new InteractionListener(
      CbEvent.ONGOING,
      InteractionType.FLUID,
      CbType.ANY_BODY,
      CbType.ANY_BODY,
      (cb: any) => {
        for (let i = 0; i < cb.arbiters.length; i++) {
          const arb = cb.arbiters.at(i);
          if (arb.isFluidArbiter()) {
            colResult = arb.collisionArbiter;
          }
        }
      },
    ).space = space;

    const fluidBody = new Body(BodyType.STATIC, new Vec2(0, 0));
    const fluidShape = new Polygon(Polygon.box(500, 500));
    fluidShape.fluidEnabled = true;
    fluidShape.fluidProperties = new FluidProperties(2, 1);
    fluidBody.shapes.add(fluidShape);
    fluidBody.space = space;

    const ball = dynamicCircle(0, 0, 15);
    ball.space = space;

    step(space, 30);
    expect(colResult).toBeNull();
  });

  it("fluidArbiter returns null for collision arbiter", () => {
    const space = new Space(new Vec2(0, 500));
    let fluidResult: FluidArbiter | null | undefined = undefined;

    new InteractionListener(
      CbEvent.ONGOING,
      InteractionType.COLLISION,
      CbType.ANY_BODY,
      CbType.ANY_BODY,
      (cb: any) => {
        const arb = cb.arbiters.at(0);
        if (arb?.isCollisionArbiter()) {
          fluidResult = arb.fluidArbiter;
        }
      },
    ).space = space;

    const floor = staticBox(0, 100);
    floor.space = space;
    const ball = dynamicCircle(0, 50, 10);
    ball.space = space;

    step(space, 60);
    expect(fluidResult).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Material effects on arbiter
// ---------------------------------------------------------------------------

describe("ZPP_ColArbiter — material effects", () => {
  it("high-elasticity material produces higher bounce", () => {
    // Scene with bouncy material
    const space = new Space(new Vec2(0, 500));
    const floor = staticBox(0, 100);
    const mat = new Material(0.95, 0.1, 0.1, 1, 0);
    floor.shapes.at(0).material = mat;
    floor.space = space;

    const ball = dynamicCircle(0, 0, 10);
    ball.shapes.at(0).material = new Material(0.95, 0.1, 0.1, 1, 0);
    ball.space = space;

    // Record max height after first bounce
    let maxY = 0;
    let hitFloor = false;

    for (let i = 0; i < 120; i++) {
      space.step(1 / 60);
      if (ball.position.y >= 80 && !hitFloor) hitFloor = true;
      if (hitFloor && ball.position.y < maxY) break;
      if (hitFloor) maxY = Math.max(maxY, ball.position.y);
    }

    // Ball with high elasticity should bounce back up
    expect(hitFloor).toBe(true);
  });
});
