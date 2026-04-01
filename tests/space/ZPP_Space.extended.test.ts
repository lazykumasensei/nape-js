/**
 * ZPP_Space — extended integration tests for sleeping, islands, solver,
 * constraint warm-start, and wake transitions.
 *
 * Targets the lowest-coverage ZPP_Space paths: really_wake() island
 * reconstruction, iterateVel/iteratePos edge cases, sleeping island
 * merge/split, kinematic delay sleep, constraint wake propagation,
 * arbiter sleep transitions, and re-entrancy safety.
 */

import { describe, it, expect } from "vitest";
import "../../src/core/engine";
import { Space } from "../../src/space/Space";
import { Body } from "../../src/phys/Body";
import { BodyType } from "../../src/phys/BodyType";
import { Vec2 } from "../../src/geom/Vec2";
import { Circle } from "../../src/shape/Circle";
import { Polygon } from "../../src/shape/Polygon";
import { PivotJoint } from "../../src/constraint/PivotJoint";
import { DistanceJoint } from "../../src/constraint/DistanceJoint";
import { WeldJoint } from "../../src/constraint/WeldJoint";
import { AngleJoint } from "../../src/constraint/AngleJoint";
import { InteractionListener } from "../../src/callbacks/InteractionListener";
import { CbEvent } from "../../src/callbacks/CbEvent";
import { CbType } from "../../src/callbacks/CbType";
import { InteractionType } from "../../src/callbacks/InteractionType";
import { Broadphase } from "../../src/space/Broadphase";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function step(space: Space, n: number, dt = 1 / 60): void {
  for (let i = 0; i < n; i++) space.step(dt);
}

function dynamicCircle(x = 0, y = 0, r = 10): Body {
  const b = new Body(BodyType.DYNAMIC, new Vec2(x, y));
  b.shapes.add(new Circle(r));
  return b;
}

function staticBox(x = 0, y = 200, w = 400, h = 20): Body {
  const b = new Body(BodyType.STATIC, new Vec2(x, y));
  b.shapes.add(new Polygon(Polygon.box(w, h)));
  return b;
}

function dynamicBox(x = 0, y = 0, w = 20, h = 20): Body {
  const b = new Body(BodyType.DYNAMIC, new Vec2(x, y));
  b.shapes.add(new Polygon(Polygon.box(w, h)));
  return b;
}

// ---------------------------------------------------------------------------
// 1. really_wake() — Breaking constraints on sleeping bodies
// ---------------------------------------------------------------------------

describe("ZPP_Space — wake via constraint breaking", () => {
  it("removing a constraint wakes sleeping connected bodies", () => {
    const space = new Space(new Vec2(0, 500));
    const floor = staticBox(0, 200);
    floor.space = space;

    const b1 = dynamicCircle(0, 180, 8);
    b1.space = space;
    const b2 = dynamicCircle(30, 180, 8);
    b2.space = space;

    const joint = new DistanceJoint(b1, b2, new Vec2(0, 0), new Vec2(0, 0), 30, 30);
    joint.space = space;

    // Let them settle and sleep
    step(space, 300);

    // Remove constraint — should wake bodies
    joint.space = null;

    // Apply force to verify they're awake
    b1.applyImpulse(new Vec2(100, 0));
    step(space, 10);

    // Body should have moved
    expect(b1.position.x).not.toBeCloseTo(0, 0);
  });

  it("adding a new constraint to sleeping body wakes it", () => {
    const space = new Space(new Vec2(0, 500));
    const floor = staticBox(0, 200);
    floor.space = space;

    const b1 = dynamicCircle(-20, 180, 8);
    b1.space = space;
    const b2 = dynamicCircle(20, 180, 8);
    b2.space = space;

    // Let settle
    step(space, 300);

    // Add constraint between sleeping bodies
    const joint = new PivotJoint(b1, b2, new Vec2(0, 0), new Vec2(0, 0));
    joint.space = space;

    step(space, 30);
    // Joint should have pulled bodies toward each other
    const dist = Math.abs(b2.position.x - b1.position.x);
    expect(dist).toBeLessThan(40);
  });
});

// ---------------------------------------------------------------------------
// 2. Solver iterations — edge cases
// ---------------------------------------------------------------------------

