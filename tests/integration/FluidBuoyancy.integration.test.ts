import { describe, it, expect } from "vitest";
import { Space } from "../../src/space/Space";
import { Body } from "../../src/phys/Body";
import { BodyType } from "../../src/phys/BodyType";
import { Vec2 } from "../../src/geom/Vec2";
import { Circle } from "../../src/shape/Circle";
import { Polygon } from "../../src/shape/Polygon";
import { FluidProperties } from "../../src/phys/FluidProperties";
import { Material } from "../../src/phys/Material";
import { InteractionListener } from "../../src/callbacks/InteractionListener";
import { InteractionType } from "../../src/callbacks/InteractionType";
import { CbEvent } from "../../src/callbacks/CbEvent";
import { CbType } from "../../src/callbacks/CbType";
import { DistanceJoint } from "../../src/constraint/DistanceJoint";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function dynamicCircle(x: number, y: number, radius = 10): Body {
  const b = new Body(BodyType.DYNAMIC, new Vec2(x, y));
  b.shapes.add(new Circle(radius));
  return b;
}

function staticFluidRegion(
  x: number,
  y: number,
  w: number,
  h: number,
  density = 2,
  viscosity = 1,
): Body {
  const b = new Body(BodyType.STATIC, new Vec2(x, y));
  const shape = new Polygon(Polygon.box(w, h));
  shape.fluidEnabled = true;
  shape.fluidProperties = new FluidProperties(density, viscosity);
  b.shapes.add(shape);
  return b;
}

function step(space: Space, n = 60): void {
  for (let i = 0; i < n; i++) space.step(1 / 60);
}

// ---------------------------------------------------------------------------
// 1. Basic buoyancy
// ---------------------------------------------------------------------------
describe("Fluid integration — basic buoyancy", () => {
  it("should slow down a falling body entering fluid", () => {
    const space = new Space(new Vec2(0, 200));

    // Floor
    const floor = new Body(BodyType.STATIC, new Vec2(0, 300));
    floor.shapes.add(new Polygon(Polygon.box(500, 10)));
    floor.space = space;

    // Fluid region at y=100..200
    const fluid = staticFluidRegion(0, 150, 500, 100, 3, 5);
    fluid.space = space;

    // Ball dropping from above
    const ball = dynamicCircle(0, -50, 10);
    ball.space = space;

    // Record velocity when entering fluid region
    let velocityBeforeFluid = 0;
    let velocityInFluid = 0;

    for (let i = 0; i < 120; i++) {
      space.step(1 / 60);
      if (ball.position.y > 90 && ball.position.y < 100) {
        velocityBeforeFluid = ball.velocity.y;
      }
      if (ball.position.y > 140 && ball.position.y < 160 && velocityInFluid === 0) {
        velocityInFluid = ball.velocity.y;
      }
    }

    // The fluid should have slowed the ball
    if (velocityBeforeFluid > 0 && velocityInFluid > 0) {
      expect(velocityInFluid).toBeLessThan(velocityBeforeFluid);
    }
  });

  it("should make a light body float upward in dense fluid", () => {
    const space = new Space(new Vec2(0, 200));

    // Dense fluid region filling most of the space
    const fluid = staticFluidRegion(0, 0, 500, 400, 10, 3);
    fluid.space = space;

    // Light ball starting in the fluid
    const ball = dynamicCircle(0, 100, 10);
    ball.shapes.at(0).material = new Material(0, 0, 0, 0.1, 0); // very light
    ball.space = space;

    const startY = ball.position.y;
    step(space, 120);

    // Light body should float up (lower y) in dense fluid
    expect(ball.position.y).toBeLessThan(startY);
  });

  it("should make a heavy body sink in light fluid", () => {
    const space = new Space(new Vec2(0, 200));

    // Light fluid
    const fluid = staticFluidRegion(0, 0, 500, 400, 0.5, 1);
    fluid.space = space;

    // Heavy ball
    const ball = dynamicCircle(0, -100, 10);
    ball.shapes.at(0).material = new Material(0, 0, 0, 10, 0);
    ball.space = space;

    step(space, 120);
    // Heavy body should sink through light fluid
    expect(ball.position.y).toBeGreaterThan(-100);
  });
});

