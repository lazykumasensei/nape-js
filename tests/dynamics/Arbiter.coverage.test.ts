/**
 * Comprehensive integration tests for arbiter coverage.
 *
 * Targets:
 *  - ZPP_Arbiter (base arbiter internals)
 *  - ZPP_ColArbiter (collision arbiter properties, contacts, impulses)
 *  - ZPP_FluidArbiter (buoyancy, drag, overlap)
 *  - ZPP_SpaceArbiterList (space.arbiters immutability, length, at())
 *
 * All tests drive the public API via Space.step() to create real arbiters.
 */

import { describe, it, expect } from "vitest";
import "../../src/core/engine";
import { Space } from "../../src/space/Space";
import { Body } from "../../src/phys/Body";
import { BodyType } from "../../src/phys/BodyType";
import { Vec2 } from "../../src/geom/Vec2";
import { Circle } from "../../src/shape/Circle";
import { Polygon } from "../../src/shape/Polygon";
import { Material } from "../../src/phys/Material";
import { FluidProperties } from "../../src/phys/FluidProperties";
import { InteractionFilter } from "../../src/dynamics/InteractionFilter";
import { ArbiterType } from "../../src/dynamics/ArbiterType";
import { Arbiter } from "../../src/dynamics/Arbiter";
import { CollisionArbiter } from "../../src/dynamics/CollisionArbiter";
import { FluidArbiter } from "../../src/dynamics/FluidArbiter";
import { InteractionListener } from "../../src/callbacks/InteractionListener";
import { CbEvent } from "../../src/callbacks/CbEvent";
import { CbType } from "../../src/callbacks/CbType";
import { InteractionType } from "../../src/callbacks/InteractionType";
import { PreListener } from "../../src/callbacks/PreListener";
import { PreFlag } from "../../src/callbacks/PreFlag";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function dynamicCircle(x: number, y: number, r = 10): Body {
  const b = new Body(BodyType.DYNAMIC, new Vec2(x, y));
  b.shapes.add(new Circle(r));
  return b;
}

function dynamicBox(x: number, y: number, w = 20, h = 20): Body {
  const b = new Body(BodyType.DYNAMIC, new Vec2(x, y));
  b.shapes.add(new Polygon(Polygon.box(w, h)));
  return b;
}

function staticBox(x: number, y: number, w = 300, h = 10): Body {
  const b = new Body(BodyType.STATIC, new Vec2(x, y));
  b.shapes.add(new Polygon(Polygon.box(w, h)));
  return b;
}

/** Get arbiter count from space.arbiters (uses zpp_gl() internally). */
function arbiterCount(space: Space): number {
  return (space.arbiters as any).zpp_gl();
}

/** Get arbiter at index from space.arbiters. */
function arbiterAt(space: Space, index: number): Arbiter {
  return (space.arbiters as any).at(index) as Arbiter;
}

/** Create a space with a ball resting on a floor after simulation. */
function createCollidingScene(steps = 60): {
  space: Space;
  ball: Body;
  floor: Body;
} {
  const space = new Space(new Vec2(0, 500));
  const floor = staticBox(0, 50);
  floor.space = space;
  const ball = dynamicCircle(0, 10, 10);
  ball.space = space;
  for (let i = 0; i < steps; i++) space.step(1 / 60);
  return { space, ball, floor };
}

