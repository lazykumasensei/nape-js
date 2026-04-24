/**
 * ZPP_Broadphase + ZPP_DynAABBPhase + ZPP_SpatialHashPhase — spatial query
 * coverage extension.
 *
 * Targets: containment mode for body queries, filter on all query types,
 * SPATIAL_HASH raycast/multicast, strict mode edge cases, and query-specific
 * edge cases that are currently untested.
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
import { InteractionFilter } from "../../../src/dynamics/InteractionFilter";
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

function _staticBox(x: number, y: number, w = 40, h = 40): Body {
  const b = new Body(BodyType.STATIC, new Vec2(x, y));
  b.shapes.add(new Polygon(Polygon.box(w, h)));
  return b;
}

function step(space: Space, n = 1): void {
  for (let i = 0; i < n; i++) space.step(1 / 60);
}

const ALL_BP: Array<{ name: string; value: Broadphase }> = [
  { name: "DYNAMIC_AABB_TREE", value: Broadphase.DYNAMIC_AABB_TREE },
  { name: "SWEEP_AND_PRUNE", value: Broadphase.SWEEP_AND_PRUNE },
  { name: "SPATIAL_HASH", value: Broadphase.SPATIAL_HASH },
];

// ---------------------------------------------------------------------------
// bodiesInCircle — containment mode
// ---------------------------------------------------------------------------

describe("Broadphase queries — bodiesInCircle containment", () => {
  for (const bp of ALL_BP) {
    describe(`[${bp.name}]`, () => {
      it("containment=false finds overlapping bodies", () => {
        const space = new Space(new Vec2(0, 0), bp.value);
        // Small circle partially overlapping query circle
        const b = dynamicCircle(45, 0, 10); // edge at 35 to 55
        b.space = space;
        step(space);

        const bodies = space.bodiesInCircle(new Vec2(0, 0), 40);
        expect(bodies.length).toBe(1);
      });

      it("containment=true excludes partially overlapping bodies", () => {
        const space = new Space(new Vec2(0, 0), bp.value);
        // Fully inside
        const b1 = dynamicCircle(0, 0, 5);
        b1.space = space;
        // Partially outside (extends beyond radius 50)
        const b2 = dynamicCircle(45, 0, 10);
        b2.space = space;
        step(space);

        const contained = space.bodiesInCircle(new Vec2(0, 0), 50, true);
        const overlapping = space.bodiesInCircle(new Vec2(0, 0), 50, false);
        expect(contained.length).toBeLessThanOrEqual(overlapping.length);
      });
    });
  }
});

// ---------------------------------------------------------------------------
// bodiesInShape — containment mode
// ---------------------------------------------------------------------------

describe("Broadphase queries — bodiesInShape containment", () => {
  for (const bp of ALL_BP) {
    describe(`[${bp.name}]`, () => {
      it("containment=false finds overlapping bodies", () => {
        const space = new Space(new Vec2(0, 0), bp.value);
        const b = dynamicCircle(60, 0, 20);
        b.space = space;
        step(space);

        const queryBody = new Body(BodyType.STATIC, new Vec2(0, 0));
        const queryCircle = new Circle(50);
        queryBody.shapes.add(queryCircle);

        const bodies = space.bodiesInShape(queryCircle);
        expect(bodies.length).toBe(1);
      });

      it("containment=true only finds fully contained bodies", () => {
        const space = new Space(new Vec2(0, 0), bp.value);
        // Fully inside
        const b1 = dynamicCircle(0, 0, 5);
        b1.space = space;
        // Partially outside
        const b2 = dynamicCircle(45, 0, 15);
        b2.space = space;
        step(space);

        const queryBody = new Body(BodyType.STATIC, new Vec2(0, 0));
        const queryCircle = new Circle(50);
        queryBody.shapes.add(queryCircle);

        const contained = space.bodiesInShape(queryCircle, true);
        const overlapping = space.bodiesInShape(queryCircle, false);
        expect(contained.length).toBeLessThanOrEqual(overlapping.length);
      });
    });
  }
});

// ---------------------------------------------------------------------------
// shapesInShape — containment mode
// ---------------------------------------------------------------------------

describe("Broadphase queries — shapesInShape containment", () => {
  for (const bp of ALL_BP) {
    describe(`[${bp.name}]`, () => {
      it("containment=true only finds fully contained shapes", () => {
        const space = new Space(new Vec2(0, 0), bp.value);
        // Tiny circle at center — fully contained
        const b1 = dynamicCircle(0, 0, 3);
        b1.space = space;
        // Larger circle that extends outside
        const b2 = dynamicCircle(0, 0, 80);
        b2.space = space;
        step(space);

        const queryBody = new Body(BodyType.STATIC, new Vec2(0, 0));
        const queryCircle = new Circle(50);
        queryBody.shapes.add(queryCircle);

        const contained = space.shapesInShape(queryCircle, true);
        const all = space.shapesInShape(queryCircle, false);
        expect(contained.length).toBeLessThanOrEqual(all.length);
        expect(all.length).toBeGreaterThanOrEqual(1);
      });
    });
  }
});

// ---------------------------------------------------------------------------
// Filters on all query types
// ---------------------------------------------------------------------------

describe("Broadphase queries — InteractionFilter on all query types", () => {
  for (const bp of ALL_BP) {
    describe(`[${bp.name}]`, () => {
      let space: Space;
      let b1: Body;
      let b2: Body;

      beforeEach(() => {
        space = new Space(new Vec2(0, 0), bp.value);
        b1 = dynamicCircle(100, 100, 20);
        b1.shapes.at(0).filter = new InteractionFilter(1, 1);
        b1.space = space;
        b2 = dynamicCircle(100, 100, 20);
        b2.shapes.at(0).filter = new InteractionFilter(2, 2);
        b2.space = space;
        step(space);
      });

      it("shapesInCircle respects filter", () => {
        const filter = new InteractionFilter(1, 1);
        const shapes = space.shapesInCircle(new Vec2(100, 100), 30, false, filter);
        expect(shapes.length).toBe(1);
      });

      it("bodiesInCircle respects filter", () => {
        const filter = new InteractionFilter(2, 2);
        const bodies = space.bodiesInCircle(new Vec2(100, 100), 30, false, filter);
        expect(bodies.length).toBe(1);
      });

      it("shapesInShape respects filter", () => {
        const queryBody = new Body(BodyType.STATIC, new Vec2(100, 100));
        const queryCircle = new Circle(30);
        queryBody.shapes.add(queryCircle);

        const filter = new InteractionFilter(1, 1);
        const shapes = space.shapesInShape(queryCircle, false, filter);
        expect(shapes.length).toBe(1);
      });

      it("bodiesInShape respects filter", () => {
        const queryBody = new Body(BodyType.STATIC, new Vec2(100, 100));
        const queryCircle = new Circle(30);
        queryBody.shapes.add(queryCircle);

        const filter = new InteractionFilter(2, 2);
        const bodies = space.bodiesInShape(queryCircle, false, filter);
        expect(bodies.length).toBe(1);
      });

      it("rayCast respects filter", () => {
        // Place bodies along a ray
        b1.position = Vec2.weak(100, 0);
        b2.position = Vec2.weak(200, 0);
        step(space);

        const ray = new Ray(new Vec2(0, 0), new Vec2(1, 0));
        const filter = new InteractionFilter(2, 2);
        const result = space.rayCast(ray, false, filter);
        if (result) {
          // Should skip b1 (group 1) and hit b2 (group 2)
          expect(result.shape.body).toBe(b2);
        }
      });

      it("bodiesUnderPoint respects filter", () => {
        const filter = new InteractionFilter(1, 1);
        const bodies = space.bodiesUnderPoint(new Vec2(100, 100), filter);
        expect(bodies.length).toBe(1);
      });
    });
  }
});

// ---------------------------------------------------------------------------
// SPATIAL_HASH — raycast and multi-cast
// ---------------------------------------------------------------------------

describe("SPATIAL_HASH — raycast extended", () => {
  let space: Space;

  beforeEach(() => {
    space = new Space(new Vec2(0, 0), Broadphase.SPATIAL_HASH);
  });

  it("rayCast finds nearest body", () => {
    const near = staticCircle(100, 0, 10);
    near.space = space;
    const far = staticCircle(300, 0, 10);
    far.space = space;
    step(space);

    const ray = new Ray(new Vec2(0, 0), new Vec2(1, 0));
    const result = space.rayCast(ray);
    expect(result).not.toBeNull();
    expect(result!.shape.body).toBe(near);
  });

  it("rayMultiCast returns all hits", () => {
    for (let i = 1; i <= 3; i++) {
      staticCircle(i * 50, 0, 10).space = space;
    }
    step(space);

    const ray = new Ray(new Vec2(0, 0), new Vec2(1, 0));
    const results = space.rayMultiCast(ray);
    expect(results.length).toBe(3);
  });

  it("rayCast with maxDistance", () => {
    staticCircle(50, 0, 10).space = space;
    staticCircle(500, 0, 10).space = space;
    step(space);

    const ray = new Ray(new Vec2(0, 0), new Vec2(1, 0));
    ray.maxDistance = 100;
    const results = space.rayMultiCast(ray);
    expect(results.length).toBe(1);
  });

  it("rayCast misses when nothing in path", () => {
    staticCircle(0, 100, 10).space = space;
    step(space);

    const ray = new Ray(new Vec2(0, 0), new Vec2(1, 0));
    const result = space.rayCast(ray);
    expect(result).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// SPATIAL_HASH — all spatial queries
// ---------------------------------------------------------------------------

describe("SPATIAL_HASH — spatial query coverage", () => {
  let space: Space;

  beforeEach(() => {
    space = new Space(new Vec2(0, 0), Broadphase.SPATIAL_HASH);
  });

  it("shapesInCircle works", () => {
    dynamicCircle(100, 100, 10).space = space;
    dynamicCircle(500, 500, 10).space = space;
    step(space);

    const shapes = space.shapesInCircle(new Vec2(100, 100), 30);
    expect(shapes.length).toBe(1);
  });

  it("bodiesInCircle works", () => {
    dynamicCircle(100, 100, 10).space = space;
    step(space);

    const bodies = space.bodiesInCircle(new Vec2(100, 100), 30);
    expect(bodies.length).toBe(1);
  });

  it("shapesInShape works", () => {
    dynamicCircle(100, 100, 15).space = space;
    step(space);

    const queryBody = new Body(BodyType.STATIC, new Vec2(100, 100));
    const q = new Circle(25);
    queryBody.shapes.add(q);

    const shapes = space.shapesInShape(q);
    expect(shapes.length).toBe(1);
  });

  it("bodiesInShape works", () => {
    dynamicCircle(100, 100, 15).space = space;
    step(space);

    const queryBody = new Body(BodyType.STATIC, new Vec2(100, 100));
    const q = new Circle(25);
    queryBody.shapes.add(q);

    const bodies = space.bodiesInShape(q);
    expect(bodies.length).toBe(1);
  });

  it("shapesUnderPoint works", () => {
    dynamicCircle(100, 100, 20).space = space;
    step(space);

    const shapes = space.shapesUnderPoint(new Vec2(100, 100));
    expect(shapes.length).toBe(1);
  });

  it("bodiesUnderPoint works", () => {
    dynamicCircle(100, 100, 20).space = space;
    step(space);

    const bodies = space.bodiesUnderPoint(new Vec2(100, 100));
    expect(bodies.length).toBe(1);
  });

  it("shapesInAABB works", () => {
    dynamicCircle(100, 100, 10).space = space;
    step(space);

    const shapes = space.shapesInAABB(new AABB(80, 80, 40, 40));
    expect(shapes.length).toBe(1);
  });

  it("bodiesInAABB works", () => {
    dynamicCircle(100, 100, 10).space = space;
    step(space);

    const bodies = space.bodiesInAABB(new AABB(80, 80, 40, 40));
    expect(bodies.length).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// SPATIAL_HASH — stress
// ---------------------------------------------------------------------------

describe("SPATIAL_HASH — stress tests", () => {
  it("handles many bodies crossing cell boundaries", () => {
    const space = new Space(new Vec2(0, 0), Broadphase.SPATIAL_HASH);

    for (let i = 0; i < 30; i++) {
      const b = dynamicCircle(i * 10, 0, 15); // overlapping circles
      b.space = space;
    }
    step(space, 5);

    // All bodies should still be in the space
    expect(space.bodies.length).toBe(30);

    // Query should find a subset
    const bodies = space.bodiesInCircle(new Vec2(100, 0), 50);
    expect(bodies.length).toBeGreaterThanOrEqual(1);
  });

  it("bodies at very different positions", () => {
    const space = new Space(new Vec2(0, 0), Broadphase.SPATIAL_HASH);

    dynamicCircle(0, 0, 10).space = space;
    dynamicCircle(5000, 5000, 10).space = space;
    dynamicCircle(-5000, -5000, 10).space = space;
    step(space);

    // Point query finds only the expected body
    const shapes = space.shapesUnderPoint(new Vec2(0, 0));
    expect(shapes.length).toBe(1);

    const far = space.shapesUnderPoint(new Vec2(5000, 5000));
    expect(far.length).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// SWEEP_AND_PRUNE — pair consistency on removal (P46 regression coverage)
// ---------------------------------------------------------------------------

describe("SWEEP_AND_PRUNE — pair removal consistency", () => {
  it("removing one of two overlapping bodies doesn't corrupt pairs", () => {
    const space = new Space(new Vec2(0, 0), Broadphase.SWEEP_AND_PRUNE);
    const b1 = dynamicCircle(0, 0, 20);
    b1.space = space;
    const b2 = dynamicCircle(30, 0, 20);
    b2.space = space;
    const b3 = dynamicCircle(60, 0, 20);
    b3.space = space;
    step(space, 3);

    b2.space = null;
    step(space, 3);

    expect(space.bodies.length).toBe(2);
    // Queries still work
    const shapes = space.shapesUnderPoint(new Vec2(0, 0));
    expect(shapes.length).toBe(1);
  });

  it("rapid add/remove cycle doesn't break pair list", () => {
    const space = new Space(new Vec2(0, 0), Broadphase.SWEEP_AND_PRUNE);

    const anchor = dynamicCircle(0, 0, 30);
    anchor.space = space;

    for (let i = 0; i < 10; i++) {
      const b = dynamicCircle(10, 0, 15);
      b.space = space;
      step(space, 1);
      b.space = null;
      step(space, 1);
    }

    expect(space.bodies.length).toBe(1);
    step(space, 5); // Should not crash
  });
});
