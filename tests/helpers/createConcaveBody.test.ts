import { describe, it, expect } from "vitest";
import "../../src/core/engine";
import { createConcaveBody } from "../../src/helpers/createConcaveBody";
import { GeomPoly } from "../../src/geom/GeomPoly";
import { Vec2 } from "../../src/geom/Vec2";
import { Body } from "../../src/phys/Body";
import { BodyType } from "../../src/phys/BodyType";
import { Material } from "../../src/phys/Material";
import { InteractionFilter } from "../../src/dynamics/InteractionFilter";
import { Space } from "../../src/space/Space";
import { Polygon } from "../../src/shape/Polygon";

// ---------------------------------------------------------------------------
// Helpers — common polygon shapes
// ---------------------------------------------------------------------------

/** Convex triangle (3 vertices). */
function triangle(): Vec2[] {
  return [Vec2.get(0, 0), Vec2.get(40, 0), Vec2.get(20, 30)];
}

/** Convex square (4 vertices). */
function square(s = 40): Vec2[] {
  return [Vec2.get(0, 0), Vec2.get(s, 0), Vec2.get(s, s), Vec2.get(0, s)];
}

/** Concave L-shape (6 vertices). */
function lShape(): Vec2[] {
  return [
    Vec2.get(0, 0),
    Vec2.get(60, 0),
    Vec2.get(60, 20),
    Vec2.get(20, 20),
    Vec2.get(20, 60),
    Vec2.get(0, 60),
  ];
}

/** Concave U-shape (8 vertices). */
function uShape(): Vec2[] {
  return [
    Vec2.get(0, 0),
    Vec2.get(80, 0),
    Vec2.get(80, 60),
    Vec2.get(60, 60),
    Vec2.get(60, 20),
    Vec2.get(20, 20),
    Vec2.get(20, 60),
    Vec2.get(0, 60),
  ];
}

/** Concave plus/cross shape (12 vertices). */
function plusShape(): Vec2[] {
  return [
    Vec2.get(20, 0),
    Vec2.get(40, 0),
    Vec2.get(40, 20),
    Vec2.get(60, 20),
    Vec2.get(60, 40),
    Vec2.get(40, 40),
    Vec2.get(40, 60),
    Vec2.get(20, 60),
    Vec2.get(20, 40),
    Vec2.get(0, 40),
    Vec2.get(0, 20),
    Vec2.get(20, 20),
  ];
}

/** Concave arrow shape (7 vertices). */
function arrowShape(): Vec2[] {
  return [
    Vec2.get(0, 20),
    Vec2.get(40, 20),
    Vec2.get(40, 0),
    Vec2.get(70, 30),
    Vec2.get(40, 60),
    Vec2.get(40, 40),
    Vec2.get(0, 40),
  ];
}

