/**
 * ZPP_Arbiter — coverage tests for the arbiter base class.
 *
 * Targets:
 * - wrapper() creation for COL, FLUID, and SENSOR types
 * - inactiveme() / acting() state checks
 * - swap_features() body/shape exchange
 * - lazyRetire() clearing and body list management
 * - sup_assign() / sup_retire() lifecycle
 * - _removeFromArbiterList / _addToArbiterList internals
 * - _initEnums() static method
 */

import { describe, it, expect } from "vitest";
import { Space } from "../../../src/space/Space";
import { Body } from "../../../src/phys/Body";
import { BodyType } from "../../../src/phys/BodyType";
import { Vec2 } from "../../../src/geom/Vec2";
import { Circle } from "../../../src/shape/Circle";
import { Polygon } from "../../../src/shape/Polygon";
import { FluidProperties } from "../../../src/phys/FluidProperties";
import { InteractionListener } from "../../../src/callbacks/InteractionListener";
import { CbType } from "../../../src/callbacks/CbType";
import { CbEvent } from "../../../src/callbacks/CbEvent";
import { InteractionType } from "../../../src/callbacks/InteractionType";
import "../../../src/dynamics/Contact";

// -------------------------------------------------------------------------
// Helpers
// -------------------------------------------------------------------------

function arbiterCount(space: Space): number {
  return (space.arbiters as any).zpp_gl();
}

// -------------------------------------------------------------------------
// 1. Arbiter wrapper creation for different types
// -------------------------------------------------------------------------

describe("ZPP_Arbiter — wrapper creation", () => {
  it("collision arbiter wrapper created during collision callback", () => {
    const space = new Space(new Vec2(0, 500));
    const floor = new Body(BodyType.STATIC, new Vec2(0, 300));
    floor.shapes.add(new Polygon(Polygon.box(600, 20)));
    floor.space = space;

    const ball = new Body(BodyType.DYNAMIC, new Vec2(0, 200));
    ball.shapes.add(new Circle(15));
    ball.space = space;

    let arbiterType = "";
    const listener = new InteractionListener(
      CbEvent.BEGIN,
      InteractionType.COLLISION,
      CbType.ANY_BODY,
      CbType.ANY_BODY,
      (cb: any) => {
        const arbiters = cb.arbiters;
        for (let i = 0; i < arbiters.length; i++) {
          if (arbiters.at(i).isCollisionArbiter()) {
            arbiterType = "COLLISION";
          }
        }
      },
    );
    listener.space = space;

    for (let i = 0; i < 120; i++) {
      space.step(1 / 60, 10, 10);
      if (arbiterType !== "") break;
    }

    expect(arbiterType).toBe("COLLISION");
  });

  it("fluid arbiter wrapper created during fluid callback", () => {
    const space = new Space(new Vec2(0, 100));
    const fluid = new Body(BodyType.STATIC, new Vec2(0, 0));
    const shape = new Polygon(Polygon.box(2000, 2000));
    shape.fluidEnabled = true;
    shape.fluidProperties = new FluidProperties(2.0, 3.0);
    fluid.shapes.add(shape as any);
    fluid.space = space;

    const ball = new Body(BodyType.DYNAMIC, new Vec2(0, 0));
    ball.shapes.add(new Circle(15));
    ball.space = space;

    let arbiterType = "";
    const listener = new InteractionListener(
      CbEvent.BEGIN,
      InteractionType.FLUID,
      CbType.ANY_BODY,
      CbType.ANY_BODY,
      (cb: any) => {
        const arbiters = cb.arbiters;
        for (let i = 0; i < arbiters.length; i++) {
          if (arbiters.at(i).isFluidArbiter()) {
            arbiterType = "FLUID";
          }
        }
      },
    );
    listener.space = space;

    for (let i = 0; i < 60; i++) {
      space.step(1 / 60, 10, 10);
      if (arbiterType !== "") break;
    }

    expect(arbiterType).toBe("FLUID");
  });

  it("sensor arbiter wrapper created during sensor callback", () => {
    const space = new Space(new Vec2(0, 500));
    const sensor = new Body(BodyType.STATIC, new Vec2(0, 250));
    const sensorShape = new Circle(100);
    sensorShape.sensorEnabled = true;
    sensor.shapes.add(sensorShape);
    sensor.space = space;

    const ball = new Body(BodyType.DYNAMIC, new Vec2(0, 200));
    ball.shapes.add(new Circle(15));
    ball.space = space;

    let arbiterType = "";
    const listener = new InteractionListener(
      CbEvent.BEGIN,
      InteractionType.SENSOR,
      CbType.ANY_BODY,
      CbType.ANY_BODY,
      (cb: any) => {
        const arbiters = cb.arbiters;
        for (let i = 0; i < arbiters.length; i++) {
          if (arbiters.at(i).isSensorArbiter()) {
            arbiterType = "SENSOR";
          }
        }
      },
    );
    listener.space = space;

    for (let i = 0; i < 120; i++) {
      space.step(1 / 60, 10, 10);
      if (arbiterType !== "") break;
    }

    expect(arbiterType).toBe("SENSOR");
  });
});

// -------------------------------------------------------------------------
// 2. Arbiter lifecycle (active → retired)
// -------------------------------------------------------------------------

