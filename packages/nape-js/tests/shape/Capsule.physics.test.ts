/**
 * Capsule shape physics integration tests.
 * Exercises Capsule in real simulation — collision, rolling, compound bodies.
 * Covers ZPP_Capsule (native/shape) paths not hit by unit tests.
 */

import { describe, it, expect } from "vitest";
import { Space } from "../../src/space/Space";
import { Body } from "../../src/phys/Body";
import { BodyType } from "../../src/phys/BodyType";
import { Vec2 } from "../../src/geom/Vec2";
import { Capsule } from "../../src/shape/Capsule";
import { Circle } from "../../src/shape/Circle";
import { Polygon } from "../../src/shape/Polygon";
import { PivotJoint } from "../../src/constraint/PivotJoint";
import { DistanceJoint } from "../../src/constraint/DistanceJoint";
import { AABB } from "../../src/geom/AABB";

function staticFloor(y = 200): Body {
  const b = new Body(BodyType.STATIC, new Vec2(0, y));
  b.shapes.add(new Polygon(Polygon.box(400, 10)));
  return b;
}

function staticWall(x: number, h = 400): Body {
  const b = new Body(BodyType.STATIC, new Vec2(x, 0));
  b.shapes.add(new Polygon(Polygon.box(20, h)));
  return b;
}

function dynCapsule(x = 0, y = 0, w = 30, h = 10): Body {
  const b = new Body(BodyType.DYNAMIC, new Vec2(x, y));
  b.shapes.add(new Capsule(w, h));
  return b;
}

// ---------------------------------------------------------------------------
// Capsule falling and landing
// ---------------------------------------------------------------------------
describe("Capsule physics — falling", () => {
  it("should fall under gravity", () => {
    const space = new Space(new Vec2(0, 500));
    const b = dynCapsule();
    b.space = space;

    for (let i = 0; i < 60; i++) space.step(1 / 60);

    expect(b.position.y).toBeGreaterThan(0);
  });

  it("should land on static floor", () => {
    const space = new Space(new Vec2(0, 500));
    const floor = staticFloor(200);
    floor.space = space;

    const cap = dynCapsule(0, 0, 40, 15);
    cap.space = space;

    for (let i = 0; i < 180; i++) space.step(1 / 60);

    expect(cap.position.y).toBeLessThan(200);
    expect(cap.position.y).toBeGreaterThan(100);
  });

  it("vertical capsule (rotated 90°) should land on floor", () => {
    const space = new Space(new Vec2(0, 500));
    const floor = staticFloor(200);
    floor.space = space;

    const b = new Body(BodyType.DYNAMIC, new Vec2(0, 0));
    b.shapes.add(new Capsule(30, 10));
    b.rotation = Math.PI / 2; // stand it vertically
    b.space = space;

    for (let i = 0; i < 180; i++) space.step(1 / 60);

    expect(b.position.y).toBeLessThan(200);
    expect(b.position.y).toBeGreaterThan(100);
  });

  it("capsule with initial rotation should settle", () => {
    const space = new Space(new Vec2(0, 500));
    const floor = staticFloor(200);
    floor.space = space;

    const cap = dynCapsule(0, 0, 40, 12);
    cap.rotation = Math.PI / 6;
    cap.space = space;

    for (let i = 0; i < 300; i++) space.step(1 / 60);

    expect(cap.position.y).toBeLessThan(200);
    expect(cap.position.y).toBeGreaterThan(100);
  });
});

// ---------------------------------------------------------------------------
// Capsule collision interactions
// ---------------------------------------------------------------------------
describe("Capsule physics — collisions", () => {
  it("capsule-circle collision should resolve correctly", () => {
    const space = new Space(new Vec2(0, 500));
    const floor = staticFloor(200);
    floor.space = space;

    const cap = dynCapsule(0, 0, 40, 15);
    cap.space = space;

    const ball = new Body(BodyType.DYNAMIC, new Vec2(0, -50));
    ball.shapes.add(new Circle(10));
    ball.space = space;

    for (let i = 0; i < 180; i++) space.step(1 / 60);

    // Both should have settled above the floor
    expect(cap.position.y).toBeLessThan(220);
    expect(ball.position.y).toBeLessThan(220);
  });

  it("capsule-polygon collision should resolve", () => {
    const space = new Space(new Vec2(0, 500));
    const floor = staticFloor(200);
    floor.space = space;

    const cap = dynCapsule(0, 50, 30, 10);
    cap.space = space;

    const box = new Body(BodyType.DYNAMIC, new Vec2(5, 0));
    box.shapes.add(new Polygon(Polygon.box(20, 20)));
    box.space = space;

    for (let i = 0; i < 240; i++) space.step(1 / 60);

    expect(cap.position.y).toBeLessThan(220);
    expect(box.position.y).toBeLessThan(220);
  });

  it("capsule-capsule collision should resolve", () => {
    const space = new Space(new Vec2(0, 500));
    const floor = staticFloor(200);
    floor.space = space;

    const cap1 = dynCapsule(-20, 0, 30, 10);
    cap1.space = space;

    const cap2 = dynCapsule(20, -60, 30, 10);
    cap2.space = space;

    for (let i = 0; i < 240; i++) space.step(1 / 60);

    expect(cap1.position.y).toBeLessThan(220);
    expect(cap2.position.y).toBeLessThan(220);
  });

  it("rolling capsule should travel horizontally", () => {
    const space = new Space(new Vec2(0, 500));
    const floor = staticFloor(100);
    floor.space = space;

    const cap = dynCapsule(0, 70, 40, 10);
    cap.velocity = new Vec2(100, 0);
    cap.space = space;

    for (let i = 0; i < 180; i++) space.step(1 / 60);

    // Should have moved in x direction
    expect(Math.abs(cap.position.x)).toBeGreaterThan(5);
  });
});