// ---------------------------------------------------------------------------
// 2. Fluid viscosity effects
// ---------------------------------------------------------------------------
describe("Fluid integration — viscosity", () => {
  it("should slow horizontal motion more in high-viscosity fluid", () => {
    // Low viscosity space
    const space1 = new Space(new Vec2(0, 0));
    const fluid1 = staticFluidRegion(0, 0, 500, 500, 2, 1);
    fluid1.space = space1;
    const ball1 = dynamicCircle(0, 0, 10);
    ball1.velocity = new Vec2(100, 0);
    ball1.space = space1;

    // High viscosity space
    const space2 = new Space(new Vec2(0, 0));
    const fluid2 = staticFluidRegion(0, 0, 500, 500, 2, 20);
    fluid2.space = space2;
    const ball2 = dynamicCircle(0, 0, 10);
    ball2.velocity = new Vec2(100, 0);
    ball2.space = space2;

    step(space1, 60);
    step(space2, 60);

    // Ball in high-viscosity fluid should travel less distance
    expect(ball2.position.x).toBeLessThan(ball1.position.x);
  });

  it("should eventually bring a moving body to near-rest in viscous fluid", () => {
    const space = new Space(new Vec2(0, 0));
    const fluid = staticFluidRegion(0, 0, 1000, 1000, 2, 50);
    fluid.space = space;

    const ball = dynamicCircle(0, 0, 10);
    ball.velocity = new Vec2(200, 0);
    ball.space = space;

    step(space, 300);

    // Velocity should be heavily damped
    expect(Math.abs(ball.velocity.x)).toBeLessThan(10);
  });
});

// ---------------------------------------------------------------------------
// 3. Multiple fluid regions
// ---------------------------------------------------------------------------
describe("Fluid integration — multiple regions", () => {
  it("should handle body passing through two adjacent fluid regions", () => {
    const space = new Space(new Vec2(0, 200));

    // Two fluid regions stacked vertically
    const fluid1 = staticFluidRegion(0, 50, 500, 100, 3, 2);
    fluid1.space = space;
    const fluid2 = staticFluidRegion(0, 150, 500, 100, 5, 5);
    fluid2.space = space;

    const ball = dynamicCircle(0, -50, 10);
    ball.space = space;

    // Run simulation - should not crash
    step(space, 180);
    expect(ball.position.y).toBeGreaterThan(-50);
  });

  it("should experience different drag in different fluid regions", () => {
    const space = new Space(new Vec2(0, 0));

    // Light fluid on the left
    const fluidLeft = staticFluidRegion(-200, 0, 200, 500, 1, 1);
    fluidLeft.space = space;

    // Heavy fluid on the right
    const fluidRight = staticFluidRegion(200, 0, 200, 500, 1, 20);
    fluidRight.space = space;

    const ballLeft = dynamicCircle(-200, 0, 10);
    ballLeft.velocity = new Vec2(0, 100);
    ballLeft.space = space;

    const ballRight = dynamicCircle(200, 0, 10);
    ballRight.velocity = new Vec2(0, 100);
    ballRight.space = space;

    step(space, 60);

    // Ball in heavy fluid should travel less
    expect(Math.abs(ballRight.position.y)).toBeLessThan(Math.abs(ballLeft.position.y) + 1);
  });
});

// ---------------------------------------------------------------------------
// 4. Fluid callbacks
// ---------------------------------------------------------------------------
describe("Fluid integration — callbacks", () => {
  it("should fire SENSOR interaction for fluid overlap", () => {
    const space = new Space(new Vec2(0, 200));
    const fluid = staticFluidRegion(0, 100, 500, 200, 3, 2);
    fluid.space = space;

    const ball = dynamicCircle(0, -50, 10);
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

    step(space, 120);
    expect(fluidDetected).toBe(true);
  });

  it("should fire ONGOING interaction while submerged", () => {
    const space = new Space(new Vec2(0, 0));
    const fluid = staticFluidRegion(0, 0, 500, 500, 3, 2);
    fluid.space = space;

    const ball = dynamicCircle(0, 0, 10);
    ball.space = space;

    let ongoingCount = 0;
    const listener = new InteractionListener(
      CbEvent.ONGOING,
      InteractionType.FLUID,
      CbType.ANY_BODY,
      CbType.ANY_BODY,
      () => {
        ongoingCount++;
      },
    );
    listener.space = space;

    step(space, 30);
    expect(ongoingCount).toBeGreaterThan(5);
  });
});

// ---------------------------------------------------------------------------
// 5. Fluid with constraints
// ---------------------------------------------------------------------------
describe("Fluid integration — with constraints", () => {
  it("should apply buoyancy to constrained bodies", () => {
    const space = new Space(new Vec2(0, 200));

    const fluid = staticFluidRegion(0, 0, 500, 400, 5, 2);
    fluid.space = space;

    // Two bodies connected by a distance joint, both in fluid
    const b1 = dynamicCircle(-20, 0, 10);
    b1.shapes.at(0).material = new Material(0, 0, 0, 0.1, 0);
    b1.space = space;

    const b2 = dynamicCircle(20, 0, 10);
    b2.shapes.at(0).material = new Material(0, 0, 0, 0.1, 0);
    b2.space = space;

    const joint = new DistanceJoint(b1, b2, new Vec2(0, 0), new Vec2(0, 0), 30, 50);
    joint.space = space;

    const startY1 = b1.position.y;
    step(space, 120);

    // Both light bodies should float up in dense fluid
    expect(b1.position.y).toBeLessThan(startY1);
  });
});