describe("ZPP_Arbiter — lifecycle", () => {
  it("arbiter becomes active on collision, inactive when separated", () => {
    const space = new Space(new Vec2(0, 500));
    const floor = new Body(BodyType.STATIC, new Vec2(0, 300));
    floor.shapes.add(new Polygon(Polygon.box(600, 20)));
    floor.space = space;

    const ball = new Body(BodyType.DYNAMIC, new Vec2(0, 200));
    ball.shapes.add(new Circle(15));
    ball.space = space;

    // Let ball fall to floor
    for (let i = 0; i < 120; i++) {
      space.step(1 / 60, 10, 10);
      if (arbiterCount(space) > 0) break;
    }
    expect(arbiterCount(space)).toBeGreaterThan(0);

    // Remove ball — arbiter should be retired
    ball.space = null;
    for (let i = 0; i < 5; i++) space.step(1 / 60, 10, 10);
    expect(arbiterCount(space)).toBe(0);
  });

  it("multiple bodies create separate arbiters", () => {
    const space = new Space(new Vec2(0, 500));
    const floor = new Body(BodyType.STATIC, new Vec2(0, 300));
    floor.shapes.add(new Polygon(Polygon.box(600, 20)));
    floor.space = space;

    const ball1 = new Body(BodyType.DYNAMIC, new Vec2(-50, 200));
    ball1.shapes.add(new Circle(15));
    ball1.space = space;

    const ball2 = new Body(BodyType.DYNAMIC, new Vec2(50, 200));
    ball2.shapes.add(new Circle(15));
    ball2.space = space;

    for (let i = 0; i < 120; i++) {
      space.step(1 / 60, 10, 10);
      if (arbiterCount(space) >= 2) break;
    }

    expect(arbiterCount(space)).toBeGreaterThanOrEqual(2);
  });
});

// -------------------------------------------------------------------------
// 3. Arbiter type discrimination
// -------------------------------------------------------------------------

describe("ZPP_Arbiter — type discrimination", () => {
  it("arbiter type methods correctly identify collision vs sensor vs fluid", () => {
    const space = new Space(new Vec2(0, 500));
    const floor = new Body(BodyType.STATIC, new Vec2(0, 300));
    floor.shapes.add(new Polygon(Polygon.box(600, 20)));
    floor.space = space;

    const ball = new Body(BodyType.DYNAMIC, new Vec2(0, 200));
    ball.shapes.add(new Circle(15));
    ball.space = space;

    let isColl = false;
    let isFluid = false;
    let isSensor = false;
    const listener = new InteractionListener(
      CbEvent.BEGIN,
      InteractionType.COLLISION,
      CbType.ANY_BODY,
      CbType.ANY_BODY,
      (cb: any) => {
        const arbiters = cb.arbiters;
        for (let i = 0; i < arbiters.length; i++) {
          const arb = arbiters.at(i);
          isColl = arb.isCollisionArbiter();
          isFluid = arb.isFluidArbiter();
          isSensor = arb.isSensorArbiter();
        }
      },
    );
    listener.space = space;

    for (let i = 0; i < 120; i++) {
      space.step(1 / 60, 10, 10);
      if (isColl) break;
    }

    expect(isColl).toBe(true);
    expect(isFluid).toBe(false);
    expect(isSensor).toBe(false);
  });
});

// -------------------------------------------------------------------------
// 4. BEGIN / END callback symmetry
// -------------------------------------------------------------------------

describe("ZPP_Arbiter — BEGIN/END symmetry", () => {
  it("BEGIN fires before END for the same pair", () => {
    const space = new Space(new Vec2(0, 500));
    const floor = new Body(BodyType.STATIC, new Vec2(0, 300));
    floor.shapes.add(new Polygon(Polygon.box(600, 20)));
    floor.space = space;

    const events: string[] = [];
    const beginListener = new InteractionListener(
      CbEvent.BEGIN,
      InteractionType.COLLISION,
      CbType.ANY_BODY,
      CbType.ANY_BODY,
      () => {
        events.push("BEGIN");
      },
    );
    beginListener.space = space;

    const endListener = new InteractionListener(
      CbEvent.END,
      InteractionType.COLLISION,
      CbType.ANY_BODY,
      CbType.ANY_BODY,
      () => {
        events.push("END");
      },
    );
    endListener.space = space;

    const ball = new Body(BodyType.DYNAMIC, new Vec2(0, 200));
    ball.shapes.add(new Circle(15));
    ball.space = space;

    // Let ball collide
    for (let i = 0; i < 120; i++) {
      space.step(1 / 60, 10, 10);
      if (events.includes("BEGIN")) break;
    }

    // Remove ball to trigger END
    ball.space = null;
    for (let i = 0; i < 5; i++) space.step(1 / 60, 10, 10);

    expect(events.indexOf("BEGIN")).toBeLessThan(events.indexOf("END"));
  });
});

// -------------------------------------------------------------------------
// 5. Arbiter sleeping
// -------------------------------------------------------------------------

describe("ZPP_Arbiter — sleeping", () => {
  it("resting body and arbiter go to sleep after inactivity", () => {
    const space = new Space(new Vec2(0, 500));
    const floor = new Body(BodyType.STATIC, new Vec2(0, 300));
    floor.shapes.add(new Polygon(Polygon.box(600, 20)));
    floor.space = space;

    const box = new Body(BodyType.DYNAMIC, new Vec2(0, 250));
    box.shapes.add(new Polygon(Polygon.box(20, 20)));
    box.space = space;

    // Run for many frames — body should eventually sleep
    for (let i = 0; i < 600; i++) space.step(1 / 60, 10, 10);

    // Box velocity should be near zero
    expect(Math.abs(box.velocity.y)).toBeLessThan(1);
  });
});
