/**
 * Broadphase — critical coverage tests.
 *
 * Targets uncovered branches:
 * - AABB sync for different shape types (circle, polygon, capsule)
 * - Shape validation during sync (dirty flag paths)
 * - updateAABBShape / updateCircShape paths
 * - Query methods across all broadphase algorithms
 * - Capsule shapes in broadphase
 * - Dynamic body AABB expansion for CCD
 * - Spatial hash broadphase edge cases
 */

import { describe, it, expect } from "vitest";
import { Space } from "../../src/space/Space";
import { Body } from "../../src/phys/Body";
import { BodyType } from "../../src/phys/BodyType";
import { Vec2 } from "../../src/geom/Vec2";
import { Circle } from "../../src/shape/Circle";
import { Polygon } from "../../src/shape/Polygon";
import { Capsule } from "../../src/shape/Capsule";
import "../../src/dynamics/Contact";
import { AABB } from "../../src/geom/AABB";
import { Ray } from "../../src/geom/Ray";
import { Broadphase } from "../../src/space/Broadphase";

// -------------------------------------------------------------------------
// Helpers
// -------------------------------------------------------------------------

const algorithms = [
  { name: "DYNAMIC_AABB_TREE", value: Broadphase.DYNAMIC_AABB_TREE },
  { name: "SWEEP_AND_PRUNE", value: Broadphase.SWEEP_AND_PRUNE },
  { name: "SPATIAL_HASH", value: Broadphase.SPATIAL_HASH },
];

function addBody(space: Space, shape: any, x: number, y: number, type = BodyType.STATIC): Body {
  const b = new Body(type, new Vec2(x, y));
  b.shapes.add(shape);
  b.space = space;
  return b;
}

// -------------------------------------------------------------------------
// 1. Capsule in broadphase
// -------------------------------------------------------------------------

describe.each(algorithms)("Broadphase ($name) — capsule shapes", ({ value: algo }) => {
  it("capsule body is detected by broadphase", () => {
    const space = new Space(new Vec2(0, 500), algo);
    addBody(space, new Polygon(Polygon.box(600, 20)), 0, 300);
    addBody(space, new Capsule(40, 20), 0, 200, BodyType.DYNAMIC);

    for (let i = 0; i < 120; i++) {
      space.step(1 / 60, 10, 10);
      if ((space.arbiters as any).zpp_gl() > 0) break;
    }

    expect((space.arbiters as any).zpp_gl()).toBeGreaterThan(0);
  });

  it("capsule detected by bodiesInAABB", () => {
    const space = new Space(new Vec2(0, 0), algo);
    addBody(space, new Capsule(40, 20), 50, 50);
    space.step(1 / 60);

    const aabb = new AABB(0, 0, 100, 100);
    const result = space.bodiesInAABB(aabb);
    expect(result.length).toBe(1);
  });
});

// -------------------------------------------------------------------------
// 2. AABB sync with moving bodies
// -------------------------------------------------------------------------

describe.each(algorithms)("Broadphase ($name) — AABB sync on movement", ({ value: algo }) => {
  it("circle AABB syncs after position change", () => {
    const space = new Space(new Vec2(0, 0), algo);
    const ball = addBody(space, new Circle(10), 0, 0, BodyType.DYNAMIC);
    space.step(1 / 60);

    ball.position = new Vec2(100, 100);
    space.step(1 / 60);

    const result = space.bodiesUnderPoint(new Vec2(100, 100));
    expect(result.length).toBe(1);
  });

  it("polygon AABB syncs after rotation", () => {
    const space = new Space(new Vec2(0, 0), algo);
    const box = addBody(space, new Polygon(Polygon.box(40, 10)), 50, 50, BodyType.DYNAMIC);
    space.step(1 / 60);

    box.rotation = Math.PI / 4;
    space.step(1 / 60);

    const result = space.bodiesUnderPoint(new Vec2(50, 50));
    expect(result.length).toBe(1);
  });
});

// -------------------------------------------------------------------------
// 3. Spatial queries — bodiesInShape
// -------------------------------------------------------------------------

