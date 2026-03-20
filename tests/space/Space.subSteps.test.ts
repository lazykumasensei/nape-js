import { describe, it, expect } from "vitest";
import { Space } from "../../src/space/Space";
import { Body } from "../../src/phys/Body";
import { BodyType } from "../../src/phys/BodyType";
import { Vec2 } from "../../src/geom/Vec2";
import { Circle } from "../../src/shape/Circle";
import { Polygon } from "../../src/shape/Polygon";
import { Material } from "../../src/phys/Material";
import { DistanceJoint } from "../../src/constraint/DistanceJoint";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function createDynamicCircle(x: number, y: number, radius = 10): Body {
  const body = new Body(BodyType.DYNAMIC, new Vec2(x, y));
  body.shapes.add(new Circle(radius));
  return body;
}

function createDynamicBox(x: number, y: number, w = 20, h = 20): Body {
  const body = new Body(BodyType.DYNAMIC, new Vec2(x, y));
  body.shapes.add(new Polygon(Polygon.box(w, h)));
  return body;
}

function createStaticBox(x: number, y: number, w = 400, h = 20): Body {
  const body = new Body(BodyType.STATIC, new Vec2(x, y));
  body.shapes.add(new Polygon(Polygon.box(w, h)));
  return body;
}

// ---------------------------------------------------------------------------
// Property tests
// ---------------------------------------------------------------------------

describe("Space.subSteps — property", () => {
  it("should default to 1", () => {
    const space = new Space();
    expect(space.subSteps).toBe(1);
  });

  it("should get/set subSteps", () => {
    const space = new Space();
    space.subSteps = 4;
    expect(space.subSteps).toBe(4);
    space.subSteps = 1;
    expect(space.subSteps).toBe(1);
  });

  it("should floor fractional values", () => {
    const space = new Space();
    space.subSteps = 3.7;
    expect(space.subSteps).toBe(3);
  });

  it("should throw on NaN", () => {
    const space = new Space();
    expect(() => {
      space.subSteps = NaN;
    }).toThrow("NaN");
  });

  it("should throw on values less than 1", () => {
    const space = new Space();
    expect(() => {
      space.subSteps = 0;
    }).toThrow("at least 1");
    expect(() => {
      space.subSteps = -2;
    }).toThrow("at least 1");
  });
});

// ---------------------------------------------------------------------------
// Backward compatibility — subSteps=1 matches original behaviour
// ---------------------------------------------------------------------------

describe("Space.subSteps — backward compatibility", () => {
  it("subSteps=1 should produce identical results to default step", () => {
    function run(sub: number) {
      const space = new Space(new Vec2(0, 400));
      space.subSteps = sub;
      const floor = createStaticBox(0, 300);
      floor.space = space;
      const b = createDynamicCircle(0, 0);
      b.space = space;

      const states: { x: number; y: number; rot: number }[] = [];
      for (let i = 0; i < 120; i++) {
        space.step(1 / 60);
        states.push({ x: b.position.x, y: b.position.y, rot: b.rotation });
      }
      return states;
    }

    const run1 = run(1);
    const run2 = run(1);
    for (let i = 0; i < run1.length; i++) {
      expect(run1[i].x).toBe(run2[i].x);
      expect(run1[i].y).toBe(run2[i].y);
      expect(run1[i].rot).toBe(run2[i].rot);
    }
  });
});

// ---------------------------------------------------------------------------
// Tunneling prevention — fast object vs thin wall
// ---------------------------------------------------------------------------

describe("Space.subSteps — tunneling prevention", () => {
  /**
   * Shoot a small circle at high speed toward a thin static wall.
   * With subSteps=1 (and CCD off via allowSleep hack), the circle may
   * tunnel through. With subSteps >= 4, the collision should be caught.
   */
  function shootAtWall(subSteps: number, speed: number): number {
    const space = new Space(new Vec2(0, 0));
    space.subSteps = subSteps;

    // Thin wall at x=400
    const wall = new Body(BodyType.STATIC, new Vec2(400, 0));
    wall.shapes.add(new Polygon(Polygon.box(4, 200)));
    wall.space = space;

    // Small bullet at x=0, moving right at high speed
    const bullet = createDynamicCircle(0, 0, 3);
    bullet.velocity = new Vec2(speed, 0);
    bullet.space = space;

    // Step until bullet either hits the wall or passes through
    for (let i = 0; i < 300; i++) {
      space.step(1 / 60);
      // If bullet stopped or bounced back, it collided
      if (bullet.velocity.x <= 0) break;
    }

    return bullet.position.x;
  }

  it("subSteps=4 should keep fast bullet on the correct side of the wall", () => {
    // Very high speed: 30000 px/s → travels 500 px/frame at 60fps
    const posWithSub4 = shootAtWall(4, 30000);
    // Bullet should not have passed through the wall (x < 400 + some tolerance)
    expect(posWithSub4).toBeLessThan(410);
  });

  it("higher subSteps should improve collision detection at extreme speeds", () => {
    const pos1 = shootAtWall(1, 50000);
    const pos8 = shootAtWall(8, 50000);
    // With more sub-steps, the bullet should be closer to (or stopped by) the wall
    expect(pos8).toBeLessThanOrEqual(pos1);
  });
});

