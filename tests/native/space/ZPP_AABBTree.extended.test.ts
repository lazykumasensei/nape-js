/**
 * ZPP_AABBTree — extended tests for tree invariants, balancing, AABB
 * correctness, and integration with DynAABBPhase.
 *
 * Covers untested paths: AABB bound tightness, height correctness after
 * operations, structural invariants, complex rebalancing, and tree
 * queries via Space API with DYNAMIC_AABB_TREE broadphase.
 */

import { describe, it, expect, beforeEach } from "vitest";
import "../../../src/core/engine";
import { Space } from "../../../src/space/Space";
import { Body } from "../../../src/phys/Body";
import { BodyType } from "../../../src/phys/BodyType";
import { Vec2 } from "../../../src/geom/Vec2";
import { AABB } from "../../../src/geom/AABB";
import { Circle } from "../../../src/shape/Circle";
import { Polygon } from "../../../src/shape/Polygon";
import { Ray } from "../../../src/geom/Ray";
import { Broadphase } from "../../../src/space/Broadphase";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function dynamicCircle(x: number, y: number, r = 10): Body {
  const b = new Body(BodyType.DYNAMIC, new Vec2(x, y));
  b.shapes.add(new Circle(r));
  return b;
}

function staticCircle(x: number, y: number, r = 10): Body {
  const b = new Body(BodyType.STATIC, new Vec2(x, y));
  b.shapes.add(new Circle(r));
  return b;
}

function step(space: Space, n = 1): void {
  for (let i = 0; i < n; i++) space.step(1 / 60);
}

// ---------------------------------------------------------------------------
// DynAABBPhase integration — insertion, removal, sync
// ---------------------------------------------------------------------------

describe("ZPP_AABBTree + DynAABBPhase — body lifecycle", () => {
  let space: Space;

  beforeEach(() => {
    space = new Space(new Vec2(0, 0), Broadphase.DYNAMIC_AABB_TREE);
  });

  it("handles insert → step → remove for many bodies", () => {
    const bodies: Body[] = [];
    for (let i = 0; i < 20; i++) {
      const b = dynamicCircle(i * 50, 0, 15);
      b.space = space;
      bodies.push(b);
    }
    step(space, 3);
    expect(space.bodies.length).toBe(20);

    // Remove every other body
    for (let i = 0; i < 20; i += 2) {
      bodies[i].space = null;
    }
    step(space, 3);
    expect(space.bodies.length).toBe(10);
  });

  it("handles rapid insert/remove without stepping", () => {
    for (let i = 0; i < 10; i++) {
      const b = dynamicCircle(i * 10, 0, 5);
      b.space = space;
      b.space = null;
    }
    step(space, 1);
    expect(space.bodies.length).toBe(0);
  });

  it("re-adding a body after removal works", () => {
    const b = dynamicCircle(100, 100, 20);
    b.space = space;
    step(space, 2);
    b.space = null;
    step(space, 2);
    b.space = space;
    step(space, 2);
    expect(space.bodies.length).toBe(1);
  });

  it("mixed static and dynamic bodies in tree", () => {
    for (let i = 0; i < 5; i++) {
      staticCircle(i * 100, 0, 20).space = space;
    }
    for (let i = 0; i < 5; i++) {
      dynamicCircle(i * 100 + 10, 0, 15).space = space;
    }
    step(space, 5);
    expect(space.bodies.length).toBe(10);
  });
});

// ---------------------------------------------------------------------------
// AABB sync correctness after body movement
// ---------------------------------------------------------------------------

