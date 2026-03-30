import { describe, it, expect } from "vitest";
import { Space } from "../../src/space/Space";
import { Body } from "../../src/phys/Body";
import { BodyType } from "../../src/phys/BodyType";
import { Vec2 } from "../../src/geom/Vec2";
import { Polygon } from "../../src/shape/Polygon";
import { Circle } from "../../src/shape/Circle";
import { Capsule } from "../../src/shape/Capsule";
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
// Material presets
// ---------------------------------------------------------------------------

const MATERIAL_PRESETS: Array<{ name: string; create: () => Material }> = [
  { name: "custom(0.2,0.5,0.4,1)", create: () => new Material(0.2, 0.5, 0.4, 1) },
  { name: "wood", create: () => Material.wood() },
  { name: "steel", create: () => Material.steel() },
  { name: "ice", create: () => Material.ice() },
  { name: "rubber", create: () => Material.rubber() },
  { name: "sand", create: () => Material.sand() },
  { name: "glass", create: () => Material.glass() },
  { name: "high-density(5.0)", create: () => new Material(0.2, 0.5, 0.4, 5.0) },
  { name: "low-density(0.1)", create: () => new Material(0.2, 0.5, 0.4, 0.1) },
  { name: "high-elasticity(0.95)", create: () => new Material(0.95, 0.3, 0.3, 1) },
  { name: "zero-friction", create: () => new Material(0, 0, 0, 1, 0.001) },
];

// ---------------------------------------------------------------------------
// Shape x Material x Collision matrix
//
// Note on constructor signatures:
//   Circle:  (radius, localCOM?, material?, filter?)
//   Capsule: (width, height, localCOM?, material?, filter?)
//   Polygon: (localVerts, material?, filter?)  — NO localCOM param!
// ---------------------------------------------------------------------------

