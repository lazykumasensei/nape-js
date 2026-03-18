import { describe, it, expect } from "vitest";
import { Space } from "../../src/space/Space";
import { Body } from "../../src/phys/Body";
import { BodyType } from "../../src/phys/BodyType";
import { Vec2 } from "../../src/geom/Vec2";
import { Circle } from "../../src/shape/Circle";
import { Polygon } from "../../src/shape/Polygon";
import { Broadphase } from "../../src/space/Broadphase";
import { AABB } from "../../src/geom/AABB";

// Side-effect imports
import "../../src/callbacks/PreFlag";
import "../../src/dynamics/CollisionArbiter";
import "../../src/dynamics/FluidArbiter";

function makeBodies(space: Space, count: number, spread = 200): Body[] {
  const bodies: Body[] = [];
  for (let i = 0; i < count; i++) {
    const b = new Body(
      BodyType.DYNAMIC,
      new Vec2(((i % 10) * spread) / 10, (Math.floor(i / 10) * spread) / 10),
    );
    b.shapes.add(new Circle(5));
    b.space = space;
    bodies.push(b);
  }
  return bodies;
}

describe("Broadphase — coverage", () => {
  const broadphaseTypes = [
    { name: "DYNAMIC_AABB_TREE", type: Broadphase.DYNAMIC_AABB_TREE },
    { name: "SWEEP_AND_PRUNE", type: Broadphase.SWEEP_AND_PRUNE },
    { name: "SPATIAL_HASH", type: Broadphase.SPATIAL_HASH },
  ];

  describe.each(broadphaseTypes)("$name", ({ type }) => {
    it("should handle many bodies added and stepped", () => {
      const space = new Space(new Vec2(0, 100), type);
      makeBodies(space, 20);
      for (let i = 0; i < 10; i++) space.step(1 / 60, 3, 3);
      expect(space.bodies.length).toBe(20);
    });

    it("should handle body removal during simulation", () => {
      const space = new Space(new Vec2(0, 100), type);
      const bodies = makeBodies(space, 10);
      for (let i = 0; i < 5; i++) space.step(1 / 60, 3, 3);

      // Remove half the bodies
      for (let i = 0; i < 5; i++) {
        bodies[i].space = null;
      }
      for (let i = 0; i < 5; i++) space.step(1 / 60, 3, 3);
      expect(space.bodies.length).toBe(5);
    });

    it("should detect collisions between overlapping circles", () => {
      const space = new Space(new Vec2(0, 0), type);
      const b1 = new Body(BodyType.DYNAMIC, new Vec2(0, 0));
      b1.shapes.add(new Circle(20));
      b1.space = space;

      const b2 = new Body(BodyType.DYNAMIC, new Vec2(10, 0));
      b2.shapes.add(new Circle(20));
      b2.space = space;

      space.step(1 / 60, 5, 5);

      // They overlap, so there should be collision arbiters
      const arb = space.arbiters.at(0);
      expect(arb).toBeDefined();
    });

    it("should handle kinematic bodies", () => {
      const space = new Space(new Vec2(0, 0), type);
      const floor = new Body(BodyType.STATIC, new Vec2(0, 100));
      floor.shapes.add(new Polygon(Polygon.box(200, 10)));
      floor.space = space;

      const kin = new Body(BodyType.KINEMATIC, new Vec2(0, 0));
      kin.shapes.add(new Circle(10));
      kin.velocity = new Vec2(50, 0);
      kin.space = space;

      for (let i = 0; i < 20; i++) space.step(1 / 60, 3, 3);
      expect(kin.position.x).toBeGreaterThan(10);
    });

    it("should handle sensor shapes (no collision response)", () => {
      const space = new Space(new Vec2(0, 0), type);
      const b1 = new Body(BodyType.DYNAMIC, new Vec2(0, 0));
      const s1 = new Circle(20);
      s1.sensorEnabled = true;
      b1.shapes.add(s1);
      b1.space = space;

      const b2 = new Body(BodyType.DYNAMIC, new Vec2(10, 0));
      b2.shapes.add(new Circle(20));
      b2.space = space;

      space.step(1 / 60, 5, 5);
      // Sensor should not push bodies apart
    });

    it("should add bodies between steps", () => {
      const space = new Space(new Vec2(0, 100), type);
      makeBodies(space, 5);
      space.step(1 / 60, 3, 3);

      // Add more bodies
      makeBodies(space, 5, 300);
      space.step(1 / 60, 3, 3);
      expect(space.bodies.length).toBe(10);
    });
  });

  describe("cross-broadphase parity", () => {
    it("should produce collisions with all three broadphase types", () => {
      for (const bp of broadphaseTypes) {
        const space = new Space(new Vec2(0, 500), bp.type);

        const floor = new Body(BodyType.STATIC, new Vec2(0, 100));
        floor.shapes.add(new Polygon(Polygon.box(500, 10)));
        floor.space = space;

        const ball = new Body(BodyType.DYNAMIC, new Vec2(0, 0));
        ball.shapes.add(new Circle(10));
        ball.space = space;

        for (let i = 0; i < 60; i++) space.step(1 / 60, 5, 5);

        // Ball should have fallen onto floor
        expect(ball.position.y).toBeGreaterThan(50);
        expect(ball.position.y).toBeLessThan(110);
      }
    });
  });

  describe("bodiesInAABB / shapesInAABB", () => {
    it("should find bodies within an AABB region", () => {
      const space = new Space(new Vec2(0, 0), Broadphase.DYNAMIC_AABB_TREE);

      const b1 = new Body(BodyType.DYNAMIC, new Vec2(50, 50));
      b1.shapes.add(new Circle(5));
      b1.space = space;

      const b2 = new Body(BodyType.DYNAMIC, new Vec2(200, 200));
      b2.shapes.add(new Circle(5));
      b2.space = space;

      space.step(1 / 60, 1, 1);

      const queryAABB = new AABB(0, 0, 100, 100);
      const found = space.bodiesInAABB(queryAABB);
      expect(found.length).toBeGreaterThanOrEqual(1);
    });

    it("should find shapes within an AABB region", () => {
      const space = new Space(new Vec2(0, 0), Broadphase.DYNAMIC_AABB_TREE);

      const b1 = new Body(BodyType.DYNAMIC, new Vec2(50, 50));
      b1.shapes.add(new Circle(5));
      b1.space = space;

      space.step(1 / 60, 1, 1);

      const queryAABB = new AABB(0, 0, 100, 100);
      const found = space.shapesInAABB(queryAABB);
      expect(found.length).toBeGreaterThanOrEqual(1);
    });
  });
});