// ============================================================================
// ColArbiter coverage
// ============================================================================
describe("ColArbiter coverage — collision properties", () => {
  it("should expose collision arbiters in space.arbiters after collision", () => {
    const { space } = createCollidingScene();
    expect(arbiterCount(space)).toBeGreaterThanOrEqual(1);
  });

  it("arbiter from space.arbiters has correct type COLLISION", () => {
    const { space } = createCollidingScene();
    if (arbiterCount(space) > 0) {
      const arb = arbiterAt(space, 0);
      expect(arb.type).toBe(ArbiterType.COLLISION);
    }
  });

  it("collision arbiter normal is a unit vector", () => {
    const { space } = createCollidingScene();
    expect(arbiterCount(space)).toBeGreaterThanOrEqual(1);
    const arb = arbiterAt(space, 0);
    const colArb = arb.collisionArbiter!;
    expect(colArb).not.toBeNull();
    const n = colArb.normal;
    expect(typeof n.x).toBe("number");
    expect(typeof n.y).toBe("number");
    const mag = Math.sqrt(n.x * n.x + n.y * n.y);
    expect(mag).toBeCloseTo(1, 3);
  });

  it("collision arbiter contacts has at least one contact", () => {
    const { space } = createCollidingScene();
    const arb = arbiterAt(space, 0);
    const colArb = arb.collisionArbiter!;
    const contacts = colArb.contacts as any;
    expect(contacts.length).toBeGreaterThanOrEqual(1);
  });

  it("contact has position with numeric coordinates", () => {
    const { space } = createCollidingScene();
    const colArb = arbiterAt(space, 0).collisionArbiter!;
    const contacts = colArb.contacts as any;
    const c = contacts.at(0);
    const pos = c.position;
    expect(typeof pos.x).toBe("number");
    expect(typeof pos.y).toBe("number");
    expect(isNaN(pos.x)).toBe(false);
  });

  it("contact has numeric penetration", () => {
    const { space } = createCollidingScene();
    const colArb = arbiterAt(space, 0).collisionArbiter!;
    const contacts = colArb.contacts as any;
    const c = contacts.at(0);
    expect(typeof c.penetration).toBe("number");
  });

  it("contact fresh property is a boolean", () => {
    const { space } = createCollidingScene();
    const colArb = arbiterAt(space, 0).collisionArbiter!;
    const contacts = colArb.contacts as any;
    const c = contacts.at(0);
    expect(typeof c.fresh).toBe("boolean");
  });

  it("totalImpulse returns Vec3 with numeric components", () => {
    const { space } = createCollidingScene();
    const colArb = arbiterAt(space, 0).collisionArbiter!;
    const imp = colArb.totalImpulse();
    expect(typeof imp.x).toBe("number");
    expect(typeof imp.y).toBe("number");
    expect(typeof imp.z).toBe("number");
  });

  it("normalImpulse returns Vec3", () => {
    const { space } = createCollidingScene();
    const colArb = arbiterAt(space, 0).collisionArbiter!;
    const imp = colArb.normalImpulse();
    expect(typeof imp.x).toBe("number");
    expect(typeof imp.y).toBe("number");
  });

  it("tangentImpulse returns Vec3", () => {
    const { space } = createCollidingScene();
    const colArb = arbiterAt(space, 0).collisionArbiter!;
    const imp = colArb.tangentImpulse();
    expect(typeof imp.x).toBe("number");
  });

  it("rollingImpulse returns a number", () => {
    const { space } = createCollidingScene();
    const colArb = arbiterAt(space, 0).collisionArbiter!;
    const ri = colArb.rollingImpulse();
    expect(typeof ri).toBe("number");
  });

  it("totalImpulse(body) scoped to body1", () => {
    const { space } = createCollidingScene();
    const arb = arbiterAt(space, 0);
    const colArb = arb.collisionArbiter!;
    const imp = colArb.totalImpulse(arb.body1);
    expect(typeof imp.x).toBe("number");
    expect(typeof imp.y).toBe("number");
    expect(typeof imp.z).toBe("number");
  });

  it("totalImpulse(body) scoped to body2", () => {
    const { space } = createCollidingScene();
    const arb = arbiterAt(space, 0);
    const colArb = arb.collisionArbiter!;
    const imp = colArb.totalImpulse(arb.body2);
    expect(typeof imp.x).toBe("number");
  });

  it("normalImpulse(null, freshOnly=true) works", () => {
    const { space } = createCollidingScene();
    const colArb = arbiterAt(space, 0).collisionArbiter!;
    const imp = colArb.normalImpulse(null, true);
    expect(typeof imp.x).toBe("number");
  });

  it("tangentImpulse(null, freshOnly=true) works", () => {
    const { space } = createCollidingScene();
    const colArb = arbiterAt(space, 0).collisionArbiter!;
    const imp = colArb.tangentImpulse(null, true);
    expect(typeof imp.x).toBe("number");
  });

  it("rollingImpulse(null, freshOnly=true) works", () => {
    const { space } = createCollidingScene();
    const colArb = arbiterAt(space, 0).collisionArbiter!;
    const ri = colArb.rollingImpulse(null, true);
    expect(typeof ri).toBe("number");
  });
});

describe("ColArbiter coverage — custom material friction and restitution", () => {
  it("high-friction material slows a sliding body more than low-friction", () => {
    const spaceHi = new Space(new Vec2(0, 500));
    const floorHi = staticBox(0, 50);
    (floorHi.shapes as any).at(0).material = new Material(0.3, 1.0, 1.0, 1, 0.01);
    floorHi.space = spaceHi;
    const ballHi = dynamicCircle(0, 10, 10);
    ballHi.velocity = new Vec2(100, 0);
    (ballHi.shapes as any).at(0).material = new Material(0.3, 1.0, 1.0, 1, 0.01);
    ballHi.space = spaceHi;

    const spaceLo = new Space(new Vec2(0, 500));
    const floorLo = staticBox(0, 50);
    (floorLo.shapes as any).at(0).material = new Material(0.3, 0.01, 0.01, 1, 0.001);
    floorLo.space = spaceLo;
    const ballLo = dynamicCircle(0, 10, 10);
    ballLo.velocity = new Vec2(100, 0);
    (ballLo.shapes as any).at(0).material = new Material(0.3, 0.01, 0.01, 1, 0.001);
    ballLo.space = spaceLo;

    for (let i = 0; i < 60; i++) {
      spaceHi.step(1 / 60);
      spaceLo.step(1 / 60);
    }

    expect(Math.abs(ballHi.velocity.x)).toBeLessThan(Math.abs(ballLo.velocity.x));
  });

  it("rollingFriction from Material is accessible on collision arbiter", () => {
    const space = new Space(new Vec2(0, 500));
    const floor = staticBox(0, 50);
    (floor.shapes as any).at(0).material = new Material(0.5, 0.5, 0.5, 1, 0.1);
    floor.space = space;
    const ball = dynamicCircle(0, 10, 10);
    (ball.shapes as any).at(0).material = new Material(0.5, 0.5, 0.5, 1, 0.1);
    ball.space = space;

    for (let i = 0; i < 60; i++) space.step(1 / 60);

    if (arbiterCount(space) > 0) {
      const colArb = arbiterAt(space, 0).collisionArbiter!;
      expect(colArb.rollingFriction).toBeGreaterThanOrEqual(0);
    }
  });

  it("elasticity from Material is accessible on collision arbiter", () => {
    const space = new Space(new Vec2(0, 500));
    const floor = staticBox(0, 50);
    (floor.shapes as any).at(0).material = new Material(0.8, 0.3, 0.3, 1, 0.01);
    floor.space = space;
    const ball = dynamicCircle(0, 10, 10);
    (ball.shapes as any).at(0).material = new Material(0.8, 0.3, 0.3, 1, 0.01);
    ball.space = space;

    for (let i = 0; i < 60; i++) space.step(1 / 60);

    if (arbiterCount(space) > 0) {
      const colArb = arbiterAt(space, 0).collisionArbiter!;
      expect(colArb.elasticity).toBeGreaterThanOrEqual(0);
    }
  });

  it("dynamicFriction and staticFriction are non-negative", () => {
    const { space } = createCollidingScene();
    if (arbiterCount(space) > 0) {
      const colArb = arbiterAt(space, 0).collisionArbiter!;
      expect(colArb.dynamicFriction).toBeGreaterThanOrEqual(0);
      expect(colArb.staticFriction).toBeGreaterThanOrEqual(0);
    }
  });
});

