/**
 * ZPP_SweepPhase — Tests for the sweep-and-prune broadphase implementation.
 * Exercises spatial queries, raycasting, body lifecycle, and collision detection
 * through the Space public API with Broadphase.SWEEP_AND_PRUNE.
 */

import { describe, it, expect } from "vitest";
import "../../../src/core/engine";
import { Space } from "../../../src/space/Space";
import { Body } from "../../../src/phys/Body";
import { BodyType } from "../../../src/phys/BodyType";
import { Vec2 } from "../../../src/geom/Vec2";
import { Circle } from "../../../src/shape/Circle";
import { Polygon } from "../../../src/shape/Polygon";
import { Broadphase } from "../../../src/space/Broadphase";
import { AABB } from "../../../src/geom/AABB";
import { Ray } from "../../../src/geom/Ray";
import { InteractionFilter } from "../../../src/dynamics/InteractionFilter";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function sap(gravity: Vec2 = new Vec2(0, 0)): Space {
  return new Space(gravity, Broadphase.SWEEP_AND_PRUNE);
}

function step(space: Space, n: number, dt = 1 / 60): void {
  for (let i = 0; i < n; i++) space.step(dt);
}

function dynamicCircle(x: number, y: number, radius = 10): Body {
  const b = new Body(BodyType.DYNAMIC, new Vec2(x, y));
  b.shapes.add(new Circle(radius));
  return b;
}

function dynamicBox(x: number, y: number, w = 20, h = 20): Body {
  const b = new Body(BodyType.DYNAMIC, new Vec2(x, y));
  b.shapes.add(new Polygon(Polygon.box(w, h)));
  return b;
}

function staticBox(x: number, y: number, w = 500, h = 20): Body {
  const b = new Body(BodyType.STATIC, new Vec2(x, y));
  b.shapes.add(new Polygon(Polygon.box(w, h)));
  return b;
}

function kinematicCircle(x: number, y: number, radius = 10): Body {
  const b = new Body(BodyType.KINEMATIC, new Vec2(x, y));
  b.shapes.add(new Circle(radius));
  return b;
}

// ---------------------------------------------------------------------------
// Tests — Collision Detection
// ---------------------------------------------------------------------------

describe("ZPP_SweepPhase — collision detection", () => {
  it("detects collision between two overlapping circles", () => {
    const space = sap();
    const b1 = dynamicCircle(0, 0, 20);
    const b2 = dynamicCircle(25, 0, 20);
    b1.space = space;
    b2.space = space;
    step(space, 5);
    // Bodies should have been pushed apart
    const dx = b2.position.x - b1.position.x;
    expect(dx).toBeGreaterThan(30);
  });

  it("detects collision between circle and polygon", () => {
    const space = sap(new Vec2(0, 500));
    const floor = staticBox(0, 200);
    floor.space = space;
    const ball = dynamicCircle(0, 0, 15);
    ball.space = space;
    step(space, 180);
    expect(ball.position.y).toBeLessThan(200);
    expect(ball.position.y).toBeGreaterThan(100);
  });

  it("detects collision between two polygons", () => {
    const space = sap(new Vec2(0, 500));
    const floor = staticBox(0, 200);
    floor.space = space;
    const box = dynamicBox(0, 0);
    box.space = space;
    step(space, 180);
    expect(box.position.y).toBeLessThan(200);
    expect(box.position.y).toBeGreaterThan(100);
  });

  it("kinematic body does not respond to collision forces", () => {
    const space = sap();
    const k = kinematicCircle(0, 0, 20);
    k.velocity = Vec2.weak(50, 0);
    k.space = space;
    const d = dynamicCircle(100, 0, 20);
    d.space = space;
    step(space, 60);
    // Kinematic keeps moving at constant velocity
    expect(k.velocity.x).toBeCloseTo(50, 0);
  });

  it("non-overlapping bodies do not collide", () => {
    const space = sap();
    const b1 = dynamicCircle(0, 0, 10);
    const b2 = dynamicCircle(500, 0, 10);
    b1.space = space;
    b2.space = space;
    const x1Before = b1.position.x;
    const x2Before = b2.position.x;
    step(space, 5);
    // Bodies should not have changed position (no forces, no gravity)
    expect(b1.position.x).toBeCloseTo(x1Before, 1);
    expect(b2.position.x).toBeCloseTo(x2Before, 1);
  });
});