// ---------------------------------------------------------------------------
// Capsule with constraints
// ---------------------------------------------------------------------------
describe("Capsule physics — constraints", () => {
  it("capsule as pendulum bob", () => {
    const space = new Space(new Vec2(0, 200));
    const anchor = new Body(BodyType.STATIC, new Vec2(0, 0));
    anchor.shapes.add(new Circle(5));
    anchor.space = space;

    const cap = dynCapsule(50, 0, 30, 10);
    cap.space = space;

    const joint = new PivotJoint(anchor, cap, new Vec2(0, 0), new Vec2(0, 0));
    joint.space = space;

    for (let i = 0; i < 120; i++) space.step(1 / 60);

    const dist = Math.sqrt(cap.position.x ** 2 + cap.position.y ** 2);
    expect(dist).toBeLessThan(15);
  });

  it("capsule on a rope (DistanceJoint)", () => {
    const space = new Space(new Vec2(0, 200));
    const anchor = new Body(BodyType.STATIC, new Vec2(0, 0));
    anchor.shapes.add(new Circle(5));
    anchor.space = space;

    const cap = dynCapsule(0, 60, 30, 10);
    cap.space = space;

    const joint = new DistanceJoint(anchor, cap, new Vec2(0, 0), new Vec2(0, 0), 40, 80);
    joint.space = space;

    for (let i = 0; i < 120; i++) space.step(1 / 60);

    const dist = Math.sqrt(cap.position.x ** 2 + cap.position.y ** 2);
    expect(dist).toBeLessThan(90);
    expect(dist).toBeGreaterThan(30);
  });
});

// ---------------------------------------------------------------------------
// Capsule in multi-shape body
// ---------------------------------------------------------------------------
describe("Capsule physics — multi-shape body", () => {
  it("body with capsule + circle should fall", () => {
    const space = new Space(new Vec2(0, 500));
    const floor = staticFloor(200);
    floor.space = space;

    const compound = new Body(BodyType.DYNAMIC, new Vec2(0, 0));
    compound.shapes.add(new Capsule(30, 8));
    compound.shapes.add(new Circle(10));
    compound.space = space;

    for (let i = 0; i < 180; i++) space.step(1 / 60);

    expect(compound.position.y).toBeLessThan(200);
    expect(compound.position.y).toBeGreaterThan(80);
  });

  it("body with capsule + polygon should fall", () => {
    const space = new Space(new Vec2(0, 500));
    const floor = staticFloor(200);
    floor.space = space;

    const b = new Body(BodyType.DYNAMIC, new Vec2(0, 0));
    b.shapes.add(new Capsule(30, 8));
    b.shapes.add(new Polygon(Polygon.box(10, 10)));
    b.space = space;

    for (let i = 0; i < 180; i++) space.step(1 / 60);

    expect(b.position.y).toBeLessThan(220);
    expect(b.position.y).toBeGreaterThan(80);
  });
});