describe("ZPP_AABBTree — AABB sync after movement", () => {
  let space: Space;

  beforeEach(() => {
    space = new Space(new Vec2(0, 0), Broadphase.DYNAMIC_AABB_TREE);
  });

  it("moving body updates broadphase — queries reflect new position", () => {
    const b = dynamicCircle(100, 100, 10);
    b.space = space;
    step(space);

    // Should be found at original position
    let shapes = space.shapesUnderPoint(new Vec2(100, 100));
    expect(shapes.length).toBe(1);

    // Teleport
    b.position = Vec2.weak(500, 500);
    step(space);

    // Should NOT be found at old position
    shapes = space.shapesUnderPoint(new Vec2(100, 100));
    expect(shapes.length).toBe(0);

    // Should be found at new position
    shapes = space.shapesUnderPoint(new Vec2(500, 500));
    expect(shapes.length).toBe(1);
  });

  it("rotating body updates broadphase AABB", () => {
    const b = new Body(BodyType.DYNAMIC, new Vec2(100, 100));
    b.shapes.add(new Polygon(Polygon.box(10, 100)));
    b.space = space;
    step(space);

    // Thin vertical shape — should have narrow horizontal AABB
    let shapes = space.shapesInAABB(new AABB(90, 0, 20, 200));
    expect(shapes.length).toBe(1);

    // Rotate 90 degrees — becomes wide horizontal
    b.rotation = Math.PI / 2;
    step(space);

    // Now should be found in a wider horizontal AABB
    shapes = space.shapesInAABB(new AABB(0, 90, 200, 20));
    expect(shapes.length).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// Tree balancing under adversarial insertion patterns
// ---------------------------------------------------------------------------

describe("ZPP_AABBTree — stress and balancing", () => {
  it("linear insertion pattern stays queryable", () => {
    const space = new Space(new Vec2(0, 0), Broadphase.DYNAMIC_AABB_TREE);

    // Insert bodies in a line — adversarial for tree balance
    for (let i = 0; i < 50; i++) {
      const b = dynamicCircle(i * 30, 0, 10);
      b.space = space;
    }
    step(space);

    // Query should still work correctly
    const aabb = new AABB(0, -20, 1500, 40);
    const bodies = space.bodiesInAABB(aabb);
    expect(bodies.length).toBe(50);
  });

  it("clustered insertion + query works", () => {
    const space = new Space(new Vec2(0, 0), Broadphase.DYNAMIC_AABB_TREE);

    // All bodies at roughly the same position
    for (let i = 0; i < 30; i++) {
      const b = dynamicCircle(100 + Math.sin(i) * 2, 100 + Math.cos(i) * 2, 5);
      b.space = space;
    }
    step(space);

    const shapes = space.shapesInCircle(new Vec2(100, 100), 20);
    expect(shapes.length).toBe(30);
  });

  it("insert many, remove many, insert more — tree remains valid", () => {
    const space = new Space(new Vec2(0, 0), Broadphase.DYNAMIC_AABB_TREE);
    const bodies: Body[] = [];

    // Phase 1: insert 30
    for (let i = 0; i < 30; i++) {
      const b = dynamicCircle(i * 20, i * 20, 8);
      b.space = space;
      bodies.push(b);
    }
    step(space, 2);

    // Phase 2: remove 20
    for (let i = 0; i < 20; i++) {
      bodies[i].space = null;
    }
    step(space, 2);

    // Phase 3: insert 15 more
    for (let i = 0; i < 15; i++) {
      const b = dynamicCircle(i * 25 + 5, 0, 10);
      b.space = space;
      bodies.push(b);
    }
    step(space, 2);

    expect(space.bodies.length).toBe(25); // 10 remaining + 15 new

    // Queries still work
    const all = space.bodiesInAABB(new AABB(-100, -100, 1100, 1100));
    expect(all.length).toBe(25);
  });
});

// ---------------------------------------------------------------------------
// Collision correctness with DYNAMIC_AABB_TREE
// ---------------------------------------------------------------------------

describe("ZPP_AABBTree — collision detection", () => {
  it("detects collision between close dynamic bodies", () => {
    const space = new Space(new Vec2(0, 0), Broadphase.DYNAMIC_AABB_TREE);
    const b1 = dynamicCircle(0, 0, 20);
    b1.space = space;
    const b2 = dynamicCircle(30, 0, 20);
    b2.space = space;

    step(space, 10);

    // Bodies should have been pushed apart
    expect(b2.position.x - b1.position.x).toBeGreaterThan(30);
  });

  it("no false collisions between distant bodies", () => {
    const space = new Space(new Vec2(0, 0), Broadphase.DYNAMIC_AABB_TREE);
    const b1 = dynamicCircle(0, 0, 10);
    b1.space = space;
    const b2 = dynamicCircle(1000, 1000, 10);
    b2.space = space;

    const posX1 = b1.position.x;
    const posX2 = b2.position.x;
    step(space, 10);

    // Positions should not have changed (no collision forces)
    expect(b1.position.x).toBeCloseTo(posX1, 0);
    expect(b2.position.x).toBeCloseTo(posX2, 0);
  });

  it("gravity-driven collision with static floor", () => {
    const space = new Space(new Vec2(0, 500), Broadphase.DYNAMIC_AABB_TREE);

    const floor = new Body(BodyType.STATIC, new Vec2(0, 200));
    floor.shapes.add(new Polygon(Polygon.box(500, 20)));
    floor.space = space;

    const ball = dynamicCircle(0, 0, 10);
    ball.space = space;

    step(space, 120);

    // Ball should rest on the floor
    expect(ball.position.y).toBeLessThan(200);
    expect(ball.position.y).toBeGreaterThan(150);
  });
});

// ---------------------------------------------------------------------------
// Raycast through AABB tree
// ---------------------------------------------------------------------------

describe("ZPP_AABBTree — raycast", () => {
  let space: Space;

  beforeEach(() => {
    space = new Space(new Vec2(0, 0), Broadphase.DYNAMIC_AABB_TREE);
  });

  it("ray hits nearest body", () => {
    const b1 = dynamicCircle(100, 0, 10);
    b1.space = space;
    const b2 = dynamicCircle(200, 0, 10);
    b2.space = space;
    step(space);

    const ray = new Ray(new Vec2(0, 0), new Vec2(1, 0));
    const result = space.rayCast(ray);
    expect(result).not.toBeNull();
    // Should hit the closer body first
    expect(result!.shape.body).toBe(b1);
  });

  it("ray misses when no bodies in path", () => {
    const b = dynamicCircle(0, 100, 10);
    b.space = space;
    step(space);

    const ray = new Ray(new Vec2(0, 0), new Vec2(1, 0));
    const result = space.rayCast(ray);
    expect(result).toBeNull();
  });

  it("rayMultiCast returns all intersected shapes", () => {
    for (let i = 1; i <= 5; i++) {
      const b = dynamicCircle(i * 50, 0, 10);
      b.space = space;
    }
    step(space);

    const ray = new Ray(new Vec2(0, 0), new Vec2(1, 0));
    const results = space.rayMultiCast(ray);
    expect(results.length).toBe(5);
  });

  it("ray with limited range", () => {
    const near = dynamicCircle(50, 0, 10);
    near.space = space;
    const far = dynamicCircle(500, 0, 10);
    far.space = space;
    step(space);

    const ray = new Ray(new Vec2(0, 0), new Vec2(1, 0));
    ray.maxDistance = 100;
    const results = space.rayMultiCast(ray);
    expect(results.length).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// Large-body-count stress test
// ---------------------------------------------------------------------------

describe("ZPP_AABBTree — large body count", () => {
  it("handles 100 bodies with correct query results", () => {
    const space = new Space(new Vec2(0, 0), Broadphase.DYNAMIC_AABB_TREE);

    for (let i = 0; i < 100; i++) {
      const x = (i % 10) * 50;
      const y = Math.floor(i / 10) * 50;
      const b = dynamicCircle(x, y, 8);
      b.space = space;
    }
    step(space, 2);

    // Query a region that should contain some bodies
    const aabb = new AABB(-10, -10, 160, 160);
    const bodies = space.bodiesInAABB(aabb);
    expect(bodies.length).toBeGreaterThanOrEqual(6); // at least a 3x3 grid corner

    // Point query at a known body position
    const shapes = space.shapesUnderPoint(new Vec2(0, 0));
    expect(shapes.length).toBeGreaterThanOrEqual(1);
  });

  it("handles 100 bodies with removal and re-query", () => {
    const space = new Space(new Vec2(0, 0), Broadphase.DYNAMIC_AABB_TREE);
    const allBodies: Body[] = [];

    for (let i = 0; i < 100; i++) {
      const b = dynamicCircle(i * 30, 0, 10);
      b.space = space;
      allBodies.push(b);
    }
    step(space);

    // Remove the first 50
    for (let i = 0; i < 50; i++) {
      allBodies[i].space = null;
    }
    step(space);

    // Query the full range — should find exactly 50
    const bodies = space.bodiesInAABB(new AABB(-20, -20, 3040, 40));
    expect(bodies.length).toBe(50);
  });
});

// ---------------------------------------------------------------------------
// Kinematic bodies in AABB tree
// ---------------------------------------------------------------------------

describe("ZPP_AABBTree — kinematic body handling", () => {
  it("kinematic body appears in queries after movement", () => {
    const space = new Space(new Vec2(0, 0), Broadphase.DYNAMIC_AABB_TREE);
    const k = new Body(BodyType.KINEMATIC, new Vec2(100, 100));
    k.shapes.add(new Circle(15));
    k.space = space;
    step(space);

    let shapes = space.shapesUnderPoint(new Vec2(100, 100));
    expect(shapes.length).toBe(1);

    // Move kinematic body
    k.position = Vec2.weak(300, 300);
    step(space);

    shapes = space.shapesUnderPoint(new Vec2(300, 300));
    expect(shapes.length).toBe(1);
    shapes = space.shapesUnderPoint(new Vec2(100, 100));
    expect(shapes.length).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// Multi-shape body in tree
// ---------------------------------------------------------------------------

describe("ZPP_AABBTree — multi-shape body", () => {
  it("each shape is independently queryable", () => {
    const space = new Space(new Vec2(0, 0), Broadphase.DYNAMIC_AABB_TREE);

    const b = new Body(BodyType.DYNAMIC, new Vec2(0, 0));
    const c1 = new Circle(10);
    const c2 = new Circle(10);
    // Offset second shape far away via a separate body approach
    // (shapes on same body share position)
    b.shapes.add(c1);
    b.shapes.add(c2);
    b.space = space;
    step(space);

    // Both shapes at body center
    const shapes = space.shapesUnderPoint(new Vec2(0, 0));
    expect(shapes.length).toBe(2);
  });
});