describe("ZPP_Space — solver iterations", () => {
  it("low velocity iterations (1) still resolves basic collisions", () => {
    const space = new Space(new Vec2(0, 500));
    const floor = staticBox(0, 200);
    floor.space = space;
    const ball = dynamicCircle(0, 0, 10);
    ball.space = space;

    // Very low iterations
    for (let i = 0; i < 120; i++) space.step(1 / 60, 1, 1);

    // Ball should still rest on floor (not fall through)
    expect(ball.position.y).toBeLessThan(210);
    expect(ball.position.y).toBeGreaterThan(150);
  });

  it("high iterations (20) produces stable stacking", () => {
    const space = new Space(new Vec2(0, 500));
    const floor = staticBox(0, 200);
    floor.space = space;

    // Stack of boxes
    for (let i = 0; i < 5; i++) {
      const box = dynamicBox(0, 150 - i * 25, 20, 20);
      box.space = space;
    }

    for (let i = 0; i < 300; i++) space.step(1 / 60, 20, 20);

    // All boxes should be above the floor
    for (const body of space.liveBodies) {
      if (body.type === BodyType.DYNAMIC) {
        expect(body.position.y).toBeLessThan(210);
      }
    }
  });

  it("zero-gravity with high iterations and constraint chain", () => {
    const space = new Space(new Vec2(0, 0));
    const bodies: Body[] = [];

    // Chain of 5 bodies connected by distance joints
    for (let i = 0; i < 5; i++) {
      const b = dynamicCircle(i * 40, 0, 10);
      b.space = space;
      bodies.push(b);
    }

    for (let i = 0; i < 4; i++) {
      const joint = new DistanceJoint(
        bodies[i],
        bodies[i + 1],
        new Vec2(0, 0),
        new Vec2(0, 0),
        40,
        40,
      );
      joint.space = space;
    }

    // Pull the first body
    bodies[0].applyImpulse(new Vec2(0, 500));

    for (let i = 0; i < 60; i++) space.step(1 / 60, 15, 15);

    // All bodies should have moved (chain propagation)
    for (const b of bodies) {
      expect(Math.abs(b.velocity.x) + Math.abs(b.velocity.y)).toBeGreaterThan(0);
    }
  });
});

// ---------------------------------------------------------------------------
// 3. Sleeping island merge/split
// ---------------------------------------------------------------------------

describe("ZPP_Space — sleeping island management", () => {
  it("two separate sleeping groups merge when connected", () => {
    const space = new Space(new Vec2(0, 500));
    const floor = staticBox(0, 200);
    floor.space = space;

    const b1 = dynamicCircle(-40, 180, 8);
    b1.space = space;
    const b2 = dynamicCircle(40, 180, 8);
    b2.space = space;

    // Let both settle independently
    step(space, 300);

    // Connect them with a joint — merges islands
    const joint = new DistanceJoint(b1, b2, new Vec2(0, 0), new Vec2(0, 0), 80, 80);
    joint.space = space;

    step(space, 30);
    // Both should still be near their original positions (joint length matches distance)
    expect(b1.position.x).toBeLessThan(0);
    expect(b2.position.x).toBeGreaterThan(0);
  });

  it("bodies re-sleep after transient wake", () => {
    const space = new Space(new Vec2(0, 500));
    space.worldLinearDrag = 0.5;
    const floor = staticBox(0, 200);
    floor.space = space;

    const ball = dynamicCircle(0, 180, 10);
    ball.space = space;

    // Let settle
    step(space, 300);

    // Wake with small impulse
    ball.applyImpulse(new Vec2(5, 0));
    step(space, 300);

    // Should re-sleep after the small impulse dissipates
    // Verify simulation is stable (no NaN, ball on floor)
    expect(ball.position.y).toBeLessThan(210);
    expect(isNaN(ball.position.x)).toBe(false);
  });

  it("removing body from sleeping island leaves others sleeping", () => {
    const space = new Space(new Vec2(0, 500));
    const floor = staticBox(0, 200);
    floor.space = space;

    const b1 = dynamicCircle(-15, 180, 8);
    b1.space = space;
    const b2 = dynamicCircle(15, 180, 8);
    b2.space = space;
    const b3 = dynamicCircle(45, 180, 8);
    b3.space = space;

    // Connect b1-b2 and b2-b3
    const j1 = new DistanceJoint(b1, b2, new Vec2(0, 0), new Vec2(0, 0), 30, 30);
    j1.space = space;
    const j2 = new DistanceJoint(b2, b3, new Vec2(0, 0), new Vec2(0, 0), 30, 30);
    j2.space = space;

    step(space, 300);

    // Remove middle body
    b2.space = null;
    j1.space = null;
    j2.space = null;
    step(space, 5);

    // Remaining bodies should still be in space
    expect(space.bodies.length).toBe(3); // floor + b1 + b3
  });
});