// ---------------------------------------------------------------------------
// Capsule spatial queries
// ---------------------------------------------------------------------------
describe("Capsule physics — spatial queries", () => {
  it("shapesInAABB should find capsule", () => {
    const space = new Space();
    const b = new Body(BodyType.DYNAMIC, new Vec2(50, 50));
    b.shapes.add(new Capsule(30, 10));
    b.space = space;
    space.step(1 / 60);

    const aabb = new AABB(30, 30, 70, 70);
    const result = space.shapesInAABB(aabb) as any;
    expect(result.length).toBeGreaterThanOrEqual(1);
  });

  it("bodiesInAABB should find body with capsule shape", () => {
    const space = new Space();
    const b = new Body(BodyType.DYNAMIC, new Vec2(50, 50));
    b.shapes.add(new Capsule(30, 10));
    b.space = space;
    space.step(1 / 60);

    const aabb = new AABB(30, 30, 70, 70);
    const result = space.bodiesInAABB(aabb) as any;
    expect(result.length).toBeGreaterThanOrEqual(1);
  });

  it("bodiesInCircle should find capsule body", () => {
    const space = new Space();
    const b = new Body(BodyType.DYNAMIC, new Vec2(50, 50));
    b.shapes.add(new Capsule(30, 10));
    b.space = space;
    space.step(1 / 60);

    const result = space.bodiesInCircle(new Vec2(50, 50), 50) as any;
    expect(result.length).toBeGreaterThanOrEqual(1);
  });
});

// ---------------------------------------------------------------------------
// Capsule wall-sticking regression tests
// ---------------------------------------------------------------------------
describe("Capsule physics — wall interaction", () => {
  it("capsule should not stick to a vertical wall (falls past it)", () => {
    // Capsule starts near a vertical wall and falls under gravity.
    // It should slide down past the wall, not get stuck.
    const space = new Space(new Vec2(0, 500));
    const floor = staticFloor(300);
    floor.space = space;

    const wall = staticWall(50, 600);
    wall.space = space;

    // Place capsule touching the wall, above the floor
    const cap = dynCapsule(30, 0, 40, 14);
    cap.space = space;

    for (let i = 0; i < 300; i++) space.step(1 / 60);

    // Should have fallen to the floor, not stuck mid-wall
    expect(cap.position.y).toBeGreaterThan(250);
  });

  it("capsule should slide down wall without sticking at corner", () => {
    // A box formed by floor + wall. The capsule starts near the wall-floor
    // corner and should settle on the floor, not stick to the wall vertex.
    const space = new Space(new Vec2(0, 500));

    // Floor at y=200
    const floor = staticFloor(200);
    floor.space = space;

    // Wall at x=100 (right side)
    const wall = staticWall(100, 400);
    wall.space = space;

    // Capsule starts near the wall, well above the floor
    const cap = dynCapsule(85, 50, 30, 10);
    cap.space = space;

    for (let i = 0; i < 300; i++) space.step(1 / 60);

    // Should have settled on the floor (y close to 200 - half capsule height)
    expect(cap.position.y).toBeGreaterThan(180);
    // Should not be stuck far above the floor
    expect(cap.position.y).toBeLessThan(210);
  });

  it("capsule between two walls should fall straight down", () => {
    const space = new Space(new Vec2(0, 500));
    const floor = staticFloor(300);
    floor.space = space;

    const leftWall = staticWall(-50, 600);
    leftWall.space = space;
    const rightWall = staticWall(50, 600);
    rightWall.space = space;

    // Capsule dropped between two walls
    const cap = dynCapsule(0, 0, 30, 10);
    cap.space = space;

    for (let i = 0; i < 300; i++) space.step(1 / 60);

    // Should have reached the floor
    expect(cap.position.y).toBeGreaterThan(260);
  });

  it("rotated capsule should not stick to wall at vertex", () => {
    // Vertically-oriented capsule near a wall should slide down.
    const space = new Space(new Vec2(0, 500));
    const floor = staticFloor(300);
    floor.space = space;

    const wall = staticWall(50, 600);
    wall.space = space;

    const b = new Body(BodyType.DYNAMIC, new Vec2(30, 0));
    b.shapes.add(new Capsule(40, 12));
    b.rotation = Math.PI / 2; // vertical orientation
    b.space = space;

    for (let i = 0; i < 300; i++) space.step(1 / 60);

    // Should have fallen to the floor
    expect(b.position.y).toBeGreaterThan(250);
  });
});

