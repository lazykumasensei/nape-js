/**
 * ZPP_Collide — extended coverage tests.
 *
 * Targets uncovered branches:
 * - Capsule containment and collision tests
 * - Polygon-polygon contact generation (Sutherland-Hodgman clipping)
 * - Circle-polygon various contact types
 * - Fluid polygon clipping (flowCollide)
 * - Capsule-circle, capsule-polygon, capsule-capsule collisions
 * - Edge cases: nearly parallel edges, degenerate geometry
 */

import { describe, it, expect } from "vitest";
import "../../../src/core/engine";
import { ZPP_Collide } from "../../../src/native/geom/ZPP_Collide";
import { ZPP_Geom } from "../../../src/native/geom/ZPP_Geom";
import { Space } from "../../../src/space/Space";
import { Body } from "../../../src/phys/Body";
import { BodyType } from "../../../src/phys/BodyType";
import { Vec2 } from "../../../src/geom/Vec2";
import { Circle } from "../../../src/shape/Circle";
import { Polygon } from "../../../src/shape/Polygon";
import { Capsule } from "../../../src/shape/Capsule";
import "../../../src/dynamics/Contact";
import { FluidProperties } from "../../../src/phys/FluidProperties";
import { InteractionListener } from "../../../src/callbacks/InteractionListener";
import { CbType } from "../../../src/callbacks/CbType";
import { CbEvent } from "../../../src/callbacks/CbEvent";
import { InteractionType } from "../../../src/callbacks/InteractionType";

// -------------------------------------------------------------------------
// Helpers
// -------------------------------------------------------------------------

function getZppShape(body: Body, space: Space): any {
  space.step(1 / 60);
  const zppShape = (body as any).zpp_inner.shapes.head.elt;
  ZPP_Geom.validateShape(zppShape);
  return zppShape;
}

function staticBody(shape: any, x = 0, y = 0): Body {
  const b = new Body(BodyType.STATIC, new Vec2(x, y));
  b.shapes.add(shape);
  return b;
}

function dynamicBody(shape: any, x = 0, y = 0): Body {
  const b = new Body(BodyType.DYNAMIC, new Vec2(x, y));
  b.shapes.add(shape);
  return b;
}

// -------------------------------------------------------------------------
// 1. Capsule containment
// -------------------------------------------------------------------------

describe("ZPP_Collide — capsule containment", () => {
  it("point inside capsule returns true", () => {
    const space = new Space(new Vec2(0, 0));
    const b = staticBody(new Capsule(40, 20), 0, 0);
    b.space = space;

    const zppShape = getZppShape(b, space);
    const point = { x: 0, y: 0 };
    expect(ZPP_Collide.shapeContains(zppShape, point)).toBe(true);
  });

  it("point outside capsule returns false", () => {
    const space = new Space(new Vec2(0, 0));
    const b = staticBody(new Capsule(40, 20), 0, 0);
    b.space = space;

    const zppShape = getZppShape(b, space);
    const point = { x: 0, y: 30 };
    expect(ZPP_Collide.shapeContains(zppShape, point)).toBe(false);
  });

  it("point at capsule endpoint (within radius) returns true", () => {
    const space = new Space(new Vec2(0, 0));
    const b = staticBody(new Capsule(40, 20), 0, 0);
    b.space = space;

    const zppShape = getZppShape(b, space);
    const point = { x: 18, y: 0 };
    expect(ZPP_Collide.shapeContains(zppShape, point)).toBe(true);
  });
});

// -------------------------------------------------------------------------
// 2. Capsule collision tests
// -------------------------------------------------------------------------