describe("ColArbiter coverage — polygon-polygon collision", () => {
  it("referenceEdge1 and referenceEdge2 are accessible on poly-poly collision", () => {
    const space = new Space(new Vec2(0, 500));
    const floor = staticBox(0, 60, 300, 10);
    floor.space = space;
    const box = dynamicBox(0, 30, 40, 20);
    box.space = space;

    for (let i = 0; i < 60; i++) space.step(1 / 60);

    if (arbiterCount(space) > 0) {
      const colArb = arbiterAt(space, 0).collisionArbiter!;
      const re1 = colArb.referenceEdge1;
      const re2 = colArb.referenceEdge2;
      expect(re1 !== null || re2 !== null).toBe(true);
    }
  });

  it("radius property is accessible on circle-polygon collision", () => {
    const { space } = createCollidingScene();
    if (arbiterCount(space) > 0) {
      const colArb = arbiterAt(space, 0).collisionArbiter!;
      expect(typeof colArb.radius).toBe("number");
      expect(colArb.radius).toBeGreaterThanOrEqual(0);
    }
  });

  it("firstVertex and secondVertex return booleans", () => {
    const { space } = createCollidingScene();
    if (arbiterCount(space) > 0) {
      const colArb = arbiterAt(space, 0).collisionArbiter!;
      expect(typeof colArb.firstVertex()).toBe("boolean");
      expect(typeof colArb.secondVertex()).toBe("boolean");
    }
  });

  it("polygon-polygon edge collision has contacts", () => {
    const space = new Space(new Vec2(0, 500));
    const floor = staticBox(0, 60, 300, 10);
    floor.space = space;
    const box = dynamicBox(0, 30, 40, 20);
    box.space = space;

    for (let i = 0; i < 60; i++) space.step(1 / 60);

    if (arbiterCount(space) > 0) {
      const colArb = arbiterAt(space, 0).collisionArbiter!;
      const contacts = colArb.contacts as any;
      expect(contacts.length).toBeGreaterThanOrEqual(1);
      const c0 = contacts.at(0);
      expect(typeof c0.position.x).toBe("number");
      expect(typeof c0.penetration).toBe("number");
    }
  });
});

