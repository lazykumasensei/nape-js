import { describe, it, expect } from "vitest";
import "../../src/core/engine";
import { RadialGravityField, RadialGravityFieldGroup } from "../../src/helpers/RadialGravityField";
import { Body } from "../../src/phys/Body";
import { BodyType } from "../../src/phys/BodyType";
import { Vec2 } from "../../src/geom/Vec2";
import { Circle } from "../../src/shape/Circle";
import { Space } from "../../src/space/Space";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeSpace(): Space {
  const space = new Space();
  space.gravity = new Vec2(0, 0);
  return space;
}

function makeDynamic(space: Space, x: number, y: number, r = 5): Body {
  const b = new Body(BodyType.DYNAMIC, new Vec2(x, y));
  b.shapes.add(new Circle(r));
  b.space = space;
  return b;
}

function makeStatic(space: Space, x: number, y: number, r = 20): Body {
  const b = new Body(BodyType.STATIC, new Vec2(x, y));
  b.shapes.add(new Circle(r));
  b.space = space;
  return b;
}

// ---------------------------------------------------------------------------
// RadialGravityField — construction & validation
// ---------------------------------------------------------------------------

describe("RadialGravityField", () => {
  describe("construction", () => {
    it("should construct with required options", () => {
      const f = new RadialGravityField({ source: new Vec2(0, 0), strength: 100 });
      expect(f.strength).toBe(100);
      expect(f.falloff).toBe("inverse-square");
      expect(f.scaleByMass).toBe(true);
      expect(f.maxRadius).toBe(Infinity);
      expect(f.minRadius).toBe(1);
      expect(f.softening).toBe(0);
      expect(f.enabled).toBe(true);
    });

    it("should accept Vec2 source", () => {
      const v = new Vec2(10, 20);
      const f = new RadialGravityField({ source: v, strength: 1 });
      expect(f.getPosition()).toEqual({ x: 10, y: 20 });
    });

    it("should accept Body source", () => {
      const space = makeSpace();
      const star = makeStatic(space, 100, 50);
      const f = new RadialGravityField({ source: star, strength: 1 });
      expect(f.getPosition()).toEqual({ x: 100, y: 50 });
    });

    it("should track Body source position changes", () => {
      const space = makeSpace();
      const anchor = new Body(BodyType.KINEMATIC, new Vec2(50, 50));
      anchor.shapes.add(new Circle(10));
      anchor.space = space;
      const f = new RadialGravityField({ source: anchor, strength: 1 });
      anchor.position = new Vec2(200, 80);
      expect(f.getPosition()).toEqual({ x: 200, y: 80 });
    });

    it("should throw on null options / source", () => {
      expect(() => new RadialGravityField(null as any)).toThrow();
      expect(() => new RadialGravityField({ strength: 1 } as any)).toThrow(/source/);
    });

    it("should throw on bad strength", () => {
      expect(() => new RadialGravityField({ source: new Vec2(0, 0), strength: NaN })).toThrow();
      expect(
        () => new RadialGravityField({ source: new Vec2(0, 0), strength: Infinity }),
      ).toThrow();
    });

    it("should throw on negative radii / softening", () => {
      const src = new Vec2(0, 0);
      expect(() => new RadialGravityField({ source: src, strength: 1, maxRadius: -1 })).toThrow();
      expect(() => new RadialGravityField({ source: src, strength: 1, minRadius: -1 })).toThrow();
      expect(() => new RadialGravityField({ source: src, strength: 1, softening: -1 })).toThrow();
    });
  });

  // -------------------------------------------------------------------------
  // forceOn — magnitudes / falloff laws
  // -------------------------------------------------------------------------

  describe("forceOn — falloff laws", () => {
    it("inverse-square: F = strength / d² (with scaleByMass false)", () => {
      const space = makeSpace();
      const b = makeDynamic(space, 100, 0); // d = 100
      const f = new RadialGravityField({
        source: new Vec2(0, 0),
        strength: 10000,
        scaleByMass: false,
      });
      const force = f.forceOn(b);
      // Magnitude = 10000 / 100² = 1; direction is from b toward source = (-1, 0).
      expect(Math.hypot(force.x, force.y)).toBeCloseTo(1, 5);
      expect(force.x).toBeCloseTo(-1, 5);
      expect(force.y).toBeCloseTo(0, 5);
    });

    it("inverse: F = strength / d", () => {
      const space = makeSpace();
      const b = makeDynamic(space, 50, 0);
      const f = new RadialGravityField({
        source: new Vec2(0, 0),
        strength: 100,
        falloff: "inverse",
        scaleByMass: false,
      });
      const force = f.forceOn(b);
      expect(Math.hypot(force.x, force.y)).toBeCloseTo(2, 5); // 100 / 50
      expect(force.x).toBeCloseTo(-2, 5);
    });

    it("constant: F = strength regardless of distance", () => {
      const space = makeSpace();
      const b1 = makeDynamic(space, 10, 0);
      const b2 = makeDynamic(space, 200, 0);
      const f = new RadialGravityField({
        source: new Vec2(0, 0),
        strength: 5,
        falloff: "constant",
        scaleByMass: false,
      });
      expect(Math.hypot(f.forceOn(b1).x, f.forceOn(b1).y)).toBeCloseTo(5, 5);
      expect(Math.hypot(f.forceOn(b2).x, f.forceOn(b2).y)).toBeCloseTo(5, 5);
    });

    it("custom falloff function: F = strength * fn(d)", () => {
      const space = makeSpace();
      const b = makeDynamic(space, 16, 0);
      const f = new RadialGravityField({
        source: new Vec2(0, 0),
        strength: 2,
        falloff: (d) => Math.sqrt(d),
        scaleByMass: false,
      });
      const force = f.forceOn(b);
      // 2 * sqrt(16) = 8
      expect(Math.hypot(force.x, force.y)).toBeCloseTo(8, 5);
    });
  });

  // -------------------------------------------------------------------------
  // forceOn — direction & special cases
  // -------------------------------------------------------------------------

  describe("forceOn — direction & special cases", () => {
    it("force points from body toward source", () => {
      const space = makeSpace();
      const b = makeDynamic(space, 30, 40);
      const f = new RadialGravityField({
        source: new Vec2(0, 0),
        strength: 100,
        falloff: "constant",
        scaleByMass: false,
      });
      const force = f.forceOn(b);
      // Unit dir from b to source = (-30, -40)/50 = (-0.6, -0.8).
      // Magnitude = 100, so force = (-60, -80).
      expect(force.x).toBeCloseTo(-60, 5);
      expect(force.y).toBeCloseTo(-80, 5);
    });

    it("scaleByMass multiplies force by body.mass", () => {
      const space = makeSpace();
      const b = makeDynamic(space, 100, 0); // some non-trivial mass
      const f1 = new RadialGravityField({
        source: new Vec2(0, 0),
        strength: 10000,
        scaleByMass: false,
      });
      const f2 = new RadialGravityField({
        source: new Vec2(0, 0),
        strength: 10000,
        scaleByMass: true,
      });
      const m1 = Math.hypot(f1.forceOn(b).x, f1.forceOn(b).y);
      const m2 = Math.hypot(f2.forceOn(b).x, f2.forceOn(b).y);
      expect(m2).toBeCloseTo(m1 * b.mass, 5);
    });

    it("returns zero when body is outside maxRadius", () => {
      const space = makeSpace();
      const b = makeDynamic(space, 1000, 0);
      const f = new RadialGravityField({
        source: new Vec2(0, 0),
        strength: 100,
        maxRadius: 200,
      });
      const force = f.forceOn(b);
      expect(force.x).toBe(0);
      expect(force.y).toBe(0);
    });

    it("returns finite force at exactly maxRadius", () => {
      const space = makeSpace();
      const b = makeDynamic(space, 200, 0);
      const f = new RadialGravityField({
        source: new Vec2(0, 0),
        strength: 100,
        maxRadius: 200,
        scaleByMass: false,
      });
      const force = f.forceOn(b);
      expect(isFinite(force.x)).toBe(true);
      expect(isFinite(force.y)).toBe(true);
    });

    it("clamps distance to minRadius (no singularity at the source)", () => {
      const space = makeSpace();
      const b = makeDynamic(space, 0.001, 0); // basically at the source
      const f = new RadialGravityField({
        source: new Vec2(0, 0),
        strength: 100,
        minRadius: 5,
        scaleByMass: false,
      });
      const force = f.forceOn(b);
      // Magnitude = 100 / max(0.001, 5)² = 100 / 25 = 4. (Direction undefined but
      // we still expect a finite, non-NaN result.)
      const mag = Math.hypot(force.x, force.y);
      expect(isFinite(mag)).toBe(true);
      expect(mag).toBeLessThanOrEqual(4 + 1e-6);
    });

    it("returns zero when body is exactly at the source", () => {
      const space = makeSpace();
      const b = makeDynamic(space, 0, 0);
      const f = new RadialGravityField({
        source: new Vec2(0, 0),
        strength: 100,
        minRadius: 1,
        scaleByMass: false,
      });
      const force = f.forceOn(b);
      // Direction undefined → zero (we don't want NaN forces in the engine).
      expect(force.x).toBe(0);
      expect(force.y).toBe(0);
    });

    it("softening attenuates near-source spikes (inverse-square)", () => {
      const space = makeSpace();
      const b = makeDynamic(space, 1, 0);
      const fSoft = new RadialGravityField({
        source: new Vec2(0, 0),
        strength: 1000,
        softening: 100,
        scaleByMass: false,
      });
      const fNoSoft = new RadialGravityField({
        source: new Vec2(0, 0),
        strength: 1000,
        softening: 0,
        scaleByMass: false,
      });
      const magSoft = Math.hypot(fSoft.forceOn(b).x, fSoft.forceOn(b).y);
      const magNoSoft = Math.hypot(fNoSoft.forceOn(b).x, fNoSoft.forceOn(b).y);
      expect(magSoft).toBeLessThan(magNoSoft);
    });

    it("returns zero when disabled", () => {
      const space = makeSpace();
      const b = makeDynamic(space, 100, 0);
      const f = new RadialGravityField({
        source: new Vec2(0, 0),
        strength: 100,
        enabled: false,
      });
      const force = f.forceOn(b);
      expect(force.x).toBe(0);
      expect(force.y).toBe(0);
    });

    it("returns zero on static / kinematic bodies", () => {
      const space = makeSpace();
      const stat = makeStatic(space, 100, 0);
      const kin = new Body(BodyType.KINEMATIC, new Vec2(100, 0));
      kin.shapes.add(new Circle(5));
      kin.space = space;
      const f = new RadialGravityField({ source: new Vec2(0, 0), strength: 100 });
      expect(f.forceOn(stat).x).toBe(0);
      expect(f.forceOn(stat).y).toBe(0);
      expect(f.forceOn(kin).x).toBe(0);
      expect(f.forceOn(kin).y).toBe(0);
    });

    it("respects bodyFilter predicate", () => {
      const space = makeSpace();
      const b1 = makeDynamic(space, 100, 0);
      const b2 = makeDynamic(space, 100, 0);
      const f = new RadialGravityField({
        source: new Vec2(0, 0),
        strength: 100,
        bodyFilter: (b) => b === b1,
      });
      expect(Math.hypot(f.forceOn(b1).x, f.forceOn(b1).y)).toBeGreaterThan(0);
      expect(f.forceOn(b2).x).toBe(0);
      expect(f.forceOn(b2).y).toBe(0);
    });
  });

  // -------------------------------------------------------------------------
  // apply()
  // -------------------------------------------------------------------------

  describe("apply", () => {
    it("adds force to all eligible dynamic bodies in the space", () => {
      const space = makeSpace();
      const b = makeDynamic(space, 100, 0);
      const f = new RadialGravityField({
        source: new Vec2(0, 0),
        strength: 10000,
        scaleByMass: false,
      });
      f.apply(space);
      const force = b.force;
      expect(force.x).toBeCloseTo(-1, 5); // F = 10000 / 100² = 1, dir = (-1, 0)
      expect(force.y).toBeCloseTo(0, 5);
    });

    it("ACCUMULATES (does not overwrite) existing body.force", () => {
      const space = makeSpace();
      const b = makeDynamic(space, 100, 0);
      // Pre-set a userland force (e.g. wind).
      b.force = new Vec2(5, 0);
      const f = new RadialGravityField({
        source: new Vec2(0, 0),
        strength: 10000,
        scaleByMass: false,
      });
      f.apply(space);
      // Wind (5, 0) + field pull (-1, 0) = (4, 0)
      expect(b.force.x).toBeCloseTo(4, 5);
      expect(b.force.y).toBeCloseTo(0, 5);
    });

    it("multiple fields stack additively", () => {
      const space = makeSpace();
      const b = makeDynamic(space, 100, 0);
      const f1 = new RadialGravityField({
        source: new Vec2(0, 0),
        strength: 10000,
        scaleByMass: false,
      });
      const f2 = new RadialGravityField({
        source: new Vec2(200, 0),
        strength: 10000,
        scaleByMass: false,
      });
      f1.apply(space);
      f2.apply(space);
      // f1 pulls toward (0,0) -> (-1, 0); f2 pulls toward (200,0) -> (+1, 0)
      expect(b.force.x).toBeCloseTo(0, 5);
      expect(b.force.y).toBeCloseTo(0, 5);
    });

    it("is a no-op when disabled", () => {
      const space = makeSpace();
      const b = makeDynamic(space, 100, 0);
      const f = new RadialGravityField({
        source: new Vec2(0, 0),
        strength: 10000,
        enabled: false,
      });
      f.apply(space);
      expect(b.force.x).toBe(0);
      expect(b.force.y).toBe(0);
    });

    it("skips static and kinematic bodies", () => {
      const space = makeSpace();
      const stat = makeStatic(space, 100, 0);
      const kin = new Body(BodyType.KINEMATIC, new Vec2(100, 0));
      kin.shapes.add(new Circle(5));
      kin.space = space;
      const f = new RadialGravityField({ source: new Vec2(0, 0), strength: 10000 });
      f.apply(space);
      // Force on non-dynamic bodies is meaningless, but it should not be
      // touched at all by the helper.
      expect(stat.force.x).toBe(0);
      expect(kin.force.x).toBe(0);
    });
  });

  // -------------------------------------------------------------------------
  // Physics integration
  // -------------------------------------------------------------------------

  describe("physics integration", () => {
    it("tangential velocity bends into a curved path under gravity", () => {
      // A body launched tangentially past a source should curve back toward
      // it instead of flying off in a straight line. We don't require a
      // closed orbit (the integrator is not symplectic), just a noticeable
      // deflection.
      const space = makeSpace();
      makeStatic(space, 0, 0, 5);
      const b = makeDynamic(space, 100, 0, 2);
      b.allowRotation = false;
      b.velocity = new Vec2(0, 80);

      const field = new RadialGravityField({
        source: new Vec2(0, 0),
        strength: 1000000,
        minRadius: 10,
      });

      // Without gravity, after 1s the body would be at (100, 80).
      // With gravity, the x coordinate should clearly decrease.
      for (let i = 0; i < 60; i++) {
        field.apply(space);
        space.step(1 / 60);
      }
      expect(b.position.x).toBeLessThan(100);
    });

    it("body falls toward a stationary source under inverse-square gravity", () => {
      const space = makeSpace();
      makeStatic(space, 0, 0, 5);
      const b = makeDynamic(space, 100, 0, 2);
      const field = new RadialGravityField({
        source: new Vec2(0, 0),
        strength: 200000,
        minRadius: 5,
      });
      const startD = Math.hypot(b.position.x, b.position.y);
      for (let i = 0; i < 60; i++) {
        field.apply(space);
        space.step(1 / 60);
      }
      const endD = Math.hypot(b.position.x, b.position.y);
      expect(endD).toBeLessThan(startD);
    });
  });
});