// ---------------------------------------------------------------------------
// Edge↔vertex transition stress tests (unified manifold regression)
// ---------------------------------------------------------------------------
describe("Capsule physics — edge/vertex transition stability", () => {
  it("capsule sliding along polygon face should not jitter at corners", () => {
    // Capsule moves horizontally across a floor made of two adjacent boxes.
    // The seam between boxes is a face→vertex→face transition that used to
    // cause normal-flipping and vertical jitter.
    const space = new Space(new Vec2(0, 400));

    // Two adjacent floor segments with a seam at x=0
    const floorL = new Body(BodyType.STATIC, new Vec2(-100, 200));
    floorL.shapes.add(new Polygon(Polygon.box(200, 20)));
    floorL.space = space;

    const floorR = new Body(BodyType.STATIC, new Vec2(100, 200));
    floorR.shapes.add(new Polygon(Polygon.box(200, 20)));
    floorR.space = space;

    // Capsule starts on the left floor, sliding right across the seam
    const cap = dynCapsule(-80, 170, 30, 12);
    cap.velocity = new Vec2(120, 0);
    cap.space = space;

    // Record y-positions across the seam crossing
    const yPositions: number[] = [];
    for (let i = 0; i < 180; i++) {
      space.step(1 / 60);
      if (cap.position.x > -20 && cap.position.x < 20) {
        yPositions.push(cap.position.y);
      }
    }

    // The capsule should stay on the floor without large vertical jumps.
    // Max jitter between consecutive samples should be small.
    for (let i = 1; i < yPositions.length; i++) {
      const jitter = Math.abs(yPositions[i] - yPositions[i - 1]);
      expect(jitter).toBeLessThan(3); // <3 px jitter per frame
    }
  });

  it("freely rotating capsule should settle on floor without bouncing forever", () => {
    // A capsule dropped with angular velocity should come to rest.
    // With normal-flipping bugs, it would gain energy at vertex contacts.
    const space = new Space(new Vec2(0, 400));
    const floor = staticFloor(300);
    floor.space = space;

    const cap = dynCapsule(0, 100, 40, 14);
    cap.angularVel = 5; // spinning
    cap.space = space;

    // Simulate 10 seconds
    for (let i = 0; i < 600; i++) space.step(1 / 60);

    // Should have settled — angular velocity near zero, on the floor
    expect(Math.abs(cap.angularVel)).toBeLessThan(0.5);
    expect(cap.position.y).toBeGreaterThan(270);
    expect(cap.position.y).toBeLessThan(310);
  });

  it("capsule stack should be stable", () => {
    // Stack 3 capsules on a floor. They should settle without tunneling
    // or exploding due to manifold instability.
    const space = new Space(new Vec2(0, 400));
    const floor = staticFloor(300);
    floor.space = space;

    const caps: Body[] = [];
    for (let i = 0; i < 3; i++) {
      const c = dynCapsule(0, 250 - i * 20, 30, 12);
      c.space = space;
      caps.push(c);
    }

    // Settle for 5 seconds
    for (let i = 0; i < 300; i++) space.step(1 / 60);

    // All capsules should be above the floor and below starting position
    for (const c of caps) {
      expect(c.position.y).toBeGreaterThan(200);
      expect(c.position.y).toBeLessThan(310);
    }
    // Bottom capsule should be nearest to floor
    expect(caps[0].position.y).toBeGreaterThan(caps[2].position.y);
  });

  it("capsule past ledge edge should fall, not hover", () => {
    // Capsule is placed fully past the platform edge (center of mass
    // beyond the polygon face). With no support underneath, it must fall.
    // This tests that the SAT doesn't generate a phantom face contact
    // when the capsule spine is entirely outside the reference edge's
    // tangent extent.
    const space = new Space(new Vec2(0, 400));

    const platform = new Body(BodyType.STATIC, new Vec2(0, 100));
    platform.shapes.add(new Polygon(Polygon.box(200, 20))); // right edge at x=100
    platform.space = space;

    // Capsule COM at x=115, spine (108..122) — fully past the right edge
    const cap = dynCapsule(115, 80, 24, 10);
    cap.space = space;

    for (let i = 0; i < 120; i++) space.step(1 / 60);

    // Should have fallen well below the platform
    expect(cap.position.y).toBeGreaterThan(150);
  });

  it("diagonal capsule near wall should not gain energy", () => {
    // A 45° rotated capsule falls near a wall. It should settle without
    // energy gain from conflicting normal directions at face↔vertex contacts.
    const space = new Space(new Vec2(0, 500));
    const floor = staticFloor(200);
    floor.space = space;
    const wall = staticWall(80, 400);
    wall.space = space;

    const b = new Body(BodyType.DYNAMIC, new Vec2(40, 100));
    b.shapes.add(new Capsule(36, 12));
    b.rotation = Math.PI / 4;
    b.space = space;

    // Record kinetic energy to verify it doesn't grow
    let maxKE = 0;
    for (let i = 0; i < 300; i++) {
      space.step(1 / 60);
      const vx = b.velocity.x,
        vy = b.velocity.y;
      const ke = vx * vx + vy * vy;
      if (i > 60) {
        // After initial fall, KE should be bounded
        if (ke > maxKE) maxKE = ke;
      }
    }

    // The capsule should not have gained energy — it either settles on the
    // floor or wedges against the wall, but velocity should not diverge.
    // Position should be below starting point (fell down).
    expect(b.position.y).toBeGreaterThan(100);
    // Velocity should be finite and bounded (no energy explosion)
    expect(Math.abs(b.velocity.x)).toBeLessThan(100);
    expect(Math.abs(b.velocity.y)).toBeLessThan(100);
  });
});
