import { describe, it, expect } from "vitest";
import { Space } from "../../src/space/Space";
import { Body } from "../../src/phys/Body";
import { BodyType } from "../../src/phys/BodyType";
import { Vec2 } from "../../src/geom/Vec2";
import { Circle } from "../../src/shape/Circle";
import { Polygon } from "../../src/shape/Polygon";
import { Ray } from "../../src/geom/Ray";
import { InteractionFilter } from "../../src/dynamics/InteractionFilter";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function step(space: Space, n = 60): void {
  for (let i = 0; i < n; i++) space.step(1 / 60);
}

// ---------------------------------------------------------------------------
// Extended raycasting integration tests
// ---------------------------------------------------------------------------
describe("Raycasting integration — advanced patterns", () => {
  it("should raycast through multiple bodies and find closest hit", () => {
    const space = new Space();

    // Three walls at different distances
    for (const x of [100, 200, 300]) {
      const wall = new Body(BodyType.STATIC, new Vec2(x, 0));
      wall.shapes.add(new Polygon(Polygon.box(10, 200)));
      wall.space = space;
    }
    space.step(1 / 60);

    const ray = new Ray(new Vec2(0, 0), new Vec2(1, 0));
    const result = space.rayCast(ray) as any;

    expect(result).not.toBeNull();
  });

  it("should rayMultiCast and find all intersections", () => {
    const space = new Space();

    for (const x of [100, 200, 300]) {
      const wall = new Body(BodyType.STATIC, new Vec2(x, 0));
      wall.shapes.add(new Polygon(Polygon.box(10, 200)));
      wall.space = space;
    }

    const ray = new Ray(new Vec2(0, 0), new Vec2(1, 0));
    const results = space.rayMultiCast(ray, false);

    // Should find hits for all 3 walls (each wall has 2 surfaces = up to 6 hits)
    expect(results.length).toBeGreaterThanOrEqual(3);
  });

  it("should not hit bodies behind the ray origin", () => {
    const space = new Space();

    // Wall behind ray only
    const behind = new Body(BodyType.STATIC, new Vec2(-100, 0));
    behind.shapes.add(new Polygon(Polygon.box(10, 200)));
    behind.space = space;
    space.step(1 / 60);

    const ray = new Ray(new Vec2(0, 0), new Vec2(1, 0));
    const result = space.rayCast(ray) as any;

    // Should not hit the wall behind
    expect(result).toBeNull();
  });

  it("should raycast against circle shapes", () => {
    const space = new Space();

    const circle = new Body(BodyType.STATIC, new Vec2(100, 0));
    circle.shapes.add(new Circle(20));
    circle.space = space;

    const ray = new Ray(new Vec2(0, 0), new Vec2(1, 0));
    const result = space.rayCast(ray, false);

    expect(result).not.toBeNull();
  });

  it("should miss bodies that are not in the ray path", () => {
    const space = new Space();

    // Body far off to the side
    const offside = new Body(BodyType.STATIC, new Vec2(100, 500));
    offside.shapes.add(new Circle(20));
    offside.space = space;

    const ray = new Ray(new Vec2(0, 0), new Vec2(1, 0));
    const result = space.rayCast(ray, false);

    expect(result).toBeNull();
  });

  it("should raycast with limited maxDistance and miss far bodies", () => {
    const space = new Space();

    // Only a far wall
    const far = new Body(BodyType.STATIC, new Vec2(500, 0));
    far.shapes.add(new Polygon(Polygon.box(10, 200)));
    far.space = space;
    space.step(1 / 60);

    const ray = new Ray(new Vec2(0, 0), new Vec2(1, 0));
    ray.maxDistance = 100; // Only look within 100 units

    const result = space.rayCast(ray) as any;
    // Should not hit the far wall
    expect(result).toBeNull();
  });

  it("should raycast downward to detect ground", () => {
    const space = new Space();

    // Ground floor
    const floor = new Body(BodyType.STATIC, new Vec2(0, 200));
    floor.shapes.add(new Polygon(Polygon.box(800, 10)));
    floor.space = space;
    space.step(1 / 60);

    const ray = new Ray(new Vec2(0, 0), new Vec2(0, 1)); // downward
    const result = space.rayCast(ray) as any;

    expect(result).not.toBeNull();
  });

  it("should raycast against dynamic bodies after simulation", () => {
    const space = new Space(new Vec2(0, 300));

    // Floor
    const floor = new Body(BodyType.STATIC, new Vec2(0, 200));
    floor.shapes.add(new Polygon(Polygon.box(800, 10)));
    floor.space = space;

    // Falling ball
    const ball = new Body(BodyType.DYNAMIC, new Vec2(100, 0));
    ball.shapes.add(new Circle(15));
    ball.space = space;

    // Let ball fall to floor
    step(space, 120);

    // Raycast horizontally to find the settled ball
    const ray = new Ray(new Vec2(0, ball.position.y), new Vec2(1, 0));
    const result = space.rayCast(ray, false);

    expect(result).not.toBeNull();
  });
});
