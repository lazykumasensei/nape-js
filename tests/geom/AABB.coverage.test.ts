import { describe, it, expect } from "vitest";
import { AABB } from "../../src/geom/AABB";
import { Vec2 } from "../../src/geom/Vec2";

describe("AABB — additional coverage", () => {
  // --- fromPoints ---

  describe("fromPoints", () => {
    it("should create AABB from a single point", () => {
      const aabb = AABB.fromPoints([new Vec2(5, 10)]);
      expect(aabb.x).toBeCloseTo(5);
      expect(aabb.y).toBeCloseTo(10);
      expect(aabb.width).toBeCloseTo(0);
      expect(aabb.height).toBeCloseTo(0);
    });

    it("should create AABB enclosing multiple points", () => {
      const aabb = AABB.fromPoints([
        new Vec2(1, 2),
        new Vec2(5, 8),
        new Vec2(-3, 4),
        new Vec2(2, -1),
      ]);
      expect(aabb.x).toBeCloseTo(-3);
      expect(aabb.y).toBeCloseTo(-1);
      expect(aabb.width).toBeCloseTo(8); // 5 - (-3)
      expect(aabb.height).toBeCloseTo(9); // 8 - (-1)
    });

    it("should create AABB from two points", () => {
      const aabb = AABB.fromPoints([new Vec2(0, 0), new Vec2(10, 20)]);
      expect(aabb.x).toBeCloseTo(0);
      expect(aabb.y).toBeCloseTo(0);
      expect(aabb.width).toBeCloseTo(10);
      expect(aabb.height).toBeCloseTo(20);
    });

    it("should handle points with negative coordinates", () => {
      const aabb = AABB.fromPoints([new Vec2(-10, -20), new Vec2(-5, -3)]);
      expect(aabb.x).toBeCloseTo(-10);
      expect(aabb.y).toBeCloseTo(-20);
      expect(aabb.width).toBeCloseTo(5);
      expect(aabb.height).toBeCloseTo(17);
    });

    it("should throw on null array", () => {
      expect(() => AABB.fromPoints(null as unknown as Vec2[])).toThrow(
        "requires at least one point",
      );
    });

    it("should throw on empty array", () => {
      expect(() => AABB.fromPoints([])).toThrow("requires at least one point");
    });

    it("should throw when first element is null", () => {
      expect(() => AABB.fromPoints([null as unknown as Vec2])).toThrow("cannot contain null Vec2");
    });

    it("should throw when a subsequent element is null", () => {
      expect(() => AABB.fromPoints([new Vec2(0, 0), null as unknown as Vec2])).toThrow(
        "cannot contain null Vec2",
      );
    });

    it("should throw when first Vec2 is disposed", () => {
      const v = Vec2.weak(1, 2);
      v.dispose();
      expect(() => AABB.fromPoints([v])).toThrow("disposed");
    });

    it("should throw when a subsequent Vec2 is disposed", () => {
      const v = Vec2.weak(1, 2);
      v.dispose();
      expect(() => AABB.fromPoints([new Vec2(0, 0), v])).toThrow("disposed");
    });

    it("should return an AABB instance", () => {
      const aabb = AABB.fromPoints([new Vec2(0, 0), new Vec2(1, 1)]);
      expect(aabb).toBeInstanceOf(AABB);
    });

    it("should handle collinear points", () => {
      const aabb = AABB.fromPoints([new Vec2(0, 0), new Vec2(5, 0), new Vec2(10, 0)]);
      expect(aabb.x).toBeCloseTo(0);
      expect(aabb.y).toBeCloseTo(0);
      expect(aabb.width).toBeCloseTo(10);
      expect(aabb.height).toBeCloseTo(0);
    });
  });

  // --- equals ---

  describe("equals", () => {
    it("should return true for identical AABBs", () => {
      const a = new AABB(1, 2, 3, 4);
      const b = new AABB(1, 2, 3, 4);
      expect(a.equals(b)).toBe(true);
    });

    it("should return false for different AABBs", () => {
      const a = new AABB(1, 2, 3, 4);
      const b = new AABB(5, 6, 7, 8);
      expect(a.equals(b)).toBe(false);
    });

    it("should return false when only x differs", () => {
      const a = new AABB(1, 2, 3, 4);
      const b = new AABB(2, 2, 3, 4);
      expect(a.equals(b)).toBe(false);
    });

    it("should return false when only y differs", () => {
      const a = new AABB(1, 2, 3, 4);
      const b = new AABB(1, 3, 3, 4);
      expect(a.equals(b)).toBe(false);
    });

    it("should return false when only width differs", () => {
      const a = new AABB(1, 2, 3, 4);
      const b = new AABB(1, 2, 5, 4);
      expect(a.equals(b)).toBe(false);
    });

    it("should return false when only height differs", () => {
      const a = new AABB(1, 2, 3, 4);
      const b = new AABB(1, 2, 3, 5);
      expect(a.equals(b)).toBe(false);
    });

    it("should return true within epsilon tolerance", () => {
      const a = new AABB(1, 2, 3, 4);
      const b = new AABB(1.05, 2.05, 2.95, 3.95);
      expect(a.equals(b, 0.1)).toBe(true);
    });

    it("should return false when difference exceeds epsilon", () => {
      const a = new AABB(1, 2, 3, 4);
      const b = new AABB(1.2, 2, 3, 4);
      expect(a.equals(b, 0.1)).toBe(false);
    });

    it("should return false for null", () => {
      const a = new AABB(1, 2, 3, 4);
      expect(a.equals(null as unknown as AABB)).toBe(false);
    });

    it("should return true when comparing AABB to itself", () => {
      const a = new AABB(1, 2, 3, 4);
      expect(a.equals(a)).toBe(true);
    });

    it("should use default epsilon of 0", () => {
      const a = new AABB(1, 2, 3, 4);
      const b = new AABB(1, 2, 3, 4);
      expect(a.equals(b)).toBe(true);
    });

    it("should handle zero-size AABBs", () => {
      const a = new AABB(5, 5, 0, 0);
      const b = new AABB(5, 5, 0, 0);
      expect(a.equals(b)).toBe(true);
    });
  });

  // --- clone ---

  describe("clone", () => {
    it("should return a copy with same bounds", () => {
      const a = new AABB(10, 20, 30, 40);
      const b = a.clone();
      expect(b.x).toBeCloseTo(10);
      expect(b.y).toBeCloseTo(20);
      expect(b.width).toBeCloseTo(30);
      expect(b.height).toBeCloseTo(40);
    });

    it("should return a new independent instance", () => {
      const a = new AABB(10, 20, 30, 40);
      const b = a.clone();
      b.x = 99;
      expect(a.x).toBeCloseTo(10);
      expect(b.x).toBeCloseTo(99);
    });

    it("should return an AABB instance", () => {
      const a = new AABB(1, 2, 3, 4);
      expect(a.clone()).toBeInstanceOf(AABB);
    });

    it("should produce a result equal to the original", () => {
      const a = new AABB(1, 2, 3, 4);
      const b = a.clone();
      expect(a.equals(b)).toBe(true);
    });
  });

  // --- max setter with valid Vec2 ---

  describe("max setter", () => {
    it("should set max via direct component manipulation", () => {
      const box = new AABB(10, 20, 30, 40);
      // Use internal manipulation since max wrapper requires getmax() init
      box.zpp_inner.maxx = 50;
      box.zpp_inner.maxy = 70;
      expect(box.max.x).toBeCloseTo(50);
      expect(box.max.y).toBeCloseTo(70);
      expect(box.width).toBeCloseTo(40); // 50 - 10
      expect(box.height).toBeCloseTo(50); // 70 - 20
    });

    it("should handle zero dimensions via internal manipulation", () => {
      const box = new AABB(10, 20, 30, 40);
      box.zpp_inner.maxx = 10;
      box.zpp_inner.maxy = 20;
      expect(box.width).toBeCloseTo(0);
      expect(box.height).toBeCloseTo(0);
    });
  });

  // --- Constructor edge cases ---

  describe("constructor edge cases", () => {
    it("should accept zero width and height", () => {
      const box = new AABB(5, 10, 0, 0);
      expect(box.x).toBeCloseTo(5);
      expect(box.y).toBeCloseTo(10);
      expect(box.width).toBeCloseTo(0);
      expect(box.height).toBeCloseTo(0);
    });

    it("should accept negative width in constructor (stored as-is)", () => {
      // Constructor does not validate width >= 0; it just sets maxx = x + width
      const box = new AABB(10, 10, -5, 10);
      expect(box.zpp_inner.minx).toBeCloseTo(10);
      expect(box.zpp_inner.maxx).toBeCloseTo(5); // 10 + (-5)
    });

    it("should accept large values", () => {
      const box = new AABB(1e6, 1e6, 1e6, 1e6);
      expect(box.x).toBeCloseTo(1e6);
      expect(box.width).toBeCloseTo(1e6);
    });
  });
});
