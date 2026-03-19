import { describe, it, expect } from "vitest";
import { Space } from "../../src/space/Space";
import { Body } from "../../src/phys/Body";
import { BodyType } from "../../src/phys/BodyType";
import { Vec2 } from "../../src/geom/Vec2";
import { Circle } from "../../src/shape/Circle";
import { Polygon } from "../../src/shape/Polygon";
import { PivotJoint } from "../../src/constraint/PivotJoint";
import { DistanceJoint } from "../../src/constraint/DistanceJoint";
import { spaceToJSON, spaceFromJSON } from "../../src/serialization";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function createDynamicCircle(x: number, y: number, radius = 10): Body {
  const body = new Body(BodyType.DYNAMIC, new Vec2(x, y));
  body.shapes.add(new Circle(radius));
  return body;
}

function createDynamicBox(x: number, y: number, w = 20, h = 20): Body {
  const body = new Body(BodyType.DYNAMIC, new Vec2(x, y));
  body.shapes.add(new Polygon(Polygon.box(w, h)));
  return body;
}

function createStaticBox(x: number, y: number, w = 200, h = 20): Body {
  const body = new Body(BodyType.STATIC, new Vec2(x, y));
  body.shapes.add(new Polygon(Polygon.box(w, h)));
  return body;
}

/** Run a simulation and record body states at every step. */
function runSimulation(
  setup: (space: Space) => Body[],
  steps: number,
  dt = 1 / 60,
): { x: number; y: number; rot: number }[][] {
  const space = new Space(new Vec2(0, 400));
  space.deterministic = true;
  const bodies = setup(space);
  const history: { x: number; y: number; rot: number }[][] = [];

  for (let i = 0; i < steps; i++) {
    space.step(dt);
    history.push(
      bodies.map((b) => ({
        x: b.position.x,
        y: b.position.y,
        rot: b.rotation,
      })),
    );
  }

  return history;
}

// ---------------------------------------------------------------------------
// Property tests
// ---------------------------------------------------------------------------