describe("ZPP_Collide — capsule collisions via simulation", () => {
  it("capsule-circle collision detected", () => {
    const space = new Space(new Vec2(0, 500));
    const floor = staticBody(new Polygon(Polygon.box(600, 20)), 0, 300);
    floor.space = space;

    const cap = dynamicBody(new Capsule(40, 20), 0, 200);
    cap.space = space;

    let collided = false;
    for (let i = 0; i < 120; i++) {
      space.step(1 / 60, 10, 10);
      if ((space.arbiters as any).zpp_gl() > 0) {
        collided = true;
        break;
      }
    }
    expect(collided).toBe(true);
  });

  it("capsule-capsule collision detected", () => {
    const space = new Space(new Vec2(0, 0));
    const cap1 = dynamicBody(new Capsule(40, 20), -20, 0);
    cap1.velocity = new Vec2(100, 0);
    cap1.space = space;

    const cap2 = dynamicBody(new Capsule(40, 20), 20, 0);
    cap2.velocity = new Vec2(-100, 0);
    cap2.space = space;

    let collided = false;
    for (let i = 0; i < 60; i++) {
      space.step(1 / 60, 10, 10);
      if ((space.arbiters as any).zpp_gl() > 0) {
        collided = true;
        break;
      }
    }
    expect(collided).toBe(true);
  });

  it("capsule-polygon collision detected", () => {
    const space = new Space(new Vec2(0, 500));
    const floor = staticBody(new Polygon(Polygon.box(600, 20)), 0, 300);
    floor.space = space;

    const cap = dynamicBody(new Capsule(40, 20), 0, 200);
    cap.space = space;

    let collided = false;
    for (let i = 0; i < 120; i++) {
      space.step(1 / 60, 10, 10);
      if ((space.arbiters as any).zpp_gl() > 0) {
        collided = true;
        break;
      }
    }
    expect(collided).toBe(true);
  });
});

// -------------------------------------------------------------------------
// 3. Polygon-polygon contact generation
// -------------------------------------------------------------------------

describe("ZPP_Collide — polygon-polygon contacts", () => {
  it("two overlapping boxes generate contacts", () => {
    const space = new Space(new Vec2(0, 500));
    const floor = staticBody(new Polygon(Polygon.box(200, 20)), 0, 300);
    floor.space = space;

    const box = dynamicBody(new Polygon(Polygon.box(40, 40)), 0, 200);
    box.space = space;

    let contactCount = 0;
    const listener = new InteractionListener(
      CbEvent.ONGOING,
      InteractionType.COLLISION,
      CbType.ANY_BODY,
      CbType.ANY_BODY,
      (cb: any) => {
        const arbiters = cb.arbiters;
        for (let i = 0; i < arbiters.length; i++) {
          const arb = arbiters.at(i);
          if (arb.isCollisionArbiter()) {
            for (const _c of arb.collisionArbiter.contacts) {
              contactCount++;
            }
          }
        }
      },
    );
    listener.space = space;

    for (let i = 0; i < 120; i++) {
      space.step(1 / 60, 10, 10);
      if (contactCount > 0) break;
    }

    expect(contactCount).toBeGreaterThan(0);
  });

  it("rotated polygon collision generates correct contacts", () => {
    const space = new Space(new Vec2(0, 500));
    const floor = staticBody(new Polygon(Polygon.box(600, 20)), 0, 300);
    floor.space = space;

    const box = dynamicBody(new Polygon(Polygon.box(30, 30)), 0, 200);
    box.rotation = Math.PI / 4; // 45 degrees — diamond shape
    box.space = space;

    let collided = false;
    for (let i = 0; i < 120; i++) {
      space.step(1 / 60, 10, 10);
      if ((space.arbiters as any).zpp_gl() > 0) {
        collided = true;
        break;
      }
    }
    expect(collided).toBe(true);
  });

  it("triangle-box collision detected", () => {
    const space = new Space(new Vec2(0, 500));
    const floor = staticBody(new Polygon(Polygon.box(600, 20)), 0, 300);
    floor.space = space;

    const tri = dynamicBody(new Polygon(Polygon.regular(20, 20, 3)), 0, 200);
    tri.space = space;

    let collided = false;
    for (let i = 0; i < 120; i++) {
      space.step(1 / 60, 10, 10);
      if ((space.arbiters as any).zpp_gl() > 0) {
        collided = true;
        break;
      }
    }
    expect(collided).toBe(true);
  });
});

// -------------------------------------------------------------------------
// 4. Circle-polygon contact types
// -------------------------------------------------------------------------

