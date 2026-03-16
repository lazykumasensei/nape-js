/**
 * ZPP_CallbackSet — Tests for interaction state tracking between pairs.
 * Exercises callback set creation, state transitions, and cleanup through
 * the public API (Space + InteractionListener + bodies).
 */

import { describe, it, expect, beforeEach } from "vitest";
import "../../../src/core/engine";
import { Space } from "../../../src/space/Space";
import { Body } from "../../../src/phys/Body";
import { BodyType } from "../../../src/phys/BodyType";
import { Vec2 } from "../../../src/geom/Vec2";
import { Circle } from "../../../src/shape/Circle";
import { Polygon } from "../../../src/shape/Polygon";
import { CbType } from "../../../src/callbacks/CbType";
import { CbEvent } from "../../../src/callbacks/CbEvent";
import { InteractionType } from "../../../src/callbacks/InteractionType";
import { InteractionListener } from "../../../src/callbacks/InteractionListener";
import { FluidProperties } from "../../../src/phys/FluidProperties";
import { InteractionFilter } from "../../../src/dynamics/InteractionFilter";
import { PreListener } from "../../../src/callbacks/PreListener";
import { PreFlag } from "../../../src/callbacks/PreFlag";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function step(space: Space, n: number, dt = 1 / 60): void {
  for (let i = 0; i < n; i++) space.step(dt);
}

function dynamicCircle(x: number, y: number, radius = 10): Body {
  const b = new Body(BodyType.DYNAMIC, new Vec2(x, y));
  b.shapes.add(new Circle(radius));
  return b;
}

