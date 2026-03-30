/**
 * Tests for ZPP_Polygon internal polygon shape behavior.
 *
 * Since ZPP_Polygon has complex initialization dependencies (via ZPP_Shape
 * prototype copying at bootstrap), we test through the public API (Polygon,
 * Body, Space) to exercise internal code paths.
 *
 * Focus areas:
 * - Material assignment via constructor vs setter (P57 root cause area)
 * - Vertex management and validation
 * - Mass/inertia calculation with Material density
 *
 * Note: Polygon constructor is (localVerts, material?, filter?) — Material
 * is the 2nd arg, unlike Circle/Capsule where it's the 3rd/4th.
 */
import { describe, it, expect } from "vitest";
import { Polygon } from "../../../src/shape/Polygon";
import { Body } from "../../../src/phys/Body";
import { BodyType } from "../../../src/phys/BodyType";
import { Space } from "../../../src/space/Space";
import { Material } from "../../../src/phys/Material";
import { Vec2 } from "../../../src/geom/Vec2";
import { ValidationResult } from "../../../src/shape/ValidationResult";

// ---------------------------------------------------------------------------
// Material assignment on ZPP_Polygon internal state
// ---------------------------------------------------------------------------

describe("ZPP_Polygon — Material internal state", () => {
  it("constructor Material (2nd arg) should set material correctly", () => {
    const mat = new Material(0.5, 0.3, 0.2, 1.5, 0.01);
    const poly = new Polygon(Polygon.box(20, 20), mat);
    expect(poly.material.elasticity).toBeCloseTo(0.5, 5);
    expect(poly.material.dynamicFriction).toBeCloseTo(0.3, 5);
    expect(poly.material.staticFriction).toBeCloseTo(0.2, 5);
    expect(poly.material.density).toBeCloseTo(1.5, 5);
    expect(poly.material.rollingFriction).toBeCloseTo(0.01, 5);
  });

  it("setter Material should set material correctly", () => {
    const mat = new Material(0.5, 0.3, 0.2, 1.5, 0.01);
    const poly = new Polygon(Polygon.box(20, 20));
    poly.material = mat;
    expect(poly.material.elasticity).toBeCloseTo(0.5, 5);
    expect(poly.material.dynamicFriction).toBeCloseTo(0.3, 5);
    expect(poly.material.staticFriction).toBeCloseTo(0.2, 5);
    expect(poly.material.density).toBeCloseTo(1.5, 5);
    expect(poly.material.rollingFriction).toBeCloseTo(0.01, 5);
  });

  it("constructor and setter Material should yield same properties", () => {
    const mat = new Material(0.5, 0.3, 0.2, 1.5, 0.01);

    const poly1 = new Polygon(Polygon.box(20, 20), mat.copy());
    const poly2 = new Polygon(Polygon.box(20, 20));
    poly2.material = mat.copy();

    expect(poly1.material.elasticity).toBeCloseTo(poly2.material.elasticity, 5);
    expect(poly1.material.dynamicFriction).toBeCloseTo(poly2.material.dynamicFriction, 5);
    expect(poly1.material.staticFriction).toBeCloseTo(poly2.material.staticFriction, 5);
    expect(poly1.material.density).toBeCloseTo(poly2.material.density, 5);
    expect(poly1.material.rollingFriction).toBeCloseTo(poly2.material.rollingFriction, 5);
  });

  it("default Material should be assigned when no Material provided", () => {
    const poly = new Polygon(Polygon.box(20, 20));
    expect(poly.material).toBeDefined();
    expect(poly.material.elasticity).toBeCloseTo(0.0, 5);
    expect(poly.material.dynamicFriction).toBeCloseTo(1.0, 5);
    expect(poly.material.staticFriction).toBeCloseTo(2.0, 5);
    expect(poly.material.density).toBeCloseTo(1.0, 5);
  });

  it("Material passed as 3rd arg (filter slot) should NOT set material [P57]", () => {
    // This documents the P57 bug: passing Material as 3rd arg goes to filter
    const mat = new Material(0.5, 0.3, 0.2, 1.5, 0.01);
    const poly = new Polygon(Polygon.box(20, 20), undefined, mat as any);

    // Material should still be default (Material went to filter, not material)
    // When P57 is fixed, this behavior should change
    expect(poly.material.elasticity).toBeCloseTo(0.0, 5);
  });
});

// ---------------------------------------------------------------------------
// Material + Body mass interaction
// ---------------------------------------------------------------------------

describe("ZPP_Polygon — Material density and mass", () => {
  it("higher density constructor Material should produce higher mass", () => {
    const body1 = new Body(BodyType.DYNAMIC);
    body1.shapes.add(new Polygon(Polygon.box(20, 20), new Material(0, 1, 2, 1.0)));

    const body2 = new Body(BodyType.DYNAMIC);
    body2.shapes.add(new Polygon(Polygon.box(20, 20), new Material(0, 1, 2, 5.0)));

    expect(body2.mass).toBeGreaterThan(body1.mass);
  });

  it("constructor and setter Material should produce same mass", () => {
    const body1 = new Body(BodyType.DYNAMIC);
    body1.shapes.add(new Polygon(Polygon.box(20, 20), new Material(0, 1, 2, 2.0)));

    const body2 = new Body(BodyType.DYNAMIC);
    const shape2 = new Polygon(Polygon.box(20, 20));
    shape2.material = new Material(0, 1, 2, 2.0);
    body2.shapes.add(shape2);

    expect(body1.mass).toBeCloseTo(body2.mass, 5);
    expect(body1.inertia).toBeCloseTo(body2.inertia, 5);
  });

  it("different density produces proportionally different mass", () => {
    const body1 = new Body(BodyType.DYNAMIC);
    body1.shapes.add(new Polygon(Polygon.box(20, 20), new Material(0, 1, 2, 1.0)));

    const body2 = new Body(BodyType.DYNAMIC);
    body2.shapes.add(new Polygon(Polygon.box(20, 20), new Material(0, 1, 2, 5.0)));

    expect(body2.mass).toBeGreaterThan(body1.mass);
    expect(body2.mass / body1.mass).toBeCloseTo(5.0, 1);
  });

  it("mass ratio should match density ratio", () => {
    const body1 = new Body(BodyType.DYNAMIC);
    body1.shapes.add(new Polygon(Polygon.box(20, 20), new Material(0, 1, 2, 1.0)));

    const body2 = new Body(BodyType.DYNAMIC);
    body2.shapes.add(new Polygon(Polygon.box(20, 20), new Material(0, 1, 2, 3.0)));

    expect(body2.mass / body1.mass).toBeCloseTo(3.0, 1);
  });
});