// ---------------------------------------------------------------------------
// RadialGravityFieldGroup
// ---------------------------------------------------------------------------

describe("RadialGravityFieldGroup", () => {
  it("starts empty", () => {
    const g = new RadialGravityFieldGroup();
    expect(g.length).toBe(0);
    expect(g.fields).toEqual([]);
  });

  it("add returns the field and stores it", () => {
    const g = new RadialGravityFieldGroup();
    const f = new RadialGravityField({ source: new Vec2(0, 0), strength: 1 });
    expect(g.add(f)).toBe(f);
    expect(g.length).toBe(1);
    expect(g.fields[0]).toBe(f);
  });

  it("remove drops a field and returns true; returns false when missing", () => {
    const g = new RadialGravityFieldGroup();
    const f1 = new RadialGravityField({ source: new Vec2(0, 0), strength: 1 });
    const f2 = new RadialGravityField({ source: new Vec2(0, 0), strength: 1 });
    g.add(f1);
    expect(g.remove(f1)).toBe(true);
    expect(g.remove(f2)).toBe(false);
    expect(g.length).toBe(0);
  });

  it("clear empties the group", () => {
    const g = new RadialGravityFieldGroup();
    g.add(new RadialGravityField({ source: new Vec2(0, 0), strength: 1 }));
    g.add(new RadialGravityField({ source: new Vec2(0, 0), strength: 1 }));
    g.clear();
    expect(g.length).toBe(0);
  });

  it("apply runs every field's apply() (forces stack)", () => {
    const space = makeSpace();
    const b = makeDynamic(space, 100, 0);
    const group = new RadialGravityFieldGroup();
    group.add(
      new RadialGravityField({
        source: new Vec2(0, 0),
        strength: 10000,
        scaleByMass: false,
      }),
    );
    group.add(
      new RadialGravityField({
        source: new Vec2(0, 0),
        strength: 10000,
        scaleByMass: false,
      }),
    );
    group.apply(space);
    // Two identical fields → 2× single-field force.
    expect(b.force.x).toBeCloseTo(-2, 5);
  });
});
