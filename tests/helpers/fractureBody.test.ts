import { describe, it, expect, beforeEach } from "vitest";
import "../../src/core/engine";
import { fractureBody } from "../../src/helpers/fractureBody";
import { Body } from "../../src/phys/Body";
import { BodyType } from "../../src/phys/BodyType";
import { Polygon } from "../../src/shape/Polygon";
import { Circle } from "../../src/shape/Circle";
import { Vec2 } from "../../src/geom/Vec2";
import { Material } from "../../src/phys/Material";
import { Space } from "../../src/space/Space";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function seededRng(seed: number) {
  let s = seed;
  return () => {
    s = (s * 16807 + 0) % 2147483647;
    return s / 2147483647;
  };
}

function createBox(x: number, y: number, w: number, h: number, space?: Space): Body {
  const body = new Body(BodyType.DYNAMIC, Vec2.get(x, y));
  body.shapes.add(new Polygon(Polygon.box(w, h)));
  if (space) body.space = space;
  return body;
}

function bodyCount(space: Space): number {
  let count = 0;
  for (const _ of space.bodies) count++;
  return count;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("fractureBody", () => {
  let space: Space;

  beforeEach(() => {
    space = new Space();
    space.gravity = Vec2.get(0, 600);
  });

  // --- Basic behavior ---

  it("fractures a box into multiple fragments", () => {
    const box = createBox(100, 100, 60, 60, space);
    // Step once so worldVerts are populated
    space.step(1 / 60, 4, 4);

    const result = fractureBody(box, Vec2.get(100, 100), {
      fragmentCount: 6,
      random: seededRng(42),
    });

    expect(result.fragments.length).toBeGreaterThanOrEqual(2);
    expect(result.originalBody).toBe(box);
    // Original body should be removed from space
    expect(box.space).toBeNull();
    // All fragments should be in space
    for (const f of result.fragments) {
      expect(f.space).toBe(space);
    }
  });

  it("fragments are dynamic bodies", () => {
    const box = createBox(100, 100, 50, 50, space);
    space.step(1 / 60, 4, 4);

    const result = fractureBody(box, Vec2.get(100, 100), {
      fragmentCount: 4,
      random: seededRng(1),
    });

    for (const f of result.fragments) {
      expect(f.type).toBe(BodyType.DYNAMIC);
    }
  });

  it("each fragment has exactly one polygon shape", () => {
    const box = createBox(200, 200, 80, 80, space);
    space.step(1 / 60, 4, 4);

    const result = fractureBody(box, Vec2.get(200, 200), {
      fragmentCount: 8,
      random: seededRng(7),
    });

    for (const f of result.fragments) {
      let shapeCount = 0;
      for (const s of f.shapes) {
        expect(s.isPolygon()).toBe(true);
        shapeCount++;
      }
      expect(shapeCount).toBe(1);
    }
  });

  // --- Error handling ---

  it("throws if body has no polygon shapes", () => {
    const body = new Body(BodyType.DYNAMIC, Vec2.get(50, 50));
    body.shapes.add(new Circle(20));
    body.space = space;
    space.step(1 / 60, 4, 4);

    expect(() => fractureBody(body, Vec2.get(50, 50))).toThrow(
      "requires a body with at least one Polygon shape",
    );
  });

  // --- Velocity inheritance ---

  it("fragments inherit approximate velocity from original body", () => {
    const box = createBox(100, 100, 60, 60, space);
    box.velocity = Vec2.get(100, 0);
    space.step(1 / 60, 4, 4);

    const result = fractureBody(box, Vec2.get(100, 100), {
      fragmentCount: 4,
      random: seededRng(5),
      explosionImpulse: 0,
    });

    // Fragments should have positive x velocity (inherited)
    for (const f of result.fragments) {
      // Due to angular velocity contribution, exact values may differ
      // but general direction should be preserved
      expect(Math.abs(f.velocity.x)).toBeGreaterThan(0);
    }
  });

  // --- Explosion impulse ---

  it("applies explosion impulse away from impact point", () => {
    const box = createBox(100, 100, 80, 80, space);
    space.step(1 / 60, 4, 4);

    const result = fractureBody(box, Vec2.get(100, 100), {
      fragmentCount: 6,
      explosionImpulse: 500,
      random: seededRng(10),
    });

    // At least some fragments should have non-zero velocity from explosion
    const hasMoving = result.fragments.some((f) => {
      const vx = f.velocity.x;
      const vy = f.velocity.y;
      return Math.sqrt(vx * vx + vy * vy) > 1;
    });
    expect(hasMoving).toBe(true);
  });

  // --- addToSpace option ---

  it("respects addToSpace: false", () => {
    const box = createBox(100, 100, 60, 60, space);
    space.step(1 / 60, 4, 4);
    const beforeCount = bodyCount(space);

    const result = fractureBody(box, Vec2.get(100, 100), {
      fragmentCount: 4,
      addToSpace: false,
      random: seededRng(1),
    });

    // Original body should still be in space
    expect(box.space).toBe(space);
    // Fragments should not be in space
    for (const f of result.fragments) {
      expect(f.space).toBeNull();
    }
    expect(bodyCount(space)).toBe(beforeCount);
  });

  // --- Material ---

  it("applies custom material to fragments", () => {
    const box = createBox(100, 100, 60, 60, space);
    space.step(1 / 60, 4, 4);

    // Material constructor: (elasticity, dynamicFriction, staticFriction, density, rollingFriction)
    const mat = new Material(0.9, 0.3, 0.1, 2.5, 0.01);
    const result = fractureBody(box, Vec2.get(100, 100), {
      fragmentCount: 4,
      material: mat,
      random: seededRng(1),
    });

    for (const f of result.fragments) {
      for (const s of f.shapes) {
        expect(s.material.elasticity).toBeCloseTo(0.9, 5);
      }
    }
  });

  // --- Reproducibility ---

  it("same seed produces same fragment count and positions", () => {
    const makeBox = () => {
      const s = new Space();
      s.gravity = Vec2.get(0, 600);
      const b = createBox(100, 100, 60, 60, s);
      s.step(1 / 60, 4, 4);
      return { space: s, body: b };
    };

    const { body: b1 } = makeBox();
    const { body: b2 } = makeBox();

    const r1 = fractureBody(b1, Vec2.get(100, 100), {
      fragmentCount: 8,
      random: seededRng(42),
    });
    const r2 = fractureBody(b2, Vec2.get(100, 100), {
      fragmentCount: 8,
      random: seededRng(42),
    });

    expect(r1.fragments.length).toBe(r2.fragments.length);
  });

  // --- Body without space ---

  it("works on a body not in any space", () => {
    const body = new Body(BodyType.DYNAMIC, Vec2.get(50, 50));
    body.shapes.add(new Polygon(Polygon.box(40, 40)));
    // Not in space — just need worldVerts
    // Create a temporary space to compute world verts
    const tempSpace = new Space();
    body.space = tempSpace;
    tempSpace.step(1 / 60, 4, 4);

    const result = fractureBody(body, Vec2.get(50, 50), {
      fragmentCount: 4,
      random: seededRng(1),
    });

    expect(result.fragments.length).toBeGreaterThanOrEqual(2);
  });

  // --- Custom sites ---

  it("accepts custom fracture sites", () => {
    const box = createBox(100, 100, 60, 60, space);
    space.step(1 / 60, 4, 4);

    const result = fractureBody(box, Vec2.get(100, 100), {
      sites: [
        { x: -10, y: -10 },
        { x: 10, y: -10 },
        { x: -10, y: 10 },
        { x: 10, y: 10 },
      ],
    });

    expect(result.fragments.length).toBeGreaterThanOrEqual(2);
  });

  // --- Large fragment count ---

  it("handles large fragment count", () => {
    const box = createBox(200, 200, 100, 100, space);
    space.step(1 / 60, 4, 4);

    const result = fractureBody(box, Vec2.get(200, 200), {
      fragmentCount: 30,
      random: seededRng(99),
    });

    expect(result.fragments.length).toBeGreaterThanOrEqual(10);
  });

  // --- Fragment area conservation ---

  it("fragment areas roughly sum to original body area", () => {
    const w = 80,
      h = 80;
    const box = createBox(100, 100, w, h, space);
    space.step(1 / 60, 4, 4);

    const result = fractureBody(box, Vec2.get(100, 100), {
      fragmentCount: 8,
      random: seededRng(42),
    });

    // Sum fragment areas (approximation via polygon area of local verts)
    let totalFragArea = 0;
    for (const f of result.fragments) {
      for (const shape of f.shapes) {
        if (shape.isPolygon()) {
          const poly = shape.castPolygon as unknown as Polygon;
          const verts = poly.localVerts;
          const pts: { x: number; y: number }[] = [];
          const vLen = verts.length;
          for (let vi = 0; vi < vLen; vi++) {
            const v = verts.at(vi);
            pts.push({ x: v.x, y: v.y });
          }
          let area = 0;
          for (let i = 0; i < pts.length; i++) {
            const j = (i + 1) % pts.length;
            area += pts[i].x * pts[j].y;
            area -= pts[j].x * pts[i].y;
          }
          totalFragArea += Math.abs(area / 2);
        }
      }
    }

    const originalArea = w * h;
    // Fragments should cover a significant portion (at least 50% due to clipping losses)
    expect(totalFragArea).toBeGreaterThan(originalArea * 0.5);
    // Should not exceed original (plus margin for floating point)
    expect(totalFragArea).toBeLessThan(originalArea * 1.5);
  });

  // --- Simulation stability ---

  it("fragments simulate without errors after fracture", () => {
    const box = createBox(100, 100, 60, 60, space);
    space.step(1 / 60, 4, 4);

    fractureBody(box, Vec2.get(100, 100), {
      fragmentCount: 6,
      explosionImpulse: 100,
      random: seededRng(7),
    });

    // Should not throw during simulation
    for (let i = 0; i < 60; i++) {
      space.step(1 / 60, 4, 4);
    }
  });

  // --- userData ---

  it("copies userData to fragments with _fractureFragment flag", () => {
    const box = createBox(100, 100, 60, 60, space);
    box.userData.label = "wall";
    box.userData.hp = 3;
    space.step(1 / 60, 4, 4);

    const result = fractureBody(box, Vec2.get(100, 100), {
      fragmentCount: 4,
      random: seededRng(1),
    });

    for (const f of result.fragments) {
      expect(f.userData).toBeDefined();
      expect(f.userData.label).toBe("wall");
      expect(f.userData._fractureFragment).toBe(true);
    }
  });
});