describe("Space.deterministic — property", () => {
  it("should default to false", () => {
    const space = new Space();
    expect(space.deterministic).toBe(false);
  });

  it("should get/set deterministic", () => {
    const space = new Space();
    space.deterministic = true;
    expect(space.deterministic).toBe(true);
    space.deterministic = false;
    expect(space.deterministic).toBe(false);
  });

  it("should force sortContacts=true when deterministic is enabled", () => {
    const space = new Space();
    space.sortContacts = false;
    space.deterministic = true;
    expect(space.sortContacts).toBe(true);
  });

  it("should not change sortContacts when deterministic is disabled", () => {
    const space = new Space();
    space.sortContacts = false;
    space.deterministic = false;
    expect(space.sortContacts).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Twin simulation — core determinism proof
// ---------------------------------------------------------------------------

describe("Space.deterministic — twin simulation", () => {
  function setupScene(space: Space): Body[] {
    const floor = createStaticBox(0, 300);
    floor.space = space;

    const bodies: Body[] = [];
    // Stack of mixed shapes
    for (let i = 0; i < 5; i++) {
      const b =
        i % 2 === 0 ? createDynamicCircle(i * 3, i * -30) : createDynamicBox(i * 3, i * -30);
      b.space = space;
      bodies.push(b);
    }
    return bodies;
  }

  it("should produce identical results in two independent runs", () => {
    const run1 = runSimulation(setupScene, 120);
    const run2 = runSimulation(setupScene, 120);

    expect(run1.length).toBe(run2.length);
    for (let step = 0; step < run1.length; step++) {
      for (let b = 0; b < run1[step].length; b++) {
        expect(run1[step][b].x).toBe(run2[step][b].x);
        expect(run1[step][b].y).toBe(run2[step][b].y);
        expect(run1[step][b].rot).toBe(run2[step][b].rot);
      }
    }
  });

  it("should produce identical results with constraints", () => {
    function setupWithConstraints(space: Space): Body[] {
      const floor = createStaticBox(0, 300);
      floor.space = space;

      const b1 = createDynamicCircle(-20, 0);
      const b2 = createDynamicCircle(20, 0);
      b1.space = space;
      b2.space = space;

      const pivot = new PivotJoint(b1, b2, Vec2.weak(0, 0), Vec2.weak(0, 0));
      pivot.space = space;

      return [b1, b2];
    }

    const run1 = runSimulation(setupWithConstraints, 120);
    const run2 = runSimulation(setupWithConstraints, 120);

    for (let step = 0; step < run1.length; step++) {
      for (let b = 0; b < run1[step].length; b++) {
        expect(run1[step][b].x).toBe(run2[step][b].x);
        expect(run1[step][b].y).toBe(run2[step][b].y);
        expect(run1[step][b].rot).toBe(run2[step][b].rot);
      }
    }
  });

  it("should produce identical results with distance joints", () => {
    function setupDistanceJoints(space: Space): Body[] {
      const anchor = createStaticBox(0, -100);
      anchor.space = space;

      const bodies: Body[] = [];
      for (let i = 0; i < 4; i++) {
        const b = createDynamicCircle(i * 30 - 45, 0, 8);
        b.space = space;
        bodies.push(b);

        const joint = new DistanceJoint(
          anchor,
          b,
          Vec2.weak(i * 30 - 45, -100),
          Vec2.weak(0, 0),
          50,
          80,
        );
        joint.space = space;
      }
      return bodies;
    }

    const run1 = runSimulation(setupDistanceJoints, 180);
    const run2 = runSimulation(setupDistanceJoints, 180);

    for (let step = 0; step < run1.length; step++) {
      for (let b = 0; b < run1[step].length; b++) {
        expect(run1[step][b].x).toBe(run2[step][b].x);
        expect(run1[step][b].y).toBe(run2[step][b].y);
        expect(run1[step][b].rot).toBe(run2[step][b].rot);
      }
    }
  });
});

// ---------------------------------------------------------------------------
// Complex scenario — bodies sleeping and waking
// ---------------------------------------------------------------------------

describe("Space.deterministic — complex scenarios", () => {
  it("should be deterministic with sleep/wake cycles", () => {
    function setupSleepWake(space: Space): Body[] {
      const floor = createStaticBox(0, 200);
      floor.space = space;

      // Bodies that will collide, settle, sleep, then get woken by a new body
      const bodies: Body[] = [];
      for (let i = 0; i < 3; i++) {
        const b = createDynamicBox(i * 25 - 25, -50);
        b.space = space;
        bodies.push(b);
      }
      return bodies;
    }

    const run1 = runSimulation(setupSleepWake, 300);
    const run2 = runSimulation(setupSleepWake, 300);

    for (let step = 0; step < run1.length; step++) {
      for (let b = 0; b < run1[step].length; b++) {
        expect(run1[step][b].x).toBe(run2[step][b].x);
        expect(run1[step][b].y).toBe(run2[step][b].y);
        expect(run1[step][b].rot).toBe(run2[step][b].rot);
      }
    }
  });

  it("should not throw with deterministic mode during normal simulation", () => {
    const space = new Space(new Vec2(0, 500));
    space.deterministic = true;

    const floor = createStaticBox(0, 200);
    floor.space = space;

    for (let i = 0; i < 10; i++) {
      const b = createDynamicCircle(Math.cos(i) * 20, -i * 30);
      b.space = space;
    }

    // Should not throw
    for (let i = 0; i < 200; i++) {
      space.step(1 / 60);
    }
  });
});

// ---------------------------------------------------------------------------
// Serialization round-trip
// ---------------------------------------------------------------------------

describe("Space.deterministic — serialization", () => {
  it("should round-trip deterministic flag via JSON", () => {
    const space = new Space(Vec2.weak(0, 0));
    space.deterministic = true;
    const snap = spaceToJSON(space);
    expect(snap.deterministic).toBe(true);

    const restored = spaceFromJSON(snap);
    expect(restored.deterministic).toBe(true);
  });

  it("should default deterministic to false in JSON when missing", () => {
    const space = new Space(Vec2.weak(0, 0));
    const snap = spaceToJSON(space);
    expect(snap.deterministic).toBe(false);

    const restored = spaceFromJSON(snap);
    expect(restored.deterministic).toBe(false);
  });
});
