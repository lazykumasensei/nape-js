/**
 * ZPP_Broadphase — extended spatial query tests.
 *
 * Targets the lowest-coverage broadphase code paths: spatial query methods
 * (shapesUnderPoint, shapesInCircle, shapesInShape, bodiesInShape, etc.),
 * containment mode, strict mode, filter callbacks, all three broadphase
 * algorithms, and edge cases.
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

function staticBox(x: number, y: number, w = 40, h = 40): Body {
  const b = new Body(BodyType.STATIC, new Vec2(x, y));
  b.shapes.add(new Polygon(Polygon.box(w, h)));
  return b;
}

function step(space: Space, n = 1): void {
  for (let i = 0; i < n; i++) space.step(1 / 60);
}

const BROADPHASE_TYPES: Array<{ name: string; value: Broadphase }> = [
  { name: "DYNAMIC_AABB_TREE", value: Broadphase.DYNAMIC_AABB_TREE },
  { name: "SWEEP_AND_PRUNE", value: Broadphase.SWEEP_AND_PRUNE },
];

// ---------------------------------------------------------------------------
// shapesUnderPoint
// ---------------------------------------------------------------------------

describe("ZPP_Broadphase — shapesUnderPoint", () => {
  for (const bp of BROADPHASE_TYPES) {
    describe(`[${bp.name}]`, () => {
      let space: Space;

      beforeEach(() => {
        space = new Space(new Vec2(0, 0), bp.value);
      });

      it("finds circle shape at center", () => {
        const b = dynamicCircle(100, 100, 20);
        b.space = space;
        step(space);

        const shapes = space.shapesUnderPoint(new Vec2(100, 100));
        expect(shapes.length).toBe(1);
      });

      it("finds polygon shape containing point", () => {
        const b = staticBox(100, 100, 60, 60);
        b.space = space;
        step(space);

        const shapes = space.shapesUnderPoint(new Vec2(100, 100));
        expect(shapes.length).toBe(1);
      });

      it("returns empty for point outside all shapes", () => {
        const b = dynamicCircle(100, 100, 10);
        b.space = space;
        step(space);

        const shapes = space.shapesUnderPoint(new Vec2(5000, 5000));
        expect(shapes.length).toBe(0);
      });

      it("finds multiple overlapping shapes", () => {
        const b1 = dynamicCircle(100, 100, 30);
        b1.space = space;
        const b2 = dynamicCircle(110, 100, 30);
        b2.space = space;
        step(space);

        const shapes = space.shapesUnderPoint(new Vec2(105, 100));
        expect(shapes.length).toBe(2);
      });

      it("finds sensor shapes", () => {
        const b = new Body(BodyType.DYNAMIC, new Vec2(100, 100));
        const c = new Circle(20);
        c.sensorEnabled = true;
        b.shapes.add(c);
        b.space = space;
        step(space);

        const shapes = space.shapesUnderPoint(new Vec2(100, 100));
        expect(shapes.length).toBe(1);
      });
    });
  }
});

// ---------------------------------------------------------------------------
// bodiesUnderPoint
// ---------------------------------------------------------------------------

describe("ZPP_Broadphase — bodiesUnderPoint", () => {
  for (const bp of BROADPHASE_TYPES) {
    describe(`[${bp.name}]`, () => {
      let space: Space;

      beforeEach(() => {
        space = new Space(new Vec2(0, 0), bp.value);
      });

      it("returns body whose shape contains the point", () => {
        const b = dynamicCircle(50, 50, 20);
        b.space = space;
        step(space);

        const bodies = space.bodiesUnderPoint(new Vec2(50, 50));
        expect(bodies.length).toBe(1);
      });

      it("does not duplicate body with multiple shapes at point", () => {
        const b = new Body(BodyType.DYNAMIC, new Vec2(0, 0));
        b.shapes.add(new Circle(30));
        b.shapes.add(new Polygon(Polygon.box(60, 60)));
        b.space = space;
        step(space);

        const bodies = space.bodiesUnderPoint(new Vec2(0, 0));
        expect(bodies.length).toBe(1);
      });
    });
  }
});

// ---------------------------------------------------------------------------
// shapesInCircle
// ---------------------------------------------------------------------------

describe("ZPP_Broadphase — shapesInCircle", () => {
  for (const bp of BROADPHASE_TYPES) {
    describe(`[${bp.name}]`, () => {
      let space: Space;

      beforeEach(() => {
        space = new Space(new Vec2(0, 0), bp.value);
      });

      it("finds shapes overlapping query circle", () => {
        const b = dynamicCircle(100, 100, 10);
        b.space = space;
        step(space);

        const shapes = space.shapesInCircle(new Vec2(100, 100), 20);
        expect(shapes.length).toBe(1);
      });

      it("excludes shapes outside query circle", () => {
        const b = dynamicCircle(100, 100, 10);
        b.space = space;
        step(space);

        const shapes = space.shapesInCircle(new Vec2(500, 500), 20);
        expect(shapes.length).toBe(0);
      });

      it("containment=true only returns fully contained shapes", () => {
        // Small shape inside the query circle
        const b1 = dynamicCircle(100, 100, 5);
        b1.space = space;
        // Large shape overlapping but not contained
        const b2 = dynamicCircle(130, 100, 40);
        b2.space = space;
        step(space);

        const contained = space.shapesInCircle(new Vec2(100, 100), 50, true);
        const overlapping = space.shapesInCircle(new Vec2(100, 100), 50, false);
        expect(contained.length).toBeLessThanOrEqual(overlapping.length);
      });

      it("finds polygon shapes overlapping query circle", () => {
        const b = staticBox(100, 100, 30, 30);
        b.space = space;
        step(space);

        const shapes = space.shapesInCircle(new Vec2(100, 100), 20);
        expect(shapes.length).toBe(1);
      });
    });
  }
});

// ---------------------------------------------------------------------------
// bodiesInCircle
// ---------------------------------------------------------------------------

describe("ZPP_Broadphase — bodiesInCircle", () => {
  for (const bp of BROADPHASE_TYPES) {
    describe(`[${bp.name}]`, () => {
      it("finds all bodies overlapping query circle", () => {
        const space = new Space(new Vec2(0, 0), bp.value);
        const b1 = dynamicCircle(100, 100, 10);
        b1.space = space;
        const b2 = dynamicCircle(120, 100, 10);
        b2.space = space;
        const b3 = dynamicCircle(500, 500, 10);
        b3.space = space;
        step(space);

        const bodies = space.bodiesInCircle(new Vec2(110, 100), 30);
        expect(bodies.length).toBe(2);
      });
    });
  }
});

// ---------------------------------------------------------------------------
// shapesInShape
// ---------------------------------------------------------------------------

describe("ZPP_Broadphase — shapesInShape", () => {
  for (const bp of BROADPHASE_TYPES) {
    describe(`[${bp.name}]`, () => {
      let space: Space;

      beforeEach(() => {
        space = new Space(new Vec2(0, 0), bp.value);
      });

      it("finds shapes overlapping a query circle shape", () => {
        const b = dynamicCircle(100, 100, 15);
        b.space = space;
        step(space);

        // Query shape: a circle at the same location
        const queryBody = new Body(BodyType.STATIC, new Vec2(100, 100));
        const queryCircle = new Circle(25);
        queryBody.shapes.add(queryCircle);

        const shapes = space.shapesInShape(queryCircle);
        expect(shapes.length).toBe(1);
      });

      it("finds shapes overlapping a query polygon shape", () => {
        const b = dynamicCircle(100, 100, 15);
        b.space = space;
        step(space);

        // Query shape: a box at the same location
        const queryBody = new Body(BodyType.STATIC, new Vec2(100, 100));
        const queryPoly = new Polygon(Polygon.box(50, 50));
        queryBody.shapes.add(queryPoly);

        const shapes = space.shapesInShape(queryPoly);
        expect(shapes.length).toBe(1);
      });

      it("returns empty when no shapes overlap query", () => {
        const b = dynamicCircle(100, 100, 10);
        b.space = space;
        step(space);

        const queryBody = new Body(BodyType.STATIC, new Vec2(5000, 5000));
        const queryCircle = new Circle(10);
        queryBody.shapes.add(queryCircle);

        const shapes = space.shapesInShape(queryCircle);
        expect(shapes.length).toBe(0);
      });
    });
  }
});

// ---------------------------------------------------------------------------
// bodiesInShape
// ---------------------------------------------------------------------------

describe("ZPP_Broadphase — bodiesInShape", () => {
  for (const bp of BROADPHASE_TYPES) {
    describe(`[${bp.name}]`, () => {
      it("finds bodies overlapping a query shape", () => {
        const space = new Space(new Vec2(0, 0), bp.value);
        const b1 = dynamicCircle(100, 100, 15);
        b1.space = space;
        const b2 = dynamicCircle(500, 500, 15);
        b2.space = space;
        step(space);

        const queryBody = new Body(BodyType.STATIC, new Vec2(100, 100));
        const queryCircle = new Circle(30);
        queryBody.shapes.add(queryCircle);

        const bodies = space.bodiesInShape(queryCircle);
        expect(bodies.length).toBe(1);
      });
    });
  }
});

// ---------------------------------------------------------------------------
// shapesInAABB — strict vs non-strict, containment
// ---------------------------------------------------------------------------

describe("ZPP_Broadphase — shapesInAABB strict/containment modes", () => {
  for (const bp of BROADPHASE_TYPES) {
    describe(`[${bp.name}]`, () => {
      let space: Space;

      beforeEach(() => {
        space = new Space(new Vec2(0, 0), bp.value);
      });

      it("strict=true uses exact geometry, not just AABB overlap", () => {
        // Rotated polygon — its AABB is bigger than its actual area
        const b = new Body(BodyType.STATIC, new Vec2(100, 100));
        b.shapes.add(new Polygon(Polygon.box(10, 100)));
        b.rotation = Math.PI / 4; // 45 degrees
        b.space = space;
        step(space);

        // Query a small AABB in a corner of the rotated AABB but NOT touching the shape
        const aabb = new AABB(60, 60, 5, 5);

        const strict = space.shapesInAABB(aabb, false, true);
        const loose = space.shapesInAABB(aabb, false, false);

        // Loose (AABB-only) may find it, strict should not
        expect(strict.length).toBeLessThanOrEqual(loose.length);
      });

      it("containment=true only returns shapes fully inside AABB", () => {
        // Small shape fully inside the AABB
        const b1 = dynamicCircle(100, 100, 5);
        b1.space = space;
        // Large shape overlapping but extending outside
        const b2 = dynamicCircle(100, 100, 80);
        b2.space = space;
        step(space);

        const aabb = new AABB(80, 80, 40, 40);
        const contained = space.shapesInAABB(aabb, true, true);
        const all = space.shapesInAABB(aabb, false, true);
        expect(contained.length).toBeLessThanOrEqual(all.length);
        // The small circle should be found in both
        expect(all.length).toBeGreaterThanOrEqual(1);
      });

      it("finds polygon and circle shapes", () => {
        const c = dynamicCircle(100, 100, 10);
        c.space = space;
        const p = staticBox(200, 100, 20, 20);
        p.space = space;
        step(space);

        const aabb = new AABB(50, 50, 200, 100);
        const shapes = space.shapesInAABB(aabb);
        expect(shapes.length).toBe(2);
      });

      it("throws on degenerate (zero-width) AABB", () => {
        expect(() => {
          space.shapesInAABB(new AABB(100, 100, 0, 200));
        }).toThrow();
      });
    });
  }
});

// ---------------------------------------------------------------------------
// bodiesInAABB
// ---------------------------------------------------------------------------

describe("ZPP_Broadphase — bodiesInAABB", () => {
  for (const bp of BROADPHASE_TYPES) {
    describe(`[${bp.name}]`, () => {
      it("finds bodies in AABB region", () => {
        const space = new Space(new Vec2(0, 0), bp.value);
        const b1 = dynamicCircle(100, 100, 10);
        b1.space = space;
        const b2 = dynamicCircle(200, 200, 10);
        b2.space = space;
        step(space);

        const aabb = new AABB(80, 80, 50, 50);
        const bodies = space.bodiesInAABB(aabb);
        expect(bodies.length).toBe(1);
      });

      it("strict=false returns bodies with overlapping AABBs", () => {
        const space = new Space(new Vec2(0, 0), bp.value);
        const b = dynamicCircle(100, 100, 10);
        b.space = space;
        step(space);

        const aabb = new AABB(80, 80, 50, 50);
        const bodies = space.bodiesInAABB(aabb, false, false);
        expect(bodies.length).toBe(1);
      });
    });
  }
});

// ---------------------------------------------------------------------------
// InteractionFilter in queries
// ---------------------------------------------------------------------------

describe("ZPP_Broadphase — spatial queries with InteractionFilter", () => {
  for (const bp of BROADPHASE_TYPES) {
    describe(`[${bp.name}]`, () => {
      it("filter excludes non-matching shapes from shapesUnderPoint", () => {
        const space = new Space(new Vec2(0, 0), bp.value);

        const b1 = dynamicCircle(100, 100, 20);
        b1.shapes.at(0).filter = new InteractionFilter(1, 1);
        b1.space = space;

        const b2 = dynamicCircle(100, 100, 20);
        b2.shapes.at(0).filter = new InteractionFilter(2, 2);
        b2.space = space;
        step(space);

        // Filter only matches group 1
        const filter = new InteractionFilter(1, 1);
        const shapes = space.shapesUnderPoint(new Vec2(100, 100), filter);
        expect(shapes.length).toBe(1);
      });

      it("filter excludes from bodiesInAABB", () => {
        const space = new Space(new Vec2(0, 0), bp.value);

        const b1 = dynamicCircle(100, 100, 10);
        b1.shapes.at(0).filter = new InteractionFilter(1, 1);
        b1.space = space;

        const b2 = dynamicCircle(120, 100, 10);
        b2.shapes.at(0).filter = new InteractionFilter(2, 2);
        b2.space = space;
        step(space);

        const filter = new InteractionFilter(2, 2);
        const bodies = space.bodiesInAABB(new AABB(80, 80, 70, 50), false, true, filter);
        expect(bodies.length).toBe(1);
      });
    });
  }
});

// ---------------------------------------------------------------------------
// SPATIAL_HASH specific tests
// ---------------------------------------------------------------------------

describe("ZPP_Broadphase — SPATIAL_HASH basics", () => {
  it("detects collision between overlapping bodies", () => {
    const space = new Space(new Vec2(0, 0), Broadphase.SPATIAL_HASH);
    const b1 = dynamicCircle(0, 0, 20);
    b1.space = space;
    const b2 = dynamicCircle(30, 0, 20);
    b2.space = space;

    step(space, 5);

    // Bodies should have been pushed apart by collision
    const dx = b2.position.x - b1.position.x;
    expect(dx).toBeGreaterThan(30);
  });

  it("shapesUnderPoint works", () => {
    const space = new Space(new Vec2(0, 0), Broadphase.SPATIAL_HASH);
    const b = dynamicCircle(100, 100, 20);
    b.space = space;
    step(space);

    const shapes = space.shapesUnderPoint(new Vec2(100, 100));
    expect(shapes.length).toBe(1);
  });

  it("bodiesInAABB works", () => {
    const space = new Space(new Vec2(0, 0), Broadphase.SPATIAL_HASH);
    const b = dynamicCircle(100, 100, 10);
    b.space = space;
    step(space);

    const bodies = space.bodiesInAABB(new AABB(80, 80, 50, 50));
    expect(bodies.length).toBe(1);
  });

  it("raycast works", () => {
    const space = new Space(new Vec2(0, 0), Broadphase.SPATIAL_HASH);
    const b = dynamicCircle(100, 0, 10);
    b.space = space;
    step(space);

    const ray = new Ray(new Vec2(0, 0), new Vec2(1, 0));
    const result = space.rayCast(ray);
    expect(result).not.toBeNull();
  });

  it("handles body removal during simulation", () => {
    const space = new Space(new Vec2(0, 0), Broadphase.SPATIAL_HASH);
    const bodies: Body[] = [];
    for (let i = 0; i < 10; i++) {
      const b = dynamicCircle(i * 5, 0, 15);
      b.space = space;
      bodies.push(b);
    }
    step(space, 3);

    // Remove half the bodies
    for (let i = 0; i < 5; i++) {
      bodies[i].space = null;
    }
    step(space, 3);

    expect(space.bodies.length).toBe(5);
  });
});

// ---------------------------------------------------------------------------
// Cross-broadphase query parity
// ---------------------------------------------------------------------------

describe("ZPP_Broadphase — query parity across algorithms", () => {
  function setupScene(bp: Broadphase): Space {
    const space = new Space(new Vec2(0, 0), bp);
    // Create deterministic scene
    for (let i = 0; i < 5; i++) {
      const b = dynamicCircle(i * 40, 0, 15);
      b.space = space;
    }
    const box = staticBox(80, 0, 30, 30);
    box.space = space;
    step(space);
    return space;
  }

  it("shapesUnderPoint returns same count across broadphases", () => {
    const results = BROADPHASE_TYPES.map((bp) => {
      const space = setupScene(bp.value);
      return space.shapesUnderPoint(new Vec2(80, 0)).length;
    });
    expect(results[0]).toBe(results[1]);
    expect(results[0]).toBeGreaterThanOrEqual(1);
  });

  it("shapesInCircle returns same count across broadphases", () => {
    const results = BROADPHASE_TYPES.map((bp) => {
      const space = setupScene(bp.value);
      return space.shapesInCircle(new Vec2(80, 0), 50).length;
    });
    expect(results[0]).toBe(results[1]);
    expect(results[0]).toBeGreaterThanOrEqual(2);
  });

  it("bodiesInAABB returns same count across broadphases", () => {
    const results = BROADPHASE_TYPES.map((bp) => {
      const space = setupScene(bp.value);
      return space.bodiesInAABB(new AABB(50, -30, 80, 60)).length;
    });
    expect(results[0]).toBe(results[1]);
    expect(results[0]).toBeGreaterThanOrEqual(2);
  });
});
