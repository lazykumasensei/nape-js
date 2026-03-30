import { describe, it, expect } from "vitest";
import { Space } from "../../src/space/Space";
import { Body } from "../../src/phys/Body";
import { BodyType } from "../../src/phys/BodyType";
import { Vec2 } from "../../src/geom/Vec2";
import { Polygon } from "../../src/shape/Polygon";
import { Circle } from "../../src/shape/Circle";
import { Material } from "../../src/phys/Material";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function step(space: Space, n: number, dt = 1 / 60): void {
  for (let i = 0; i < n; i++) space.step(dt);
}

function staticFloor(x: number, y: number, w = 500, h = 20): Body {
  const body = new Body(BodyType.STATIC, new Vec2(x, y));
  body.shapes.add(new Polygon(Polygon.box(w, h)));
  return body;
}

function isAboveFloor(body: Body, floorY: number, floorH: number): boolean {
  const floorTop = floorY - floorH / 2;
  return body.position.y < floorTop + 5;
}

// ---------------------------------------------------------------------------
// Material assignment timing tests
//
// Validates that Material behavior is consistent regardless of WHEN and HOW
// the Material is assigned: constructor param, property setter before adding
// to space, property setter after adding to space, or changed mid-simulation.
// ---------------------------------------------------------------------------