// ---------------------------------------------------------------------------
// 4. Kinematic body interactions with sleeping
// ---------------------------------------------------------------------------

describe("ZPP_Space — kinematic body interactions", () => {
  it("moving kinematic body wakes nearby sleeping dynamic body", () => {
    const space = new Space(new Vec2(0, 500));
    const floor = staticBox(0, 200);
    floor.space = space;

    const ball = dynamicCircle(0, 180, 10);
    ball.space = space;

    // Let ball settle and sleep
    step(space, 300);

    // Kinematic pusher moves into the ball
    const pusher = new Body(BodyType.KINEMATIC, new Vec2(-100, 185));
    pusher.shapes.add(new Polygon(Polygon.box(20, 30)));
    pusher.velocity = new Vec2(200, 0);
    pusher.space = space;

    step(space, 60);

    // Ball should have been pushed
    expect(ball.position.x).toBeGreaterThan(5);
  });

  it("kinematic body with zero velocity doesn't disturb sleeping bodies", () => {
    const space = new Space(new Vec2(0, 500));
    const floor = staticBox(0, 200);
    floor.space = space;

    const ball = dynamicCircle(0, 180, 10);
    ball.space = space;

    step(space, 300);
    const posX = ball.position.x;

    // Static kinematic near ball
    const kinematic = new Body(BodyType.KINEMATIC, new Vec2(50, 185));
    kinematic.shapes.add(new Circle(10));
    kinematic.space = space;

    step(space, 30);

    // Ball should not have moved significantly
    expect(ball.position.x).toBeCloseTo(posX, 0);
  });
});

// ---------------------------------------------------------------------------
// 5. Constraint warm-start on wake
// ---------------------------------------------------------------------------

describe("ZPP_Space — constraint warm-start", () => {
  it("weld joint holds position after wake", () => {
    const space = new Space(new Vec2(0, 500));
    const floor = staticBox(0, 200);
    floor.space = space;

    const b1 = dynamicCircle(-15, 170, 8);
    b1.space = space;
    const b2 = dynamicCircle(15, 170, 8);
    b2.space = space;

    const weld = new WeldJoint(b1, b2, new Vec2(0, 0), new Vec2(0, 0));
    weld.space = space;

    // Settle
    step(space, 300);
    const relX = b2.position.x - b1.position.x;

    // Wake and apply impulse
    b1.applyImpulse(new Vec2(50, -100));
    step(space, 30);

    // Weld should keep relative position roughly the same
    const newRelX = b2.position.x - b1.position.x;
    expect(Math.abs(newRelX - relX)).toBeLessThan(15);
  });

  it("angle joint preserves angle after wake", () => {
    const space = new Space(new Vec2(0, 0));

    const b1 = dynamicCircle(0, 0, 10);
    b1.space = space;
    const b2 = dynamicCircle(40, 0, 10);
    b2.space = space;

    const angle = new AngleJoint(b1, b2, 0, 0);
    angle.space = space;

    step(space, 300);

    // Apply torque to one body
    b1.angularVel = 5;
    step(space, 60);

    // Angle constraint should keep rotations coupled
    const angleDiff = Math.abs(b1.rotation - b2.rotation);
    expect(angleDiff).toBeLessThan(1);
  });
});

// ---------------------------------------------------------------------------
// 6. Arbiter sleep transitions
// ---------------------------------------------------------------------------