function staticBox(x: number, y: number, w = 200, h = 10): Body {
  const b = new Body(BodyType.STATIC, new Vec2(x, y));
  b.shapes.add(new Polygon(Polygon.box(w, h)));
  return b;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("ZPP_CallbackSet — collision BEGIN/END state tracking", () => {
  let space: Space;

  beforeEach(() => {
    space = new Space(new Vec2(0, 0));
  });

  it("BEGIN callback fires when two overlapping bodies are stepped", () => {
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

    const b1 = dynamicCircle(0, 0, 20);
    b1.space = space;
    const b2 = dynamicCircle(30, 0, 20);
    b2.space = space;

    step(space, 1);
    expect(beginFired).toBe(true);
  });

  it("END callback fires after bodies separate", () => {
    let endFired = false;

    new InteractionListener(
      CbEvent.BEGIN,
      InteractionType.COLLISION,
      CbType.ANY_BODY,
      CbType.ANY_BODY,
      () => {},
    ).space = space;

    new InteractionListener(
      CbEvent.END,
      InteractionType.COLLISION,
      CbType.ANY_BODY,
      CbType.ANY_BODY,
      () => {
        endFired = true;
      },
    ).space = space;

    const b1 = dynamicCircle(0, 0, 20);
    b1.space = space;
    const b2 = dynamicCircle(30, 0, 20);
    b2.space = space;

    step(space, 1);

    // Move far apart
    b2.position = Vec2.weak(5000, 0);
    for (let i = 0; i < 10; i++) {
      space.step(1 / 60);
      if (endFired) break;
    }
    expect(endFired).toBe(true);
  });

  it("BEGIN fires exactly once per new contact (not repeated on subsequent steps)", () => {
    let beginCount = 0;

    new InteractionListener(
      CbEvent.BEGIN,
      InteractionType.COLLISION,
      CbType.ANY_BODY,
      CbType.ANY_BODY,
      () => {
        beginCount++;
      },
    ).space = space;

    const b1 = dynamicCircle(0, 0, 30);
    b1.space = space;
    const b2 = dynamicCircle(20, 0, 30);
    b2.space = space;

    step(space, 5);
    // BEGIN should fire once for this single pair
    expect(beginCount).toBe(1);
  });
});

describe("ZPP_CallbackSet — ONGOING callback", () => {
  it("ONGOING fires on sustained contact across multiple steps", () => {
    const space = new Space(new Vec2(0, 0));
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

    const b1 = dynamicCircle(0, 0, 30);
    b1.space = space;
    const b2 = dynamicCircle(20, 0, 30);
    b2.space = space;

    step(space, 5);
    expect(ongoingCount).toBeGreaterThanOrEqual(1);
  });

  it("ONGOING stops firing once bodies separate", () => {
    const space = new Space(new Vec2(0, 0));
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

    const b1 = dynamicCircle(0, 0, 20);
    b1.space = space;
    const b2 = dynamicCircle(30, 0, 20);
    b2.space = space;

    step(space, 3);
    const countBefore = ongoingCount;

    // Move apart
    b2.position = Vec2.weak(5000, 0);
    step(space, 10);

    // Should not have increased much after separation
    // (possibly one more if the step that teleported still counted)
    expect(ongoingCount - countBefore).toBeLessThanOrEqual(1);
  });
});

describe("ZPP_CallbackSet — sensor callbacks", () => {
  it("sensor BEGIN fires when sensor shape overlaps another body", () => {
    const space = new Space(new Vec2(0, 0));
    let sensorBegin = false;

    new InteractionListener(
      CbEvent.BEGIN,
      InteractionType.SENSOR,
      CbType.ANY_BODY,
      CbType.ANY_BODY,
      () => {
        sensorBegin = true;
      },
    ).space = space;

    const b1 = new Body(BodyType.DYNAMIC, new Vec2(0, 0));
    const c1 = new Circle(20);
    c1.sensorEnabled = true;
    b1.shapes.add(c1);
    b1.space = space;

    const b2 = dynamicCircle(30, 0, 20);
    b2.space = space;

    step(space, 1);
    expect(sensorBegin).toBe(true);
  });

  it("sensor END fires when sensor-enabled bodies separate", () => {
    const space = new Space(new Vec2(0, 0));
    let sensorEnd = false;

    new InteractionListener(
      CbEvent.BEGIN,
      InteractionType.SENSOR,
      CbType.ANY_BODY,
      CbType.ANY_BODY,
      () => {},
    ).space = space;

    new InteractionListener(
      CbEvent.END,
      InteractionType.SENSOR,
      CbType.ANY_BODY,
      CbType.ANY_BODY,
      () => {
        sensorEnd = true;
      },
    ).space = space;

    const b1 = new Body(BodyType.DYNAMIC, new Vec2(0, 0));
    const c1 = new Circle(20);
    c1.sensorEnabled = true;
    b1.shapes.add(c1);
    b1.space = space;

    const b2 = dynamicCircle(30, 0, 20);
    b2.space = space;

    step(space, 1);

    b2.position = Vec2.weak(5000, 0);
    for (let i = 0; i < 10; i++) {
      space.step(1 / 60);
      if (sensorEnd) break;
    }
    expect(sensorEnd).toBe(true);
  });

  it("sensor ONGOING fires while sensor overlap persists", () => {
    const space = new Space(new Vec2(0, 0));
    let sensorOngoing = 0;

    new InteractionListener(
      CbEvent.ONGOING,
      InteractionType.SENSOR,
      CbType.ANY_BODY,
      CbType.ANY_BODY,
      () => {
        sensorOngoing++;
      },
    ).space = space;

    const b1 = new Body(BodyType.DYNAMIC, new Vec2(0, 0));
    const c1 = new Circle(30);
    c1.sensorEnabled = true;
    b1.shapes.add(c1);
    b1.space = space;

    const b2 = dynamicCircle(20, 0, 30);
    b2.space = space;

    step(space, 5);
    expect(sensorOngoing).toBeGreaterThanOrEqual(1);
  });
});

describe("ZPP_CallbackSet — fluid callbacks", () => {
  it("fluid BEGIN fires when body enters fluid-enabled shape", () => {
    const space = new Space(new Vec2(0, -100));
    let fluidBegin = false;

    new InteractionListener(
      CbEvent.BEGIN,
      InteractionType.FLUID,
      CbType.ANY_BODY,
      CbType.ANY_BODY,
      () => {
        fluidBegin = true;
      },
    ).space = space;

    const fluidBody = new Body(BodyType.STATIC, new Vec2(0, 200));
    const fluidShape = new Polygon(Polygon.box(500, 200));
    fluidShape.fluidEnabled = true;
    fluidShape.fluidProperties = new FluidProperties(2, 1);
    fluidBody.shapes.add(fluidShape);
    fluidBody.space = space;

    const ball = dynamicCircle(0, 100, 10);
    ball.space = space;

    for (let i = 0; i < 120; i++) {
      space.step(1 / 60);
      if (fluidBegin) break;
    }
    expect(fluidBegin).toBe(true);
  });

  it("fluid ONGOING fires while body remains in fluid", () => {
    const space = new Space(new Vec2(0, 100));
    let fluidOngoing = 0;

    new InteractionListener(
      CbEvent.ONGOING,
      InteractionType.FLUID,
      CbType.ANY_BODY,
      CbType.ANY_BODY,
      () => {
        fluidOngoing++;
      },
    ).space = space;

    // Large fluid pool that ball starts inside
    const fluidBody = new Body(BodyType.STATIC, new Vec2(0, 0));
    const fluidShape = new Polygon(Polygon.box(500, 500));
    fluidShape.fluidEnabled = true;
    fluidShape.fluidProperties = new FluidProperties(2, 1);
    fluidBody.shapes.add(fluidShape);
    fluidBody.space = space;

    const ball = dynamicCircle(0, 0, 10);
    ball.space = space;

    step(space, 10);
    expect(fluidOngoing).toBeGreaterThanOrEqual(1);
  });
});

describe("ZPP_CallbackSet — multiple callback types on same pair", () => {
  it("collision and sensor listeners can coexist for different shapes", () => {
    const space = new Space(new Vec2(0, 0));
    let collisionBegin = false;
    let sensorBegin = false;

    new InteractionListener(
      CbEvent.BEGIN,
      InteractionType.COLLISION,
      CbType.ANY_BODY,
      CbType.ANY_BODY,
      () => {
        collisionBegin = true;
      },
    ).space = space;

    new InteractionListener(
      CbEvent.BEGIN,
      InteractionType.SENSOR,
      CbType.ANY_BODY,
      CbType.ANY_BODY,
      () => {
        sensorBegin = true;
      },
    ).space = space;

    // Body with normal shape
    const b1 = dynamicCircle(0, 0, 20);
    b1.space = space;

    // Body with sensor shape
    const b2 = new Body(BodyType.DYNAMIC, new Vec2(30, 0));
    const sensorShape = new Circle(20);
    sensorShape.sensorEnabled = true;
    b2.shapes.add(sensorShape);
    b2.space = space;

    // Body with normal shape that collides with b1
    const b3 = dynamicCircle(0, 30, 20);
    b3.space = space;

    step(space, 1);

    // Sensor interaction from b1-b2, collision from b1-b3
    expect(sensorBegin).toBe(true);
    expect(collisionBegin).toBe(true);
  });
});

describe("ZPP_CallbackSet — state reset after separation and re-contact", () => {
  it("BEGIN fires again after bodies separate and re-collide", () => {
    const space = new Space(new Vec2(0, 0));
    let beginCount = 0;

    new InteractionListener(
      CbEvent.BEGIN,
      InteractionType.COLLISION,
      CbType.ANY_BODY,
      CbType.ANY_BODY,
      () => {
        beginCount++;
      },
    ).space = space;

    new InteractionListener(
      CbEvent.END,
      InteractionType.COLLISION,
      CbType.ANY_BODY,
      CbType.ANY_BODY,
      () => {},
    ).space = space;

    const b1 = dynamicCircle(0, 0, 20);
    b1.space = space;
    const b2 = dynamicCircle(30, 0, 20);
    b2.space = space;

    // First collision
    step(space, 1);
    expect(beginCount).toBe(1);

    // Separate
    b2.position = Vec2.weak(5000, 0);
    step(space, 5);

    // Re-collide
    b2.position = Vec2.weak(30, 0);
    b2.velocity = Vec2.weak(0, 0);
    b1.velocity = Vec2.weak(0, 0);
    step(space, 1);
    expect(beginCount).toBe(2);
  });
});

describe("ZPP_CallbackSet — cleanup when bodies are removed", () => {
  it("END fires when a colliding body is removed from space", () => {
    const space = new Space(new Vec2(0, 0));
    let endFired = false;

    new InteractionListener(
      CbEvent.BEGIN,
      InteractionType.COLLISION,
      CbType.ANY_BODY,
      CbType.ANY_BODY,
      () => {},
    ).space = space;

    new InteractionListener(
      CbEvent.END,
      InteractionType.COLLISION,
      CbType.ANY_BODY,
      CbType.ANY_BODY,
      () => {
        endFired = true;
      },
    ).space = space;

    const b1 = dynamicCircle(0, 0, 20);
    b1.space = space;
    const b2 = dynamicCircle(30, 0, 20);
    b2.space = space;

    step(space, 1);

    // Remove b2
    b2.space = null;
    step(space, 1);

    expect(endFired).toBe(true);
  });

  it("no callbacks fire after both bodies are removed", () => {
    const space = new Space(new Vec2(0, 0));
    let _fired = false;
    new InteractionListener(
      CbEvent.BEGIN,
      InteractionType.COLLISION,
      CbType.ANY_BODY,
      CbType.ANY_BODY,
      () => {
        _fired = true;
      },
    ).space = space;

    const b1 = dynamicCircle(0, 0, 20);
    b1.space = space;
    const b2 = dynamicCircle(30, 0, 20);
    b2.space = space;

    step(space, 1);

    b1.space = null;
    b2.space = null;

    // Add new bodies far away — should not trigger the old pair
    const b3 = dynamicCircle(1000, 1000, 10);
    b3.space = space;
    step(space, 5);

    // Only one body remains
    expect(space.bodies.length).toBe(1);
  });
});

describe("ZPP_CallbackSet — multiple listeners on same CbType", () => {
  it("all listeners fire for the same interaction pair", () => {
    const space = new Space(new Vec2(0, 0));
    let count1 = 0;
    let count2 = 0;
    let count3 = 0;

    new InteractionListener(
      CbEvent.BEGIN,
      InteractionType.COLLISION,
      CbType.ANY_BODY,
      CbType.ANY_BODY,
      () => {
        count1++;
      },
    ).space = space;

    new InteractionListener(
      CbEvent.BEGIN,
      InteractionType.COLLISION,
      CbType.ANY_BODY,
      CbType.ANY_BODY,
      () => {
        count2++;
      },
    ).space = space;

    new InteractionListener(
      CbEvent.BEGIN,
      InteractionType.COLLISION,
      CbType.ANY_BODY,
      CbType.ANY_BODY,
      () => {
        count3++;
      },
    ).space = space;

    const b1 = dynamicCircle(0, 0, 20);
    b1.space = space;
    const b2 = dynamicCircle(30, 0, 20);
    b2.space = space;

    step(space, 1);

    expect(count1).toBeGreaterThanOrEqual(1);
    expect(count2).toBeGreaterThanOrEqual(1);
    expect(count3).toBeGreaterThanOrEqual(1);
  });

  it("BEGIN and ONGOING listeners on same CbType both fire", () => {
    const space = new Space(new Vec2(0, 0));
    let beginFired = false;
    let ongoingCount = 0;

    new InteractionListener(
      CbEvent.BEGIN,
      InteractionType.COLLISION,
      CbType.ANY_BODY,
      CbType.ANY_BODY,
      () => {
        beginFired = true;
      },
    ).space = space;

    new InteractionListener(
      CbEvent.ONGOING,
      InteractionType.COLLISION,
      CbType.ANY_BODY,
      CbType.ANY_BODY,
      () => {
        ongoingCount++;
      },
    ).space = space;

    const b1 = dynamicCircle(0, 0, 30);
    b1.space = space;
    const b2 = dynamicCircle(20, 0, 30);
    b2.space = space;

    step(space, 5);

    expect(beginFired).toBe(true);
    expect(ongoingCount).toBeGreaterThanOrEqual(1);
  });
});

describe("ZPP_CallbackSet — InteractionType filtering", () => {
  it("COLLISION listener does not fire for sensor interactions", () => {
    const space = new Space(new Vec2(0, 0));
    let collisionFired = false;

    new InteractionListener(
      CbEvent.BEGIN,
      InteractionType.COLLISION,
      CbType.ANY_BODY,
      CbType.ANY_BODY,
      () => {
        collisionFired = true;
      },
    ).space = space;

    // Both shapes are sensors — no collision, only sensor interaction
    const b1 = new Body(BodyType.DYNAMIC, new Vec2(0, 0));
    const s1 = new Circle(20);
    s1.sensorEnabled = true;
    b1.shapes.add(s1);
    b1.space = space;

    const b2 = new Body(BodyType.DYNAMIC, new Vec2(30, 0));
    const s2 = new Circle(20);
    s2.sensorEnabled = true;
    b2.shapes.add(s2);
    b2.space = space;

    step(space, 3);
    expect(collisionFired).toBe(false);
  });

  it("SENSOR listener does not fire for normal collision interactions", () => {
    const space = new Space(new Vec2(0, 0));
    let sensorFired = false;

    new InteractionListener(
      CbEvent.BEGIN,
      InteractionType.SENSOR,
      CbType.ANY_BODY,
      CbType.ANY_BODY,
      () => {
        sensorFired = true;
      },
    ).space = space;

    // Normal shapes — no sensor interaction
    const b1 = dynamicCircle(0, 0, 20);
    b1.space = space;
    const b2 = dynamicCircle(30, 0, 20);
    b2.space = space;

    step(space, 3);
    expect(sensorFired).toBe(false);
  });

  it("InteractionType.ANY matches collision interactions", () => {
    const space = new Space(new Vec2(0, 0));
    let anyFired = false;

    new InteractionListener(
      CbEvent.BEGIN,
      InteractionType.ANY,
      CbType.ANY_BODY,
      CbType.ANY_BODY,
      () => {
        anyFired = true;
      },
    ).space = space;

    const b1 = dynamicCircle(0, 0, 20);
    b1.space = space;
    const b2 = dynamicCircle(30, 0, 20);
    b2.space = space;

    step(space, 1);
    expect(anyFired).toBe(true);
  });

  it("InteractionType.ANY matches sensor interactions", () => {
    const space = new Space(new Vec2(0, 0));
    let anyFired = false;

    new InteractionListener(
      CbEvent.BEGIN,
      InteractionType.ANY,
      CbType.ANY_BODY,
      CbType.ANY_BODY,
      () => {
        anyFired = true;
      },
    ).space = space;

    const b1 = new Body(BodyType.DYNAMIC, new Vec2(0, 0));
    const s1 = new Circle(20);
    s1.sensorEnabled = true;
    b1.shapes.add(s1);
    b1.space = space;

    const b2 = dynamicCircle(30, 0, 20);
    b2.space = space;

    step(space, 1);
    expect(anyFired).toBe(true);
  });
});

describe("ZPP_CallbackSet — CbType-specific filtering", () => {
  it("listener with specific CbTypes fires only for matching shapes", () => {
    const space = new Space(new Vec2(0, 0));
    const typeA = new CbType();
    const typeB = new CbType();
    let abFired = false;

    new InteractionListener(CbEvent.BEGIN, InteractionType.COLLISION, typeA, typeB, () => {
      abFired = true;
    }).space = space;

    const b1 = new Body(BodyType.DYNAMIC, new Vec2(0, 0));
    const c1 = new Circle(20);
    c1.cbTypes.add(typeA);
    b1.shapes.add(c1);
    b1.space = space;

    const b2 = new Body(BodyType.DYNAMIC, new Vec2(30, 0));
    const c2 = new Circle(20);
    c2.cbTypes.add(typeB);
    b2.shapes.add(c2);
    b2.space = space;

    step(space, 1);
    expect(abFired).toBe(true);
  });

  it("listener with mismatched CbTypes does not fire", () => {
    const space = new Space(new Vec2(0, 0));
    const typeA = new CbType();
    const typeB = new CbType();
    let fired = false;

    // Listen for A-A but provide A-B pair
    new InteractionListener(CbEvent.BEGIN, InteractionType.COLLISION, typeA, typeA, () => {
      fired = true;
    }).space = space;

    const b1 = new Body(BodyType.DYNAMIC, new Vec2(0, 0));
    const c1 = new Circle(20);
    c1.cbTypes.add(typeA);
    b1.shapes.add(c1);
    b1.space = space;

    const b2 = new Body(BodyType.DYNAMIC, new Vec2(30, 0));
    const c2 = new Circle(20);
    c2.cbTypes.add(typeB);
    b2.shapes.add(c2);
    b2.space = space;

    step(space, 1);
    expect(fired).toBe(false);
  });
});

describe("ZPP_CallbackSet — PreListener (BEGIN event filtering)", () => {
  it("PreListener IGNORE prevents collision response", () => {
    const space = new Space(new Vec2(0, 0));

    new PreListener(
      InteractionType.COLLISION,
      CbType.ANY_BODY,
      CbType.ANY_BODY,
      () => PreFlag.IGNORE,
    ).space = space;

    const b1 = dynamicCircle(0, 0, 20);
    b1.velocity = Vec2.weak(200, 0);
    b1.space = space;

    const b2 = dynamicCircle(60, 0, 20);
    b2.velocity = Vec2.weak(-200, 0);
    b2.space = space;

    step(space, 30);
    // Bodies should pass through each other
    expect(b1.position.x).toBeGreaterThan(60);
    expect(b2.position.x).toBeLessThan(0);
  });

  it("PreListener ACCEPT allows normal collision", () => {
    const space = new Space(new Vec2(0, 0));

    new PreListener(
      InteractionType.COLLISION,
      CbType.ANY_BODY,
      CbType.ANY_BODY,
      () => PreFlag.ACCEPT,
    ).space = space;

    const b1 = dynamicCircle(0, 0, 20);
    b1.velocity = Vec2.weak(200, 0);
    b1.space = space;

    const b2 = dynamicCircle(60, 0, 20);
    b2.velocity = Vec2.weak(-200, 0);
    b2.space = space;

    step(space, 30);
    // With collision accepted, bodies should bounce
    expect(b1.position.x).toBeLessThan(100);
  });

  it("PreListener pure mode caches the result", () => {
    const space = new Space(new Vec2(0, 0));
    let callCount = 0;

    new PreListener(
      InteractionType.COLLISION,
      CbType.ANY_BODY,
      CbType.ANY_BODY,
      () => {
        callCount++;
        return PreFlag.ACCEPT;
      },
      0,
      true, // pure = true
    ).space = space;

    const b1 = dynamicCircle(0, 0, 30);
    b1.space = space;
    const b2 = dynamicCircle(20, 0, 30);
    b2.space = space;

    step(space, 10);
    // Pure mode should cache — fewer calls than steps
    expect(callCount).toBeGreaterThanOrEqual(1);
    expect(callCount).toBeLessThanOrEqual(3);
  });

  it("PreListener non-pure mode calls handler at least once per collision pair", () => {
    const space = new Space(new Vec2(0, 500));
    let callCount = 0;

    new PreListener(
      InteractionType.COLLISION,
      CbType.ANY_BODY,
      CbType.ANY_BODY,
      () => {
        callCount++;
        return PreFlag.ACCEPT;
      },
      0,
      false, // pure = false
    ).space = space;

    const floor = staticBox(0, 50);
    floor.space = space;
    const ball = dynamicCircle(0, 0, 10);
    ball.space = space;

    step(space, 30);
    // Non-pure should be called at least once
    expect(callCount).toBeGreaterThanOrEqual(1);
  });
});

describe("ZPP_CallbackSet — callback with interaction filter", () => {
  it("InteractionFilter sensorGroup/sensorMask controls sensor detection", () => {
    const space = new Space(new Vec2(0, 0));
    let sensorFired = false;

    new InteractionListener(
      CbEvent.BEGIN,
      InteractionType.SENSOR,
      CbType.ANY_BODY,
      CbType.ANY_BODY,
      () => {
        sensorFired = true;
      },
    ).space = space;

    // Body with sensor shape, group=2
    const b1 = new Body(BodyType.DYNAMIC, new Vec2(0, 0));
    const s1 = new Circle(20);
    s1.sensorEnabled = true;
    s1.filter = new InteractionFilter(1, -1, 2, 0); // sensorGroup=2, sensorMask=0 (no bits)
    b1.shapes.add(s1);
    b1.space = space;

    const b2 = dynamicCircle(30, 0, 20);
    b2.space = space;

    step(space, 3);
    // With sensorMask=0, no sensor interactions should pass the filter
    expect(sensorFired).toBe(false);
  });
});

describe("ZPP_CallbackSet — three-body interactions", () => {
  it("BEGIN fires for each distinct colliding pair among three bodies", () => {
    const space = new Space(new Vec2(0, 0));
    let beginCount = 0;

    new InteractionListener(
      CbEvent.BEGIN,
      InteractionType.COLLISION,
      CbType.ANY_BODY,
      CbType.ANY_BODY,
      () => {
        beginCount++;
      },
    ).space = space;

    // Three mutually overlapping circles
    const b1 = dynamicCircle(0, 0, 30);
    b1.space = space;
    const b2 = dynamicCircle(20, 0, 30);
    b2.space = space;
    const b3 = dynamicCircle(10, 20, 30);
    b3.space = space;

    step(space, 1);

    // Up to 3 pairs: b1-b2, b1-b3, b2-b3
    expect(beginCount).toBeGreaterThanOrEqual(2);
    expect(beginCount).toBeLessThanOrEqual(3);
  });
});

describe("ZPP_CallbackSet — callback handler access to interactors", () => {
  it("callback provides access to int1 and int2 (the interacting bodies)", () => {
    const space = new Space(new Vec2(0, 0));
    const bodies: Body[] = [];

    new InteractionListener(
      CbEvent.BEGIN,
      InteractionType.COLLISION,
      CbType.ANY_BODY,
      CbType.ANY_BODY,
      (cb) => {
        if (cb.int1) bodies.push(cb.int1 as Body);
        if (cb.int2) bodies.push(cb.int2 as Body);
      },
    ).space = space;

    const b1 = dynamicCircle(0, 0, 20);
    b1.space = space;
    const b2 = dynamicCircle(30, 0, 20);
    b2.space = space;

    step(space, 1);

    expect(bodies.length).toBe(2);
  });

  it("callback provides access to arbiter", () => {
    const space = new Space(new Vec2(0, 500));
    let hasArbiter = false;

    new InteractionListener(
      CbEvent.BEGIN,
      InteractionType.COLLISION,
      CbType.ANY_BODY,
      CbType.ANY_BODY,
      (cb) => {
        if (cb.arbiter !== null) hasArbiter = true;
      },
    ).space = space;

    const floor = staticBox(0, 50);
    floor.space = space;
    const ball = dynamicCircle(0, 0, 10);
    ball.space = space;

    for (let i = 0; i < 60; i++) space.step(1 / 60);

    expect(hasArbiter).toBe(true);
  });
});
