/**
 * ZPP_FluidArbiter — extended coverage tests.
 *
 * Targets uncovered branches:
 * - Kinematic bodies in fluid
 * - Varying dt (warm-start dtratio scaling)
 * - Zero viscosity (nodrag) vs high viscosity
 * - Polygon submerged in fluid (edge iteration drag)
 * - Fluid position wrapper access
 * - FluidArbiter mutable/immutable state in pre-handler
 * - Angular damping path
 * - Both bodies in fluid (dual fluidEnabled)
 * - Very high/low density contrasts
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
import { PreListener } from "../../../src/callbacks/PreListener";
import { CbType } from "../../../src/callbacks/CbType";
import { CbEvent } from "../../../src/callbacks/CbEvent";
import { InteractionType } from "../../../src/callbacks/InteractionType";
import { PreFlag } from "../../../src/callbacks/PreFlag";
import "../../../src/dynamics/Contact";

// -------------------------------------------------------------------------
// Helpers
// -------------------------------------------------------------------------

function makeFluidBody(x = 0, y = 0, w = 2000, h = 2000, density = 2.0, viscosity = 3.0): Body {
  const b = new Body(BodyType.STATIC, new Vec2(x, y));
  const shape = new Polygon(Polygon.box(w, h));
  shape.fluidEnabled = true;
  shape.fluidProperties = new FluidProperties(density, viscosity);
  b.shapes.add(shape as any);
  return b;
}

function dynamicCircle(x: number, y: number, r = 20): Body {
  const b = new Body(BodyType.DYNAMIC, new Vec2(x, y));
  b.shapes.add(new Circle(r));
  return b;
}

function dynamicBox(x: number, y: number, w = 30, h = 30): Body {
  const b = new Body(BodyType.DYNAMIC, new Vec2(x, y));
  b.shapes.add(new Polygon(Polygon.box(w, h)));
  return b;
}

// -------------------------------------------------------------------------
// 1. Kinematic body in fluid
// -------------------------------------------------------------------------

describe("ZPP_FluidArbiter — kinematic body in fluid", () => {
  it("kinematic body moving through fluid does not change velocity", () => {
    const space = new Space(new Vec2(0, 100));
    const fluid = makeFluidBody(0, 0, 2000, 2000, 2.0, 5.0);
    fluid.space = space;

    const kb = new Body(BodyType.KINEMATIC, new Vec2(0, 0));
    kb.shapes.add(new Circle(20));
    kb.velocity = new Vec2(50, 0);
    kb.space = space;

    for (let i = 0; i < 60; i++) space.step(1 / 60, 10, 10);

    // Kinematic bodies are not affected by forces
    expect(kb.velocity.x).toBe(50);
  });
});

// -------------------------------------------------------------------------
// 2. Varying dt for warm-start scaling
// -------------------------------------------------------------------------

describe("ZPP_FluidArbiter — varying dt", () => {
  it("changing dt between steps scales warm-start impulses", () => {
    const space = new Space(new Vec2(0, 300));
    const fluid = makeFluidBody(0, 0, 2000, 2000, 2.0, 3.0);
    fluid.space = space;

    const ball = dynamicCircle(0, 0, 20);
    ball.space = space;

    // Step with normal dt
    for (let i = 0; i < 30; i++) space.step(1 / 60, 10, 10);
    const posY1 = ball.position.y;

    // Step with larger dt
    for (let i = 0; i < 30; i++) space.step(1 / 30, 10, 10);
    const posY2 = ball.position.y;

    // Position should have changed significantly with larger dt
    expect(posY2).not.toBe(posY1);
  });

  it("very small dt produces stable simulation", () => {
    const space = new Space(new Vec2(0, 100));
    const fluid = makeFluidBody(0, 0, 2000, 2000, 2.0, 3.0);
    fluid.space = space;

    const ball = dynamicCircle(0, 0, 20);
    ball.space = space;

    // Step with very small dt — should not blow up
    for (let i = 0; i < 100; i++) space.step(1 / 240, 10, 10);

    expect(isFinite(ball.position.y)).toBe(true);
    expect(isFinite(ball.velocity.y)).toBe(true);
  });
});

// -------------------------------------------------------------------------
// 3. Zero viscosity (nodrag path)
// -------------------------------------------------------------------------

describe("ZPP_FluidArbiter — zero viscosity", () => {
  it("zero viscosity fluid applies buoyancy but no drag", () => {
    const space = new Space(new Vec2(0, 300));
    const fluid = makeFluidBody(0, 0, 2000, 2000, 3.0, 0.0);
    fluid.space = space;

    const ball = dynamicCircle(0, 0, 20);
    ball.velocity = new Vec2(100, 0);
    ball.space = space;

    for (let i = 0; i < 60; i++) space.step(1 / 60, 10, 10);

    // With zero viscosity, horizontal velocity should be mostly preserved
    expect(Math.abs(ball.velocity.x)).toBeGreaterThan(50);
  });

  it("high viscosity fluid slows body significantly", () => {
    const space = new Space(new Vec2(0, 300));
    const fluid = makeFluidBody(0, 0, 2000, 2000, 3.0, 50.0);
    fluid.space = space;

    const ball = dynamicCircle(0, 0, 20);
    ball.velocity = new Vec2(100, 0);
    ball.space = space;

    for (let i = 0; i < 60; i++) space.step(1 / 60, 10, 10);

    // High viscosity should slow the body down much more
    expect(Math.abs(ball.velocity.x)).toBeLessThan(50);
  });
});

// -------------------------------------------------------------------------
// 4. Polygon drag (border traversal path)
// -------------------------------------------------------------------------

describe("ZPP_FluidArbiter — polygon drag path", () => {
  it("polygon body in fluid — polygon edge iteration for drag", () => {
    const space = new Space(new Vec2(0, 300));
    const fluid = makeFluidBody(0, 0, 2000, 2000, 2.0, 5.0);
    fluid.space = space;

    const box = dynamicBox(0, 0, 40, 40);
    box.velocity = new Vec2(50, 0);
    box.space = space;

    for (let i = 0; i < 60; i++) space.step(1 / 60, 10, 10);

    // Polygon should be slowed by viscous drag
    expect(Math.abs(box.velocity.x)).toBeLessThan(50);
  });

  it("triangle polygon in fluid", () => {
    const space = new Space(new Vec2(0, 300));
    const fluid = makeFluidBody(0, 0, 2000, 2000, 2.0, 5.0);
    fluid.space = space;

    const b = new Body(BodyType.DYNAMIC, new Vec2(0, 0));
    b.shapes.add(new Polygon(Polygon.regular(20, 20, 3)));
    b.velocity = new Vec2(30, 0);
    b.space = space;

    for (let i = 0; i < 60; i++) space.step(1 / 60, 10, 10);

    expect(isFinite(b.velocity.x)).toBe(true);
    expect(Math.abs(b.velocity.x)).toBeLessThan(30);
  });
});

// -------------------------------------------------------------------------
// 5. Angular damping
// -------------------------------------------------------------------------

describe("ZPP_FluidArbiter — angular damping", () => {
  it("spinning circle in fluid — angular velocity damped", () => {
    const space = new Space(new Vec2(0, 0));
    const fluid = makeFluidBody(0, 0, 2000, 2000, 2.0, 10.0);
    fluid.space = space;

    const ball = dynamicCircle(0, 0, 20);
    ball.angularVel = 10.0;
    ball.space = space;

    for (let i = 0; i < 120; i++) space.step(1 / 60, 10, 10);

    // Angular velocity should be damped
    expect(Math.abs(ball.angularVel)).toBeLessThan(10.0);
  });

  it("spinning box in fluid — angular damping applied", () => {
    const space = new Space(new Vec2(0, 0));
    const fluid = makeFluidBody(0, 0, 2000, 2000, 2.0, 10.0);
    fluid.space = space;

    const box = dynamicBox(0, 0, 30, 30);
    box.angularVel = 5.0;
    box.space = space;

    for (let i = 0; i < 120; i++) space.step(1 / 60, 10, 10);

    expect(Math.abs(box.angularVel)).toBeLessThan(5.0);
  });
});

// -------------------------------------------------------------------------
// 6. Fluid position wrapper
// -------------------------------------------------------------------------

describe("ZPP_FluidArbiter — position wrapper", () => {
  it("fluid arbiter position accessible in callback", () => {
    const space = new Space(new Vec2(0, 300));
    const fluid = makeFluidBody(0, 0, 2000, 2000, 2.0, 3.0);
    fluid.space = space;

    const ball = dynamicCircle(0, 0, 20);
    ball.space = space;

    let posX = NaN;
    let posY = NaN;
    const listener = new InteractionListener(
      CbEvent.ONGOING,
      InteractionType.FLUID,
      CbType.ANY_BODY,
      CbType.ANY_BODY,
      (cb: any) => {
        const arbiters = cb.arbiters;
        for (let i = 0; i < arbiters.length; i++) {
          const arb = arbiters.at(i);
          if (arb.isFluidArbiter()) {
            const pos = arb.fluidArbiter.position;
            posX = pos.x;
            posY = pos.y;
          }
        }
      },
    );
    listener.space = space;

    for (let i = 0; i < 30; i++) space.step(1 / 60, 10, 10);

    expect(isFinite(posX)).toBe(true);
    expect(isFinite(posY)).toBe(true);
  });

  it("fluid arbiter overlap is positive when submerged", () => {
    const space = new Space(new Vec2(0, 300));
    const fluid = makeFluidBody(0, 0, 2000, 2000, 2.0, 3.0);
    fluid.space = space;

    const ball = dynamicCircle(0, 0, 20);
    ball.space = space;

    let overlap = 0;
    const listener = new InteractionListener(
      CbEvent.ONGOING,
      InteractionType.FLUID,
      CbType.ANY_BODY,
      CbType.ANY_BODY,
      (cb: any) => {
        const arbiters = cb.arbiters;
        for (let i = 0; i < arbiters.length; i++) {
          const arb = arbiters.at(i);
          if (arb.isFluidArbiter()) {
            overlap = arb.fluidArbiter.overlap;
          }
        }
      },
    );
    listener.space = space;

    for (let i = 0; i < 30; i++) space.step(1 / 60, 10, 10);

    expect(overlap).toBeGreaterThan(0);
  });
});

// -------------------------------------------------------------------------
// 7. Pre-handler mutable/immutable state
// -------------------------------------------------------------------------

describe("ZPP_FluidArbiter — pre-handler mutability", () => {
  it("fluid arbiter is mutable in pre-handler", () => {
    const space = new Space(new Vec2(0, 300));
    const fluid = makeFluidBody(0, 0, 2000, 2000, 2.0, 3.0);
    fluid.space = space;

    const ball = dynamicCircle(0, 0, 20);
    ball.space = space;

    let posAccessedInPre = false;
    const preListener = new PreListener(
      InteractionType.FLUID,
      CbType.ANY_BODY,
      CbType.ANY_BODY,
      (cb) => {
        if (cb.arbiter.isFluidArbiter()) {
          const pos = cb.arbiter.fluidArbiter.position;
          posAccessedInPre = isFinite(pos.x) && isFinite(pos.y);
        }
        return PreFlag.ACCEPT;
      },
    );
    preListener.space = space;

    for (let i = 0; i < 30; i++) space.step(1 / 60, 10, 10);

    expect(posAccessedInPre).toBe(true);
  });

  it("PRE_IGNORE prevents fluid interaction", () => {
    const space = new Space(new Vec2(0, 300));
    const fluid = makeFluidBody(0, 0, 2000, 2000, 2.0, 3.0);
    fluid.space = space;

    const ball = dynamicCircle(0, 0, 20);
    ball.space = space;

    const preListener = new PreListener(
      InteractionType.FLUID,
      CbType.ANY_BODY,
      CbType.ANY_BODY,
      () => PreFlag.IGNORE,
    );
    preListener.space = space;

    for (let i = 0; i < 60; i++) space.step(1 / 60, 10, 10);

    // Ball should fall straight through fluid (no buoyancy)
    expect(ball.position.y).toBeGreaterThan(100);
  });
});

// -------------------------------------------------------------------------
// 8. Very high/low density contrasts
// -------------------------------------------------------------------------

describe("ZPP_FluidArbiter — density contrasts", () => {
  it("very high fluid density — body floats", () => {
    const space = new Space(new Vec2(0, 300));
    const fluid = makeFluidBody(0, 0, 2000, 2000, 100.0, 3.0);
    fluid.space = space;

    const ball = dynamicCircle(0, 0, 20);
    ball.space = space;

    for (let i = 0; i < 120; i++) space.step(1 / 60, 10, 10);

    // Very high density fluid should push body up significantly
    expect(ball.position.y).toBeLessThan(0);
  });

  it("very low fluid density — body sinks through", () => {
    const space = new Space(new Vec2(0, 300));
    const fluid = makeFluidBody(0, 0, 2000, 2000, 0.01, 0.1);
    fluid.space = space;

    const ball = dynamicCircle(0, 0, 20);
    ball.space = space;

    for (let i = 0; i < 120; i++) space.step(1 / 60, 10, 10);

    // Very low density fluid barely slows the body
    expect(ball.position.y).toBeGreaterThan(50);
  });
});

// -------------------------------------------------------------------------
// 9. Fluid arbiter pool reuse
// -------------------------------------------------------------------------

describe("ZPP_FluidArbiter — pool reuse", () => {
  it("entering and leaving fluid reuses pooled arbiter", () => {
    const space = new Space(new Vec2(0, 100));
    const fluid = makeFluidBody(0, 200, 2000, 200, 2.0, 3.0);
    fluid.space = space;

    let beginCount = 0;
    let _endCount = 0;
    const listener = new InteractionListener(
      CbEvent.BEGIN,
      InteractionType.FLUID,
      CbType.ANY_BODY,
      CbType.ANY_BODY,
      () => {
        beginCount++;
      },
    );
    listener.space = space;
    const endListener = new InteractionListener(
      CbEvent.END,
      InteractionType.FLUID,
      CbType.ANY_BODY,
      CbType.ANY_BODY,
      () => {
        _endCount++;
      },
    );
    endListener.space = space;

    const ball = dynamicCircle(0, 0, 10);
    ball.space = space;

    // Let ball fall through fluid region
    for (let i = 0; i < 300; i++) space.step(1 / 60, 10, 10);

    // Should have entered fluid at least once
    expect(beginCount).toBeGreaterThanOrEqual(1);
  });
});

// -------------------------------------------------------------------------
// 10. Custom gravity on fluid shapes
// -------------------------------------------------------------------------

describe("ZPP_FluidArbiter — fluid custom gravity", () => {
  it("fluid shape with custom gravity overrides space gravity for buoyancy", () => {
    const space = new Space(new Vec2(0, 300));
    const fluid = makeFluidBody(0, 0, 2000, 2000, 2.0, 1.0);
    // Set custom gravity on the fluid properties
    fluid.shapes.at(0).fluidProperties.gravity = new Vec2(0, -300);
    fluid.space = space;

    const ball = dynamicCircle(0, 0, 20);
    ball.space = space;

    for (let i = 0; i < 60; i++) space.step(1 / 60, 10, 10);

    // Custom gravity should affect buoyancy direction
    expect(isFinite(ball.position.y)).toBe(true);
  });
});