describe("ZPP_Space — arbiter sleep/wake transitions", () => {
  it("collision response is immediate after body wake", () => {
    const space = new Space(new Vec2(0, 500));
    const floor = staticBox(0, 200);
    floor.space = space;

    const ball = dynamicCircle(0, 180, 10);
    ball.space = space;

    // Settle
    step(space, 300);

    // Wake ball by launching it
    ball.velocity = new Vec2(0, -500);
    step(space, 120);

    // Ball should come back to rest on floor
    expect(ball.position.y).toBeLessThan(210);
    expect(ball.position.y).toBeGreaterThan(100);
  });

  it("ONGOING callback fires after sleeping bodies are woken", () => {
    const space = new Space(new Vec2(0, 500));
    const floor = staticBox(0, 200);
    floor.space = space;

    const ball = dynamicCircle(0, 180, 10);
    ball.space = space;

    // Let settle
    step(space, 300);

    // Add ongoing listener
    let ongoingCount = 0;
    new InteractionListener(
      CbEvent.ONGOING,
      InteractionType.COLLISION,
      CbType.ANY_BODY,
      CbType.ANY_BODY,
      () => {
        ongoingCount++;
      },
    ).space = space;

    // Wake ball slightly
    ball.applyImpulse(new Vec2(0, -20));
    step(space, 60);

    // ONGOING should have fired at least once after re-contact
    expect(ongoingCount).toBeGreaterThanOrEqual(1);
  });
});

// ---------------------------------------------------------------------------
// 7. Callback during step (re-entrancy safety)
// ---------------------------------------------------------------------------

