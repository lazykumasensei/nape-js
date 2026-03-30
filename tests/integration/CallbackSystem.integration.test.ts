import { describe, it, expect } from "vitest";
import { Space } from "../../src/space/Space";
import { Body } from "../../src/phys/Body";
import { BodyType } from "../../src/phys/BodyType";
import { Vec2 } from "../../src/geom/Vec2";
import { Circle } from "../../src/shape/Circle";
import { Polygon } from "../../src/shape/Polygon";
import { InteractionListener } from "../../src/callbacks/InteractionListener";
import { BodyListener } from "../../src/callbacks/BodyListener";
import { ConstraintListener } from "../../src/callbacks/ConstraintListener";
import { PreListener } from "../../src/callbacks/PreListener";
import { PreFlag } from "../../src/callbacks/PreFlag";
import { InteractionType } from "../../src/callbacks/InteractionType";
import { CbEvent } from "../../src/callbacks/CbEvent";
import { CbType } from "../../src/callbacks/CbType";
import { DistanceJoint } from "../../src/constraint/DistanceJoint";
import { PivotJoint } from "../../src/constraint/PivotJoint";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function dynamicCircle(x: number, y: number, radius = 10): Body {
  const b = new Body(BodyType.DYNAMIC, new Vec2(x, y));
  b.shapes.add(new Circle(radius));
  return b;
}

function staticBox(x: number, y: number, w = 500, h = 10): Body {
  const b = new Body(BodyType.STATIC, new Vec2(x, y));
  b.shapes.add(new Polygon(Polygon.box(w, h)));
  return b;
}

function step(space: Space, n = 60): void {
  for (let i = 0; i < n; i++) space.step(1 / 60);
}

// ---------------------------------------------------------------------------
// 1. InteractionListener — BEGIN / END lifecycle
// ---------------------------------------------------------------------------
describe("Callback integration — interaction listener lifecycle", () => {
  it("should fire BEGIN when two bodies start colliding", () => {
    const space = new Space(new Vec2(0, 500));
    const floor = staticBox(0, 100);
    floor.space = space;
    const ball = dynamicCircle(0, 50, 10);
    ball.space = space;

    let beginFired = false;
    const listener = new InteractionListener(
      CbEvent.BEGIN,
      InteractionType.COLLISION,
      CbType.ANY_BODY,
      CbType.ANY_BODY,
      () => {
        beginFired = true;
      },
    );
    listener.space = space;

    step(space, 60);
    expect(beginFired).toBe(true);
  });

  it("should fire END when bodies separate", () => {
    const space = new Space(new Vec2(0, 500));
    const floor = staticBox(0, 100);
    floor.space = space;
    const ball = dynamicCircle(0, 50, 10);
    ball.space = space;

    let endFired = false;
    const listener = new InteractionListener(
      CbEvent.END,
      InteractionType.COLLISION,
      CbType.ANY_BODY,
      CbType.ANY_BODY,
      () => {
        endFired = true;
      },
    );
    listener.space = space;

    // Let ball land
    step(space, 30);
    // Remove ball to trigger END
    ball.space = null;
    step(space, 5);

    expect(endFired).toBe(true);
  });

  it("should fire ONGOING while bodies are in contact", () => {
    const space = new Space(new Vec2(0, 500));
    const floor = staticBox(0, 100);
    floor.space = space;
    const ball = dynamicCircle(0, 50, 10);
    ball.space = space;

    let ongoingCount = 0;
    const listener = new InteractionListener(
      CbEvent.ONGOING,
      InteractionType.COLLISION,
      CbType.ANY_BODY,
      CbType.ANY_BODY,
      () => {
        ongoingCount++;
      },
    );
    listener.space = space;

    step(space, 120);
    expect(ongoingCount).toBeGreaterThan(10);
  });
});