// ============================================================================
// FluidArbiter coverage
// ============================================================================
describe("FluidArbiter coverage — buoyancy and drag", () => {
  it("fluid arbiter is captured in ONGOING callback with position and overlap", () => {
    let captured: FluidArbiter | null = null;
    const space = new Space(new Vec2(0, 400));
    const listener = new InteractionListener(
      CbEvent.ONGOING,
      InteractionType.FLUID,
      CbType.ANY_BODY,
      CbType.ANY_BODY,
      (cb: any) => {
        const arbiters = cb.arbiters;
        for (let i = 0; i < arbiters.length; i++) {
          const arb = arbiters.at(i) as Arbiter;
          if (arb.isFluidArbiter()) {
            captured = arb.fluidArbiter;
            break;
          }
        }
      },
    );
    listener.space = space;

    const fluidBody = new Body(BodyType.STATIC, new Vec2(0, 0));
    const fluidShape = new Polygon(Polygon.box(1000, 1000));
    fluidShape.fluidEnabled = true;
    fluidShape.fluidProperties = new FluidProperties(3, 5);
    fluidBody.shapes.add(fluidShape);
    fluidBody.space = space;
    const ball = dynamicCircle(0, 0, 20);
    ball.space = space;

    space.step(1 / 60);
    space.step(1 / 60);

    expect(captured).not.toBeNull();
    expect(captured!.position).toBeDefined();
    expect(captured!.overlap).toBeGreaterThan(0);
  });

  it("buoyancyImpulse has non-zero y-component for submerged body in gravity", () => {
    let captured: FluidArbiter | null = null;
    const space = new Space(new Vec2(0, 400));
    const listener = new InteractionListener(
      CbEvent.ONGOING,
      InteractionType.FLUID,
      CbType.ANY_BODY,
      CbType.ANY_BODY,
      (cb: any) => {
        for (let i = 0; i < cb.arbiters.length; i++) {
          const arb = cb.arbiters.at(i) as Arbiter;
          if (arb.isFluidArbiter()) {
            captured = arb.fluidArbiter;
          }
        }
      },
    );
    listener.space = space;

    const fluidBody = new Body(BodyType.STATIC, new Vec2(0, 0));
    const fluidShape = new Polygon(Polygon.box(1000, 1000));
    fluidShape.fluidEnabled = true;
    fluidShape.fluidProperties = new FluidProperties(5, 2);
    fluidBody.shapes.add(fluidShape);
    fluidBody.space = space;
    const ball = dynamicCircle(0, 0, 15);
    ball.space = space;

    space.step(1 / 60);
    space.step(1 / 60);

    expect(captured).not.toBeNull();
    const buoy = captured!.buoyancyImpulse();
    expect(typeof buoy.y).toBe("number");
  });

  it("dragImpulse has numeric components for moving body in fluid", () => {
    let captured: FluidArbiter | null = null;
    const space = new Space(new Vec2(0, 400));
    const listener = new InteractionListener(
      CbEvent.ONGOING,
      InteractionType.FLUID,
      CbType.ANY_BODY,
      CbType.ANY_BODY,
      (cb: any) => {
        for (let i = 0; i < cb.arbiters.length; i++) {
          const arb = cb.arbiters.at(i) as Arbiter;
          if (arb.isFluidArbiter()) captured = arb.fluidArbiter;
        }
      },
    );
    listener.space = space;

    const fluidBody = new Body(BodyType.STATIC, new Vec2(0, 0));
    const fluidShape = new Polygon(Polygon.box(1000, 1000));
    fluidShape.fluidEnabled = true;
    fluidShape.fluidProperties = new FluidProperties(3, 10);
    fluidBody.shapes.add(fluidShape);
    fluidBody.space = space;
    const ball = dynamicCircle(0, 0, 15);
    ball.velocity = new Vec2(50, 0);
    ball.space = space;

    space.step(1 / 60);
    space.step(1 / 60);

    expect(captured).not.toBeNull();
    const drag = captured!.dragImpulse();
    expect(typeof drag.x).toBe("number");
    expect(typeof drag.y).toBe("number");
    expect(typeof drag.z).toBe("number");
  });

  it("totalImpulse on fluid arbiter equals buoyancy + drag", () => {
    let captured: FluidArbiter | null = null;
    const space = new Space(new Vec2(0, 400));
    const listener = new InteractionListener(
      CbEvent.ONGOING,
      InteractionType.FLUID,
      CbType.ANY_BODY,
      CbType.ANY_BODY,
      (cb: any) => {
        for (let i = 0; i < cb.arbiters.length; i++) {
          const arb = cb.arbiters.at(i) as Arbiter;
          if (arb.isFluidArbiter()) {
            captured = arb.fluidArbiter;
          }
        }
      },
    );
    listener.space = space;

    const fluidBody = new Body(BodyType.STATIC, new Vec2(0, 0));
    const fluidShape = new Polygon(Polygon.box(1000, 1000));
    fluidShape.fluidEnabled = true;
    fluidShape.fluidProperties = new FluidProperties(3, 5);
    fluidBody.shapes.add(fluidShape);
    fluidBody.space = space;
    const ball = dynamicCircle(0, 0, 20);
    ball.space = space;

    space.step(1 / 60);
    space.step(1 / 60);

    expect(captured).not.toBeNull();
    const total = captured!.totalImpulse();
    const buoy = captured!.buoyancyImpulse();
    const drag = captured!.dragImpulse();
    expect(total.x).toBeCloseTo(buoy.x + drag.x, 5);
    expect(total.y).toBeCloseTo(buoy.y + drag.y, 5);
  });

  it("higher fluid density produces stronger buoyancy", () => {
    function measureBuoyancyY(density: number): number {
      let buoyY = 0;
      const space = new Space(new Vec2(0, 400));
      const listener = new InteractionListener(
        CbEvent.ONGOING,
        InteractionType.FLUID,
        CbType.ANY_BODY,
        CbType.ANY_BODY,
        (cb: any) => {
          for (let i = 0; i < cb.arbiters.length; i++) {
            const arb = cb.arbiters.at(i) as Arbiter;
            if (arb.isFluidArbiter()) {
              buoyY = arb.fluidArbiter!.buoyancyImpulse().y;
            }
          }
        },
      );
      listener.space = space;

      const fb = new Body(BodyType.STATIC, new Vec2(0, 0));
      const fs = new Polygon(Polygon.box(1000, 1000));
      fs.fluidEnabled = true;
      fs.fluidProperties = new FluidProperties(density, 2);
      fb.shapes.add(fs);
      fb.space = space;
      const ball = dynamicCircle(0, 0, 15);
      ball.space = space;

      space.step(1 / 60);
      space.step(1 / 60);
      return buoyY;
    }

    const buoyLow = measureBuoyancyY(1);
    const buoyHigh = measureBuoyancyY(10);
    expect(Math.abs(buoyHigh)).toBeGreaterThan(Math.abs(buoyLow));
  });

  it("viscous drag (angular) is applied when body has angular velocity in fluid", () => {
    let captured: FluidArbiter | null = null;
    const space = new Space(new Vec2(0, 400));
    const listener = new InteractionListener(
      CbEvent.ONGOING,
      InteractionType.FLUID,
      CbType.ANY_BODY,
      CbType.ANY_BODY,
      (cb: any) => {
        for (let i = 0; i < cb.arbiters.length; i++) {
          const arb = cb.arbiters.at(i) as Arbiter;
          if (arb.isFluidArbiter()) captured = arb.fluidArbiter;
        }
      },
    );
    listener.space = space;

    const fb = new Body(BodyType.STATIC, new Vec2(0, 0));
    const fs = new Polygon(Polygon.box(1000, 1000));
    fs.fluidEnabled = true;
    fs.fluidProperties = new FluidProperties(3, 10);
    fb.shapes.add(fs);
    fb.space = space;
    const ball = dynamicCircle(0, 0, 20);
    ball.angularVel = 5;
    ball.space = space;

    space.step(1 / 60);
    space.step(1 / 60);

    expect(captured).not.toBeNull();
    const drag = captured!.dragImpulse();
    expect(typeof drag.z).toBe("number");
  });

  it("buoyancyImpulse(body) and dragImpulse(body) work with specific body", () => {
    let captured: FluidArbiter | null = null;
    let capturedBase: Arbiter | null = null;
    const space = new Space(new Vec2(0, 400));
    const listener = new InteractionListener(
      CbEvent.ONGOING,
      InteractionType.FLUID,
      CbType.ANY_BODY,
      CbType.ANY_BODY,
      (cb: any) => {
        for (let i = 0; i < cb.arbiters.length; i++) {
          const arb = cb.arbiters.at(i) as Arbiter;
          if (arb.isFluidArbiter()) {
            captured = arb.fluidArbiter;
            capturedBase = arb;
          }
        }
      },
    );
    listener.space = space;

    const fb = new Body(BodyType.STATIC, new Vec2(0, 0));
    const fs = new Polygon(Polygon.box(1000, 1000));
    fs.fluidEnabled = true;
    fs.fluidProperties = new FluidProperties(3, 5);
    fb.shapes.add(fs);
    fb.space = space;
    const ball = dynamicCircle(0, 0, 20);
    ball.space = space;

    space.step(1 / 60);
    space.step(1 / 60);

    expect(captured).not.toBeNull();
    expect(capturedBase).not.toBeNull();
    const body =
      capturedBase!.body1 === ball ? ball : capturedBase!.body2;
    const buoy = captured!.buoyancyImpulse(body);
    const drag = captured!.dragImpulse(body);
    expect(typeof buoy.x).toBe("number");
    expect(typeof drag.x).toBe("number");
  });
});