describe("Shape x Material collision matrix", () => {
  // --- Circle x Material (baseline — known to work) ---

  describe("Circle + Material constructor param", () => {
    for (const preset of MATERIAL_PRESETS) {
      it(`Circle + ${preset.name} should land on polygon floor`, () => {
        const space = new Space(new Vec2(0, 400));
        space.bodies.add(staticFloor(0, 300, 500, 20));

        const body = new Body(BodyType.DYNAMIC, new Vec2(0, 0));
        body.shapes.add(new Circle(14, undefined, preset.create()));
        space.bodies.add(body);

        step(space, 800);
        expect(isAboveFloor(body, 300, 20)).toBe(true);
      });
    }
  });

  // --- Polygon x Material (correct API: material as 2nd arg) ---

  describe("Polygon + Material constructor param (correct: 2nd arg)", () => {
    for (const preset of MATERIAL_PRESETS) {
      it(`Polygon(box) + ${preset.name} should land on polygon floor`, () => {
        const space = new Space(new Vec2(0, 400));
        space.bodies.add(staticFloor(0, 300, 500, 20));

        const body = new Body(BodyType.DYNAMIC, new Vec2(0, 0));
        // Correct: Material as 2nd arg (Polygon has no localCOM param)
        body.shapes.add(new Polygon(Polygon.box(28, 28), preset.create()));
        space.bodies.add(body);

        step(space, 800);
        expect(isAboveFloor(body, 300, 20)).toBe(true);
      });
    }
  });

  // --- Polygon x Material (buggy P57 API: material as 3rd arg) ---

  describe("Polygon + Material in wrong position (P57 bug)", () => {
    for (const preset of MATERIAL_PRESETS) {
      it(`Polygon(box, undefined, ${preset.name}) should land on floor [P57 fixed]`, () => {
        const space = new Space(new Vec2(0, 400));
        space.bodies.add(staticFloor(0, 300, 500, 20));

        const body = new Body(BodyType.DYNAMIC, new Vec2(0, 0));
        // P57 bug: Material passed as 3rd arg (filter slot)
        body.shapes.add(new Polygon(Polygon.box(28, 28), undefined, preset.create()));
        space.bodies.add(body);

        step(space, 800);
        expect(isAboveFloor(body, 300, 20)).toBe(true);
      });
    }
  });

  // --- Capsule x Material ---

  describe("Capsule + Material constructor param", () => {
    for (const preset of MATERIAL_PRESETS) {
      it(`Capsule + ${preset.name} should land on polygon floor`, () => {
        const space = new Space(new Vec2(0, 400));
        space.bodies.add(staticFloor(0, 300, 500, 20));

        const body = new Body(BodyType.DYNAMIC, new Vec2(0, 0));
        body.shapes.add(new Capsule(40, 20, undefined, preset.create()));
        space.bodies.add(body);

        step(space, 800);
        expect(isAboveFloor(body, 300, 20)).toBe(true);
      });
    }
  });

  // --- Cross-shape dynamic-dynamic collisions with Material ---

  describe("Cross-shape dynamic-dynamic collisions with Material", () => {
    it("Circle(Material) + Polygon(Material) should collide", () => {
      const space = new Space(new Vec2(0, 0));
      const mat = new Material(0.5, 0.3, 0.3, 1);

      const circBody = new Body(BodyType.DYNAMIC, new Vec2(-60, 0));
      circBody.shapes.add(new Circle(14, undefined, mat.copy()));
      circBody.velocity = new Vec2(100, 0);
      space.bodies.add(circBody);

      const polyBody = new Body(BodyType.DYNAMIC, new Vec2(60, 0));
      polyBody.shapes.add(new Polygon(Polygon.box(28, 28), mat.copy()));
      polyBody.velocity = new Vec2(-100, 0);
      space.bodies.add(polyBody);

      step(space, 120);

      expect(circBody.position.x).toBeLessThan(polyBody.position.x);
    });

    it("Capsule(Material) + Polygon(Material) should collide", () => {
      const space = new Space(new Vec2(0, 0));
      const mat = new Material(0.5, 0.3, 0.3, 1);

      const capBody = new Body(BodyType.DYNAMIC, new Vec2(-60, 0));
      capBody.shapes.add(new Capsule(40, 20, undefined, mat.copy()));
      capBody.velocity = new Vec2(100, 0);
      space.bodies.add(capBody);

      const polyBody = new Body(BodyType.DYNAMIC, new Vec2(60, 0));
      polyBody.shapes.add(new Polygon(Polygon.box(28, 28), mat.copy()));
      polyBody.velocity = new Vec2(-100, 0);
      space.bodies.add(polyBody);

      step(space, 120);

      expect(capBody.position.x).toBeLessThan(polyBody.position.x);
    });

    it("Circle(Material) + Capsule(Material) should collide", () => {
      const space = new Space(new Vec2(0, 0));
      const mat = new Material(0.5, 0.3, 0.3, 1);

      const circBody = new Body(BodyType.DYNAMIC, new Vec2(-60, 0));
      circBody.shapes.add(new Circle(14, undefined, mat.copy()));
      circBody.velocity = new Vec2(100, 0);
      space.bodies.add(circBody);

      const capBody = new Body(BodyType.DYNAMIC, new Vec2(60, 0));
      capBody.shapes.add(new Capsule(40, 20, undefined, mat.copy()));
      capBody.velocity = new Vec2(-100, 0);
      space.bodies.add(capBody);

      step(space, 120);

      expect(circBody.position.x).toBeLessThan(capBody.position.x);
    });
  });

  // --- Both floor and dynamic shape have Material ---

  describe("Both floor and dynamic shape have constructor Material", () => {
    it("Circle on Material floor should land", () => {
      const space = new Space(new Vec2(0, 400));
      const floor = new Body(BodyType.STATIC, new Vec2(0, 300));
      floor.shapes.add(new Polygon(Polygon.box(500, 20), Material.steel()));
      space.bodies.add(floor);

      const body = new Body(BodyType.DYNAMIC, new Vec2(0, 0));
      body.shapes.add(new Circle(14, undefined, Material.rubber()));
      space.bodies.add(body);

      step(space, 800);
      expect(isAboveFloor(body, 300, 20)).toBe(true);
    });

    it("Polygon on Material floor should land", () => {
      const space = new Space(new Vec2(0, 400));
      const floor = new Body(BodyType.STATIC, new Vec2(0, 300));
      floor.shapes.add(new Polygon(Polygon.box(500, 20), Material.steel()));
      space.bodies.add(floor);

      const body = new Body(BodyType.DYNAMIC, new Vec2(0, 0));
      body.shapes.add(new Polygon(Polygon.box(28, 28), Material.rubber()));
      space.bodies.add(body);

      step(space, 800);
      expect(isAboveFloor(body, 300, 20)).toBe(true);
    });

    it("Capsule on Material floor should land", () => {
      const space = new Space(new Vec2(0, 400));
      const floor = new Body(BodyType.STATIC, new Vec2(0, 300));
      floor.shapes.add(new Polygon(Polygon.box(500, 20), Material.steel()));
      space.bodies.add(floor);

      const body = new Body(BodyType.DYNAMIC, new Vec2(0, 0));
      body.shapes.add(new Capsule(40, 20, undefined, Material.rubber()));
      space.bodies.add(body);

      step(space, 800);
      expect(isAboveFloor(body, 300, 20)).toBe(true);
    });
  });

  // --- Multiple shapes on same body ---

  describe("Compound shapes with Material on same body", () => {
    it("body with two Polygon shapes (both with Material) should land on floor", () => {
      const space = new Space(new Vec2(0, 400));
      space.bodies.add(staticFloor(0, 300, 500, 20));

      const body = new Body(BodyType.DYNAMIC, new Vec2(0, 0));
      const mat = new Material(0.2, 0.5, 0.4, 1);
      body.shapes.add(new Polygon(Polygon.box(20, 20), mat.copy()));
      body.shapes.add(new Polygon(Polygon.box(10, 40), mat.copy()));
      space.bodies.add(body);

      step(space, 600);
      expect(isAboveFloor(body, 300, 20)).toBe(true);
    });

    it("body with Circle + Polygon (both with Material) should land on floor", () => {
      const space = new Space(new Vec2(0, 400));
      space.bodies.add(staticFloor(0, 300, 500, 20));

      const body = new Body(BodyType.DYNAMIC, new Vec2(0, 0));
      const mat = new Material(0.2, 0.5, 0.4, 1);
      body.shapes.add(new Circle(10, undefined, mat.copy()));
      body.shapes.add(new Polygon(Polygon.box(30, 10), mat.copy()));
      space.bodies.add(body);

      step(space, 600);
      expect(isAboveFloor(body, 300, 20)).toBe(true);
    });
  });
});
