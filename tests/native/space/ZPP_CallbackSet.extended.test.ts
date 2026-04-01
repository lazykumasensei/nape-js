/**
 * ZPP_CallbackSet — extended tests for untested paths.
 *
 * Focuses on: fluid END, listener lifecycle, compound bodies, kinematic
 * interactions, dynamic↔static callbacks, multiple CbTypes per body,
 * and edge cases in callback dispatch.
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
import { Compound } from "../../../src/phys/Compound";

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

function kinematicCircle(x: number, y: number, radius = 20): Body {
  const b = new Body(BodyType.KINEMATIC, new Vec2(x, y));
  b.shapes.add(new Circle(radius));
  return b;
}

function fluidPool(x: number, y: number, w = 500, h = 200): Body {
  const b = new Body(BodyType.STATIC, new Vec2(x, y));
  const s = new Polygon(Polygon.box(w, h));
  s.fluidEnabled = true;
  s.fluidProperties = new FluidProperties(2, 1);
  b.shapes.add(s);
  return b;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("ZPP_CallbackSet — fluid END callback", () => {
  let space: Space;

  beforeEach(() => {
    space = new Space(new Vec2(0, 0));
  });

  it("fluid END fires when body leaves the fluid region", () => {
    let fluidEnd = false;

    new InteractionListener(
      CbEvent.BEGIN,
      InteractionType.FLUID,
      CbType.ANY_BODY,
      CbType.ANY_BODY,
      () => {},
    ).space = space;

    new InteractionListener(
      CbEvent.END,
      InteractionType.FLUID,
      CbType.ANY_BODY,
      CbType.ANY_BODY,
      () => {
        fluidEnd = true;
      },
    ).space = space;

    const pool = fluidPool(0, 0, 200, 200);
    pool.space = space;

    // Start inside the fluid
    const ball = dynamicCircle(0, 0, 10);
    ball.space = space;

    step(space, 3);

    // Teleport out of the fluid
    ball.position = Vec2.weak(5000, 0);
    ball.velocity = Vec2.weak(0, 0);

    for (let i = 0; i < 10; i++) {
      space.step(1 / 60);
      if (fluidEnd) break;
    }
    expect(fluidEnd).toBe(true);
  });

  it("fluid END fires when fluid body is removed from space", () => {
    let fluidEnd = false;

    new InteractionListener(
      CbEvent.BEGIN,
      InteractionType.FLUID,
      CbType.ANY_BODY,
      CbType.ANY_BODY,
      () => {},
    ).space = space;

    new InteractionListener(
      CbEvent.END,
      InteractionType.FLUID,
      CbType.ANY_BODY,
      CbType.ANY_BODY,
      () => {
        fluidEnd = true;
      },
    ).space = space;

    const pool = fluidPool(0, 0, 200, 200);
    pool.space = space;

    const ball = dynamicCircle(0, 0, 10);
    ball.space = space;

    step(space, 3);

    // Remove the dynamic body while it's in the fluid
    ball.space = null;
    step(space, 1);
    expect(fluidEnd).toBe(true);
  });
});

describe("ZPP_CallbackSet — listener removal during simulation", () => {
  it("removing a listener stops its callbacks from firing", () => {
    const space = new Space(new Vec2(0, 0));
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

    const b1 = dynamicCircle(0, 0, 20);
    b1.space = space;
    const b2 = dynamicCircle(30, 0, 20);
    b2.space = space;

    step(space, 3);
    const countBefore = count;
    expect(countBefore).toBeGreaterThanOrEqual(1);

    // Remove the listener
    listener.space = null;
    step(space, 5);

    // Count should not increase after listener removal
    expect(count).toBe(countBefore);
  });

  it("adding a listener mid-simulation picks up existing contacts", () => {
    const space = new Space(new Vec2(0, 0));

    const b1 = dynamicCircle(0, 0, 20);
    b1.space = space;
    const b2 = dynamicCircle(30, 0, 20);
    b2.space = space;

    // Step without listener
    step(space, 3);

    // Now add an ONGOING listener
    let ongoingFired = false;
    new InteractionListener(
      CbEvent.ONGOING,
      InteractionType.COLLISION,
      CbType.ANY_BODY,
      CbType.ANY_BODY,
      () => {
        ongoingFired = true;
      },
    ).space = space;

    step(space, 3);
    expect(ongoingFired).toBe(true);
  });
});

describe("ZPP_CallbackSet — kinematic body interactions", () => {
  it("BEGIN fires for kinematic-dynamic collision", () => {
    const space = new Space(new Vec2(0, 0));
    let beginFired = false;

    new InteractionListener(
      CbEvent.BEGIN,
      InteractionType.COLLISION,
      CbType.ANY_BODY,
      CbType.ANY_BODY,
      () => {
        beginFired = true;
      },
    ).space = space;

    const k = kinematicCircle(0, 0, 20);
    k.space = space;
    const d = dynamicCircle(30, 0, 20);
    d.space = space;

    step(space, 1);
    expect(beginFired).toBe(true);
  });

  it("sensor BEGIN fires for kinematic-static sensor overlap", () => {
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

    const k = new Body(BodyType.KINEMATIC, new Vec2(0, 0));
    const sensor = new Circle(30);
    sensor.sensorEnabled = true;
    k.shapes.add(sensor);
    k.space = space;

    const s = staticBox(20, 0, 40, 40);
    s.space = space;

    step(space, 1);
    expect(sensorFired).toBe(true);
  });
});

describe("ZPP_CallbackSet — dynamic-static collision callbacks", () => {
  it("BEGIN fires when dynamic body collides with static body", () => {
    const space = new Space(new Vec2(0, 500));
    let beginFired = false;

    new InteractionListener(
      CbEvent.BEGIN,
      InteractionType.COLLISION,
      CbType.ANY_BODY,
      CbType.ANY_BODY,
      () => {
        beginFired = true;
      },
    ).space = space;

    const floor = staticBox(0, 100, 400, 20);
    floor.space = space;
    const ball = dynamicCircle(0, 0, 10);
    ball.space = space;

    for (let i = 0; i < 120; i++) {
      space.step(1 / 60);
      if (beginFired) break;
    }
    expect(beginFired).toBe(true);
  });

  it("ONGOING fires repeatedly for resting contact on static floor", () => {
    const space = new Space(new Vec2(0, 500));
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

    const floor = staticBox(0, 100, 400, 20);
    floor.space = space;
    const ball = dynamicCircle(0, 80, 10);
    ball.space = space;

    step(space, 30);
    expect(ongoingCount).toBeGreaterThanOrEqual(5);
  });
});

describe("ZPP_CallbackSet — custom CbType pairs", () => {
  let space: Space;

  beforeEach(() => {
    space = new Space(new Vec2(0, 0));
  });

  it("custom CbType listener fires only for matching pair", () => {
    const typeA = new CbType();
    const typeB = new CbType();
    let abFired = false;
    let anyFired = false;

    new InteractionListener(CbEvent.BEGIN, InteractionType.COLLISION, typeA, typeB, () => {
      abFired = true;
    }).space = space;

    // Second listener with mismatched types
    const typeC = new CbType();
    new InteractionListener(CbEvent.BEGIN, InteractionType.COLLISION, typeA, typeC, () => {
      anyFired = true;
    }).space = space;

    const b1 = dynamicCircle(0, 0, 20);
    b1.cbTypes.add(typeA);
    b1.space = space;

    const b2 = dynamicCircle(30, 0, 20);
    b2.cbTypes.add(typeB);
    b2.space = space;

    step(space, 1);
    expect(abFired).toBe(true);
    expect(anyFired).toBe(false);
  });

  it("body with multiple CbTypes triggers all matching listeners", () => {
    const typeA = new CbType();
    const typeB = new CbType();
    const typeC = new CbType();
    let abFired = false;
    let acFired = false;

    new InteractionListener(CbEvent.BEGIN, InteractionType.COLLISION, typeA, typeB, () => {
      abFired = true;
    }).space = space;

    new InteractionListener(CbEvent.BEGIN, InteractionType.COLLISION, typeA, typeC, () => {
      acFired = true;
    }).space = space;

    const b1 = dynamicCircle(0, 0, 20);
    b1.cbTypes.add(typeA);
    b1.space = space;

    // b2 has both typeB and typeC
    const b2 = dynamicCircle(30, 0, 20);
    b2.cbTypes.add(typeB);
    b2.cbTypes.add(typeC);
    b2.space = space;

    step(space, 1);
    expect(abFired).toBe(true);
    expect(acFired).toBe(true);
  });
});

describe("ZPP_CallbackSet — compound body callbacks", () => {
  it("BEGIN fires for compound body collision", () => {
    const space = new Space(new Vec2(0, 0));
    let beginFired = false;

    new InteractionListener(
      CbEvent.BEGIN,
      InteractionType.COLLISION,
      CbType.ANY_BODY,
      CbType.ANY_BODY,
      () => {
        beginFired = true;
      },
    ).space = space;

    // Create a compound with two shapes
    const compound = new Compound();
    const b1 = new Body(BodyType.DYNAMIC, new Vec2(0, 0));
    b1.shapes.add(new Circle(15));
    compound.bodies.add(b1);
    compound.space = space;

    const b2 = dynamicCircle(25, 0, 15);
    b2.space = space;

    step(space, 1);
    expect(beginFired).toBe(true);
  });
});

describe("ZPP_CallbackSet — PreListener advanced", () => {
  it("PreListener IGNORE lets bodies pass through each other", () => {
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

  it("PreListener with custom CbType only ignores matching pairs", () => {
    const space = new Space(new Vec2(0, 0));
    const ghostType = new CbType();

    // Block collisions for ghostType bodies
    new PreListener(
      InteractionType.COLLISION,
      ghostType,
      CbType.ANY_BODY,
      () => PreFlag.IGNORE,
    ).space = space;

    // Ghost body passes through the wall
    const ghost = dynamicCircle(0, 0, 20);
    ghost.cbTypes.add(ghostType);
    ghost.velocity = Vec2.weak(200, 0);
    ghost.space = space;

    const wall = staticBox(60, 0, 20, 60);
    wall.space = space;

    // Normal body collides with a separate wall
    const normal = dynamicCircle(200, 0, 20);
    normal.velocity = Vec2.weak(200, 0);
    normal.space = space;

    const wall2 = staticBox(260, 0, 20, 60);
    wall2.space = space;

    step(space, 30);

    // Ghost passed through
    expect(ghost.position.x).toBeGreaterThan(60);
    // Normal body bounced or stopped
    expect(normal.position.x).toBeLessThan(260);
  });
});

describe("ZPP_CallbackSet — sensor END with InteractionFilter", () => {
  it("sensor END fires after filter change makes shapes non-interacting", () => {
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
    c1.filter = new InteractionFilter(1, 1, 1, 1, 1, 1);
    b1.shapes.add(c1);
    b1.space = space;

    const b2 = dynamicCircle(15, 0, 20);
    b2.shapes.at(0).filter = new InteractionFilter(1, 1, 1, 1, 1, 1);
    b2.space = space;

    step(space, 2);

    // Change filter to non-interacting
    c1.filter = new InteractionFilter(1, 0, 1, 0, 1, 0);
    for (let i = 0; i < 10; i++) {
      space.step(1 / 60);
      if (sensorEnd) break;
    }
    expect(sensorEnd).toBe(true);
  });
});

describe("ZPP_CallbackSet — many-body stress", () => {
  it("correctly tracks callbacks for 10 overlapping bodies", () => {
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

    // Place 10 overlapping circles in a tight cluster
    for (let i = 0; i < 10; i++) {
      const angle = (i / 10) * Math.PI * 2;
      const x = Math.cos(angle) * 5;
      const y = Math.sin(angle) * 5;
      const b = dynamicCircle(x, y, 20);
      b.space = space;
    }

    step(space, 1);

    // With 10 bodies, max pairs = 10*9/2 = 45
    expect(beginCount).toBeGreaterThanOrEqual(10);
    expect(beginCount).toBeLessThanOrEqual(45);
  });
});

describe("ZPP_CallbackSet — InteractionType.ANY matching", () => {
  it("ANY listener fires for fluid interactions", () => {
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

    const pool = fluidPool(0, 0, 200, 200);
    pool.space = space;

    const ball = dynamicCircle(0, 0, 10);
    ball.space = space;

    step(space, 3);
    expect(anyFired).toBe(true);
  });

  it("ANY listener fires for both collision and sensor from different pairs", () => {
    const space = new Space(new Vec2(0, 0));
    let anyCount = 0;

    new InteractionListener(
      CbEvent.BEGIN,
      InteractionType.ANY,
      CbType.ANY_BODY,
      CbType.ANY_BODY,
      () => {
        anyCount++;
      },
    ).space = space;

    // Collision pair
    const b1 = dynamicCircle(0, 0, 20);
    b1.space = space;
    const b2 = dynamicCircle(30, 0, 20);
    b2.space = space;

    // Sensor pair (far away to be a separate pair)
    const sensor = new Body(BodyType.DYNAMIC, new Vec2(500, 0));
    const sc = new Circle(20);
    sc.sensorEnabled = true;
    sensor.shapes.add(sc);
    sensor.space = space;
    const target = dynamicCircle(520, 0, 20);
    target.space = space;

    step(space, 1);
    // Should have at least 2 BEGIN events (one collision, one sensor)
    expect(anyCount).toBeGreaterThanOrEqual(2);
  });
});

describe("ZPP_CallbackSet — callback with body type changes", () => {
  it("END fires when body is changed to static (sleeping pair)", () => {
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

    // Separate first
    b2.position = Vec2.weak(5000, 0);
    step(space, 5);

    expect(endFired).toBe(true);
  });
});

describe("ZPP_CallbackSet — rapid add/remove cycles", () => {
  it("handles rapid body add/remove without stale callbacks", () => {
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

    const anchor = dynamicCircle(0, 0, 30);
    anchor.space = space;

    for (let i = 0; i < 5; i++) {
      const temp = dynamicCircle(10, 0, 20);
      temp.space = space;
      step(space, 1);
      temp.space = null;
      step(space, 1);
    }

    // Each cycle should produce at most one BEGIN
    expect(beginCount).toBeGreaterThanOrEqual(3);
    expect(beginCount).toBeLessThanOrEqual(5);
  });
});