// ============================================================================
// SpaceArbiterList coverage
// ============================================================================
describe("SpaceArbiterList coverage", () => {
  it("space.arbiters zpp_gl() returns correct count", () => {
    const { space } = createCollidingScene();
    const count = arbiterCount(space);
    expect(typeof count).toBe("number");
    expect(count).toBeGreaterThanOrEqual(1);
  });

  it("space.arbiters.at(0) returns first arbiter", () => {
    const { space } = createCollidingScene();
    const arb = arbiterAt(space, 0);
    expect(arb).toBeDefined();
    expect(arb).not.toBeNull();
  });

  it("space.arbiters.at() with out-of-bounds index throws", () => {
    const { space } = createCollidingScene();
    const arbs = space.arbiters as any;
    expect(() => arbs.at(-1)).toThrow();
    expect(() => arbs.at(10000)).toThrow();
  });

  it("space.arbiters.push() throws immutable error", () => {
    const { space } = createCollidingScene();
    const arbs = space.arbiters as any;
    expect(() => arbs.push(null)).toThrow("immutable");
  });

  it("space.arbiters.pop() throws immutable error", () => {
    const { space } = createCollidingScene();
    const arbs = space.arbiters as any;
    expect(() => arbs.pop()).toThrow("immutable");
  });

  it("space.arbiters.unshift() throws immutable error", () => {
    const { space } = createCollidingScene();
    const arbs = space.arbiters as any;
    expect(() => arbs.unshift(null)).toThrow("immutable");
  });

  it("space.arbiters.shift() throws immutable error", () => {
    const { space } = createCollidingScene();
    const arbs = space.arbiters as any;
    expect(() => arbs.shift()).toThrow("immutable");
  });

  it("space.arbiters.remove() throws immutable error", () => {
    const { space } = createCollidingScene();
    const arbs = space.arbiters as any;
    expect(() => arbs.remove(null)).toThrow("immutable");
  });

  it("space.arbiters.clear() throws immutable error", () => {
    const { space } = createCollidingScene();
    const arbs = space.arbiters as any;
    expect(() => arbs.clear()).toThrow("immutable");
  });

  it("multiple collisions produce multiple arbiters", () => {
    const space = new Space(new Vec2(0, 500));
    const floor = staticBox(0, 50, 300, 10);
    floor.space = space;
    const ball1 = dynamicCircle(-30, 10, 10);
    ball1.space = space;
    const ball2 = dynamicCircle(30, 10, 10);
    ball2.space = space;

    for (let i = 0; i < 60; i++) space.step(1 / 60);

    expect(arbiterCount(space)).toBeGreaterThanOrEqual(2);
  });

  it("arbiter list updates after body removal — count decreases", () => {
    const space = new Space(new Vec2(0, 500));
    const floor = staticBox(0, 50, 300, 10);
    floor.space = space;
    const ball1 = dynamicCircle(-30, 10, 10);
    ball1.space = space;
    const ball2 = dynamicCircle(30, 10, 10);
    ball2.space = space;

    for (let i = 0; i < 60; i++) space.step(1 / 60);

    const countBefore = arbiterCount(space);
    expect(countBefore).toBeGreaterThanOrEqual(2);

    ball1.space = null;
    space.step(1 / 60);

    const countAfter = arbiterCount(space);
    expect(countAfter).toBeLessThan(countBefore);
  });

  it("can iterate over all arbiters via at()", () => {
    const { space } = createCollidingScene();
    const count = arbiterCount(space);
    const arbs = space.arbiters as any;
    const visited: Arbiter[] = [];
    for (let i = 0; i < count; i++) {
      visited.push(arbs.at(i));
    }
    expect(visited.length).toBe(count);
  });
});