/** Concave star shape (10 vertices). */
function starShape(): Vec2[] {
  const verts: Vec2[] = [];
  for (let i = 0; i < 5; i++) {
    const outerAngle = (i / 5) * Math.PI * 2 - Math.PI / 2;
    const innerAngle = ((i + 0.5) / 5) * Math.PI * 2 - Math.PI / 2;
    verts.push(Vec2.get(Math.cos(outerAngle) * 50, Math.sin(outerAngle) * 50));
    verts.push(Vec2.get(Math.cos(innerAngle) * 20, Math.sin(innerAngle) * 20));
  }
  return verts;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("createConcaveBody", () => {
  // -----------------------------------------------------------------------
  // Input validation
  // -----------------------------------------------------------------------

  describe("input validation", () => {
    it("should throw on null vertices", () => {
      expect(() => createConcaveBody(null as any)).toThrow(/null/);
    });

    it("should throw on undefined vertices", () => {
      expect(() => createConcaveBody(undefined as any)).toThrow(/null/);
    });

    it("should throw on non-array/non-GeomPoly input", () => {
      expect(() => createConcaveBody("bad" as any)).toThrow(/Array.*GeomPoly/);
    });

    it("should throw on fewer than 3 vertices", () => {
      expect(() => createConcaveBody([Vec2.get(0, 0), Vec2.get(10, 0)])).toThrow(/3 vertices/);
    });

    it("should throw on empty array", () => {
      expect(() => createConcaveBody([])).toThrow(/3 vertices/);
    });

    it("should throw on null vertex in array", () => {
      expect(() => createConcaveBody([Vec2.get(0, 0), null as any, Vec2.get(10, 10)])).toThrow(
        /vertices\[1\] is null/,
      );
    });

    it("should throw on degenerate (collinear) vertices", () => {
      expect(() => createConcaveBody([Vec2.get(0, 0), Vec2.get(10, 0), Vec2.get(20, 0)])).toThrow(
        /degenerate/i,
      );
    });

    it("should reject invalid polygons (degenerate or self-intersecting)", () => {
      // Bowtie: edges cross, detected as degenerate (zero net area)
      expect(() =>
        createConcaveBody([Vec2.get(0, 0), Vec2.get(40, 40), Vec2.get(40, 0), Vec2.get(0, 40)]),
      ).toThrow(/degenerate|self-intersecting/i);
    });

    it("should throw on disposed GeomPoly", () => {
      const gp = new GeomPoly(triangle());
      gp.dispose();
      expect(() => createConcaveBody(gp)).toThrow(/disposed/);
    });
  });

  // -----------------------------------------------------------------------
  // Convex input (no decomposition needed)
  // -----------------------------------------------------------------------

  describe("convex input (passthrough)", () => {
    it("should create a body with 1 shape for a convex triangle", () => {
      const body = createConcaveBody(triangle());
      expect(body).toBeInstanceOf(Body);
      expect(body.shapes.length).toBe(1);
    });

    it("should create a body with 1 shape for a convex square", () => {
      const body = createConcaveBody(square());
      expect(body.shapes.length).toBe(1);
    });

    it("should create a body with 1 shape for a convex regular hexagon", () => {
      const verts: Vec2[] = [];
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * Math.PI * 2;
        verts.push(Vec2.get(Math.cos(a) * 40, Math.sin(a) * 40));
      }
      const body = createConcaveBody(verts);
      expect(body.shapes.length).toBe(1);
    });
  });

  // -----------------------------------------------------------------------
  // Concave input (decomposition)
  // -----------------------------------------------------------------------

  describe("concave decomposition", () => {
    it("should decompose an L-shape into multiple convex shapes", () => {
      const body = createConcaveBody(lShape());
      expect(body.shapes.length).toBeGreaterThan(1);
      // Each shape must be a Polygon
      for (const shape of body.shapes) {
        expect(shape.isPolygon()).toBe(true);
      }
    });

    it("should decompose a U-shape into multiple convex shapes", () => {
      const body = createConcaveBody(uShape());
      expect(body.shapes.length).toBeGreaterThan(1);
    });

    it("should decompose a plus/cross shape", () => {
      const body = createConcaveBody(plusShape());
      expect(body.shapes.length).toBeGreaterThan(1);
    });

    it("should decompose an arrow shape", () => {
      const body = createConcaveBody(arrowShape());
      expect(body.shapes.length).toBeGreaterThan(1);
    });

    it("should decompose a star shape", () => {
      const body = createConcaveBody(starShape());
      expect(body.shapes.length).toBeGreaterThan(1);
    });

    it("should produce valid Polygon shapes (no CONCAVE validation)", () => {
      const body = createConcaveBody(lShape());
      for (const shape of body.shapes) {
        const poly = shape as Polygon;
        expect(poly.validity().toString()).not.toMatch(/CONCAVE/);
      }
    });
  });

  // -----------------------------------------------------------------------
  // Options
  // -----------------------------------------------------------------------

  describe("options", () => {
    it("should default to BodyType.DYNAMIC", () => {
      const body = createConcaveBody(lShape());
      expect(body.type).toBe(BodyType.DYNAMIC);
    });

    it("should accept BodyType.STATIC", () => {
      const body = createConcaveBody(lShape(), { type: BodyType.STATIC });
      expect(body.type).toBe(BodyType.STATIC);
    });

    it("should accept BodyType.KINEMATIC", () => {
      const body = createConcaveBody(lShape(), { type: BodyType.KINEMATIC });
      expect(body.type).toBe(BodyType.KINEMATIC);
    });

    it("should set body position", () => {
      const body = createConcaveBody(lShape(), {
        position: Vec2.get(100, 200),
      });
      expect(body.position.x).toBeCloseTo(100, 5);
      expect(body.position.y).toBeCloseTo(200, 5);
    });

    it("should apply material to all shapes", () => {
      const mat = new Material(0.5, 0.3, 0.2, 2.0);
      const body = createConcaveBody(lShape(), { material: mat });
      for (const shape of body.shapes) {
        expect(shape.material.elasticity).toBeCloseTo(0.5, 5);
        expect(shape.material.dynamicFriction).toBeCloseTo(0.3, 5);
      }
    });

    it("should apply filter to all shapes", () => {
      const filter = new InteractionFilter(2, 4);
      const body = createConcaveBody(lShape(), { filter });
      for (const shape of body.shapes) {
        expect(shape.filter.collisionGroup).toBe(2);
        expect(shape.filter.collisionMask).toBe(4);
      }
    });

    it("should accept delaunay option", () => {
      // Should not throw, may produce different decomposition
      const body = createConcaveBody(lShape(), { delaunay: true });
      expect(body.shapes.length).toBeGreaterThan(0);
    });

    it("should support simplification", () => {
      // Create a polygon with many vertices on a roughly L-shaped path
      // with small perturbations that simplify() should remove
      const verts = [
        Vec2.get(0, 0),
        Vec2.get(30, 0.1), // nearly collinear
        Vec2.get(60, 0),
        Vec2.get(60, 20),
        Vec2.get(20.1, 20), // nearly collinear
        Vec2.get(20, 20),
        Vec2.get(20, 60),
        Vec2.get(0, 60),
      ];
      const body = createConcaveBody(verts, { simplify: 1 });
      expect(body.shapes.length).toBeGreaterThan(0);
    });

    it("should throw when simplification makes polygon degenerate", () => {
      // A very thin triangle that becomes degenerate with large epsilon
      const verts = [Vec2.get(0, 0), Vec2.get(100, 0.01), Vec2.get(50, 0.005)];
      // The simplification might collapse it, but this polygon is already
      // likely degenerate — test that the error is thrown
      expect(() => createConcaveBody(verts, { simplify: 100 })).toThrow();
    });
  });

  // -----------------------------------------------------------------------
  // GeomPoly input
  // -----------------------------------------------------------------------

  describe("GeomPoly input", () => {
    it("should accept a GeomPoly as input", () => {
      const gp = new GeomPoly(lShape());
      const body = createConcaveBody(gp);
      expect(body.shapes.length).toBeGreaterThan(1);
    });

    it("should not mutate the input GeomPoly", () => {
      const gp = new GeomPoly(lShape());
      const sizeBefore = gp.size();
      createConcaveBody(gp);
      expect(gp.size()).toBe(sizeBefore);
      expect(gp.zpp_disp).toBe(false);
    });

    it("should accept convex GeomPoly", () => {
      const gp = new GeomPoly(square());
      const body = createConcaveBody(gp);
      expect(body.shapes.length).toBe(1);
    });
  });

  // -----------------------------------------------------------------------
  // Physics integration
  // -----------------------------------------------------------------------

  describe("physics integration", () => {
    it("should add concave body to space and simulate", () => {
      const space = new Space(new Vec2(0, 100));

      // Static floor
      const floor = new Body(BodyType.STATIC, new Vec2(0, 200));
      floor.shapes.add(new Polygon(Polygon.box(500, 20)));
      floor.space = space;

      // Concave dynamic body
      const body = createConcaveBody(lShape(), {
        position: Vec2.get(0, 0),
      });
      body.space = space;

      const yBefore = body.position.y;
      for (let i = 0; i < 60; i++) space.step(1 / 60);
      // Body should have fallen due to gravity
      expect(body.position.y).toBeGreaterThan(yBefore);
    });

    it("should work with static concave body as terrain", () => {
      const space = new Space(new Vec2(0, 100));

      // Concave static terrain
      const terrain = createConcaveBody(uShape(), {
        type: BodyType.STATIC,
        position: Vec2.get(0, 100),
      });
      terrain.space = space;

      // Dynamic ball
      const ball = new Body(BodyType.DYNAMIC, new Vec2(40, 0));
      ball.shapes.add(new Polygon(Polygon.box(10, 10)));
      ball.space = space;

      // Should not throw during simulation
      for (let i = 0; i < 120; i++) space.step(1 / 60);
      expect(ball.position.y).toBeGreaterThan(0);
    });

    it("should compute correct total mass from all shapes", () => {
      const body = createConcaveBody(lShape());
      expect(body.mass).toBeGreaterThan(0);
      expect(isFinite(body.mass)).toBe(true);
    });

    it("should compute inertia from all shapes", () => {
      const body = createConcaveBody(lShape());
      expect(body.inertia).toBeGreaterThan(0);
      expect(isFinite(body.inertia)).toBe(true);
    });
  });

  // -----------------------------------------------------------------------
  // Edge cases
  // -----------------------------------------------------------------------

  describe("edge cases", () => {
    it("should handle exactly 3 vertices (triangle — always convex)", () => {
      const body = createConcaveBody(triangle());
      expect(body.shapes.length).toBe(1);
    });

    it("should handle a large vertex count", () => {
      // Create a concave star with many points
      const verts: Vec2[] = [];
      const n = 20;
      for (let i = 0; i < n; i++) {
        const outer = (i / n) * Math.PI * 2;
        const inner = ((i + 0.5) / n) * Math.PI * 2;
        verts.push(Vec2.get(Math.cos(outer) * 80, Math.sin(outer) * 80));
        verts.push(Vec2.get(Math.cos(inner) * 30, Math.sin(inner) * 30));
      }
      const body = createConcaveBody(verts);
      expect(body.shapes.length).toBeGreaterThan(1);
    });

    it("should handle concave polygon with material and position combined", () => {
      const mat = new Material(0.8, 0.1, 0.05, 3.0);
      const body = createConcaveBody(plusShape(), {
        type: BodyType.DYNAMIC,
        position: Vec2.get(50, 50),
        material: mat,
        delaunay: true,
      });
      expect(body.shapes.length).toBeGreaterThan(1);
      expect(body.position.x).toBeCloseTo(50, 5);
      for (const shape of body.shapes) {
        expect(shape.material.elasticity).toBeCloseTo(0.8, 5);
      }
    });

    it("should handle clockwise winding order", () => {
      // Reverse the L-shape winding
      const verts = lShape().reverse();
      const body = createConcaveBody(verts);
      expect(body.shapes.length).toBeGreaterThan(0);
    });
  });
});