// ---------------------------------------------------------------------------
// Tests — shapesUnderPoint
// ---------------------------------------------------------------------------

describe("ZPP_SweepPhase — shapesUnderPoint", () => {
  it("finds a shape at the given point", () => {
    const space = sap();
    const b = dynamicCircle(50, 50, 15);
    b.space = space;
    step(space, 1);
    const result = space.shapesUnderPoint(new Vec2(50, 50));
    expect(result.length).toBeGreaterThanOrEqual(1);
  });

  it("returns empty when no shapes are at the point", () => {
    const space = sap();
    dynamicCircle(0, 0, 10).space = space;
    step(space, 1);
    const result = space.shapesUnderPoint(new Vec2(1000, 1000));
    expect(result.length).toBe(0);
  });

  it("finds multiple shapes when they overlap at a point", () => {
    const space = sap();
    // Use static bodies so they don't move apart after collision resolution
    const b1 = new Body(BodyType.STATIC, new Vec2(50, 50));
    b1.shapes.add(new Circle(30));
    b1.space = space;
    const b2 = new Body(BodyType.STATIC, new Vec2(55, 50));
    b2.shapes.add(new Circle(30));
    b2.space = space;
    step(space, 1);
    const result = space.shapesUnderPoint(new Vec2(50, 50));
    expect(result.length).toBeGreaterThanOrEqual(2);
  });
});

// ---------------------------------------------------------------------------
// Tests — bodiesUnderPoint
// ---------------------------------------------------------------------------