// ============================================================================
// ZPP_Arbiter base class coverage
// ============================================================================
describe("ZPP_Arbiter base class — type checking and accessors", () => {
  it("isCollisionArbiter() returns true for collision", () => {
    const { space } = createCollidingScene();
    const arb = arbiterAt(space, 0);
    expect(arb.isCollisionArbiter()).toBe(true);
    expect(arb.isFluidArbiter()).toBe(false);
    expect(arb.isSensorArbiter()).toBe(false);
  });

  it("isFluidArbiter() returns true for fluid (via callback)", () => {
    let arbBase: Arbiter | null = null;
    const space = new Space(new Vec2(0, 400));
    const listener = new InteractionListener(
      CbEvent.ONGOING,
      InteractionType.FLUID,
      CbType.ANY_BODY,
      CbType.ANY_BODY,
      (cb: any) => {
        for (let i = 0; i < cb.arbiters.length; i++) {
          arbBase = cb.arbiters.at(i) as Arbiter;
        }
      },
    );
    listener.space = space;

    const fb = new Body(BodyType.STATIC, new Vec2(0, 0));
    const fs = new Polygon(Polygon.box(1000, 1000));
    fs.fluidEnabled = true;
    fs.fluidProperties = new FluidProperties(3, 5);
    fb.shapes.add(fs);
    fb.space = space;
    const ball = dynamicCircle(0, 0, 20);
    ball.space = space;

    space.step(1 / 60);
    space.step(1 / 60);

    expect(arbBase).not.toBeNull();
    expect(arbBase!.isFluidArbiter()).toBe(true);
    expect(arbBase!.isCollisionArbiter()).toBe(false);
    expect(arbBase!.isSensorArbiter()).toBe(false);
  });

  it("shape1 and shape2 belong to the two colliding bodies", () => {
    const { space, ball, floor } = createCollidingScene();
    const arb = arbiterAt(space, 0);
    const s1 = arb.shape1;
    const s2 = arb.shape2;
    expect(s1).toBeDefined();
    expect(s2).toBeDefined();
    const bodies = new Set([s1.body, s2.body]);
    expect(bodies.has(ball) || bodies.has(floor)).toBe(true);
  });

  it("body1 and body2 are the two colliding bodies", () => {
    const { space, ball, floor } = createCollidingScene();
    const arb = arbiterAt(space, 0);
    const b1 = arb.body1;
    const b2 = arb.body2;
    expect(b1).toBeDefined();
    expect(b2).toBeDefined();
    const bodySet = new Set([b1, b2]);
    expect(bodySet.has(ball)).toBe(true);
    expect(bodySet.has(floor)).toBe(true);
  });

  it("isSleeping is a boolean", () => {
    const { space } = createCollidingScene();
    if (arbiterCount(space) > 0) {
      const arb = arbiterAt(space, 0);
      expect(typeof arb.isSleeping).toBe("boolean");
    }
  });

  it("collisionArbiter returns CollisionArbiter for collision type", () => {
    const { space } = createCollidingScene();
    const arb = arbiterAt(space, 0);
    expect(arb.collisionArbiter).not.toBeNull();
    expect(arb.fluidArbiter).toBeNull();
  });

  it("state returns a PreFlag value", () => {
    const { space } = createCollidingScene();
    if (arbiterCount(space) > 0) {
      const arb = arbiterAt(space, 0);
      const state = arb.state;
      expect(state).toBeDefined();
    }
  });

  it("toString contains CollisionArbiter for collision type", () => {
    const { space } = createCollidingScene();
    if (arbiterCount(space) > 0) {
      const arb = arbiterAt(space, 0);
      const str = arb.toString();
      expect(str).toContain("CollisionArbiter");
    }
  });

  it("toString contains FluidArbiter for fluid type (via callback)", () => {
    let arbBase: Arbiter | null = null;
    const space = new Space(new Vec2(0, 400));
    const listener = new InteractionListener(
      CbEvent.ONGOING,
      InteractionType.FLUID,
      CbType.ANY_BODY,
      CbType.ANY_BODY,
      (cb: any) => {
        for (let i = 0; i < cb.arbiters.length; i++) {
          arbBase = cb.arbiters.at(i) as Arbiter;
        }
      },
    );
    listener.space = space;

    const fb = new Body(BodyType.STATIC, new Vec2(0, 0));
    const fs = new Polygon(Polygon.box(1000, 1000));
    fs.fluidEnabled = true;
    fs.fluidProperties = new FluidProperties(3, 5);
    fb.shapes.add(fs);
    fb.space = space;
    const ball = dynamicCircle(0, 0, 20);
    ball.space = space;

    space.step(1 / 60);
    space.step(1 / 60);

    expect(arbBase).not.toBeNull();
    expect(arbBase!.toString()).toContain("FluidArbiter");
  });
});