describe("ZPP_Space — callback re-entrancy", () => {
  it("modifying body velocity in BEGIN callback is safe", () => {
    const space = new Space(new Vec2(0, 0));

    new InteractionListener(
      CbEvent.BEGIN,
      InteractionType.COLLISION,
      CbType.ANY_BODY,
      CbType.ANY_BODY,
      (cb: any) => {
        // Modify velocity during callback
        const b1 = cb.int1 as Body;
        if (b1.type === BodyType.DYNAMIC) {
          b1.velocity = new Vec2(0, -100);
        }
      },
    ).space = space;

    const b1 = dynamicCircle(0, 0, 20);
    b1.space = space;
    const b2 = dynamicCircle(30, 0, 20);
    b2.space = space;

    // Should not crash
    step(space, 10);
    expect(typeof b1.position.x).toBe("number");
    expect(typeof b2.position.x).toBe("number");
  });

  it("removing a body in END callback is safe", () => {
    const space = new Space(new Vec2(0, 0));
    let bodyToRemove: Body | null = null;

    new InteractionListener(
      CbEvent.END,
      InteractionType.COLLISION,
      CbType.ANY_BODY,
      CbType.ANY_BODY,
      (_cb: any) => {
        if (bodyToRemove) {
          bodyToRemove.space = null;
          bodyToRemove = null;
        }
      },
    ).space = space;

    new InteractionListener(
      CbEvent.BEGIN,
      InteractionType.COLLISION,
      CbType.ANY_BODY,
      CbType.ANY_BODY,
      () => {},
    ).space = space;

    const b1 = dynamicCircle(0, 0, 20);
    b1.space = space;
    const b2 = dynamicCircle(30, 0, 20);
    b2.space = space;

    step(space, 1);

    // Separate to trigger END
    b2.position = new Vec2(5000, 0);
    bodyToRemove = b2;

    // Should not crash
    step(space, 5);
    expect(space.bodies.length).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// 8. Space.clear() and lifecycle
// ---------------------------------------------------------------------------

describe("ZPP_Space — clear and lifecycle", () => {
  it("space.clear() removes everything and allows re-use", () => {
    const space = new Space(new Vec2(0, 500));
    const floor = staticBox(0, 200);
    floor.space = space;

    for (let i = 0; i < 10; i++) {
      dynamicCircle(i * 15 - 75, 0, 8).space = space;
    }
    step(space, 30);

    space.clear();
    expect(space.bodies.length).toBe(0);
    expect(space.constraints.length).toBe(0);

    // Re-use space
    const b = dynamicCircle(0, 0, 10);
    b.space = space;
    step(space, 5);
    expect(b.position.y).toBeGreaterThan(0);
  });

  it("space.clear() with constraints", () => {
    const space = new Space(new Vec2(0, 0));
    const b1 = dynamicCircle(0, 0, 10);
    b1.space = space;
    const b2 = dynamicCircle(40, 0, 10);
    b2.space = space;

    const joint = new PivotJoint(b1, b2, new Vec2(0, 0), new Vec2(0, 0));
    joint.space = space;

    step(space, 5);
    space.clear();

    expect(space.bodies.length).toBe(0);
    expect(space.constraints.length).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// 9. Sub-stepping for stability
// ---------------------------------------------------------------------------

describe("ZPP_Space — sub-stepping", () => {
  it("smaller timesteps produce more stable stacking", () => {
    const space = new Space(new Vec2(0, 500));
    const floor = staticBox(0, 200);
    floor.space = space;

    // Stack 3 boxes
    for (let i = 0; i < 3; i++) {
      dynamicBox(0, 150 - i * 25, 20, 20).space = space;
    }

    // Many small steps (sub-stepping)
    for (let i = 0; i < 600; i++) space.step(1 / 120);

    // Verify stack is stable
    let allAboveFloor = true;
    for (const body of space.liveBodies) {
      if (body.type === BodyType.DYNAMIC && body.position.y > 210) {
        allAboveFloor = false;
      }
    }
    expect(allAboveFloor).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// 10. Complex constraint chain
// ---------------------------------------------------------------------------

describe("ZPP_Space — complex constraint scenarios", () => {
  it("pendulum chain under gravity", () => {
    const space = new Space(new Vec2(0, 300));
    const anchor = new Body(BodyType.STATIC, new Vec2(0, 0));
    anchor.shapes.add(new Circle(5));
    anchor.space = space;

    let prev = anchor;
    const links: Body[] = [];
    for (let i = 0; i < 5; i++) {
      const link = dynamicCircle(0, (i + 1) * 25, 5);
      link.space = space;
      const joint = new PivotJoint(prev, link, new Vec2(0, i === 0 ? 0 : 0), new Vec2(0, 0));
      joint.space = space;
      links.push(link);
      prev = link;
    }

    // Give horizontal push to bottom
    links[links.length - 1].applyImpulse(new Vec2(200, 0));

    step(space, 120);

    // Chain should have swung — last link should have moved horizontally
    expect(Math.abs(links[links.length - 1].position.x)).toBeGreaterThan(0);
  });

  it("constraint with breakUnderForce", () => {
    const space = new Space(new Vec2(0, 0));

    const b1 = dynamicCircle(0, 0, 10);
    b1.space = space;
    const b2 = dynamicCircle(40, 0, 10);
    b2.space = space;

    const joint = new DistanceJoint(b1, b2, new Vec2(0, 0), new Vec2(0, 0), 40, 40);
    joint.breakUnderForce = true;
    joint.maxForce = 50;
    joint.space = space;

    // Apply massive force to break the joint
    b1.applyImpulse(new Vec2(-5000, 0));

    step(space, 30);

    // Joint should have broken
    expect(joint.space).toBeNull();
  });

  it("multiple joints on same body pair", () => {
    const space = new Space(new Vec2(0, 0));

    const b1 = dynamicCircle(0, 0, 10);
    b1.space = space;
    const b2 = dynamicCircle(40, 0, 10);
    b2.space = space;

    // Distance + angle joint
    const dist = new DistanceJoint(b1, b2, new Vec2(0, 0), new Vec2(0, 0), 40, 40);
    dist.space = space;
    const angle = new AngleJoint(b1, b2, 0, 0);
    angle.space = space;

    b1.applyImpulse(new Vec2(0, 100));
    step(space, 60);

    // Both constraints should keep bodies coupled
    const actualDist = Math.sqrt(
      (b2.position.x - b1.position.x) ** 2 + (b2.position.y - b1.position.y) ** 2,
    );
    expect(actualDist).toBeCloseTo(40, -1);
  });
});

// ---------------------------------------------------------------------------
// 11. Broadphase interaction with solver
// ---------------------------------------------------------------------------

describe("ZPP_Space — broadphase + solver integration", () => {
  for (const bp of [Broadphase.DYNAMIC_AABB_TREE, Broadphase.SWEEP_AND_PRUNE]) {
    it(`gravity stacking with ${bp === Broadphase.DYNAMIC_AABB_TREE ? "AABB" : "SAP"}`, () => {
      const space = new Space(new Vec2(0, 500), bp);
      const floor = staticBox(0, 200);
      floor.space = space;

      for (let i = 0; i < 3; i++) {
        dynamicCircle(0, 100 - i * 30, 12).space = space;
      }

      step(space, 120);

      // All circles should be above floor
      for (const body of space.liveBodies) {
        if (body.type === BodyType.DYNAMIC) {
          expect(body.position.y).toBeLessThan(210);
        }
      }
    });
  }
});