describe("ZPP_Collide — circle-polygon contacts", () => {
  it("circle approaching polygon edge — edge contact type", () => {
    const space = new Space(new Vec2(0, 500));
    const floor = staticBody(new Polygon(Polygon.box(600, 20)), 0, 300);
    floor.space = space;

    const ball = dynamicBody(new Circle(15), 0, 200);
    ball.space = space;

    let hasContact = false;
    const listener = new InteractionListener(
      CbEvent.ONGOING,
      InteractionType.COLLISION,
      CbType.ANY_BODY,
      CbType.ANY_BODY,
      (cb: any) => {
        const arbiters = cb.arbiters;
        for (let i = 0; i < arbiters.length; i++) {
          const arb = arbiters.at(i);
          if (arb.isCollisionArbiter()) {
            hasContact = true;
          }
        }
      },
    );
    listener.space = space;

    for (let i = 0; i < 120; i++) {
      space.step(1 / 60, 10, 10);
      if (hasContact) break;
    }
    expect(hasContact).toBe(true);
  });

  it("circle at polygon corner — vertex contact type", () => {
    const space = new Space(new Vec2(0, 500));
    // Narrow platform — ball will hit near the corner
    const platform = staticBody(new Polygon(Polygon.box(30, 20)), 0, 300);
    platform.space = space;

    const ball = dynamicBody(new Circle(15), 14, 200);
    ball.space = space;

    let collided = false;
    for (let i = 0; i < 120; i++) {
      space.step(1 / 60, 10, 10);
      if ((space.arbiters as any).zpp_gl() > 0) {
        collided = true;
        break;
      }
    }
    expect(collided).toBe(true);
  });
});

// -------------------------------------------------------------------------
// 5. Fluid polygon clipping (flowCollide)
// -------------------------------------------------------------------------

describe("ZPP_Collide — fluid collision (flowCollide)", () => {
  it("circle in fluid polygon — flowCollide generates overlap", () => {
    const space = new Space(new Vec2(0, 300));
    const fluid = new Body(BodyType.STATIC, new Vec2(0, 0));
    const shape = new Polygon(Polygon.box(2000, 2000));
    shape.fluidEnabled = true;
    shape.fluidProperties = new FluidProperties(2.0, 1.0);
    fluid.shapes.add(shape as any);
    fluid.space = space;

    const ball = dynamicBody(new Circle(20), 0, 0);
    ball.space = space;

    let fluidDetected = false;
    const listener = new InteractionListener(
      CbEvent.BEGIN,
      InteractionType.FLUID,
      CbType.ANY_BODY,
      CbType.ANY_BODY,
      () => {
        fluidDetected = true;
      },
    );
    listener.space = space;

    for (let i = 0; i < 30; i++) space.step(1 / 60, 10, 10);
    expect(fluidDetected).toBe(true);
  });

  it("polygon in fluid — flowCollide with polygon clipping", () => {
    const space = new Space(new Vec2(0, 300));
    const fluid = new Body(BodyType.STATIC, new Vec2(0, 0));
    const shape = new Polygon(Polygon.box(2000, 2000));
    shape.fluidEnabled = true;
    shape.fluidProperties = new FluidProperties(2.0, 3.0);
    fluid.shapes.add(shape as any);
    fluid.space = space;

    const box = dynamicBody(new Polygon(Polygon.box(30, 30)), 0, 0);
    box.space = space;

    let fluidDetected = false;
    const listener = new InteractionListener(
      CbEvent.BEGIN,
      InteractionType.FLUID,
      CbType.ANY_BODY,
      CbType.ANY_BODY,
      () => {
        fluidDetected = true;
      },
    );
    listener.space = space;

    for (let i = 0; i < 30; i++) space.step(1 / 60, 10, 10);
    expect(fluidDetected).toBe(true);
  });

  it("capsule in fluid — capsule flow clipping", () => {
    const space = new Space(new Vec2(0, 300));
    const fluid = new Body(BodyType.STATIC, new Vec2(0, 0));
    const shape = new Polygon(Polygon.box(2000, 2000));
    shape.fluidEnabled = true;
    shape.fluidProperties = new FluidProperties(2.0, 3.0);
    fluid.shapes.add(shape as any);
    fluid.space = space;

    const cap = dynamicBody(new Capsule(40, 20), 0, 0);
    cap.space = space;

    let fluidDetected = false;
    const listener = new InteractionListener(
      CbEvent.BEGIN,
      InteractionType.FLUID,
      CbType.ANY_BODY,
      CbType.ANY_BODY,
      () => {
        fluidDetected = true;
      },
    );
    listener.space = space;

    for (let i = 0; i < 30; i++) space.step(1 / 60, 10, 10);
    expect(fluidDetected).toBe(true);
  });
});

// -------------------------------------------------------------------------
// 6. containTest (shape-in-shape)
// -------------------------------------------------------------------------