// ---------------------------------------------------------------------------
// 2. BodyListener — add/remove from space
// ---------------------------------------------------------------------------
describe("Callback integration — BodyListener", () => {
  it("should fire WAKE when dynamic body wakes up during simulation", () => {
    const space = new Space(new Vec2(0, 500));
    const floor = staticBox(0, 100);
    floor.space = space;

    const ball = dynamicCircle(0, 50, 10);
    ball.space = space;

    let wakeFired = false;
    const listener = new BodyListener(CbEvent.WAKE, CbType.ANY_BODY, () => {
      wakeFired = true;
    });
    listener.space = space;

    // Let ball land and settle to sleep
    step(space, 300);

    // Now wake it by applying impulse
    ball.applyImpulse(new Vec2(0, -500));
    step(space, 5);

    expect(wakeFired).toBe(true);
  });

  it("should fire SLEEP when body settles and goes to sleep", () => {
    const space = new Space(new Vec2(0, 500));
    const floor = staticBox(0, 100);
    floor.space = space;

    const ball = dynamicCircle(0, 50, 10);
    ball.space = space;

    let sleptFired = false;
    const listener = new BodyListener(CbEvent.SLEEP, CbType.ANY_BODY, () => {
      sleptFired = true;
    });
    listener.space = space;

    // Let ball land and settle
    step(space, 300);

    expect(sleptFired).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// 3. PreListener — collision filtering
// ---------------------------------------------------------------------------
describe("Callback integration — PreListener collision filtering", () => {
  it("should ignore collision when PreListener returns IGNORE", () => {
    const space = new Space(new Vec2(0, 500));
    const floor = staticBox(0, 100);
    floor.space = space;

    const ball = dynamicCircle(0, 50, 10);
    ball.space = space;

    const preListener = new PreListener(
      InteractionType.COLLISION,
      CbType.ANY_BODY,
      CbType.ANY_BODY,
      () => PreFlag.IGNORE,
    );
    preListener.space = space;

    step(space, 60);

    // Ball should fall through the floor
    expect(ball.position.y).toBeGreaterThan(100);
  });

  it("should accept collision when PreListener returns ACCEPT", () => {
    const space = new Space(new Vec2(0, 500));
    const floor = staticBox(0, 100);
    floor.space = space;

    const ball = dynamicCircle(0, 50, 10);
    ball.space = space;

    const preListener = new PreListener(
      InteractionType.COLLISION,
      CbType.ANY_BODY,
      CbType.ANY_BODY,
      () => PreFlag.ACCEPT,
    );
    preListener.space = space;

    step(space, 60);

    // Ball should rest on or near the floor
    expect(ball.position.y).toBeLessThanOrEqual(100);
  });

  it("should selectively filter collisions with custom CbTypes", () => {
    const space = new Space(new Vec2(0, 500));
    const ghostType = new CbType();
    const solidType = new CbType();

    const floor = staticBox(0, 100);
    floor.cbTypes.add(solidType);
    floor.space = space;

    // Ghost ball — should pass through
    const ghost = dynamicCircle(-30, 50, 10);
    ghost.cbTypes.add(ghostType);
    ghost.space = space;

    // Solid ball — should collide
    const solid = dynamicCircle(30, 50, 10);
    solid.cbTypes.add(solidType);
    solid.space = space;

    const preListener = new PreListener(
      InteractionType.COLLISION,
      ghostType,
      solidType,
      () => PreFlag.IGNORE,
    );
    preListener.space = space;

    step(space, 60);

    // Ghost should fall through, solid should rest on floor
    expect(ghost.position.y).toBeGreaterThan(100);
    expect(solid.position.y).toBeLessThanOrEqual(105);
  });
});

// ---------------------------------------------------------------------------
// 4. ConstraintListener
// ---------------------------------------------------------------------------
describe("Callback integration — ConstraintListener", () => {
  it("should fire BREAK when constraint breaks under force", () => {
    const space = new Space(new Vec2(0, 0));
    const constraintCb = new CbType();

    const b1 = new Body(BodyType.DYNAMIC, new Vec2(0, 0));
    b1.shapes.add(new Circle(10));
    b1.velocity = new Vec2(-500, 0);
    b1.space = space;

    const b2 = new Body(BodyType.DYNAMIC, new Vec2(50, 0));
    b2.shapes.add(new Circle(10));
    b2.velocity = new Vec2(500, 0);
    b2.space = space;

    const joint = new PivotJoint(b1, b2, new Vec2(25, 0), new Vec2(-25, 0));
    joint.breakUnderForce = true;
    joint.maxForce = 1;
    (joint.cbTypes as any).add(constraintCb);
    joint.space = space;

    let breakFired = false;
    const listener = new ConstraintListener(CbEvent.BREAK, constraintCb, () => {
      breakFired = true;
    });
    listener.space = space;

    for (let i = 0; i < 60; i++) {
      space.step(1 / 60);
      if (breakFired) break;
    }
    expect(breakFired).toBe(true);
  });

  it("should fire SLEEP when constraint settles", () => {
    const space = new Space(new Vec2(0, 500));
    const constraintCb = new CbType();
    const floor = staticBox(0, 100);
    floor.space = space;

    const b1 = dynamicCircle(-10, 50);
    b1.space = space;
    const b2 = dynamicCircle(10, 50);
    b2.space = space;

    const joint = new DistanceJoint(b1, b2, new Vec2(0, 0), new Vec2(0, 0), 15, 25);
    (joint.cbTypes as any).add(constraintCb);
    joint.space = space;

    let sleepFired = false;
    const listener = new ConstraintListener(CbEvent.SLEEP, constraintCb, () => {
      sleepFired = true;
    });
    listener.space = space;

    // Let everything settle
    step(space, 300);
    expect(sleepFired).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// 5. Multiple listeners on the same space
// ---------------------------------------------------------------------------
describe("Callback integration — multiple listeners", () => {
  it("should fire multiple listeners for the same event", () => {
    const space = new Space(new Vec2(0, 500));
    const floor = staticBox(0, 100);
    floor.space = space;
    const ball = dynamicCircle(0, 50, 10);
    ball.space = space;

    let count1 = 0;
    let count2 = 0;

    const l1 = new InteractionListener(
      CbEvent.BEGIN,
      InteractionType.COLLISION,
      CbType.ANY_BODY,
      CbType.ANY_BODY,
      () => {
        count1++;
      },
    );
    l1.space = space;

    const l2 = new InteractionListener(
      CbEvent.BEGIN,
      InteractionType.COLLISION,
      CbType.ANY_BODY,
      CbType.ANY_BODY,
      () => {
        count2++;
      },
    );
    l2.space = space;

    step(space, 60);
    expect(count1).toBeGreaterThan(0);
    expect(count2).toBeGreaterThan(0);
  });

  it("should track interaction order with BEGIN and ONGOING", () => {
    const space = new Space(new Vec2(0, 500));
    const floor = staticBox(0, 100);
    floor.space = space;
    const ball = dynamicCircle(0, 50, 10);
    ball.space = space;

    const events: string[] = [];

    const l1 = new InteractionListener(
      CbEvent.BEGIN,
      InteractionType.COLLISION,
      CbType.ANY_BODY,
      CbType.ANY_BODY,
      () => {
        events.push("begin");
      },
    );
    l1.space = space;

    const l2 = new InteractionListener(
      CbEvent.ONGOING,
      InteractionType.COLLISION,
      CbType.ANY_BODY,
      CbType.ANY_BODY,
      () => {
        events.push("ongoing");
      },
    );
    l2.space = space;

    step(space, 60);

    // BEGIN should appear before ONGOING
    const firstBegin = events.indexOf("begin");
    const firstOngoing = events.indexOf("ongoing");
    expect(firstBegin).toBeLessThan(firstOngoing);
  });

  it("should allow removing a listener mid-simulation", () => {
    const space = new Space(new Vec2(0, 500));
    const floor = staticBox(0, 100);
    floor.space = space;
    const ball = dynamicCircle(0, 50, 10);
    ball.space = space;

    let count = 0;
    const listener = new InteractionListener(
      CbEvent.ONGOING,
      InteractionType.COLLISION,
      CbType.ANY_BODY,
      CbType.ANY_BODY,
      () => {
        count++;
      },
    );
    listener.space = space;

    step(space, 30);
    const countBefore = count;
    listener.space = null; // Remove listener
    step(space, 30);

    // Count should not increase much after removal
    expect(count).toBe(countBefore);
  });
});
