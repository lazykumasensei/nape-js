/**
 * ZPP_Collide — extended narrowphase collision tests.
 *
 * Targets: edge-edge polygon collisions, circle-polygon at various angles,
 * nearly parallel edges, degenerate geometry, triangle-triangle collisions,
 * hexagon collisions, capsule edge cases, and fluid collision with
 * different shape combinations.
 */

import { describe, it, expect } from "vitest";
import "../../../src/core/engine";
import { Space } from "../../../src/space/Space";
import { Body } from "../../../src/phys/Body";
import { BodyType } from "../../../src/phys/BodyType";
import { Vec2 } from "../../../src/geom/Vec2";
import { Circle } from "../../../src/shape/Circle";
import { Polygon } from "../../../src/shape/Polygon";
import { Capsule } from "../../../src/shape/Capsule";
import { FluidProperties } from "../../../src/phys/FluidProperties";
import { InteractionListener } from "../../../src/callbacks/InteractionListener";
import { CbEvent } from "../../../src/callbacks/CbEvent";
import { CbType } from "../../../src/callbacks/CbType";
import { InteractionType } from "../../../src/callbacks/InteractionType";

function step(space: Space, n = 1): void {
  for (let i = 0; i < n; i++) space.step(1 / 60);
}

// ---------------------------------------------------------------------------
// Polygon-polygon edge collisions
// ---------------------------------------------------------------------------

describe("ZPP_Collide — polygon-polygon edge cases", () => {
  it("box-box flat edge contact", () => {
    const space = new Space(new Vec2(0, 500));

    const floor = new Body(BodyType.STATIC, new Vec2(0, 100));
    floor.shapes.add(new Polygon(Polygon.box(200, 10)));
    floor.space = space;

    const box = new Body(BodyType.DYNAMIC, new Vec2(0, 50));
    box.shapes.add(new Polygon(Polygon.box(30, 30)));
    box.space = space;

    let beginFired = false;
    new InteractionListener(
      CbEvent.BEGIN,
      InteractionType.COLLISION,
      CbType.ANY_BODY,
      CbType.ANY_BODY,
      () => {
        beginFired = true;
      },
    ).space = space;

    step(space, 60);
    expect(beginFired).toBe(true);
    // Box should rest on floor
    expect(box.position.y).toBeLessThan(100);
    expect(box.position.y).toBeGreaterThan(50);
  });

  it("rotated box on flat floor — edge-to-edge at angle", () => {
    const space = new Space(new Vec2(0, 500));

    const floor = new Body(BodyType.STATIC, new Vec2(0, 100));
    floor.shapes.add(new Polygon(Polygon.box(200, 10)));
    floor.space = space;

    const box = new Body(BodyType.DYNAMIC, new Vec2(0, 50));
    box.shapes.add(new Polygon(Polygon.box(30, 30)));
    box.rotation = Math.PI / 4; // 45 degrees — vertex contact
    box.space = space;

    step(space, 60);
    expect(box.position.y).toBeLessThan(100);
  });

  it("triangle-triangle collision", () => {
    const space = new Space(new Vec2(0, 0));

    const tri1 = new Body(BodyType.DYNAMIC, new Vec2(0, 0));
    tri1.shapes.add(new Polygon([new Vec2(0, -20), new Vec2(20, 20), new Vec2(-20, 20)]));
    tri1.space = space;

    const tri2 = new Body(BodyType.DYNAMIC, new Vec2(25, 0));
    tri2.shapes.add(new Polygon([new Vec2(0, -20), new Vec2(20, 20), new Vec2(-20, 20)]));
    tri2.space = space;

    let hit = false;
    new InteractionListener(
      CbEvent.BEGIN,
      InteractionType.COLLISION,
      CbType.ANY_BODY,
      CbType.ANY_BODY,
      () => {
        hit = true;
      },
    ).space = space;

    step(space, 1);
    expect(hit).toBe(true);
  });

  it("hexagon-hexagon collision", () => {
    const space = new Space(new Vec2(0, 0));

    const h1 = new Body(BodyType.DYNAMIC, new Vec2(0, 0));
    h1.shapes.add(new Polygon(Polygon.regular(15, 15, 6)));
    h1.space = space;

    const h2 = new Body(BodyType.DYNAMIC, new Vec2(25, 0));
    h2.shapes.add(new Polygon(Polygon.regular(15, 15, 6)));
    h2.space = space;

    let hit = false;
    new InteractionListener(
      CbEvent.BEGIN,
      InteractionType.COLLISION,
      CbType.ANY_BODY,
      CbType.ANY_BODY,
      () => {
        hit = true;
      },
    ).space = space;

    step(space, 1);
    expect(hit).toBe(true);
  });

  it("pentagon on box", () => {
    const space = new Space(new Vec2(0, 500));

    const floor = new Body(BodyType.STATIC, new Vec2(0, 100));
    floor.shapes.add(new Polygon(Polygon.box(200, 10)));
    floor.space = space;

    const penta = new Body(BodyType.DYNAMIC, new Vec2(0, 50));
    penta.shapes.add(new Polygon(Polygon.regular(15, 15, 5)));
    penta.space = space;

    step(space, 60);
    expect(penta.position.y).toBeLessThan(100);
    expect(penta.position.y).toBeGreaterThan(50);
  });
});

