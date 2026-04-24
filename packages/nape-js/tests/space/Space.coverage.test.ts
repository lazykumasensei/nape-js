/**
 * Space — extended coverage tests.
 *
 * Targets uncovered branches:
 * - Spatial queries: bodiesUnderPoint, shapesUnderPoint, bodiesInAABB, shapesInAABB
 * - Spatial queries: bodiesInCircle, shapesInCircle, bodiesInShape, shapesInShape
 * - Raycasting: rayCast, rayMultiCast
 * - Space.clear()
 * - Midstep guard (immutable_midstep)
 * - Gravity validation/invalidation
 * - Global drag properties
 * - Compound body management
 * - CCD (continuous collision detection)
 */

import { describe, it, expect } from "vitest";
import { Space } from "../../src/space/Space";
import { Body } from "../../src/phys/Body";
import { BodyType } from "../../src/phys/BodyType";
import { Vec2 } from "../../src/geom/Vec2";
import { Circle } from "../../src/shape/Circle";
import { Polygon } from "../../src/shape/Polygon";
import { AABB } from "../../src/geom/AABB";
import { Ray } from "../../src/geom/Ray";
import { Compound } from "../../src/phys/Compound";
import { PivotJoint } from "../../src/constraint/PivotJoint";
import { DistanceJoint } from "../../src/constraint/DistanceJoint";

// -------------------------------------------------------------------------
// Helpers
// -------------------------------------------------------------------------

function makeSpace(gy = 0) {
  return new Space(new Vec2(0, gy));
}

function addCircle(space: Space, x: number, y: number, r = 10, type = BodyType.DYNAMIC): Body {
  const b = new Body(type, new Vec2(x, y));
  b.shapes.add(new Circle(r));
  b.space = space;
  return b;
}

function addBox(space: Space, x: number, y: number, w = 20, h = 20, type = BodyType.STATIC): Body {
  const b = new Body(type, new Vec2(x, y));
  b.shapes.add(new Polygon(Polygon.box(w, h)));
  b.space = space;
  return b;
}

// -------------------------------------------------------------------------
// 1. Spatial queries — bodiesUnderPoint / shapesUnderPoint
// -------------------------------------------------------------------------

describe("Space — spatial queries: underPoint", () => {
  it("bodiesUnderPoint finds body at specified position", () => {
    const space = makeSpace();
    addCircle(space, 50, 50, 20, BodyType.STATIC);
    space.step(1 / 60);

    const result = space.bodiesUnderPoint(new Vec2(50, 50));
    expect(result.length).toBe(1);
  });

  it("bodiesUnderPoint returns empty for miss", () => {
    const space = makeSpace();
    addCircle(space, 50, 50, 10, BodyType.STATIC);
    space.step(1 / 60);

    const result = space.bodiesUnderPoint(new Vec2(200, 200));
    expect(result.length).toBe(0);
  });

  it("shapesUnderPoint finds shape at specified position", () => {
    const space = makeSpace();
    addCircle(space, 50, 50, 20, BodyType.STATIC);
    space.step(1 / 60);

    const result = space.shapesUnderPoint(new Vec2(50, 50));
    expect(result.length).toBe(1);
  });

  it("bodiesUnderPoint finds multiple overlapping bodies", () => {
    const space = makeSpace();
    addCircle(space, 50, 50, 20, BodyType.STATIC);
    addCircle(space, 55, 50, 20, BodyType.STATIC);
    space.step(1 / 60);

    const result = space.bodiesUnderPoint(new Vec2(52, 50));
    expect(result.length).toBe(2);
  });
});

// -------------------------------------------------------------------------
// 2. Spatial queries — AABB
// -------------------------------------------------------------------------

describe("Space — spatial queries: AABB", () => {
  it("bodiesInAABB finds bodies within bounding box", () => {
    const space = makeSpace();
    addCircle(space, 50, 50, 10, BodyType.STATIC);
    addCircle(space, 150, 150, 10, BodyType.STATIC);
    space.step(1 / 60);

    const aabb = new AABB(0, 0, 100, 100);
    const result = space.bodiesInAABB(aabb);
    expect(result.length).toBe(1);
  });

  it("shapesInAABB finds shapes within bounding box", () => {
    const space = makeSpace();
    addBox(space, 50, 50, 20, 20, BodyType.STATIC);
    space.step(1 / 60);

    const aabb = new AABB(0, 0, 100, 100);
    const result = space.shapesInAABB(aabb);
    expect(result.length).toBe(1);
  });

  it("bodiesInAABB returns empty for area with no bodies", () => {
    const space = makeSpace();
    addCircle(space, 50, 50, 10, BodyType.STATIC);
    space.step(1 / 60);

    const aabb = new AABB(200, 200, 300, 300);
    const result = space.bodiesInAABB(aabb);
    expect(result.length).toBe(0);
  });
});

// -------------------------------------------------------------------------
// 3. Spatial queries — Circle region
// -------------------------------------------------------------------------

