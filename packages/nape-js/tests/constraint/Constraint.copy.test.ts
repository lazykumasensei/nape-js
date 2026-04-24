import { describe, it, expect } from "vitest";
import { Space } from "../../src/space/Space";
import { Body } from "../../src/phys/Body";
import { BodyType } from "../../src/phys/BodyType";
import { Vec2 } from "../../src/geom/Vec2";
import { Circle } from "../../src/shape/Circle";
import { PivotJoint } from "../../src/constraint/PivotJoint";
import { DistanceJoint } from "../../src/constraint/DistanceJoint";
import { MotorJoint } from "../../src/constraint/MotorJoint";
import { AngleJoint } from "../../src/constraint/AngleJoint";
import { WeldJoint } from "../../src/constraint/WeldJoint";
import { LineJoint } from "../../src/constraint/LineJoint";

describe("Constraint copy & toString — coverage", () => {
  function makeBody(x = 0, y = 0): Body {
    const b = new Body(BodyType.DYNAMIC, new Vec2(x, y));
    b.shapes.add(new Circle(5));
    return b;
  }

  describe("PivotJoint", () => {
    it("should copy PivotJoint", () => {
      const b1 = makeBody(0, 0);
      const b2 = makeBody(50, 0);
      const pj = new PivotJoint(b1, b2, new Vec2(0, 0), new Vec2(0, 0));
      pj.maxForce = 500;
      pj.stiff = false;
      pj.frequency = 10;
      pj.damping = 0.5;

      const copy = pj.copy();
      expect(copy.maxForce).toBeCloseTo(500);
      expect(copy.stiff).toBe(false);
      expect(copy.frequency).toBeCloseTo(10);
      expect(copy.damping).toBeCloseTo(0.5);
    });

    it("should have toString", () => {
      const b1 = makeBody();
      const b2 = makeBody();
      const pj = new PivotJoint(b1, b2, new Vec2(1, 2), new Vec2(3, 4));
      const str = pj.toString();
      expect(str).toBeDefined();
      expect(typeof str).toBe("string");
    });

    it("should throw on NaN anchor", () => {
      const b1 = makeBody();
      const b2 = makeBody();
      const pj = new PivotJoint(b1, b2, new Vec2(0, 0), new Vec2(0, 0));
      expect(() => {
        pj.anchor1 = new Vec2(NaN, 0);
      }).toThrow();
    });
  });

  describe("DistanceJoint", () => {
    it("should copy DistanceJoint", () => {
      const b1 = makeBody(0, 0);
      const b2 = makeBody(100, 0);
      const dj = new DistanceJoint(b1, b2, new Vec2(0, 0), new Vec2(0, 0), 50, 150);
      dj.stiff = false;
      dj.frequency = 8;

      const copy = dj.copy();
      expect(copy.jointMin).toBeCloseTo(50);
      expect(copy.jointMax).toBeCloseTo(150);
    });

    it("should have toString", () => {
      const b1 = makeBody();
      const b2 = makeBody();
      const dj = new DistanceJoint(b1, b2, new Vec2(0, 0), new Vec2(0, 0), 10, 50);
      const str = dj.toString();
      expect(str).toBeDefined();
    });

    it("should throw on NaN jointMin", () => {
      const b1 = makeBody();
      const b2 = makeBody();
      const dj = new DistanceJoint(b1, b2, new Vec2(0, 0), new Vec2(0, 0), 10, 50);
      expect(() => {
        dj.jointMin = NaN;
      }).toThrow();
    });

    it("should throw on NaN jointMax", () => {
      const b1 = makeBody();
      const b2 = makeBody();
      const dj = new DistanceJoint(b1, b2, new Vec2(0, 0), new Vec2(0, 0), 10, 50);
      expect(() => {
        dj.jointMax = NaN;
      }).toThrow();
    });
  });

  describe("MotorJoint", () => {
    it("should copy MotorJoint", () => {
      const b1 = makeBody();
      const b2 = makeBody();
      const mj = new MotorJoint(b1, b2, 3.14, 2.0);
      mj.maxForce = 1000;

      const copy = mj.copy();
      expect(copy.rate).toBeCloseTo(3.14);
      expect(copy.ratio).toBeCloseTo(2.0);
      expect(copy.maxForce).toBeCloseTo(1000);
    });

    it("should have toString", () => {
      const b1 = makeBody();
      const b2 = makeBody();
      const mj = new MotorJoint(b1, b2, 1.0);
      const str = mj.toString();
      expect(str).toBeDefined();
    });

    it("should throw on NaN rate", () => {
      const b1 = makeBody();
      const b2 = makeBody();
      const mj = new MotorJoint(b1, b2, 1.0);
      expect(() => {
        mj.rate = NaN;
      }).toThrow();
    });

    it("should throw on NaN ratio", () => {
      const b1 = makeBody();
      const b2 = makeBody();
      const mj = new MotorJoint(b1, b2, 1.0);
      expect(() => {
        mj.ratio = NaN;
      }).toThrow();
    });
  });

  describe("AngleJoint", () => {
    it("should copy AngleJoint", () => {
      const b1 = makeBody();
      const b2 = makeBody();
      const aj = new AngleJoint(b1, b2, -Math.PI, Math.PI);

      const copy = aj.copy();
      expect(copy.jointMin).toBeCloseTo(-Math.PI);
      expect(copy.jointMax).toBeCloseTo(Math.PI);
    });

    it("should have toString", () => {
      const b1 = makeBody();
      const b2 = makeBody();
      const aj = new AngleJoint(b1, b2, 0, Math.PI);
      expect(aj.toString()).toBeDefined();
    });
  });

  describe("WeldJoint", () => {
    it("should copy WeldJoint", () => {
      const b1 = makeBody();
      const b2 = makeBody();
      const wj = new WeldJoint(b1, b2, new Vec2(0, 0), new Vec2(10, 0));

      const copy = wj.copy();
      expect(copy).toBeDefined();
    });

    it("should have toString", () => {
      const b1 = makeBody();
      const b2 = makeBody();
      const wj = new WeldJoint(b1, b2, new Vec2(0, 0), new Vec2(0, 0));
      expect(wj.toString()).toBeDefined();
    });
  });

  describe("LineJoint", () => {
    it("should copy LineJoint", () => {
      const b1 = makeBody();
      const b2 = makeBody();
      const lj = new LineJoint(b1, b2, new Vec2(0, 0), new Vec2(0, 0), new Vec2(1, 0), -50, 50);

      const copy = lj.copy();
      expect(copy.jointMin).toBeCloseTo(-50);
      expect(copy.jointMax).toBeCloseTo(50);
    });

    it("should have toString", () => {
      const b1 = makeBody();
      const b2 = makeBody();
      const lj = new LineJoint(b1, b2, new Vec2(0, 0), new Vec2(0, 0), new Vec2(1, 0), -50, 50);
      expect(lj.toString()).toBeDefined();
    });
  });

  describe("breakUnderForce / removeOnBreak", () => {
    it("should break a constraint when force exceeds maxForce", () => {
      const space = new Space(new Vec2(0, 500));
      const anchor = new Body(BodyType.STATIC, new Vec2(0, 0));
      anchor.shapes.add(new Circle(5));
      anchor.space = space;

      const bob = new Body(BodyType.DYNAMIC, new Vec2(0, 100));
      bob.shapes.add(new Circle(10));
      bob.space = space;

      const dj = new DistanceJoint(anchor, bob, new Vec2(0, 0), new Vec2(0, 0), 50, 50);
      dj.stiff = true;
      dj.breakUnderForce = true;
      dj.maxForce = 0.001; // Very low — will break immediately
      dj.removeOnBreak = true;
      dj.space = space;

      for (let i = 0; i < 30; i++) space.step(1 / 60, 5, 5);

      // Constraint should have been removed
      expect(dj.space).toBeNull();
    });
  });
});
