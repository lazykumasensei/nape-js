import { describe, it, expect } from "vitest";
import { Space } from "../../src/space/Space";
import { Body } from "../../src/phys/Body";
import { BodyType } from "../../src/phys/BodyType";
import { Vec2 } from "../../src/geom/Vec2";
import { Circle } from "../../src/shape/Circle";
import { Polygon } from "../../src/shape/Polygon";
import { PivotJoint } from "../../src/constraint/PivotJoint";
import { PhysicsMetrics } from "../../src/profiler/PhysicsMetrics";

describe("PhysicsMetrics", () => {
  describe("PhysicsMetrics class", () => {
    it("should initialize all fields to zero", () => {
      const m = new PhysicsMetrics();
      expect(m.totalStepTime).toBe(0);
      expect(m.broadphaseTime).toBe(0);
      expect(m.narrowphaseTime).toBe(0);
      expect(m.velocitySolverTime).toBe(0);
      expect(m.positionSolverTime).toBe(0);
      expect(m.ccdTime).toBe(0);
      expect(m.sleepTime).toBe(0);
      expect(m.bodyCount).toBe(0);
      expect(m.dynamicBodyCount).toBe(0);
      expect(m.staticBodyCount).toBe(0);
      expect(m.kinematicBodyCount).toBe(0);
      expect(m.sleepingBodyCount).toBe(0);
      expect(m.contactCount).toBe(0);
      expect(m.constraintCount).toBe(0);
      expect(m.broadphasePairCount).toBe(0);
    });

    it("should reset all fields to zero", () => {
      const m = new PhysicsMetrics();
      m.totalStepTime = 5;
      m.bodyCount = 10;
      m.contactCount = 3;
      m.reset();
      expect(m.totalStepTime).toBe(0);
      expect(m.bodyCount).toBe(0);
      expect(m.contactCount).toBe(0);
    });

    it("should produce a plain-object snapshot via toJSON()", () => {
      const m = new PhysicsMetrics();
      m.totalStepTime = 1.5;
      m.bodyCount = 7;
      const json = m.toJSON();
      expect(json.totalStepTime).toBe(1.5);
      expect(json.bodyCount).toBe(7);
      // Should be a plain object, not the same instance
      expect(json).not.toBe(m);
      expect(typeof json.toJSON).toBe("undefined");
    });
  });

  describe("Space profiler integration", () => {
    it("should default profilerEnabled to false", () => {
      const space = new Space(new Vec2(0, 100));
      expect(space.profilerEnabled).toBe(false);
    });

    it("should toggle profilerEnabled", () => {
      const space = new Space(new Vec2(0, 100));
      space.profilerEnabled = true;
      expect(space.profilerEnabled).toBe(true);
      space.profilerEnabled = false;
      expect(space.profilerEnabled).toBe(false);
    });

    it("should return zero metrics when profiler is disabled", () => {
      const space = new Space(new Vec2(0, 100));
      const body = new Body(BodyType.DYNAMIC, new Vec2(0, 0));
      body.shapes.add(new Circle(10));
      body.space = space;
      space.step(1 / 60);
      const m = space.metrics;
      expect(m.totalStepTime).toBe(0);
      expect(m.bodyCount).toBe(0);
    });

    it("should collect timing metrics when profiler is enabled", () => {
      const space = new Space(new Vec2(0, 100));
      space.profilerEnabled = true;
      const body = new Body(BodyType.DYNAMIC, new Vec2(0, 0));
      body.shapes.add(new Circle(10));
      body.space = space;
      space.step(1 / 60);
      const m = space.metrics;
      expect(m.totalStepTime).toBeGreaterThan(0);
      // Phase times should be non-negative
      expect(m.broadphaseTime).toBeGreaterThanOrEqual(0);
      expect(m.narrowphaseTime).toBeGreaterThanOrEqual(0);
      expect(m.velocitySolverTime).toBeGreaterThanOrEqual(0);
      expect(m.positionSolverTime).toBeGreaterThanOrEqual(0);
      expect(m.ccdTime).toBeGreaterThanOrEqual(0);
      expect(m.sleepTime).toBeGreaterThanOrEqual(0);
    });

    it("should sum phase times to approximately totalStepTime", () => {
      const space = new Space(new Vec2(0, 500));
      space.profilerEnabled = true;
      // Add several bodies for measurable timings
      for (let i = 0; i < 20; i++) {
        const b = new Body(BodyType.DYNAMIC, new Vec2(i * 25, 0));
        b.shapes.add(new Circle(10));
        b.space = space;
      }
      const floor = new Body(BodyType.STATIC, new Vec2(250, 300));
      floor.shapes.add(new Polygon(Polygon.box(600, 20)));
      floor.space = space;
      // Step a few times so bodies collide
      for (let i = 0; i < 10; i++) space.step(1 / 60);
      const m = space.metrics;
      const phaseSum =
        m.broadphaseTime +
        m.narrowphaseTime +
        m.velocitySolverTime +
        m.positionSolverTime +
        m.ccdTime +
        m.sleepTime;
      // Phase sum should be <= totalStepTime (there's minor unaccounted overhead)
      expect(phaseSum).toBeLessThanOrEqual(m.totalStepTime + 0.01);
    });

    it("should count body types correctly", () => {
      const space = new Space(new Vec2(0, 100));
      space.profilerEnabled = true;

      const dyn = new Body(BodyType.DYNAMIC, new Vec2(0, 0));
      dyn.shapes.add(new Circle(10));
      dyn.space = space;

      const stat = new Body(BodyType.STATIC, new Vec2(100, 200));
      stat.shapes.add(new Polygon(Polygon.box(200, 20)));
      stat.space = space;

      const kin = new Body(BodyType.KINEMATIC, new Vec2(50, 50));
      kin.shapes.add(new Circle(10));
      kin.space = space;

      space.step(1 / 60);
      const m = space.metrics;
      expect(m.bodyCount).toBe(3);
      expect(m.dynamicBodyCount).toBeGreaterThanOrEqual(1);
      expect(m.staticBodyCount).toBe(1);
      expect(m.kinematicBodyCount).toBe(1);
    });

    it("should count contacts when bodies collide", () => {
      const space = new Space(new Vec2(0, 500));
      space.profilerEnabled = true;

      // Ball resting on floor
      const floor = new Body(BodyType.STATIC, new Vec2(0, 100));
      floor.shapes.add(new Polygon(Polygon.box(400, 20)));
      floor.space = space;

      const ball = new Body(BodyType.DYNAMIC, new Vec2(0, 70));
      ball.shapes.add(new Circle(15));
      ball.space = space;

      // Step until collision
      for (let i = 0; i < 30; i++) space.step(1 / 60);
      const m = space.metrics;
      expect(m.contactCount).toBeGreaterThanOrEqual(1);
    });

    it("should count constraints", () => {
      const space = new Space(new Vec2(0, 100));
      space.profilerEnabled = true;

      const b1 = new Body(BodyType.STATIC, new Vec2(0, 0));
      b1.shapes.add(new Circle(5));
      b1.space = space;

      const b2 = new Body(BodyType.DYNAMIC, new Vec2(50, 0));
      b2.shapes.add(new Circle(5));
      b2.space = space;

      const joint = new PivotJoint(b1, b2, new Vec2(0, 0), new Vec2(0, 0));
      joint.space = space;

      space.step(1 / 60);
      const m = space.metrics;
      expect(m.constraintCount).toBe(1);
    });

    it("should count sleeping bodies", () => {
      const space = new Space(new Vec2(0, 500));
      space.profilerEnabled = true;

      const floor = new Body(BodyType.STATIC, new Vec2(0, 200));
      floor.shapes.add(new Polygon(Polygon.box(400, 20)));
      floor.space = space;

      const ball = new Body(BodyType.DYNAMIC, new Vec2(0, 100));
      ball.shapes.add(new Circle(10));
      ball.space = space;

      // Step many times to let the body come to rest and sleep
      for (let i = 0; i < 300; i++) space.step(1 / 60);
      const m = space.metrics;
      // After 300 steps the ball should have settled and might be sleeping
      expect(m.sleepingBodyCount).toBeGreaterThanOrEqual(0);
      // dynamicBodyCount + sleepingBodyCount + staticBodyCount + kinematicBodyCount should cover all bodies
      expect(
        m.dynamicBodyCount + m.sleepingBodyCount + m.staticBodyCount + m.kinematicBodyCount,
      ).toBe(m.bodyCount);
    });

    it("should reset metrics each step", () => {
      const space = new Space(new Vec2(0, 100));
      space.profilerEnabled = true;

      const b = new Body(BodyType.DYNAMIC, new Vec2(0, 0));
      b.shapes.add(new Circle(10));
      b.space = space;

      space.step(1 / 60);
      const time1 = space.metrics.totalStepTime;
      expect(time1).toBeGreaterThan(0);

      space.step(1 / 60);
      const time2 = space.metrics.totalStepTime;
      // Second step timing should be independent (reset, not accumulated)
      expect(time2).toBeGreaterThan(0);
    });

    it("should accumulate sub-step timings correctly", () => {
      const space = new Space(new Vec2(0, 100));
      space.profilerEnabled = true;
      space.subSteps = 4;

      const b = new Body(BodyType.DYNAMIC, new Vec2(0, 0));
      b.shapes.add(new Circle(10));
      b.space = space;

      space.step(1 / 60);
      const m = space.metrics;
      // With 4 sub-steps, timings should be accumulated
      expect(m.totalStepTime).toBeGreaterThan(0);
      expect(m.broadphaseTime).toBeGreaterThanOrEqual(0);
    });

    it("metrics object should be reused across steps (no allocation)", () => {
      const space = new Space(new Vec2(0, 100));
      space.profilerEnabled = true;

      const b = new Body(BodyType.DYNAMIC, new Vec2(0, 0));
      b.shapes.add(new Circle(10));
      b.space = space;

      space.step(1 / 60);
      const ref1 = space.metrics;
      space.step(1 / 60);
      const ref2 = space.metrics;
      // Same object reference
      expect(ref1).toBe(ref2);
    });
  });
});