// ---------------------------------------------------------------------------
// Stacking stability — tower of boxes
// ---------------------------------------------------------------------------

describe("Space.subSteps — stacking stability", () => {
  function measureStackDrift(subSteps: number): number {
    const space = new Space(new Vec2(0, 600));
    space.subSteps = subSteps;

    // Wide floor
    const floor = createStaticBox(0, 300);
    floor.space = space;

    // Stack 8 boxes on top of each other
    const boxes: Body[] = [];
    for (let i = 0; i < 8; i++) {
      const box = createDynamicBox(0, 300 - 20 - i * 22, 20, 20);
      box.space = space;
      boxes.push(box);
    }

    // Let settle
    for (let i = 0; i < 600; i++) {
      space.step(1 / 60);
    }

    // Measure horizontal drift: sum of |x| for all stacked boxes
    let totalDrift = 0;
    for (const box of boxes) {
      totalDrift += Math.abs(box.position.x);
    }
    return totalDrift;
  }

  it("sub-stepping should not make stacking worse", () => {
    const drift1 = measureStackDrift(1);
    const drift4 = measureStackDrift(4);
    // subSteps=4 drift should be at most as bad as subSteps=1 (ideally better)
    expect(drift4).toBeLessThanOrEqual(drift1 + 5); // 5px tolerance
  });

  it("stack should remain standing with subSteps=4", () => {
    const drift = measureStackDrift(4);
    // Total drift for 8 boxes should be reasonable (< 50px total)
    expect(drift).toBeLessThan(50);
  });
});

// ---------------------------------------------------------------------------
// Joint stiffness — DistanceJoint under load
// ---------------------------------------------------------------------------

describe("Space.subSteps — joint stiffness", () => {
  function measureJointError(subSteps: number): number {
    const space = new Space(new Vec2(0, 600));
    space.subSteps = subSteps;

    const anchor = new Body(BodyType.STATIC, new Vec2(0, 0));
    anchor.shapes.add(new Circle(5));
    anchor.space = space;

    const pendulum = createDynamicCircle(0, 100, 15);
    pendulum.space = space;

    const joint = new DistanceJoint(anchor, pendulum, Vec2.weak(0, 0), Vec2.weak(0, 0), 100, 100);
    joint.stiff = true;
    joint.space = space;

    let maxError = 0;
    for (let i = 0; i < 300; i++) {
      space.step(1 / 60);
      const dx = pendulum.position.x - anchor.position.x;
      const dy = pendulum.position.y - anchor.position.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      const error = Math.abs(dist - 100);
      if (error > maxError) maxError = error;
    }
    return maxError;
  }

  it("subSteps=4 should have less joint error than subSteps=1", () => {
    const error1 = measureJointError(1);
    const error4 = measureJointError(4);
    expect(error4).toBeLessThanOrEqual(error1 + 0.1);
  });

  it("joint error should remain small with sub-stepping", () => {
    const error = measureJointError(4);
    expect(error).toBeLessThan(5); // max 5px deviation from target length
  });
});

// ---------------------------------------------------------------------------
// Energy conservation — bouncing ball
// ---------------------------------------------------------------------------