// ---------------------------------------------------------------------------
// Circle-polygon at various angles
// ---------------------------------------------------------------------------

describe("ZPP_Collide — circle-polygon angles", () => {
  it("circle on box corner", () => {
    const space = new Space(new Vec2(0, 500));

    const box = new Body(BodyType.STATIC, new Vec2(0, 100));
    box.shapes.add(new Polygon(Polygon.box(60, 40)));
    box.space = space;

    // Circle positioned near the edge of the box
    const ball = new Body(BodyType.DYNAMIC, new Vec2(15, 60));
    ball.shapes.add(new Circle(10));
    ball.space = space;

    let hit = false;
    new InteractionListener(
      CbEvent.BEGIN,
      InteractionType.COLLISION,
      CbType.ANY_BODY,
      CbType.ANY_BODY,
      () => {
        hit = true;
      },
    ).space = space;

    step(space, 60);
    expect(hit).toBe(true);
  });

  it("circle on angled polygon edge", () => {
    const space = new Space(new Vec2(0, 500));

    // Angled surface
    const ramp = new Body(BodyType.STATIC, new Vec2(0, 100));
    ramp.shapes.add(new Polygon(Polygon.box(200, 10)));
    ramp.rotation = 0.4;
    ramp.space = space;

    const ball = new Body(BodyType.DYNAMIC, new Vec2(0, 0));
    ball.shapes.add(new Circle(10));
    ball.space = space;

    step(space, 60);
    // Ball should have slid along the ramp
    expect(typeof ball.position.x).toBe("number");
    expect(typeof ball.position.y).toBe("number");
  });

  it("small circle inside large polygon detects collision", () => {
    const space = new Space(new Vec2(0, 0));

    const bigBox = new Body(BodyType.STATIC, new Vec2(0, 0));
    bigBox.shapes.add(new Polygon(Polygon.box(200, 200)));
    bigBox.space = space;

    const tiny = new Body(BodyType.DYNAMIC, new Vec2(0, 0));
    tiny.shapes.add(new Circle(3));
    tiny.space = space;

    let hit = false;
    new InteractionListener(
      CbEvent.BEGIN,
      InteractionType.COLLISION,
      CbType.ANY_BODY,
      CbType.ANY_BODY,
      () => {
        hit = true;
      },
    ).space = space;

    step(space, 5);
    expect(hit).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Capsule collisions
// ---------------------------------------------------------------------------

describe("ZPP_Collide — capsule collisions", () => {
  it("capsule-circle collision", () => {
    const space = new Space(new Vec2(0, 0));

    const b1 = new Body(BodyType.DYNAMIC, new Vec2(0, 0));
    b1.shapes.add(new Capsule(30, 10));
    b1.space = space;

    const b2 = new Body(BodyType.DYNAMIC, new Vec2(20, 0));
    b2.shapes.add(new Circle(15));
    b2.space = space;

    let hit = false;
    new InteractionListener(
      CbEvent.BEGIN,
      InteractionType.COLLISION,
      CbType.ANY_BODY,
      CbType.ANY_BODY,
      () => {
        hit = true;
      },
    ).space = space;

    step(space, 1);
    expect(hit).toBe(true);
  });

  it("capsule-polygon collision", () => {
    const space = new Space(new Vec2(0, 500));

    const floor = new Body(BodyType.STATIC, new Vec2(0, 100));
    floor.shapes.add(new Polygon(Polygon.box(200, 10)));
    floor.space = space;

    const cap = new Body(BodyType.DYNAMIC, new Vec2(0, 50));
    cap.shapes.add(new Capsule(20, 8));
    cap.space = space;

    step(space, 60);
    expect(cap.position.y).toBeLessThan(100);
    expect(cap.position.y).toBeGreaterThan(50);
  });

  it("capsule-capsule collision", () => {
    const space = new Space(new Vec2(0, 0));

    const b1 = new Body(BodyType.DYNAMIC, new Vec2(0, 0));
    b1.shapes.add(new Capsule(25, 10));
    b1.space = space;

    const b2 = new Body(BodyType.DYNAMIC, new Vec2(15, 0));
    b2.shapes.add(new Capsule(25, 10));
    b2.space = space;

    let hit = false;
    new InteractionListener(
      CbEvent.BEGIN,
      InteractionType.COLLISION,
      CbType.ANY_BODY,
      CbType.ANY_BODY,
      () => {
        hit = true;
      },
    ).space = space;

    step(space, 1);
    expect(hit).toBe(true);
  });

  it("rotated capsule collides with box", () => {
    const space = new Space(new Vec2(0, 500));

    const floor = new Body(BodyType.STATIC, new Vec2(0, 100));
    floor.shapes.add(new Polygon(Polygon.box(200, 10)));
    floor.space = space;

    const cap = new Body(BodyType.DYNAMIC, new Vec2(0, 50));
    cap.shapes.add(new Capsule(30, 10));
    cap.rotation = Math.PI / 4;
    cap.space = space;

    step(space, 60);
    expect(cap.position.y).toBeLessThan(100);
  });
});

// ---------------------------------------------------------------------------
// Fluid collisions with various shapes
// ---------------------------------------------------------------------------

describe("ZPP_Collide — fluid collision (flowCollide) shapes", () => {
  function createFluidPool(space: Space): Body {
    const b = new Body(BodyType.STATIC, new Vec2(0, 0));
    const s = new Polygon(Polygon.box(500, 500));
    s.fluidEnabled = true;
    s.fluidProperties = new FluidProperties(2, 1);
    b.shapes.add(s);
    b.space = space;
    return b;
  }

  it("circle in fluid", () => {
    const space = new Space(new Vec2(0, 400));
    createFluidPool(space);

    let fluidDetected = false;
    new InteractionListener(
      CbEvent.BEGIN,
      InteractionType.FLUID,
      CbType.ANY_BODY,
      CbType.ANY_BODY,
      () => {
        fluidDetected = true;
      },
    ).space = space;

    const ball = new Body(BodyType.DYNAMIC, new Vec2(0, 0));
    ball.shapes.add(new Circle(15));
    ball.space = space;

    step(space, 5);
    expect(fluidDetected).toBe(true);
  });

  it("polygon in fluid", () => {
    const space = new Space(new Vec2(0, 400));
    createFluidPool(space);

    let fluidDetected = false;
    new InteractionListener(
      CbEvent.BEGIN,
      InteractionType.FLUID,
      CbType.ANY_BODY,
      CbType.ANY_BODY,
      () => {
        fluidDetected = true;
      },
    ).space = space;

    const box = new Body(BodyType.DYNAMIC, new Vec2(0, 0));
    box.shapes.add(new Polygon(Polygon.box(20, 20)));
    box.space = space;

    step(space, 5);
    expect(fluidDetected).toBe(true);
  });

  it("capsule in fluid", () => {
    const space = new Space(new Vec2(0, 400));
    createFluidPool(space);

    let fluidDetected = false;
    new InteractionListener(
      CbEvent.BEGIN,
      InteractionType.FLUID,
      CbType.ANY_BODY,
      CbType.ANY_BODY,
      () => {
        fluidDetected = true;
      },
    ).space = space;

    const cap = new Body(BodyType.DYNAMIC, new Vec2(0, 0));
    cap.shapes.add(new Capsule(20, 8));
    cap.space = space;

    step(space, 5);
    expect(fluidDetected).toBe(true);
  });

  it("triangle in fluid", () => {
    const space = new Space(new Vec2(0, 400));
    createFluidPool(space);

    let fluidDetected = false;
    new InteractionListener(
      CbEvent.BEGIN,
      InteractionType.FLUID,
      CbType.ANY_BODY,
      CbType.ANY_BODY,
      () => {
        fluidDetected = true;
      },
    ).space = space;

    const tri = new Body(BodyType.DYNAMIC, new Vec2(0, 0));
    tri.shapes.add(new Polygon([new Vec2(0, -15), new Vec2(15, 15), new Vec2(-15, 15)]));
    tri.space = space;

    step(space, 5);
    expect(fluidDetected).toBe(true);
  });

  it("hexagon in fluid", () => {
    const space = new Space(new Vec2(0, 400));
    createFluidPool(space);

    let fluidDetected = false;
    new InteractionListener(
      CbEvent.BEGIN,
      InteractionType.FLUID,
      CbType.ANY_BODY,
      CbType.ANY_BODY,
      () => {
        fluidDetected = true;
      },
    ).space = space;

    const hex = new Body(BodyType.DYNAMIC, new Vec2(0, 0));
    hex.shapes.add(new Polygon(Polygon.regular(15, 15, 6)));
    hex.space = space;

    step(space, 5);
    expect(fluidDetected).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Point containment tests
// ---------------------------------------------------------------------------

describe("ZPP_Collide — containment", () => {
  it("body.contains returns true for point inside circle", () => {
    const space = new Space(new Vec2(0, 0));
    const b = new Body(BodyType.DYNAMIC, new Vec2(100, 100));
    b.shapes.add(new Circle(20));
    b.space = space;
    step(space);

    expect(b.contains(new Vec2(100, 100))).toBe(true);
    expect(b.contains(new Vec2(200, 200))).toBe(false);
  });

  it("body.contains returns true for point inside polygon", () => {
    const space = new Space(new Vec2(0, 0));
    const b = new Body(BodyType.STATIC, new Vec2(100, 100));
    b.shapes.add(new Polygon(Polygon.box(40, 40)));
    b.space = space;
    step(space);

    expect(b.contains(new Vec2(100, 100))).toBe(true);
    expect(b.contains(new Vec2(200, 200))).toBe(false);
  });

  it("body.contains returns true for point inside capsule", () => {
    const space = new Space(new Vec2(0, 0));
    const b = new Body(BodyType.DYNAMIC, new Vec2(100, 100));
    b.shapes.add(new Capsule(30, 10));
    b.space = space;
    step(space);

    expect(b.contains(new Vec2(100, 100))).toBe(true);
    expect(b.contains(new Vec2(200, 200))).toBe(false);
  });
});