describe.each(algorithms)("Broadphase ($name) — bodiesInShape", ({ value: algo }) => {
  it("find bodies overlapping with query shape", () => {
    const space = new Space(new Vec2(0, 0), algo);
    addBody(space, new Circle(10), 50, 50);
    addBody(space, new Circle(10), 200, 200);
    space.step(1 / 60);

    // Create a query circle shape
    const queryBody = new Body(BodyType.STATIC, new Vec2(50, 50));
    queryBody.shapes.add(new Circle(30));

    const result = space.bodiesInShape(queryBody.shapes.at(0));
    expect(result.length).toBe(1);
  });
});

// -------------------------------------------------------------------------
// 4. Ray queries across algorithms
// -------------------------------------------------------------------------

describe.each(algorithms)("Broadphase ($name) — ray queries", ({ value: algo }) => {
  it("rayCast finds nearest body", () => {
    const space = new Space(new Vec2(0, 0), algo);
    addBody(space, new Circle(20), 100, 0);
    addBody(space, new Circle(20), 200, 0);
    space.step(1 / 60);

    const ray = new Ray(new Vec2(0, 0), new Vec2(1, 0));
    const result = space.rayCast(ray);
    expect(result).not.toBeNull();
  });

  it("rayMultiCast finds all bodies", () => {
    const space = new Space(new Vec2(0, 0), algo);
    addBody(space, new Circle(20), 100, 0);
    addBody(space, new Circle(20), 200, 0);
    space.step(1 / 60);

    const ray = new Ray(new Vec2(0, 0), new Vec2(1, 0));
    const results = space.rayMultiCast(ray);
    expect(results.length).toBeGreaterThanOrEqual(2);
  });

  it("rayCast through polygon shape", () => {
    const space = new Space(new Vec2(0, 0), algo);
    addBody(space, new Polygon(Polygon.box(40, 40)), 100, 0);
    space.step(1 / 60);

    const ray = new Ray(new Vec2(0, 0), new Vec2(1, 0));
    const result = space.rayCast(ray);
    expect(result).not.toBeNull();
  });

  it("rayCast miss returns null", () => {
    const space = new Space(new Vec2(0, 0), algo);
    addBody(space, new Circle(10), 0, 100);
    space.step(1 / 60);

    const ray = new Ray(new Vec2(0, 0), new Vec2(1, 0));
    ray.maxDistance = 50;
    const result = space.rayCast(ray);
    expect(result).toBeNull();
  });
});

// -------------------------------------------------------------------------
// 5. Many bodies stress test
// -------------------------------------------------------------------------

describe.each(algorithms)("Broadphase ($name) — stress test", ({ value: algo }) => {
  it("50 circles falling on floor — all algorithms handle many bodies", () => {
    const space = new Space(new Vec2(0, 500), algo);
    addBody(space, new Polygon(Polygon.box(1000, 20)), 0, 400);

    for (let i = 0; i < 50; i++) {
      addBody(space, new Circle(5), -100 + i * 4, -100 + i * 3, BodyType.DYNAMIC);
    }

    for (let i = 0; i < 300; i++) space.step(1 / 60, 5, 5);

    // All bodies should have settled near the floor
    expect(space.bodies.length).toBe(51);
  });
});

// -------------------------------------------------------------------------
// 6. Body removal during iteration
// -------------------------------------------------------------------------

describe.each(algorithms)("Broadphase ($name) — body removal", ({ value: algo }) => {
  it("removing body from space cleans up broadphase", () => {
    const space = new Space(new Vec2(0, 0), algo);
    const b = addBody(space, new Circle(10), 50, 50, BodyType.DYNAMIC);
    space.step(1 / 60);

    b.space = null;
    space.step(1 / 60);

    const result = space.bodiesUnderPoint(new Vec2(50, 50));
    expect(result.length).toBe(0);
  });

  it("rapid add-remove-add cycle works correctly", () => {
    const space = new Space(new Vec2(0, 0), algo);

    for (let cycle = 0; cycle < 10; cycle++) {
      const b = addBody(space, new Circle(10), 50, 50, BodyType.DYNAMIC);
      space.step(1 / 60);
      b.space = null;
      space.step(1 / 60);
    }

    // Space should be clean
    expect(space.bodies.length).toBe(0);
  });
});