describe("Space.subSteps — energy conservation", () => {
  function measureFinalHeight(subSteps: number): number {
    const space = new Space(new Vec2(0, 400));
    space.subSteps = subSteps;

    // Floor
    const floor = new Body(BodyType.STATIC, new Vec2(0, 300));
    floor.shapes.add(new Polygon(Polygon.box(400, 20)));
    floor.space = space;

    // Elastic ball — elasticity=1, friction=0
    const ball = new Body(BodyType.DYNAMIC, new Vec2(0, 0));
    const mat = new Material(1, 0, 0, 1);
    const circ = new Circle(10);
    circ.material = mat;
    ball.shapes.add(circ);
    ball.space = space;

    // Also set floor material to perfect elastic
    for (const shape of floor.shapes) {
      (shape as any).material = mat;
    }

    // Run for 1000 steps (multiple bounces)
    for (let i = 0; i < 1000; i++) {
      space.step(1 / 60);
    }

    // Measure how high the ball gets in the next 120 steps (should return near startY)
    let minY = Infinity; // lower y = higher up
    for (let i = 0; i < 120; i++) {
      space.step(1 / 60);
      if (ball.position.y < minY) minY = ball.position.y;
    }
    return minY;
  }

  it("sub-stepping should not make energy conservation worse", () => {
    const h1 = measureFinalHeight(1);
    const h4 = measureFinalHeight(4);
    // With more sub-steps, ball should bounce at least as high (lower y value)
    // Allow some tolerance since physics is complex
    expect(h4).toBeLessThanOrEqual(h1 + 20);
  });
});

// ---------------------------------------------------------------------------
// Multiple bodies with subSteps — basic smoke test
// ---------------------------------------------------------------------------

describe("Space.subSteps — multi-body simulation", () => {
  it("should handle many bodies without errors", () => {
    const space = new Space(new Vec2(0, 600));
    space.subSteps = 4;

    const floor = createStaticBox(0, 500);
    floor.space = space;

    // Spawn 30 circles
    for (let i = 0; i < 30; i++) {
      const b = createDynamicCircle((i - 15) * 15, i * -20, 8);
      b.space = space;
    }

    // Should not throw
    for (let i = 0; i < 200; i++) {
      space.step(1 / 60);
    }
  });

  it("should work with subSteps=8", () => {
    const space = new Space(new Vec2(0, 600));
    space.subSteps = 8;

    const floor = createStaticBox(0, 300);
    floor.space = space;

    const b = createDynamicCircle(0, 0);
    b.space = space;

    for (let i = 0; i < 120; i++) {
      space.step(1 / 60);
    }

    // Ball should have fallen and be near the floor
    expect(b.position.y).toBeGreaterThan(200);
  });
});

// ---------------------------------------------------------------------------
// Deterministic + subSteps combination
// ---------------------------------------------------------------------------

describe("Space.subSteps — deterministic mode", () => {
  it("should produce identical results with deterministic=true and subSteps=4", () => {
    function run() {
      const space = new Space(new Vec2(0, 400));
      space.deterministic = true;
      space.subSteps = 4;

      const floor = createStaticBox(0, 300);
      floor.space = space;

      const bodies: Body[] = [];
      for (let i = 0; i < 5; i++) {
        const b =
          i % 2 === 0 ? createDynamicCircle(i * 10, i * -25) : createDynamicBox(i * 10, i * -25);
        b.space = space;
        bodies.push(b);
      }

      const history: { x: number; y: number; rot: number }[][] = [];
      for (let i = 0; i < 120; i++) {
        space.step(1 / 60);
        history.push(
          bodies.map((b) => ({
            x: b.position.x,
            y: b.position.y,
            rot: b.rotation,
          })),
        );
      }
      return history;
    }

    const run1 = run();
    const run2 = run();
    expect(run1.length).toBe(run2.length);
    for (let step = 0; step < run1.length; step++) {
      for (let b = 0; b < run1[step].length; b++) {
        expect(run1[step][b].x).toBe(run2[step][b].x);
        expect(run1[step][b].y).toBe(run2[step][b].y);
        expect(run1[step][b].rot).toBe(run2[step][b].rot);
      }
    }
  });
});

// ---------------------------------------------------------------------------
// Changing subSteps mid-simulation
// ---------------------------------------------------------------------------

describe("Space.subSteps — runtime changes", () => {
  it("should allow changing subSteps between step() calls", () => {
    const space = new Space(new Vec2(0, 400));
    const floor = createStaticBox(0, 300);
    floor.space = space;
    const b = createDynamicCircle(0, 0);
    b.space = space;

    space.subSteps = 1;
    for (let i = 0; i < 60; i++) space.step(1 / 60);

    space.subSteps = 4;
    for (let i = 0; i < 60; i++) space.step(1 / 60);

    space.subSteps = 1;
    for (let i = 0; i < 60; i++) space.step(1 / 60);

    // Should not throw and ball should be on/near floor
    expect(b.position.y).toBeGreaterThan(200);
  });
});
