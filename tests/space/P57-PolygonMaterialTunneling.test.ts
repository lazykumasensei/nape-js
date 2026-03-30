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

function hasSettled(body: Body, threshold = 5): boolean {
  return Math.abs(body.velocity.x) < threshold && Math.abs(body.velocity.y) < threshold;
}

// ---------------------------------------------------------------------------
// P57: Polygon + Material tunneling
//
// Root cause: Polygon constructor signature is (localVerts, material, filter)
// while Circle is (radius, localCOM, material, filter) and Capsule is
// (width, height, localCOM, material, filter). Users naturally write
// `new Polygon(verts, undefined, material)` following Circle/Capsule patterns,
// but this passes Material into the `filter` parameter slot, causing silent
// collision failure.
//
// These tests document both:
// 1. The buggy pattern (Material passed as 3rd arg = filter) — should be fixed
// 2. The correct pattern (Material as 2nd arg) — should always work
// ---------------------------------------------------------------------------

describe("P57 — Polygon + Material tunneling", () => {
  // --- Bug reproduction: exact ROADMAP scenario ---
  // Material passed as 3rd arg (filter slot) — the user-facing bug

  describe("Bug reproduction: Material in wrong constructor position", () => {
    it.fails("ROADMAP repro: Polygon(box, undefined, Material) tunnels through floor", () => {
      const space = new Space(new Vec2(0, 400));
      const floor = new Body(BodyType.STATIC, new Vec2(200, 290));
      floor.shapes.add(new Polygon(Polygon.box(400, 20)));
      space.bodies.add(floor);

      // Exact ROADMAP pattern — Material passed as 3rd arg (filter slot)
      const box = new Body(BodyType.DYNAMIC, new Vec2(200, 100));
      box.shapes.add(
        new Polygon(Polygon.box(28, 28), undefined, new Material(0.2, 0.5, 0.4, 1) as any),
      );
      space.bodies.add(box);

      step(space, 600);

      // BUG: This currently tunnels. When P57 is fixed (constructor API
      // harmonized), this should pass. Until then, this documents the bug.
      expect(isAboveFloor(box, 290, 20)).toBe(true);
    });

    it("ROADMAP control: Polygon(box) without Material works fine", () => {
      const space = new Space(new Vec2(0, 400));
      const floor = new Body(BodyType.STATIC, new Vec2(200, 290));
      floor.shapes.add(new Polygon(Polygon.box(400, 20)));
      space.bodies.add(floor);

      const box = new Body(BodyType.DYNAMIC, new Vec2(200, 100));
      box.shapes.add(new Polygon(Polygon.box(28, 28)));
      space.bodies.add(box);

      step(space, 600);

      expect(isAboveFloor(box, 290, 20)).toBe(true);
      expect(hasSettled(box)).toBe(true);
    });

    it.fails("multiple Polygon(box, undefined, Material) all tunnel", () => {
      const space = new Space(new Vec2(0, 400));
      const floor = staticFloor(0, 300, 500, 20);
      space.bodies.add(floor);

      const boxes: Body[] = [];
      for (let i = 0; i < 5; i++) {
        const box = new Body(BodyType.DYNAMIC, new Vec2(-80 + i * 40, 0));
        box.shapes.add(
          new Polygon(Polygon.box(28, 28), undefined, new Material(0.2, 0.5, 0.4, 1) as any),
        );
        space.bodies.add(box);
        boxes.push(box);
      }

      step(space, 600);

      for (const b of boxes) {
        expect(isAboveFloor(b, 300, 20)).toBe(true);
      }
    });

    it.fails("isBullet does NOT prevent the Material tunneling bug", () => {
      const space = new Space(new Vec2(0, 400));
      const floor = staticFloor(0, 300, 500, 20);
      space.bodies.add(floor);

      const box = new Body(BodyType.DYNAMIC, new Vec2(0, -200));
      box.shapes.add(
        new Polygon(Polygon.box(28, 28), undefined, new Material(0.2, 0.5, 0.4, 1) as any),
      );
      box.isBullet = true;
      space.bodies.add(box);

      step(space, 600);

      expect(isAboveFloor(box, 300, 20)).toBe(true);
    });
  });

  // --- Correct usage: Material as 2nd arg ---

  describe("Correct API: Polygon(verts, Material)", () => {
    it("Polygon(box, Material) with custom Material should land on floor", () => {
      const space = new Space(new Vec2(0, 400));
      const floor = staticFloor(0, 300, 500, 20);
      space.bodies.add(floor);

      const box = new Body(BodyType.DYNAMIC, new Vec2(0, 0));
      box.shapes.add(new Polygon(Polygon.box(28, 28), new Material(0.2, 0.5, 0.4, 1)));
      space.bodies.add(box);

      step(space, 600);
      expect(isAboveFloor(box, 300, 20)).toBe(true);
      expect(hasSettled(box)).toBe(true);
    });

    it("Material via 2nd arg should behave same as property setter", () => {
      const mat = new Material(0.2, 0.5, 0.4, 1);

      // Via constructor (correct position)
      const space1 = new Space(new Vec2(0, 400));
      space1.bodies.add(staticFloor(0, 300));
      const box1 = new Body(BodyType.DYNAMIC, new Vec2(0, 0));
      box1.shapes.add(new Polygon(Polygon.box(28, 28), mat.copy()));
      space1.bodies.add(box1);

      // Via property setter
      const space2 = new Space(new Vec2(0, 400));
      space2.bodies.add(staticFloor(0, 300));
      const box2 = new Body(BodyType.DYNAMIC, new Vec2(0, 0));
      const shape2 = new Polygon(Polygon.box(28, 28));
      shape2.material = mat.copy();
      box2.shapes.add(shape2);
      space2.bodies.add(box2);

      step(space1, 600);
      step(space2, 600);

      expect(Math.abs(box1.position.y - box2.position.y)).toBeLessThan(5);
      expect(isAboveFloor(box1, 300, 20)).toBe(true);
      expect(isAboveFloor(box2, 300, 20)).toBe(true);
    });

    it("multiple polygons with correct Material position should all land", () => {
      const space = new Space(new Vec2(0, 400));
      const floor = staticFloor(0, 300, 500, 20);
      space.bodies.add(floor);

      const boxes: Body[] = [];
      for (let i = 0; i < 5; i++) {
        const box = new Body(BodyType.DYNAMIC, new Vec2(-80 + i * 40, 0));
        box.shapes.add(new Polygon(Polygon.box(28, 28), new Material(0.2, 0.5, 0.4, 1)));
        space.bodies.add(box);
        boxes.push(box);
      }

      step(space, 600);

      for (const b of boxes) {
        expect(isAboveFloor(b, 300, 20)).toBe(true);
        expect(hasSettled(b)).toBe(true);
      }
    });
  });

  // --- Material factory presets with correct API ---

  describe("Material presets via correct constructor position", () => {
    const presets: Array<[string, () => Material]> = [
      ["wood", () => Material.wood()],
      ["steel", () => Material.steel()],
      ["ice", () => Material.ice()],
      ["rubber", () => Material.rubber()],
      ["sand", () => Material.sand()],
      ["glass", () => Material.glass()],
    ];

    for (const [name, create] of presets) {
      it(`Polygon + Material.${name}() should land on floor`, () => {
        const space = new Space(new Vec2(0, 400));
        const floor = staticFloor(0, 300, 500, 20);
        space.bodies.add(floor);

        const box = new Body(BodyType.DYNAMIC, new Vec2(0, 0));
        box.shapes.add(new Polygon(Polygon.box(28, 28), create()));
        space.bodies.add(box);

        step(space, 800);
        expect(isAboveFloor(box, 300, 20)).toBe(true);
      });
    }
  });

  // --- Both floor and box have Material ---

  it("Material on both floor and dynamic polygon should not cause tunneling", () => {
    const space = new Space(new Vec2(0, 400));

    const floor = new Body(BodyType.STATIC, new Vec2(0, 300));
    floor.shapes.add(new Polygon(Polygon.box(500, 20), new Material(0.3, 0.6, 0.5, 1)));
    space.bodies.add(floor);

    const box = new Body(BodyType.DYNAMIC, new Vec2(0, 0));
    box.shapes.add(new Polygon(Polygon.box(28, 28), new Material(0.2, 0.5, 0.4, 1)));
    space.bodies.add(box);

    step(space, 600);

    expect(isAboveFloor(box, 300, 20)).toBe(true);
    expect(hasSettled(box)).toBe(true);
  });

  // --- Non-square shapes with Material ---

  it("triangle with Material should land on floor", () => {
    const space = new Space(new Vec2(0, 400));
    const floor = staticFloor(0, 300, 500, 20);
    space.bodies.add(floor);

    const body = new Body(BodyType.DYNAMIC, new Vec2(0, 0));
    body.shapes.add(
      new Polygon(
        [Vec2.get(0, -15), Vec2.get(15, 15), Vec2.get(-15, 15)],
        new Material(0.2, 0.5, 0.4, 1),
      ),
    );
    space.bodies.add(body);

    step(space, 600);
    expect(isAboveFloor(body, 300, 20)).toBe(true);
  });

  it("wide rectangle with Material should land on floor", () => {
    const space = new Space(new Vec2(0, 400));
    const floor = staticFloor(0, 300, 500, 20);
    space.bodies.add(floor);

    const body = new Body(BodyType.DYNAMIC, new Vec2(0, 0));
    body.shapes.add(new Polygon(Polygon.box(60, 10), new Material(0.2, 0.5, 0.4, 1)));
    space.bodies.add(body);

    step(space, 600);
    expect(isAboveFloor(body, 300, 20)).toBe(true);
  });

  // --- High-speed drop ---

  it("fast-falling polygon with Material should not tunnel through floor", () => {
    const space = new Space(new Vec2(0, 800));
    const floor = staticFloor(0, 300, 500, 20);
    space.bodies.add(floor);

    const box = new Body(BodyType.DYNAMIC, new Vec2(0, -200));
    box.shapes.add(new Polygon(Polygon.box(28, 28), new Material(0.2, 0.5, 0.4, 1)));
    space.bodies.add(box);

    step(space, 600);
    expect(isAboveFloor(box, 300, 20)).toBe(true);
  });

  // --- Stacking ---

  it("vertical stack of polygons with Material should settle on floor", () => {
    const space = new Space(new Vec2(0, 400));
    const floor = staticFloor(0, 300, 500, 20);
    space.bodies.add(floor);

    const boxes: Body[] = [];
    for (let i = 0; i < 3; i++) {
      const box = new Body(BodyType.DYNAMIC, new Vec2(0, 200 - i * 40));
      box.shapes.add(new Polygon(Polygon.box(30, 30), new Material(0.2, 0.5, 0.4, 1)));
      space.bodies.add(box);
      boxes.push(box);
    }

    step(space, 800);

    for (const b of boxes) {
      expect(isAboveFloor(b, 300, 20)).toBe(true);
    }
    for (let i = 0; i < boxes.length - 1; i++) {
      expect(boxes[i].position.y).toBeGreaterThan(boxes[i + 1].position.y);
    }
  });

  // --- Step-by-step tracking ---

  it("polygon with Material should never pass through floor at any step", () => {
    const space = new Space(new Vec2(0, 400));
    const floor = staticFloor(0, 300, 500, 20);
    space.bodies.add(floor);

    const box = new Body(BodyType.DYNAMIC, new Vec2(0, 0));
    box.shapes.add(new Polygon(Polygon.box(28, 28), new Material(0.2, 0.5, 0.4, 1)));
    space.bodies.add(box);

    const floorBottom = 300 + 10;
    for (let s = 0; s < 600; s++) {
      space.step(1 / 60);
      expect(box.position.y).toBeLessThan(floorBottom + 20);
    }
  });

  // --- API consistency: same user intent across shape types ---

  describe("API consistency across shape types", () => {
    it("Circle(radius, undefined, Material) should land on floor", () => {
      const space = new Space(new Vec2(0, 400));
      space.bodies.add(staticFloor(0, 300));
      const body = new Body(BodyType.DYNAMIC, new Vec2(0, 0));
      body.shapes.add(new Circle(14, undefined, new Material(0.2, 0.5, 0.4, 1)));
      space.bodies.add(body);
      step(space, 600);
      expect(isAboveFloor(body, 300, 20)).toBe(true);
    });

    it("Capsule(w, h, undefined, Material) should land on floor", () => {
      const space = new Space(new Vec2(0, 400));
      space.bodies.add(staticFloor(0, 300));
      const body = new Body(BodyType.DYNAMIC, new Vec2(0, 0));
      body.shapes.add(new Capsule(40, 20, undefined, new Material(0.2, 0.5, 0.4, 1)));
      space.bodies.add(body);
      step(space, 600);
      expect(isAboveFloor(body, 300, 20)).toBe(true);
    });

    it("Polygon(verts, Material) should land on floor (correct API)", () => {
      const space = new Space(new Vec2(0, 400));
      space.bodies.add(staticFloor(0, 300));
      const body = new Body(BodyType.DYNAMIC, new Vec2(0, 0));
      body.shapes.add(new Polygon(Polygon.box(28, 28), new Material(0.2, 0.5, 0.4, 1)));
      space.bodies.add(body);
      step(space, 600);
      expect(isAboveFloor(body, 300, 20)).toBe(true);
    });

    it.fails("Polygon(verts, undefined, Material) should also land on floor (P57 fix)", () => {
      // After P57 fix, this pattern should either:
      // a) Work (if constructor adds localCOM param like Circle/Capsule), or
      // b) Throw a clear error (if Material is detected in filter position)
      const space = new Space(new Vec2(0, 400));
      space.bodies.add(staticFloor(0, 300));
      const body = new Body(BodyType.DYNAMIC, new Vec2(0, 0));
      body.shapes.add(
        new Polygon(Polygon.box(28, 28), undefined, new Material(0.2, 0.5, 0.4, 1) as any),
      );
      space.bodies.add(body);
      step(space, 600);
      expect(isAboveFloor(body, 300, 20)).toBe(true);
    });
  });
});