describe("Material assignment timing", () => {
  const MAT_VALS = { e: 0.2, df: 0.5, sf: 0.4, d: 1.0, rf: 0.01 };

  function makeMat(): Material {
    return new Material(MAT_VALS.e, MAT_VALS.df, MAT_VALS.sf, MAT_VALS.d, MAT_VALS.rf);
  }

  // --- Method A: Material via constructor param ---
  function methodA_constructor(): { space: Space; body: Body } {
    const space = new Space(new Vec2(0, 400));
    space.bodies.add(staticFloor(0, 300));
    const body = new Body(BodyType.DYNAMIC, new Vec2(0, 0));
    body.shapes.add(new Polygon(Polygon.box(28, 28), makeMat()));
    space.bodies.add(body);
    return { space, body };
  }

  // --- Method B: Material via property setter, before adding to body ---
  function methodB_setterBeforeBody(): { space: Space; body: Body } {
    const space = new Space(new Vec2(0, 400));
    space.bodies.add(staticFloor(0, 300));
    const body = new Body(BodyType.DYNAMIC, new Vec2(0, 0));
    const shape = new Polygon(Polygon.box(28, 28));
    shape.material = makeMat();
    body.shapes.add(shape);
    space.bodies.add(body);
    return { space, body };
  }

  // --- Method C: Material via property setter, after adding shape to body ---
  function methodC_setterAfterBody(): { space: Space; body: Body } {
    const space = new Space(new Vec2(0, 400));
    space.bodies.add(staticFloor(0, 300));
    const body = new Body(BodyType.DYNAMIC, new Vec2(0, 0));
    const shape = new Polygon(Polygon.box(28, 28));
    body.shapes.add(shape);
    shape.material = makeMat();
    space.bodies.add(body);
    return { space, body };
  }

  // --- Method D: Material via property setter, after adding body to space ---
  function methodD_setterAfterSpace(): { space: Space; body: Body } {
    const space = new Space(new Vec2(0, 400));
    space.bodies.add(staticFloor(0, 300));
    const body = new Body(BodyType.DYNAMIC, new Vec2(0, 0));
    const shape = new Polygon(Polygon.box(28, 28));
    body.shapes.add(shape);
    space.bodies.add(body);
    shape.material = makeMat();
    return { space, body };
  }

  // All methods should produce same collision result

  it("Method A: constructor param — should land on floor", () => {
    const { space, body } = methodA_constructor();
    step(space, 600);
    expect(isAboveFloor(body, 300, 20)).toBe(true);
  });

  it("Method B: setter before body — should land on floor", () => {
    const { space, body } = methodB_setterBeforeBody();
    step(space, 600);
    expect(isAboveFloor(body, 300, 20)).toBe(true);
  });

  it("Method C: setter after body — should land on floor", () => {
    const { space, body } = methodC_setterAfterBody();
    step(space, 600);
    expect(isAboveFloor(body, 300, 20)).toBe(true);
  });

  it("Method D: setter after space — should land on floor", () => {
    const { space, body } = methodD_setterAfterSpace();
    step(space, 600);
    expect(isAboveFloor(body, 300, 20)).toBe(true);
  });

  // All methods should produce approximately the same final position

  it("all Material assignment methods should produce equivalent final positions", () => {
    const methods = [
      methodA_constructor,
      methodB_setterBeforeBody,
      methodC_setterAfterBody,
      methodD_setterAfterSpace,
    ];
    const results: number[] = [];

    for (const method of methods) {
      const { space, body } = method();
      step(space, 600);
      results.push(body.position.y);
    }

    // All final Y positions should be within 5px of each other
    const min = Math.min(...results);
    const max = Math.max(...results);
    expect(max - min).toBeLessThan(5);
  });

  // --- Material change mid-simulation ---

  it("changing Material mid-simulation should not cause tunneling", () => {
    const space = new Space(new Vec2(0, 400));
    space.bodies.add(staticFloor(0, 300));

    const body = new Body(BodyType.DYNAMIC, new Vec2(0, 0));
    const shape = new Polygon(Polygon.box(28, 28));
    body.shapes.add(shape);
    space.bodies.add(body);

    // Start with default material, run 100 steps
    step(space, 100);

    // Change material mid-simulation
    shape.material = new Material(0.8, 0.1, 0.1, 2.0);

    // Continue simulation
    step(space, 500);

    expect(isAboveFloor(body, 300, 20)).toBe(true);
  });

  it("changing Material multiple times mid-simulation should not cause tunneling", () => {
    const space = new Space(new Vec2(0, 400));
    space.bodies.add(staticFloor(0, 300));

    const body = new Body(BodyType.DYNAMIC, new Vec2(0, 0));
    const shape = new Polygon(Polygon.box(28, 28));
    body.shapes.add(shape);
    space.bodies.add(body);

    const materials = [
      Material.wood(),
      Material.steel(),
      Material.rubber(),
      Material.ice(),
      makeMat(),
    ];

    for (let i = 0; i < 600; i++) {
      if (i % 120 === 0 && i / 120 < materials.length) {
        shape.material = materials[i / 120];
      }
      space.step(1 / 60);
    }

    expect(isAboveFloor(body, 300, 20)).toBe(true);
  });

  // --- Same tests for Circle (control group) ---

  describe("Circle Material timing (control group)", () => {
    it("Circle + Material via constructor should land on floor", () => {
      const space = new Space(new Vec2(0, 400));
      space.bodies.add(staticFloor(0, 300));
      const body = new Body(BodyType.DYNAMIC, new Vec2(0, 0));
      body.shapes.add(new Circle(14, undefined, makeMat()));
      space.bodies.add(body);
      step(space, 600);
      expect(isAboveFloor(body, 300, 20)).toBe(true);
    });

    it("Circle + Material via setter should land on floor", () => {
      const space = new Space(new Vec2(0, 400));
      space.bodies.add(staticFloor(0, 300));
      const body = new Body(BodyType.DYNAMIC, new Vec2(0, 0));
      const shape = new Circle(14);
      shape.material = makeMat();
      body.shapes.add(shape);
      space.bodies.add(body);
      step(space, 600);
      expect(isAboveFloor(body, 300, 20)).toBe(true);
    });

    it("Circle constructor vs setter should produce equivalent positions", () => {
      const space1 = new Space(new Vec2(0, 400));
      space1.bodies.add(staticFloor(0, 300));
      const body1 = new Body(BodyType.DYNAMIC, new Vec2(0, 0));
      body1.shapes.add(new Circle(14, undefined, makeMat()));
      space1.bodies.add(body1);

      const space2 = new Space(new Vec2(0, 400));
      space2.bodies.add(staticFloor(0, 300));
      const body2 = new Body(BodyType.DYNAMIC, new Vec2(0, 0));
      const shape2 = new Circle(14);
      shape2.material = makeMat();
      body2.shapes.add(shape2);
      space2.bodies.add(body2);

      step(space1, 600);
      step(space2, 600);

      expect(Math.abs(body1.position.y - body2.position.y)).toBeLessThan(5);
    });
  });

  // --- Material.density affects mass correctly ---

  describe("Material density impact on mass", () => {
    it("higher density Material should result in higher body mass (Polygon)", () => {
      const lightBody = new Body(BodyType.DYNAMIC);
      lightBody.shapes.add(new Polygon(Polygon.box(28, 28), new Material(0, 1, 2, 0.5)));

      const heavyBody = new Body(BodyType.DYNAMIC);
      heavyBody.shapes.add(new Polygon(Polygon.box(28, 28), new Material(0, 1, 2, 5.0)));

      expect(heavyBody.mass).toBeGreaterThan(lightBody.mass);
    });

    it("higher density Material should result in higher body mass (Circle)", () => {
      const lightBody = new Body(BodyType.DYNAMIC);
      lightBody.shapes.add(new Circle(14, undefined, new Material(0, 1, 2, 0.5)));

      const heavyBody = new Body(BodyType.DYNAMIC);
      heavyBody.shapes.add(new Circle(14, undefined, new Material(0, 1, 2, 5.0)));

      expect(heavyBody.mass).toBeGreaterThan(lightBody.mass);
    });

    it("density via constructor should equal density via setter", () => {
      const density = 3.0;

      // Constructor: Material as 2nd arg (correct Polygon API)
      const body1 = new Body(BodyType.DYNAMIC);
      body1.shapes.add(new Polygon(Polygon.box(28, 28), new Material(0, 1, 2, density)));

      // Setter: assign Material after shape creation, before adding to body
      const body2 = new Body(BodyType.DYNAMIC);
      const shape2 = new Polygon(Polygon.box(28, 28));
      shape2.material = new Material(0, 1, 2, density);
      body2.shapes.add(shape2);

      expect(body1.mass).toBeCloseTo(body2.mass, 3);
    });
  });
});