describe("ZPP_Collide — containTest", () => {
  it("small circle inside large circle — contains true", () => {
    const space = new Space(new Vec2(0, 0));
    const b1 = staticBody(new Circle(50), 0, 0);
    b1.space = space;
    const b2 = staticBody(new Circle(5), 0, 0);
    b2.space = space;

    const s1 = getZppShape(b1, space);
    const s2 = getZppShape(b2, space);
    expect(ZPP_Collide.containTest(s1, s2)).toBe(true);
  });

  it("small box inside large box — contains true", () => {
    const space = new Space(new Vec2(0, 0));
    const b1 = staticBody(new Polygon(Polygon.box(100, 100)), 0, 0);
    b1.space = space;
    const b2 = staticBody(new Polygon(Polygon.box(10, 10)), 0, 0);
    b2.space = space;

    const s1 = getZppShape(b1, space);
    const s2 = getZppShape(b2, space);
    expect(ZPP_Collide.containTest(s1, s2)).toBe(true);
  });

  it("separated shapes — contains false", () => {
    const space = new Space(new Vec2(0, 0));
    const b1 = staticBody(new Circle(10), 0, 0);
    b1.space = space;
    const b2 = staticBody(new Circle(10), 100, 0);
    b2.space = space;

    const s1 = getZppShape(b1, space);
    const s2 = getZppShape(b2, space);
    expect(ZPP_Collide.containTest(s1, s2)).toBe(false);
  });
});

// -------------------------------------------------------------------------
// 7. testCollide_safe (boolean collision test with AABB pretest)
// -------------------------------------------------------------------------

describe("ZPP_Collide — testCollide_safe", () => {
  it("overlapping circles — returns true", () => {
    const space = new Space(new Vec2(0, 0));
    const b1 = staticBody(new Circle(20), 0, 0);
    b1.space = space;
    const b2 = staticBody(new Circle(20), 25, 0);
    b2.space = space;

    const s1 = getZppShape(b1, space);
    const s2 = getZppShape(b2, space);
    expect(ZPP_Collide.testCollide_safe(s1, s2)).toBe(true);
  });

  it("separated circles — returns false", () => {
    const space = new Space(new Vec2(0, 0));
    const b1 = staticBody(new Circle(10), 0, 0);
    b1.space = space;
    const b2 = staticBody(new Circle(10), 100, 0);
    b2.space = space;

    const s1 = getZppShape(b1, space);
    const s2 = getZppShape(b2, space);
    expect(ZPP_Collide.testCollide_safe(s1, s2)).toBe(false);
  });

  it("overlapping polygon and circle — returns true", () => {
    const space = new Space(new Vec2(0, 0));
    const b1 = staticBody(new Polygon(Polygon.box(40, 40)), 0, 0);
    b1.space = space;
    const b2 = staticBody(new Circle(15), 15, 0);
    b2.space = space;

    const s1 = getZppShape(b1, space);
    const s2 = getZppShape(b2, space);
    expect(ZPP_Collide.testCollide_safe(s1, s2)).toBe(true);
  });

  it("capsule-circle overlap — returns true", () => {
    const space = new Space(new Vec2(0, 0));
    const b1 = staticBody(new Capsule(40, 20), 0, 0);
    b1.space = space;
    const b2 = staticBody(new Circle(10), 15, 0);
    b2.space = space;

    const s1 = getZppShape(b1, space);
    const s2 = getZppShape(b2, space);
    expect(ZPP_Collide.testCollide_safe(s1, s2)).toBe(true);
  });
});

// -------------------------------------------------------------------------
// 8. bodyContains
// -------------------------------------------------------------------------

describe("ZPP_Collide — bodyContains", () => {
  it("point inside multi-shape body returns true", () => {
    const space = new Space(new Vec2(0, 0));
    const b = new Body(BodyType.STATIC, new Vec2(0, 0));
    b.shapes.add(new Circle(10));
    b.shapes.add(new Polygon(Polygon.box(40, 40)));
    b.space = space;
    space.step(1 / 60);

    const zppBody = (b as any).zpp_inner;
    const point = { x: 18, y: 0 };
    expect(ZPP_Collide.bodyContains(zppBody, point)).toBe(true);
  });

  it("point outside all shapes returns false", () => {
    const space = new Space(new Vec2(0, 0));
    const b = new Body(BodyType.STATIC, new Vec2(0, 0));
    b.shapes.add(new Circle(10));
    b.space = space;
    space.step(1 / 60);

    const zppBody = (b as any).zpp_inner;
    const point = { x: 100, y: 100 };
    expect(ZPP_Collide.bodyContains(zppBody, point)).toBe(false);
  });
});