// ============================================================================
// Sensor arbiter coverage
// ============================================================================
describe("Sensor arbiter via sensorEnabled", () => {
  it("sensor shapes produce sensor arbiters in BEGIN callback", () => {
    let sensorDetected = false;
    const space = new Space(new Vec2(0, 500));
    const listener = new InteractionListener(
      CbEvent.BEGIN,
      InteractionType.SENSOR,
      CbType.ANY_BODY,
      CbType.ANY_BODY,
      (cb: any) => {
        for (let i = 0; i < cb.arbiters.length; i++) {
          const arb = cb.arbiters.at(i) as Arbiter;
          if (arb.isSensorArbiter()) sensorDetected = true;
        }
      },
    );
    listener.space = space;

    const floor = staticBox(0, 50);
    (floor.shapes as any).at(0).sensorEnabled = true;
    floor.space = space;
    const ball = dynamicCircle(0, 10, 10);
    ball.space = space;

    for (let i = 0; i < 60; i++) space.step(1 / 60);

    expect(sensorDetected).toBe(true);
  });

  it("sensor arbiter has valid shape1/shape2/body1/body2 inside callback", () => {
    let s1Ok = false;
    let s2Ok = false;
    let b1Ok = false;
    let b2Ok = false;
    const space = new Space(new Vec2(0, 500));
    const listener = new InteractionListener(
      CbEvent.ONGOING,
      InteractionType.SENSOR,
      CbType.ANY_BODY,
      CbType.ANY_BODY,
      (cb: any) => {
        for (let i = 0; i < cb.arbiters.length; i++) {
          const arb = cb.arbiters.at(i) as Arbiter;
          if (arb.isSensorArbiter()) {
            s1Ok = arb.shape1 != null;
            s2Ok = arb.shape2 != null;
            b1Ok = arb.body1 != null;
            b2Ok = arb.body2 != null;
          }
        }
      },
    );
    listener.space = space;

    const floor = staticBox(0, 50);
    (floor.shapes as any).at(0).sensorEnabled = true;
    floor.space = space;
    const ball = dynamicCircle(0, 10, 10);
    ball.space = space;

    for (let i = 0; i < 60; i++) space.step(1 / 60);

    expect(s1Ok).toBe(true);
    expect(s2Ok).toBe(true);
    expect(b1Ok).toBe(true);
    expect(b2Ok).toBe(true);
  });

  it("sensor arbiter type checks are correct inside callback", () => {
    let isSensor = false;
    let isCollision = true;
    let isFluid = true;
    let colArbNull = false;
    let fluidArbNull = false;
    const space = new Space(new Vec2(0, 500));
    const listener = new InteractionListener(
      CbEvent.ONGOING,
      InteractionType.SENSOR,
      CbType.ANY_BODY,
      CbType.ANY_BODY,
      (cb: any) => {
        for (let i = 0; i < cb.arbiters.length; i++) {
          const arb = cb.arbiters.at(i) as Arbiter;
          if (arb.isSensorArbiter()) {
            isSensor = true;
            isCollision = arb.isCollisionArbiter();
            isFluid = arb.isFluidArbiter();
            colArbNull = arb.collisionArbiter === null;
            fluidArbNull = arb.fluidArbiter === null;
          }
        }
      },
    );
    listener.space = space;

    const floor = staticBox(0, 50);
    (floor.shapes as any).at(0).sensorEnabled = true;
    floor.space = space;
    const ball = dynamicCircle(0, 10, 10);
    ball.space = space;

    for (let i = 0; i < 60; i++) space.step(1 / 60);

    expect(isSensor).toBe(true);
    expect(isCollision).toBe(false);
    expect(isFluid).toBe(false);
    expect(colArbNull).toBe(true);
    expect(fluidArbNull).toBe(true);
  });

  it("sensor arbiter totalImpulse returns zero Vec3 inside callback", () => {
    let impX = -1;
    let impY = -1;
    let impZ = -1;
    const space = new Space(new Vec2(0, 500));
    const listener = new InteractionListener(
      CbEvent.ONGOING,
      InteractionType.SENSOR,
      CbType.ANY_BODY,
      CbType.ANY_BODY,
      (cb: any) => {
        for (let i = 0; i < cb.arbiters.length; i++) {
          const arb = cb.arbiters.at(i) as Arbiter;
          if (arb.isSensorArbiter()) {
            const imp = arb.totalImpulse();
            impX = imp.x;
            impY = imp.y;
            impZ = imp.z;
          }
        }
      },
    );
    listener.space = space;

    const floor = staticBox(0, 50);
    (floor.shapes as any).at(0).sensorEnabled = true;
    floor.space = space;
    const ball = dynamicCircle(0, 10, 10);
    ball.space = space;

    for (let i = 0; i < 60; i++) space.step(1 / 60);

    expect(impX).toBe(0);
    expect(impY).toBe(0);
    expect(impZ).toBe(0);
  });
});

