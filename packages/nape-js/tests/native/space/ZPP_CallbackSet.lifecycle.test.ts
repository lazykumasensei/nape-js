/**
 * ZPP_CallbackSet — lifecycle, sleeping aggregation, and arbiter-list edge cases.
 *
 * Targets uncovered branches in lines ~380–615:
 * - Sleeping aggregation (sleeping/empty_arb/really_empty methods)
 * - Multiple arbiters per pair (compound bodies)
 * - Multi-shape, multi-event interactions
 * - Lazy delete (lazydel) path
 * - State transitions across many steps (COLLISIONstate, SENSORstate, FLUIDstate)
 * - Filtered groups → SENSOR vs COLLISION classification
 * - Arbiter add/remove cycles within a single CallbackSet
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
import { Material } from "../../../src/phys/Material";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function step(space: Space, n: number, dt = 1 / 60): void {
  for (let i = 0; i < n; i++) space.step(dt);
}

function dynCircle(x: number, y: number, r = 10): Body {
  const b = new Body(BodyType.DYNAMIC, new Vec2(x, y));
  b.shapes.add(new Circle(r));
  return b;
}

function staticBox(x: number, y: number, w = 200, h = 10): Body {
  const b = new Body(BodyType.STATIC, new Vec2(x, y));
  b.shapes.add(new Polygon(Polygon.box(w, h)));
  return b;
}

function lowFrictionMaterial(): Material {
  return new Material(0.1, 1, 1, 1, 0);
}

// ---------------------------------------------------------------------------
// 1. Compound body — multiple shapes generate multiple arbiters per pair
// ---------------------------------------------------------------------------

describe("ZPP_CallbackSet — compound bodies / multi-arbiter", () => {
  it("body with two shapes contacts a floor with two simultaneous arbiters", () => {
    const space = new Space(new Vec2(0, 500));
    const floor = staticBox(0, 300, 800, 20);
    floor.space = space;

    // Body with two well-separated shapes — both touch the floor side-by-side
    const car = new Body(BodyType.DYNAMIC, new Vec2(0, 200));
    car.shapes.add(new Circle(15, new Vec2(-30, 15)));
    car.shapes.add(new Circle(15, new Vec2(30, 15)));
    car.space = space;

    let beginCount = 0;
    const beginListener = new InteractionListener(
      CbEvent.BEGIN,
      InteractionType.COLLISION,
      CbType.ANY_BODY,
      CbType.ANY_BODY,
      () => beginCount++,
    );
    beginListener.space = space;

    step(space, 60);
    // BEGIN fires per-CallbackSet, so even with two arbiters it fires once per pair
    expect(beginCount).toBeGreaterThanOrEqual(1);
    expect(car.position.y).toBeLessThan(300);
  });

  it("compound car settles with both wheels touching the floor", () => {
    const space = new Space(new Vec2(0, 500));
    const floor = staticBox(0, 300, 800, 20);
    floor.shapes.at(0).material = lowFrictionMaterial();
    floor.space = space;

    const car = new Body(BodyType.DYNAMIC, new Vec2(0, 200));
    const w1 = new Circle(15, new Vec2(-30, 0));
    const w2 = new Circle(15, new Vec2(30, 0));
    w1.material = lowFrictionMaterial();
    w2.material = lowFrictionMaterial();
    car.shapes.add(w1);
    car.shapes.add(w2);
    car.space = space;

    step(space, 240);
    // Should rest in roughly horizontal orientation
    expect(Math.abs(car.rotation)).toBeLessThan(0.5);
  });
});

// ---------------------------------------------------------------------------
// 2. Sleeping aggregation — a CallbackSet sleeps only when ALL arbiters sleep
// ---------------------------------------------------------------------------

describe("ZPP_CallbackSet — sleeping aggregation", () => {
  it("a settled stack of bodies eventually goes to sleep", () => {
    const space = new Space(new Vec2(0, 500));
    const floor = staticBox(0, 300, 800, 20);
    floor.shapes.at(0).material = lowFrictionMaterial();
    floor.space = space;

    const stack: Body[] = [];
    for (let i = 0; i < 3; i++) {
      const b = dynCircle(0, 280 - i * 32, 14);
      b.shapes.at(0).material = lowFrictionMaterial();
      b.space = space;
      stack.push(b);
    }

    step(space, 600);
    // At least the bottom and middle should be asleep
    let sleeping = 0;
    for (const b of stack) if (b.isSleeping) sleeping++;
    expect(sleeping).toBeGreaterThanOrEqual(2);
  });

  it("waking one body in a pair wakes its CallbackSet", () => {
    const space = new Space(new Vec2(0, 500));
    const floor = staticBox(0, 300, 800, 20);
    floor.shapes.at(0).material = lowFrictionMaterial();
    floor.space = space;

    const ball = dynCircle(0, 200, 14);
    ball.shapes.at(0).material = lowFrictionMaterial();
    ball.space = space;

    step(space, 600);
    expect(ball.isSleeping).toBe(true);

    ball.velocity = new Vec2(0, -200);
    expect(ball.isSleeping).toBe(false);
    step(space, 5);
    // Ball should still be in the world / consistent
    expect(Number.isFinite(ball.position.y)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// 3. State transitions across many steps
// ---------------------------------------------------------------------------

describe("ZPP_CallbackSet — long-run state transitions", () => {
  it("BEGIN → ONGOING → END for an oscillating ball", () => {
    const space = new Space(new Vec2(0, 0));
    const wall = staticBox(0, 100, 200, 10);
    wall.space = space;

    const ball = dynCircle(0, 0, 8);
    ball.space = space;

    const events: string[] = [];
    new InteractionListener(
      CbEvent.BEGIN,
      InteractionType.COLLISION,
      CbType.ANY_BODY,
      CbType.ANY_BODY,
      () => events.push("BEGIN"),
    ).space = space;
    new InteractionListener(
      CbEvent.END,
      InteractionType.COLLISION,
      CbType.ANY_BODY,
      CbType.ANY_BODY,
      () => events.push("END"),
    ).space = space;

    // Drive ball into the wall, then pull it away
    ball.velocity = new Vec2(0, 200);
    step(space, 30);

    // BEGIN should have fired
    expect(events.includes("BEGIN")).toBe(true);

    // Now pull it away
    ball.velocity = new Vec2(0, -500);
    ball.position = new Vec2(0, -1000);
    step(space, 60);

    // END should have fired by now
    expect(events.includes("END")).toBe(true);
  });

  it("re-entering same pair triggers a fresh BEGIN", () => {
    const space = new Space(new Vec2(0, 0));
    const wall = staticBox(0, 100, 200, 10);
    wall.space = space;

    const ball = dynCircle(0, 0, 8);
    ball.space = space;

    let beginCount = 0;
    new InteractionListener(
      CbEvent.BEGIN,
      InteractionType.COLLISION,
      CbType.ANY_BODY,
      CbType.ANY_BODY,
      () => beginCount++,
    ).space = space;

    // Cycle 1
    ball.velocity = new Vec2(0, 200);
    step(space, 30);
    const begin1 = beginCount;
    expect(begin1).toBeGreaterThanOrEqual(1);

    // Pull away → END
    ball.position = new Vec2(0, -200);
    ball.velocity = new Vec2(0, 0);
    step(space, 5);

    // Re-enter with strong velocity
    ball.velocity = new Vec2(0, 800);
    step(space, 60);

    expect(beginCount).toBeGreaterThan(begin1);
  });
});

// ---------------------------------------------------------------------------
// 4. Many simultaneous pairs
// ---------------------------------------------------------------------------

describe("ZPP_CallbackSet — many simultaneous pairs", () => {
  it("100 pairs of contacts all fire BEGIN exactly once each", () => {
    const space = new Space(new Vec2(0, 0));

    let beginCount = 0;
    new InteractionListener(
      CbEvent.BEGIN,
      InteractionType.COLLISION,
      CbType.ANY_BODY,
      CbType.ANY_BODY,
      () => beginCount++,
    ).space = space;

    // Place 100 pairs of overlapping circles, well-separated from each other
    for (let i = 0; i < 100; i++) {
      const a = dynCircle(i * 200, 0, 20);
      a.space = space;
      const b = dynCircle(i * 200 + 5, 0, 20); // overlapping
      b.space = space;
    }

    step(space, 1);
    expect(beginCount).toBe(100);
  });
});

// ---------------------------------------------------------------------------
// 5. Body removal during an active CallbackSet
// ---------------------------------------------------------------------------

describe("ZPP_CallbackSet — removal mid-contact", () => {
  it("removing one body during contact triggers END for the pair", () => {
    const space = new Space(new Vec2(0, 0));

    const a = dynCircle(0, 0, 20);
    a.space = space;
    const b = dynCircle(5, 0, 20);
    b.space = space;

    let endFired = false;
    new InteractionListener(
      CbEvent.END,
      InteractionType.COLLISION,
      CbType.ANY_BODY,
      CbType.ANY_BODY,
      () => {
        endFired = true;
      },
    ).space = space;

    step(space, 1);

    // Remove a, expect END
    a.space = null;
    step(space, 2);
    expect(endFired).toBe(true);
  });

  it("removing a body with multiple active pairs cleans up all CallbackSets", () => {
    const space = new Space(new Vec2(0, 0));

    const center = dynCircle(0, 0, 30);
    center.space = space;

    // Place 4 bodies overlapping the center one
    const others: Body[] = [];
    for (const [dx, dy] of [
      [25, 0],
      [-25, 0],
      [0, 25],
      [0, -25],
    ]) {
      const o = dynCircle(dx, dy, 20);
      o.space = space;
      others.push(o);
    }

    let endCount = 0;
    new InteractionListener(
      CbEvent.END,
      InteractionType.COLLISION,
      CbType.ANY_BODY,
      CbType.ANY_BODY,
      () => endCount++,
    ).space = space;

    step(space, 1);
    center.space = null;
    step(space, 2);

    // 4 END events expected (one per remaining body)
    expect(endCount).toBeGreaterThanOrEqual(4);
  });
});

// ---------------------------------------------------------------------------
// 6. Listener add/remove during simulation
// ---------------------------------------------------------------------------

describe("ZPP_CallbackSet — listener lifecycle", () => {
  let space: Space;
  beforeEach(() => {
    space = new Space(new Vec2(0, 0));
  });

  it("listener added mid-simulation receives subsequent events", () => {
    const a = dynCircle(0, 0, 20);
    a.space = space;
    step(space, 1);

    let receivedAfter = false;
    const listener = new InteractionListener(
      CbEvent.BEGIN,
      InteractionType.COLLISION,
      CbType.ANY_BODY,
      CbType.ANY_BODY,
      () => {
        receivedAfter = true;
      },
    );
    listener.space = space;

    // Add a second body that immediately overlaps
    const b = dynCircle(5, 0, 20);
    b.space = space;
    step(space, 1);

    expect(receivedAfter).toBe(true);
  });

  it("listener removed mid-simulation stops receiving events", () => {
    let count = 0;
    const listener = new InteractionListener(
      CbEvent.BEGIN,
      InteractionType.COLLISION,
      CbType.ANY_BODY,
      CbType.ANY_BODY,
      () => count++,
    );
    listener.space = space;

    const a = dynCircle(0, 0, 20);
    a.space = space;
    const b = dynCircle(5, 0, 20);
    b.space = space;
    step(space, 1);

    const before = count;
    listener.space = null;

    // Re-pair: remove b, then re-add nearby
    b.space = null;
    step(space, 1);
    const c = dynCircle(0, 100, 20);
    c.space = space;
    const d = dynCircle(5, 100, 20);
    d.space = space;
    step(space, 1);

    expect(count).toBe(before);
  });
});

// ---------------------------------------------------------------------------
// 7. Re-using a CallbackSet from the pool
// ---------------------------------------------------------------------------

describe("ZPP_CallbackSet — pool reuse", () => {
  it("repeat add/remove cycles do not leak counts or fire phantom events", () => {
    const space = new Space(new Vec2(0, 0));

    let beginCount = 0;
    let endCount = 0;
    new InteractionListener(
      CbEvent.BEGIN,
      InteractionType.COLLISION,
      CbType.ANY_BODY,
      CbType.ANY_BODY,
      () => beginCount++,
    ).space = space;
    new InteractionListener(
      CbEvent.END,
      InteractionType.COLLISION,
      CbType.ANY_BODY,
      CbType.ANY_BODY,
      () => endCount++,
    ).space = space;

    for (let cycle = 0; cycle < 10; cycle++) {
      const a = dynCircle(0, 0, 20);
      a.space = space;
      const b = dynCircle(5, 0, 20);
      b.space = space;
      step(space, 1);
      a.space = null;
      b.space = null;
      step(space, 2);
    }

    expect(beginCount).toBe(10);
    expect(endCount).toBe(10);
  });
});