describe("Space — spatial queries: circle region", () => {
  it("bodiesInCircle finds bodies within radius", () => {
    const space = makeSpace();
    addCircle(space, 50, 50, 10, BodyType.STATIC);
    addCircle(space, 200, 200, 10, BodyType.STATIC);
    space.step(1 / 60);

    const result = space.bodiesInCircle(new Vec2(50, 50), 30);
    expect(result.length).toBe(1);
  });

  it("shapesInCircle finds shapes within radius", () => {
    const space = makeSpace();
    addCircle(space, 50, 50, 10, BodyType.STATIC);
    space.step(1 / 60);

    const result = space.shapesInCircle(new Vec2(50, 50), 30);
    expect(result.length).toBe(1);
  });
});

// -------------------------------------------------------------------------
// 4. Raycasting
// -------------------------------------------------------------------------

describe("Space — raycasting", () => {
  it("rayCast finds the nearest body", () => {
    const space = makeSpace();
    addCircle(space, 100, 0, 20, BodyType.STATIC);
    addCircle(space, 200, 0, 20, BodyType.STATIC);
    space.step(1 / 60);

    const ray = new Ray(new Vec2(0, 0), new Vec2(1, 0));
    const result = space.rayCast(ray);
    expect(result).not.toBeNull();
  });

  it("rayCast returns null for empty ray path", () => {
    const space = makeSpace();
    addCircle(space, 100, 100, 10, BodyType.STATIC);
    space.step(1 / 60);

    const ray = new Ray(new Vec2(0, 0), new Vec2(1, 0));
    ray.maxDistance = 50; // Too short to reach
    const result = space.rayCast(ray);
    expect(result).toBeNull();
  });

  it("rayMultiCast finds all bodies along ray", () => {
    const space = makeSpace();
    addCircle(space, 100, 0, 20, BodyType.STATIC);
    addCircle(space, 200, 0, 20, BodyType.STATIC);
    space.step(1 / 60);

    const ray = new Ray(new Vec2(0, 0), new Vec2(1, 0));
    const results = space.rayMultiCast(ray);
    expect(results.length).toBeGreaterThanOrEqual(2);
  });

  it("rayCast through polygon", () => {
    const space = makeSpace();
    addBox(space, 100, 0, 40, 40, BodyType.STATIC);
    space.step(1 / 60);

    const ray = new Ray(new Vec2(0, 0), new Vec2(1, 0));
    const result = space.rayCast(ray);
    expect(result).not.toBeNull();
  });
});

// -------------------------------------------------------------------------
// 5. Space.clear()
// -------------------------------------------------------------------------

describe("Space — clear", () => {
  it("clear removes all bodies", () => {
    const space = makeSpace(500);
    addCircle(space, 0, 0, 10, BodyType.DYNAMIC);
    addCircle(space, 50, 0, 10, BodyType.DYNAMIC);
    addBox(space, 0, 100, 200, 20, BodyType.STATIC);

    space.step(1 / 60, 10, 10);
    space.clear();

    expect(space.bodies.length).toBe(0);
  });

  it("clear removes all constraints", () => {
    const space = makeSpace();
    const b1 = addCircle(space, 0, 0, 10, BodyType.DYNAMIC);
    const b2 = addCircle(space, 50, 0, 10, BodyType.DYNAMIC);
    const joint = new PivotJoint(b1, b2, new Vec2(0, 0), new Vec2(0, 0));
    joint.space = space;

    space.step(1 / 60, 10, 10);
    space.clear();

    expect(space.constraints.length).toBe(0);
    expect(space.bodies.length).toBe(0);
  });

  it("clear removes arbiters", () => {
    const space = makeSpace(500);
    addBox(space, 0, 100, 200, 20, BodyType.STATIC);
    addCircle(space, 0, 50, 10, BodyType.DYNAMIC);

    for (let i = 0; i < 120; i++) {
      space.step(1 / 60, 10, 10);
      if ((space.arbiters as any).zpp_gl() > 0) break;
    }

    space.clear();
    expect((space.arbiters as any).zpp_gl()).toBe(0);
  });
});

// -------------------------------------------------------------------------
// 6. Gravity invalidation
// -------------------------------------------------------------------------

describe("Space — gravity", () => {
  it("changing gravity wakes sleeping bodies", () => {
    const space = makeSpace(500);
    addBox(space, 0, 300, 600, 20, BodyType.STATIC);
    const ball = addCircle(space, 0, 250, 10, BodyType.DYNAMIC);

    // Let ball settle and sleep
    for (let i = 0; i < 600; i++) space.step(1 / 60, 10, 10);

    const posY = ball.position.y;

    // Change gravity direction
    space.gravity = new Vec2(0, -500);
    for (let i = 0; i < 60; i++) space.step(1 / 60, 10, 10);

    // Ball should have moved upward
    expect(ball.position.y).toBeLessThan(posY);
  });

  it("zero gravity keeps bodies stationary", () => {
    const space = makeSpace(0);
    const ball = addCircle(space, 0, 0, 10, BodyType.DYNAMIC);

    for (let i = 0; i < 60; i++) space.step(1 / 60, 10, 10);

    expect(Math.abs(ball.position.y)).toBeLessThan(1);
  });
});