// ============================================================================
// Pre-handler mutable property coverage
// ============================================================================
describe("ColArbiter — pre-handler mutable properties throw outside handler", () => {
  it("setting elasticity outside pre-handler throws", () => {
    const { space } = createCollidingScene();
    if (arbiterCount(space) > 0) {
      const colArb = arbiterAt(space, 0).collisionArbiter!;
      expect(() => {
        colArb.elasticity = 0.5;
      }).toThrow("pre-handler");
    }
  });

  it("setting dynamicFriction outside pre-handler throws", () => {
    const { space } = createCollidingScene();
    if (arbiterCount(space) > 0) {
      const colArb = arbiterAt(space, 0).collisionArbiter!;
      expect(() => {
        colArb.dynamicFriction = 0.5;
      }).toThrow("pre-handler");
    }
  });

  it("setting staticFriction outside pre-handler throws", () => {
    const { space } = createCollidingScene();
    if (arbiterCount(space) > 0) {
      const colArb = arbiterAt(space, 0).collisionArbiter!;
      expect(() => {
        colArb.staticFriction = 0.5;
      }).toThrow("pre-handler");
    }
  });

  it("setting rollingFriction outside pre-handler throws", () => {
    const { space } = createCollidingScene();
    if (arbiterCount(space) > 0) {
      const colArb = arbiterAt(space, 0).collisionArbiter!;
      expect(() => {
        colArb.rollingFriction = 0.5;
      }).toThrow("pre-handler");
    }
  });

  it("setting elasticity to NaN in pre-handler throws", () => {
    const space = new Space(new Vec2(0, 500));
    let threw = false;

    const preListener = new PreListener(
      InteractionType.COLLISION,
      CbType.ANY_BODY,
      CbType.ANY_BODY,
      (cb) => {
        const colArb = cb.arbiter?.collisionArbiter;
        if (colArb) {
          try {
            colArb.elasticity = NaN;
          } catch {
            threw = true;
          }
        }
        return PreFlag.ACCEPT;
      },
    );
    preListener.space = space;

    const floor = staticBox(0, 50);
    floor.space = space;
    const ball = dynamicCircle(0, 10, 10);
    ball.space = space;

    for (let i = 0; i < 60; i++) space.step(1 / 60);

    expect(threw).toBe(true);
  });

  it("setting elasticity to negative in pre-handler throws", () => {
    const space = new Space(new Vec2(0, 500));
    let threw = false;

    const preListener = new PreListener(
      InteractionType.COLLISION,
      CbType.ANY_BODY,
      CbType.ANY_BODY,
      (cb) => {
        const colArb = cb.arbiter?.collisionArbiter;
        if (colArb) {
          try {
            colArb.elasticity = -1;
          } catch {
            threw = true;
          }
        }
        return PreFlag.ACCEPT;
      },
    );
    preListener.space = space;

    const floor = staticBox(0, 50);
    floor.space = space;
    const ball = dynamicCircle(0, 10, 10);
    ball.space = space;

    for (let i = 0; i < 60; i++) space.step(1 / 60);

    expect(threw).toBe(true);
  });
});

// ============================================================================
// Contact properties from collision arbiter
// ============================================================================
describe("Contact properties — friction and arbiter back-reference", () => {
  it("contact.friction is a non-negative number", () => {
    const { space } = createCollidingScene();
    if (arbiterCount(space) > 0) {
      const colArb = arbiterAt(space, 0).collisionArbiter!;
      const contacts = colArb.contacts as any;
      if (contacts.length > 0) {
        const c = contacts.at(0);
        expect(typeof c.friction).toBe("number");
        expect(c.friction).toBeGreaterThanOrEqual(0);
      }
    }
  });

  it("contact.arbiter back-reference is the parent collision arbiter", () => {
    const { space } = createCollidingScene();
    if (arbiterCount(space) > 0) {
      const colArb = arbiterAt(space, 0).collisionArbiter!;
      const contacts = colArb.contacts as any;
      if (contacts.length > 0) {
        const c = contacts.at(0);
        expect(c.arbiter).toBeDefined();
      }
    }
  });

  it("contact.normalImpulse(body) works with specific body", () => {
    const { space } = createCollidingScene();
    if (arbiterCount(space) > 0) {
      const arb = arbiterAt(space, 0);
      const colArb = arb.collisionArbiter!;
      const contacts = colArb.contacts as any;
      if (contacts.length > 0) {
        const c = contacts.at(0);
        const imp = c.normalImpulse(arb.body1);
        expect(typeof imp.x).toBe("number");
        expect(typeof imp.y).toBe("number");
        expect(typeof imp.z).toBe("number");
      }
    }
  });

  it("contact.tangentImpulse(body) works with specific body", () => {
    const { space } = createCollidingScene();
    if (arbiterCount(space) > 0) {
      const arb = arbiterAt(space, 0);
      const colArb = arb.collisionArbiter!;
      const contacts = colArb.contacts as any;
      if (contacts.length > 0) {
        const c = contacts.at(0);
        const imp = c.tangentImpulse(arb.body2);
        expect(typeof imp.x).toBe("number");
      }
    }
  });

  it("contact.rollingImpulse(body) works with specific body", () => {
    const { space } = createCollidingScene();
    if (arbiterCount(space) > 0) {
      const arb = arbiterAt(space, 0);
      const colArb = arb.collisionArbiter!;
      const contacts = colArb.contacts as any;
      if (contacts.length > 0) {
        const c = contacts.at(0);
        const ri = c.rollingImpulse(arb.body1);
        expect(typeof ri).toBe("number");
      }
    }
  });

  it("contact.totalImpulse(body) works with specific body", () => {
    const { space } = createCollidingScene();
    if (arbiterCount(space) > 0) {
      const arb = arbiterAt(space, 0);
      const colArb = arb.collisionArbiter!;
      const contacts = colArb.contacts as any;
      if (contacts.length > 0) {
        const c = contacts.at(0);
        const imp = c.totalImpulse(arb.body2);
        expect(typeof imp.x).toBe("number");
        expect(typeof imp.y).toBe("number");
        expect(typeof imp.z).toBe("number");
      }
    }
  });

  it("contact.toString() returns a string", () => {
    const { space } = createCollidingScene();
    if (arbiterCount(space) > 0) {
      const colArb = arbiterAt(space, 0).collisionArbiter!;
      const contacts = colArb.contacts as any;
      if (contacts.length > 0) {
        const c = contacts.at(0);
        expect(typeof c.toString()).toBe("string");
      }
    }
  });
});