// ---------------------------------------------------------------------------
// Polygon validation with Material
// ---------------------------------------------------------------------------

describe("ZPP_Polygon — validation with Material", () => {
  it("valid polygon with Material should pass validation", () => {
    const poly = new Polygon(Polygon.box(20, 20), new Material(0.5, 0.3, 0.2, 1));
    expect(poly.validity()).toBe(ValidationResult.VALID);
  });

  it("regular polygon with Material should pass validation", () => {
    const verts = Polygon.regular(30, 30, 6);
    const poly = new Polygon(verts, new Material(0.5, 0.3, 0.2, 1));
    expect(poly.validity()).toBe(ValidationResult.VALID);
  });

  it("triangle with Material should pass validation", () => {
    const tri = new Polygon(
      [Vec2.get(0, -20), Vec2.get(20, 20), Vec2.get(-20, 20)],
      new Material(0.5, 0.3, 0.2, 1),
    );
    expect(tri.validity()).toBe(ValidationResult.VALID);
  });
});

// ---------------------------------------------------------------------------
// Polygon in Space with Material — internal state consistency
// ---------------------------------------------------------------------------

describe("ZPP_Polygon — in-space Material state consistency", () => {
  it("adding Polygon with constructor Material to Space should preserve material", () => {
    const space = new Space();
    const body = new Body(BodyType.DYNAMIC);
    const mat = new Material(0.5, 0.3, 0.2, 1.5);
    const shape = new Polygon(Polygon.box(20, 20), mat);
    body.shapes.add(shape);
    space.bodies.add(body);

    expect(shape.material.elasticity).toBeCloseTo(0.5, 5);
    expect(shape.material.density).toBeCloseTo(1.5, 5);
  });

  it("removing and re-adding body to space should preserve Material", () => {
    const space = new Space();
    const body = new Body(BodyType.DYNAMIC);
    const mat = new Material(0.7, 0.2, 0.1, 2.0);
    body.shapes.add(new Polygon(Polygon.box(20, 20), mat));
    space.bodies.add(body);

    space.bodies.remove(body);
    space.bodies.add(body);

    const shape = body.shapes.at(0);
    expect(shape.material.elasticity).toBeCloseTo(0.7, 5);
    expect(shape.material.density).toBeCloseTo(2.0, 5);
  });

  it("stepping space should not corrupt Polygon Material", () => {
    const space = new Space(new Vec2(0, 100));
    const body = new Body(BodyType.DYNAMIC, new Vec2(0, 0));
    const mat = new Material(0.3, 0.4, 0.5, 1.5, 0.02);
    body.shapes.add(new Polygon(Polygon.box(20, 20), mat));
    space.bodies.add(body);

    for (let i = 0; i < 100; i++) {
      space.step(1 / 60);
    }

    const shape = body.shapes.at(0);
    expect(shape.material.elasticity).toBeCloseTo(0.3, 5);
    expect(shape.material.dynamicFriction).toBeCloseTo(0.4, 5);
    expect(shape.material.staticFriction).toBeCloseTo(0.5, 5);
    expect(shape.material.density).toBeCloseTo(1.5, 5);
    expect(shape.material.rollingFriction).toBeCloseTo(0.02, 5);
  });
});

// ---------------------------------------------------------------------------
// Edge cases
// ---------------------------------------------------------------------------

describe("ZPP_Polygon — Material edge cases", () => {
  it("two polygons sharing same Material instance via constructor", () => {
    const mat = new Material(0.5, 0.3, 0.2, 1.5);
    const poly1 = new Polygon(Polygon.box(20, 20), mat);
    const poly2 = new Polygon(Polygon.box(30, 30), mat);

    expect(poly1.material.elasticity).toBeCloseTo(0.5, 5);
    expect(poly2.material.elasticity).toBeCloseTo(0.5, 5);
  });

  it("Polygon with Material should copy correctly", () => {
    const mat = new Material(0.5, 0.3, 0.2, 1.5);
    const original = new Polygon(Polygon.box(20, 20), mat);
    const copy = original.copy();

    expect(copy.material.elasticity).toBeCloseTo(0.5, 5);
    expect(copy.material.density).toBeCloseTo(1.5, 5);
  });

  it("Polygon with extreme Material values should still be valid", () => {
    const bouncy = new Polygon(Polygon.box(20, 20), new Material(1.0, 0.01, 0.01, 0.1));
    expect(bouncy.validity()).toBe(ValidationResult.VALID);

    const heavy = new Polygon(Polygon.box(20, 20), new Material(0, 1, 2, 100));
    expect(heavy.validity()).toBe(ValidationResult.VALID);
  });

  it("Polygon with Material.wood() factory preset", () => {
    const poly = new Polygon(Polygon.box(20, 20), Material.wood());
    expect(poly.material).toBeDefined();
    expect(poly.validity()).toBe(ValidationResult.VALID);
  });
});
