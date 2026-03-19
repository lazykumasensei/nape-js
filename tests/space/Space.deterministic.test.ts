import { describe, it, expect } from "vitest";
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
import { spaceToJSON, spaceFromJSON } from "../../src/serialization";
import { spaceToBinary, spaceFromBinary } from "../../src/serialization/index";

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

  it("should round-trip deterministic flag via binary", () => {
    const space = new Space(Vec2.weak(0, 400));
    space.deterministic = true;

    const floor = createStaticBox(0, 300);
    floor.space = space;
    const ball = createDynamicCircle(0, 0);
    ball.space = space;

    const bin = spaceToBinary(space);
    const restored = spaceFromBinary(bin);
    expect(restored.deterministic).toBe(true);
    expect(restored.sortContacts).toBe(true);
    expect(restored.bodies.length).toBe(2);
  });

  it("should round-trip deterministic=false via binary", () => {
    const space = new Space(Vec2.weak(0, 0));
    space.deterministic = false;

    const bin = spaceToBinary(space);
    const restored = spaceFromBinary(bin);
    expect(restored.deterministic).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Kinematic bodies
// ---------------------------------------------------------------------------

describe("Space.deterministic — kinematic bodies", () => {
  it("should be deterministic with kinematic bodies pushing dynamic bodies", () => {
    function setupKinematic(space: Space): Body[] {
      const floor = createStaticBox(0, 300);
      floor.space = space;

      // Kinematic body moving rightward
      const kinBody = new Body(BodyType.KINEMATIC, new Vec2(-50, 250));
      kinBody.shapes.add(new Polygon(Polygon.box(40, 40)));
      kinBody.velocity = Vec2.weak(60, 0);
      kinBody.space = space;

      // Dynamic bodies that will be pushed
      const bodies: Body[] = [];
      for (let i = 0; i < 3; i++) {
        const b = createDynamicCircle(i * 30, 250, 10);
        b.space = space;
        bodies.push(b);
      }
      return bodies;
    }

    const run1 = runSimulation(setupKinematic, 150);
    const run2 = runSimulation(setupKinematic, 150);

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
// Fluid arbiters
// ---------------------------------------------------------------------------

describe("Space.deterministic — fluid arbiters", () => {
  it("should be deterministic with fluid shapes (buoyancy)", () => {
    function setupFluid(space: Space): Body[] {
      // Static fluid body
      const fluidBody = new Body(BodyType.STATIC, new Vec2(0, 200));
      const fluidShape = new Polygon(Polygon.box(400, 200));
      fluidShape.fluidEnabled = true;
      fluidShape.fluidProperties.density = 3;
      fluidShape.fluidProperties.viscosity = 5;
      fluidBody.shapes.add(fluidShape);
      fluidBody.space = space;

      // Dynamic bodies falling into fluid
      const bodies: Body[] = [];
      for (let i = 0; i < 4; i++) {
        const b = createDynamicCircle(i * 25 - 37, 50, 8);
        b.space = space;
        bodies.push(b);
      }
      return bodies;
    }

    const run1 = runSimulation(setupFluid, 200);
    const run2 = runSimulation(setupFluid, 200);

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
// Dynamic body add/remove mid-simulation
// ---------------------------------------------------------------------------

describe("Space.deterministic — dynamic add/remove", () => {
  it("should be deterministic when bodies are added mid-simulation", () => {
    function run(): { x: number; y: number; rot: number }[][] {
      const space = new Space(new Vec2(0, 400));
      space.deterministic = true;

      const floor = createStaticBox(0, 300);
      floor.space = space;

      const tracked: Body[] = [];
      const b1 = createDynamicCircle(-20, 0);
      b1.space = space;
      tracked.push(b1);

      const history: { x: number; y: number; rot: number }[][] = [];

      for (let i = 0; i < 200; i++) {
        // Add a new body at step 50 and 100
        if (i === 50 || i === 100) {
          const nb = createDynamicBox(10, -50);
          nb.space = space;
          tracked.push(nb);
        }
        space.step(1 / 60);
        history.push(
          tracked.map((b) => ({
            x: b.position.x,
            y: b.position.y,
            rot: b.rotation,
          })),
        );
      }
      return history;
    }

    const run1 = run();
    const run2 = run();

    for (let step = 0; step < run1.length; step++) {
      for (let b = 0; b < run1[step].length; b++) {
        expect(run1[step][b].x).toBe(run2[step][b].x);
        expect(run1[step][b].y).toBe(run2[step][b].y);
        expect(run1[step][b].rot).toBe(run2[step][b].rot);
      }
    }
  });

  it("should be deterministic when bodies are removed mid-simulation", () => {
    function run(): { x: number; y: number }[][] {
      const space = new Space(new Vec2(0, 400));
      space.deterministic = true;

      const floor = createStaticBox(0, 300);
      floor.space = space;

      const bodies: Body[] = [];
      for (let i = 0; i < 5; i++) {
        const b = createDynamicCircle(i * 20 - 40, -50, 8);
        b.space = space;
        bodies.push(b);
      }

      const history: { x: number; y: number }[][] = [];

      for (let i = 0; i < 150; i++) {
        // Remove body at step 40
        if (i === 40 && bodies.length > 3) {
          const removed = bodies[2];
          removed.space = null;
        }
        space.step(1 / 60);
        history.push(
          bodies.filter((b) => b.space != null).map((b) => ({ x: b.position.x, y: b.position.y })),
        );
      }
      return history;
    }

    const run1 = run();
    const run2 = run();

    for (let step = 0; step < run1.length; step++) {
      for (let b = 0; b < run1[step].length; b++) {
        expect(run1[step][b].x).toBe(run2[step][b].x);
        expect(run1[step][b].y).toBe(run2[step][b].y);
      }
    }
  });
});

// ---------------------------------------------------------------------------
// More constraint types — WeldJoint, AngleJoint
// ---------------------------------------------------------------------------

describe("Space.deterministic — WeldJoint and AngleJoint", () => {
  it("should be deterministic with WeldJoint", () => {
    function setupWeld(space: Space): Body[] {
      const floor = createStaticBox(0, 300);
      floor.space = space;

      const b1 = createDynamicBox(-15, 0);
      const b2 = createDynamicBox(15, 0);
      b1.space = space;
      b2.space = space;

      const weld = new WeldJoint(b1, b2, Vec2.weak(0, 0), Vec2.weak(0, 0));
      weld.space = space;

      return [b1, b2];
    }

    const run1 = runSimulation(setupWeld, 120);
    const run2 = runSimulation(setupWeld, 120);

    for (let step = 0; step < run1.length; step++) {
      for (let b = 0; b < run1[step].length; b++) {
        expect(run1[step][b].x).toBe(run2[step][b].x);
        expect(run1[step][b].y).toBe(run2[step][b].y);
        expect(run1[step][b].rot).toBe(run2[step][b].rot);
      }
    }
  });

  it("should be deterministic with AngleJoint", () => {
    function setupAngle(space: Space): Body[] {
      const floor = createStaticBox(0, 300);
      floor.space = space;

      const b1 = createDynamicBox(-20, 0);
      const b2 = createDynamicBox(20, 0);
      b1.space = space;
      b2.space = space;

      const angle = new AngleJoint(b1, b2, -0.5, 0.5);
      angle.space = space;

      const pivot = new PivotJoint(b1, b2, Vec2.weak(0, 0), Vec2.weak(0, 0));
      pivot.space = space;

      return [b1, b2];
    }

    const run1 = runSimulation(setupAngle, 120);
    const run2 = runSimulation(setupAngle, 120);

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
// Edge cases — empty space, single body
// ---------------------------------------------------------------------------

describe("Space.deterministic — edge cases", () => {
  it("should handle empty space without throwing", () => {
    const space = new Space(new Vec2(0, 400));
    space.deterministic = true;

    for (let i = 0; i < 10; i++) {
      space.step(1 / 60);
    }

    expect(space.timeStamp).toBe(10);
  });

  it("should handle single body without throwing", () => {
    const space = new Space(new Vec2(0, 400));
    space.deterministic = true;

    const b = createDynamicCircle(0, 0);
    b.space = space;

    for (let i = 0; i < 60; i++) {
      space.step(1 / 60);
    }

    expect(b.position.y).toBeGreaterThan(0);
  });

  it("should handle single static body without throwing", () => {
    const space = new Space(new Vec2(0, 400));
    space.deterministic = true;

    const floor = createStaticBox(0, 0);
    floor.space = space;

    for (let i = 0; i < 30; i++) {
      space.step(1 / 60);
    }

    expect(space.timeStamp).toBe(30);
  });
});

// ---------------------------------------------------------------------------
// deterministic=false should not alter results
// ---------------------------------------------------------------------------

describe("Space.deterministic — disabled mode regression", () => {
  it("should not change simulation results when deterministic=false", () => {
    function setupAndRun(det: boolean): { x: number; y: number }[] {
      const space = new Space(new Vec2(0, 400));
      space.deterministic = det;

      const floor = createStaticBox(0, 300);
      floor.space = space;

      const b = createDynamicCircle(0, 0);
      b.space = space;

      for (let i = 0; i < 120; i++) {
        space.step(1 / 60);
      }

      return [{ x: b.position.x, y: b.position.y }];
    }

    const withDet = setupAndRun(true);
    const withoutDet = setupAndRun(false);

    // A single body falling onto a floor should produce the same result
    // regardless of deterministic mode (there's only one body, no ordering issue)
    expect(withDet[0].x).toBe(withoutDet[0].x);
    expect(withDet[0].y).toBe(withoutDet[0].y);
  });
});

// ---------------------------------------------------------------------------
// Rollback pattern: serialize → deserialize → continue = identical
// ---------------------------------------------------------------------------

describe("Space.deterministic — rollback pattern", () => {
  it("should produce identical results after JSON round-trip continuation", () => {
    function createScene(space: Space): Body[] {
      const floor = createStaticBox(0, 300);
      floor.space = space;

      const bodies: Body[] = [];
      for (let i = 0; i < 3; i++) {
        const b = createDynamicCircle(i * 20 - 20, 0, 8);
        b.space = space;
        bodies.push(b);
      }
      return bodies;
    }

    // Run A: full 200 steps
    const spaceA = new Space(new Vec2(0, 400));
    spaceA.deterministic = true;
    createScene(spaceA);
    for (let i = 0; i < 200; i++) {
      spaceA.step(1 / 60);
    }

    // Run B: 100 steps, snapshot, restore, 100 more steps
    const spaceB1 = new Space(new Vec2(0, 400));
    spaceB1.deterministic = true;
    createScene(spaceB1);
    for (let i = 0; i < 100; i++) {
      spaceB1.step(1 / 60);
    }

    const snap = spaceToJSON(spaceB1);
    const spaceB2 = spaceFromJSON(snap);
    for (let i = 0; i < 100; i++) {
      spaceB2.step(1 / 60);
    }

    // Compare final states — the visitor collects ALL bodies including
    // the world body and the static floor. Filter to dynamic only.
    const finalA: { x: number; y: number }[] = [];
    spaceA.visitBodies((b) => {
      if (b.type === BodyType.DYNAMIC) {
        finalA.push({ x: b.position.x, y: b.position.y });
      }
    });

    const finalB: { x: number; y: number }[] = [];
    spaceB2.visitBodies((b) => {
      if (b.type === BodyType.DYNAMIC) {
        finalB.push({ x: b.position.x, y: b.position.y });
      }
    });

    expect(finalA.length).toBe(finalB.length);
    // Sort by x to ensure consistent comparison order
    finalA.sort((a, b) => a.x - b.x);
    finalB.sort((a, b) => a.x - b.x);

    for (let i = 0; i < finalA.length; i++) {
      expect(finalA[i].x).toBe(finalB[i].x);
      expect(finalA[i].y).toBe(finalB[i].y);
    }
  });

  it("should produce identical results after binary round-trip continuation", () => {
    function createScene(space: Space): Body[] {
      const floor = createStaticBox(0, 300);
      floor.space = space;

      const bodies: Body[] = [];
      for (let i = 0; i < 3; i++) {
        const b = createDynamicCircle(i * 20 - 20, 0, 8);
        b.space = space;
        bodies.push(b);
      }
      return bodies;
    }

    // Run A: full 200 steps
    const spaceA = new Space(new Vec2(0, 400));
    spaceA.deterministic = true;
    createScene(spaceA);
    for (let i = 0; i < 200; i++) {
      spaceA.step(1 / 60);
    }

    // Run B: 100 steps, binary snapshot, restore, 100 more steps
    const spaceB1 = new Space(new Vec2(0, 400));
    spaceB1.deterministic = true;
    createScene(spaceB1);
    for (let i = 0; i < 100; i++) {
      spaceB1.step(1 / 60);
    }

    const bin = spaceToBinary(spaceB1);
    const spaceB2 = spaceFromBinary(bin);
    for (let i = 0; i < 100; i++) {
      spaceB2.step(1 / 60);
    }

    const finalA: { x: number; y: number }[] = [];
    spaceA.visitBodies((b) => {
      if (b.type === BodyType.DYNAMIC) {
        finalA.push({ x: b.position.x, y: b.position.y });
      }
    });

    const finalB: { x: number; y: number }[] = [];
    spaceB2.visitBodies((b) => {
      if (b.type === BodyType.DYNAMIC) {
        finalB.push({ x: b.position.x, y: b.position.y });
      }
    });

    expect(finalA.length).toBe(finalB.length);
    finalA.sort((a, b) => a.x - b.x);
    finalB.sort((a, b) => a.x - b.x);

    for (let i = 0; i < finalA.length; i++) {
      expect(finalA[i].x).toBe(finalB[i].x);
      expect(finalA[i].y).toBe(finalB[i].y);
    }
  });
});