describe("ZPP_SweepPhase — bodiesUnderPoint", () => {
  it("finds a body at the given point", () => {
    const space = sap();
    const b = dynamicCircle(50, 50, 15);
    b.space = space;
    step(space, 1);
    const result = space.bodiesUnderPoint(new Vec2(50, 50));
    expect(result.length).toBeGreaterThanOrEqual(1);
  });

  it("returns empty when no body is at the point", () => {
    const space = sap();
    dynamicCircle(0, 0, 10).space = space;
    step(space, 1);
    const result = space.bodiesUnderPoint(new Vec2(1000, 1000));
    expect(result.length).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// Tests — shapesInAABB
// ---------------------------------------------------------------------------

describe("ZPP_SweepPhase — shapesInAABB", () => {
  it("finds shapes inside an AABB", () => {
    const space = sap();
    dynamicCircle(50, 50, 10).space = space;
    step(space, 1);
    const result = space.shapesInAABB(new AABB(30, 30, 40, 40));
    expect(result.length).toBeGreaterThanOrEqual(1);
  });

  it("returns empty for AABB in empty region", () => {
    const space = sap();
    dynamicCircle(0, 0, 10).space = space;
    step(space, 1);
    const result = space.shapesInAABB(new AABB(1000, 1000, 10, 10));
    expect(result.length).toBe(0);
  });

  it("finds multiple shapes inside a large AABB", () => {
    const space = sap();
    for (let i = 0; i < 5; i++) {
      dynamicCircle(i * 50, 0, 10).space = space;
    }
    step(space, 1);
    const result = space.shapesInAABB(new AABB(-50, -50, 400, 100));
    expect(result.length).toBe(5);
  });

  it("shapesInAABB with containment=true only returns fully contained shapes", () => {
    const space = sap();
    // Small circle fully inside the AABB
    dynamicCircle(50, 50, 5).space = space;
    // Large circle only partially inside
    dynamicCircle(100, 50, 40).space = space;
    step(space, 1);
    const contained = space.shapesInAABB(new AABB(30, 30, 50, 50), true);
    const overlapping = space.shapesInAABB(new AABB(30, 30, 50, 50), false);
    expect(contained.length).toBeLessThanOrEqual(overlapping.length);
  });
});

// ---------------------------------------------------------------------------
// Tests — bodiesInAABB
// ---------------------------------------------------------------------------

describe("ZPP_SweepPhase — bodiesInAABB", () => {
  it("finds bodies inside an AABB", () => {
    const space = sap();
    dynamicCircle(50, 50, 10).space = space;
    step(space, 1);
    const result = space.bodiesInAABB(new AABB(30, 30, 40, 40)) as any;
    expect(result.length).toBeGreaterThanOrEqual(1);
  });

  it("returns empty for AABB in empty region", () => {
    const space = sap();
    dynamicCircle(0, 0, 10).space = space;
    step(space, 1);
    const result = space.bodiesInAABB(new AABB(1000, 1000, 10, 10)) as any;
    expect(result.length).toBe(0);
  });

  it("finds all bodies via large AABB query", () => {
    const space = sap();
    for (let i = 0; i < 5; i++) {
      dynamicCircle(i * 50, 0, 10).space = space;
    }
    step(space, 1);
    const result = space.bodiesInAABB(new AABB(-50, -50, 400, 100)) as any;
    expect(result.length).toBe(5);
  });
});

// ---------------------------------------------------------------------------
// Tests — shapesInCircle
// ---------------------------------------------------------------------------

describe("ZPP_SweepPhase — shapesInCircle", () => {
  it("finds shapes within a query circle", () => {
    const space = sap();
    dynamicCircle(100, 100, 10).space = space;
    step(space, 1);
    const result = space.shapesInCircle(new Vec2(100, 100), 20);
    expect(result.length).toBeGreaterThanOrEqual(1);
  });

  it("returns empty when no shapes are in the circle", () => {
    const space = sap();
    dynamicCircle(0, 0, 10).space = space;
    step(space, 1);
    const result = space.shapesInCircle(new Vec2(1000, 1000), 10);
    expect(result.length).toBe(0);
  });

  it("finds multiple shapes within a large query circle", () => {
    const space = sap();
    dynamicCircle(10, 0, 5).space = space;
    dynamicCircle(-10, 0, 5).space = space;
    dynamicCircle(0, 10, 5).space = space;
    step(space, 1);
    const result = space.shapesInCircle(new Vec2(0, 0), 50);
    expect(result.length).toBeGreaterThanOrEqual(3);
  });
});

// ---------------------------------------------------------------------------
// Tests — bodiesInCircle
// ---------------------------------------------------------------------------

describe("ZPP_SweepPhase — bodiesInCircle", () => {
  it("finds bodies within a query circle", () => {
    const space = sap();
    dynamicCircle(100, 100, 10).space = space;
    step(space, 1);
    const result = space.bodiesInCircle(new Vec2(100, 100), 20) as any;
    expect(result.length).toBeGreaterThanOrEqual(1);
  });

  it("returns empty when no bodies are in the circle", () => {
    const space = sap();
    dynamicCircle(0, 0, 10).space = space;
    step(space, 1);
    const result = space.bodiesInCircle(new Vec2(1000, 1000), 10) as any;
    expect(result.length).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// Tests — Raycasting
// ---------------------------------------------------------------------------

describe("ZPP_SweepPhase — raycasting", () => {
  it("rayCast finds a body along the ray direction", () => {
    const space = sap();
    dynamicCircle(100, 0, 15).space = space;
    step(space, 1);
    const ray = new Ray(new Vec2(0, 0), new Vec2(1, 0));
    const result = space.rayCast(ray);
    expect(result).not.toBeNull();
  });

  it("rayCast returns null when ray misses all bodies", () => {
    const space = sap();
    dynamicCircle(100, 100, 10).space = space;
    step(space, 1);
    // Ray goes along negative X — should miss body at (100,100)
    const ray = new Ray(new Vec2(0, 0), new Vec2(-1, 0));
    const result = space.rayCast(ray);
    expect(result).toBeNull();
  });

  it("rayCast finds the nearest body (closer distance)", () => {
    const space = sap();
    dynamicCircle(100, 0, 10).space = space;
    dynamicCircle(200, 0, 10).space = space;
    step(space, 1);
    const ray = new Ray(new Vec2(0, 0), new Vec2(1, 0));
    const result = space.rayCast(ray);
    expect(result).not.toBeNull();
    if (result) {
      // distance should correspond to the near body (~90), not the far one (~190)
      expect(result.distance).toBeLessThan(150);
    }
  });

  it("rayMultiCast finds multiple bodies along the ray", () => {
    const space = sap();
    dynamicCircle(100, 0, 15).space = space;
    dynamicCircle(200, 0, 15).space = space;
    step(space, 1);
    const ray = new Ray(new Vec2(0, 0), new Vec2(1, 0));
    const results = space.rayMultiCast(ray) as any;
    expect(results.length).toBeGreaterThanOrEqual(2);
  });

  it("rayCast with filter excludes filtered bodies", () => {
    const space = sap();
    const b = dynamicCircle(100, 0, 15);
    // Set collision group to 2
    (b.shapes.at(0) as any).filter = new InteractionFilter(2, 0);
    b.space = space;
    step(space, 1);
    // Filter with mask=0 should exclude group=2
    const filter = new InteractionFilter(1, 0);
    const ray = new Ray(new Vec2(0, 0), new Vec2(1, 0));
    const result = space.rayCast(ray, false, filter);
    expect(result).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Tests — Body Addition/Removal
// ---------------------------------------------------------------------------

describe("ZPP_SweepPhase — body addition and removal", () => {
  it("adding a body makes it findable in queries", () => {
    const space = sap();
    const b = dynamicCircle(50, 50, 10);
    b.space = space;
    step(space, 1);
    const result = space.bodiesInAABB(new AABB(30, 30, 40, 40)) as any;
    expect(result.length).toBe(1);
  });

  it("removing a body makes it unfindable in queries", () => {
    const space = sap();
    const b = dynamicCircle(50, 50, 10);
    b.space = space;
    step(space, 1);
    b.space = null;
    step(space, 1);
    const result = space.bodiesInAABB(new AABB(30, 30, 40, 40)) as any;
    expect(result.length).toBe(0);
  });

  it("rapid add/remove cycles do not corrupt broadphase", () => {
    const space = sap();
    for (let cycle = 0; cycle < 5; cycle++) {
      const bodies: Body[] = [];
      for (let i = 0; i < 10; i++) {
        const b = dynamicCircle(i * 20, 0);
        b.space = space;
        bodies.push(b);
      }
      step(space, 2);
      for (const b of bodies) b.space = null;
      step(space, 1);
    }
    expect(space.bodies.length).toBe(0);
  });

  it("space.clear() removes all bodies from sweep broadphase", () => {
    const space = sap();
    for (let i = 0; i < 5; i++) {
      dynamicCircle(i * 30, 0).space = space;
    }
    step(space, 3);
    space.clear();
    expect(space.bodies.length).toBe(0);
    // Space should still work after clear
    dynamicCircle(0, 0).space = space;
    step(space, 1);
    expect(space.bodies.length).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// Tests — Moving Bodies / Re-sort
// ---------------------------------------------------------------------------

describe("ZPP_SweepPhase — moving bodies triggers re-sort", () => {
  it("teleporting a body updates its position in the broadphase", () => {
    const space = sap();
    const b = dynamicCircle(50, 50, 10);
    b.space = space;
    step(space, 1);

    // Teleport
    b.position.setxy(500, 500);
    step(space, 1);

    const oldRegion = space.bodiesInAABB(new AABB(30, 30, 40, 40)) as any;
    expect(oldRegion.length).toBe(0);
    const newRegion = space.bodiesInAABB(new AABB(480, 480, 40, 40)) as any;
    expect(newRegion.length).toBe(1);
  });

  it("moving bodies with velocity updates broadphase correctly", () => {
    const space = sap();
    const b = dynamicCircle(0, 0, 10);
    b.velocity = Vec2.weak(100, 0);
    b.space = space;
    step(space, 60); // 1 second at 100 px/s = roughly x=100

    const result = space.bodiesInAABB(new AABB(50, -20, 200, 40)) as any;
    expect(result.length).toBe(1);
  });

  it("bodies under gravity are tracked correctly after settling", () => {
    const space = sap(new Vec2(0, 500));
    const floor = staticBox(0, 200);
    floor.space = space;
    const ball = dynamicCircle(0, 0, 10);
    ball.space = space;
    step(space, 180);

    // Ball should be near the floor
    const result = space.bodiesUnderPoint(new Vec2(ball.position.x, ball.position.y));
    expect(result.length).toBeGreaterThanOrEqual(1);
  });

  it("broadphase handles bodies crossing each other along X axis", () => {
    const space = sap();
    const b1 = dynamicCircle(-100, 0, 10);
    b1.velocity = Vec2.weak(200, 0);
    b1.space = space;

    const b2 = dynamicCircle(100, 0, 10);
    b2.velocity = Vec2.weak(-200, 0);
    b2.space = space;

    // They will cross and collide near x=0
    step(space, 60);
    // Both bodies should still be in the space
    expect(space.bodies.length).toBe(2);
  });
});

// ---------------------------------------------------------------------------
// Tests — Stress / Many Bodies
// ---------------------------------------------------------------------------

describe("ZPP_SweepPhase — stress tests", () => {
  it("handles 100 bodies without errors", () => {
    const space = sap(new Vec2(0, 100));
    const floor = staticBox(0, 300, 2000, 20);
    floor.space = space;
    for (let i = 0; i < 100; i++) {
      dynamicCircle(i * 5 - 250, -i * 3, 3).space = space;
    }
    expect(() => step(space, 30)).not.toThrow();
    expect(space.bodies.length).toBe(101);
  });

  it("handles bodies arranged in a grid pattern", () => {
    const space = sap();
    for (let x = 0; x < 10; x++) {
      for (let y = 0; y < 10; y++) {
        dynamicCircle(x * 30, y * 30, 5).space = space;
      }
    }
    step(space, 5);
    // All 100 bodies still present
    expect(space.bodies.length).toBe(100);
  });

  it("spatial queries work correctly after many steps", () => {
    const space = sap(new Vec2(0, 50));
    const floor = staticBox(0, 200, 1000, 20);
    floor.space = space;
    for (let i = 0; i < 20; i++) {
      dynamicCircle(i * 30 - 300, 0, 8).space = space;
    }
    step(space, 120);

    // All bodies should be near the floor
    const result = space.bodiesInAABB(new AABB(-500, 100, 1000, 200)) as any;
    // Should find at least the floor + some balls
    expect(result.length).toBeGreaterThanOrEqual(5);
  });

  it("handles bodies spread along Y axis (perpendicular to sweep)", () => {
    const space = sap();
    for (let i = 0; i < 20; i++) {
      dynamicCircle(0, i * 40 - 400, 5).space = space;
    }
    step(space, 1);
    // All bodies have same X — sweep axis should handle this
    const result = space.bodiesInAABB(new AABB(-20, -450, 40, 900)) as any;
    expect(result.length).toBe(20);
  });
});

// ---------------------------------------------------------------------------
// Tests — Edge Cases
// ---------------------------------------------------------------------------

describe("ZPP_SweepPhase — edge cases", () => {
  it("empty space steps without error", () => {
    const space = sap();
    expect(() => step(space, 10)).not.toThrow();
  });

  it("single body steps without error", () => {
    const space = sap(new Vec2(0, 100));
    dynamicCircle(0, 0).space = space;
    expect(() => step(space, 30)).not.toThrow();
  });

  it("static-only space steps without error", () => {
    const space = sap();
    staticBox(0, 0).space = space;
    staticBox(0, 100).space = space;
    expect(() => step(space, 10)).not.toThrow();
  });

  it("adding body to space after stepping works", () => {
    const space = sap();
    step(space, 5);
    const b = dynamicCircle(50, 50, 10);
    b.space = space;
    step(space, 5);
    const result = space.bodiesUnderPoint(new Vec2(50, 50));
    expect(result.length).toBeGreaterThanOrEqual(1);
  });
});