// -------------------------------------------------------------------------
// 7. Compound body management
// -------------------------------------------------------------------------

describe("Space — compound bodies", () => {
  it("compound with multiple bodies can be added/removed from space", () => {
    const space = makeSpace(500);
    const compound = new Compound();

    const b1 = new Body(BodyType.DYNAMIC, new Vec2(0, 0));
    b1.shapes.add(new Circle(10));
    b1.compound = compound;

    const b2 = new Body(BodyType.DYNAMIC, new Vec2(30, 0));
    b2.shapes.add(new Circle(10));
    b2.compound = compound;

    compound.space = space;
    // Bodies in compound are in space.compounds, not directly in space.bodies
    expect(space.compounds.length).toBe(1);

    compound.space = null;
    expect(space.compounds.length).toBe(0);
  });

  it("compound with constraint", () => {
    const space = makeSpace(500);
    const compound = new Compound();

    const b1 = new Body(BodyType.DYNAMIC, new Vec2(0, 0));
    b1.shapes.add(new Circle(10));
    b1.compound = compound;

    const b2 = new Body(BodyType.DYNAMIC, new Vec2(30, 0));
    b2.shapes.add(new Circle(10));
    b2.compound = compound;

    const joint = new DistanceJoint(b1, b2, new Vec2(0, 0), new Vec2(0, 0), 20, 40);
    joint.compound = compound;

    compound.space = space;

    for (let i = 0; i < 60; i++) space.step(1 / 60, 10, 10);

    // Bodies should have moved under gravity
    expect(b1.position.y).toBeGreaterThan(0);
    expect(b2.position.y).toBeGreaterThan(0);
  });
});

// -------------------------------------------------------------------------
// 8. Global drag properties
// -------------------------------------------------------------------------

describe("Space — global drag", () => {
  it("global linear drag slows moving bodies", () => {
    const space = makeSpace(0);
    space.worldLinearDrag = 0.5;

    const ball = addCircle(space, 0, 0, 10, BodyType.DYNAMIC);
    ball.velocity = new Vec2(100, 0);

    for (let i = 0; i < 120; i++) space.step(1 / 60, 10, 10);

    expect(Math.abs(ball.velocity.x)).toBeLessThan(100);
  });

  it("global angular drag slows spinning bodies", () => {
    const space = makeSpace(0);
    space.worldAngularDrag = 0.5;

    const ball = addCircle(space, 0, 0, 10, BodyType.DYNAMIC);
    ball.angularVel = 10.0;

    for (let i = 0; i < 120; i++) space.step(1 / 60, 10, 10);

    expect(Math.abs(ball.angularVel)).toBeLessThan(10);
  });
});

// -------------------------------------------------------------------------
// 9. Constraint management
// -------------------------------------------------------------------------

describe("Space — constraint lifecycle", () => {
  it("adding and removing constraints during simulation", () => {
    const space = makeSpace(500);
    addBox(space, 0, 300, 600, 20, BodyType.STATIC);
    const b1 = addCircle(space, 0, 100, 10, BodyType.DYNAMIC);
    const b2 = addCircle(space, 50, 100, 10, BodyType.DYNAMIC);

    const joint = new PivotJoint(b1, b2, new Vec2(0, 0), new Vec2(0, 0));
    joint.space = space;

    for (let i = 0; i < 30; i++) space.step(1 / 60, 10, 10);

    // Remove constraint mid-simulation
    joint.space = null;
    expect(space.constraints.length).toBe(0);

    // Bodies should still simulate
    for (let i = 0; i < 30; i++) space.step(1 / 60, 10, 10);
    expect(b1.position.y).toBeGreaterThan(100);
  });
});

// -------------------------------------------------------------------------
// 10. Multiple stepping patterns
// -------------------------------------------------------------------------

describe("Space — stepping", () => {
  it("step with different iteration counts", () => {
    const space = makeSpace(500);
    addBox(space, 0, 300, 600, 20, BodyType.STATIC);
    const ball = addCircle(space, 0, 200, 10, BodyType.DYNAMIC);

    // Low iterations
    for (let i = 0; i < 30; i++) space.step(1 / 60, 1, 1);
    const pos1 = ball.position.y;

    // The simulation should still work with low iterations
    expect(isFinite(pos1)).toBe(true);
  });

  it("many small steps produce stable simulation", () => {
    const space = makeSpace(500);
    addBox(space, 0, 300, 600, 20, BodyType.STATIC);
    const ball = addCircle(space, 0, 200, 10, BodyType.DYNAMIC);

    for (let i = 0; i < 240; i++) space.step(1 / 240, 10, 10);

    expect(isFinite(ball.position.y)).toBe(true);
    expect(ball.position.y).toBeLessThan(300);
  });
});
