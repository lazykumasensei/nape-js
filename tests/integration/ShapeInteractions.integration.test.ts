import { describe, it, expect } from "vitest";
import { Space } from "../../src/space/Space";
import { Body } from "../../src/phys/Body";
import { BodyType } from "../../src/phys/BodyType";
import { Vec2 } from "../../src/geom/Vec2";
import { Circle } from "../../src/shape/Circle";
import { Polygon } from "../../src/shape/Polygon";
import { Capsule } from "../../src/shape/Capsule";
import { Material } from "../../src/phys/Material";
import { InteractionFilter } from "../../src/dynamics/InteractionFilter";
import { InteractionListener } from "../../src/callbacks/InteractionListener";
import { InteractionType } from "../../src/callbacks/InteractionType";
import { CbEvent } from "../../src/callbacks/CbEvent";
import { CbType } from "../../src/callbacks/CbType";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function step(space: Space, n = 60): void {
  for (let i = 0; i < n; i++) space.step(1 / 60);
}

function staticFloor(y = 100): Body {
  const b = new Body(BodyType.STATIC, new Vec2(0, y));
  b.shapes.add(new Polygon(Polygon.box(800, 10)));
  return b;
}

// ---------------------------------------------------------------------------
// 1. Circle-circle collisions
// ---------------------------------------------------------------------------
describe("Shape interactions — circle-circle", () => {
  it("two circles should collide and bounce apart", () => {
    const space = new Space(new Vec2(0, 0));

    const a = new Body(BodyType.DYNAMIC, new Vec2(-50, 0));
    a.shapes.add(new Circle(15));
    a.velocity = new Vec2(100, 0);
    a.space = space;

    const b = new Body(BodyType.DYNAMIC, new Vec2(50, 0));
    b.shapes.add(new Circle(15));
    b.velocity = new Vec2(-100, 0);
    b.space = space;

    step(space, 60);

    // After collision, they should have bounced apart
    expect(a.position.x).toBeLessThan(b.position.x);
  });

  it("small circle should collide with large circle", () => {
    const space = new Space(new Vec2(0, 0));

    const big = new Body(BodyType.STATIC, new Vec2(0, 0));
    big.shapes.add(new Circle(100));
    big.space = space;

    const small = new Body(BodyType.DYNAMIC, new Vec2(-200, 0));
    small.shapes.add(new Circle(5));
    small.velocity = new Vec2(200, 0);
    small.space = space;

    let collided = false;
    const listener = new InteractionListener(
      CbEvent.BEGIN,
      InteractionType.COLLISION,
      CbType.ANY_BODY,
      CbType.ANY_BODY,
      () => { collided = true; },
    );
    listener.space = space;

    step(space, 60);
    expect(collided).toBe(true);
  });

  it("stacked circles should settle under gravity", () => {
    const space = new Space(new Vec2(0, 300));
    const floor = staticFloor(200);
    floor.space = space;

    for (let i = 0; i < 5; i++) {
      const b = new Body(BodyType.DYNAMIC, new Vec2(0, 200 - 25 * (i + 1)));
      b.shapes.add(new Circle(10));
      b.space = space;
    }

    step(space, 300);

    // All bodies should be above or at floor level
    for (let i = 0; i < space.bodies.length; i++) {
      const body = space.bodies.at(i);
      if (body.type === BodyType.DYNAMIC) {
        expect(body.position.y).toBeLessThanOrEqual(200);
      }
    }
  });
});

// ---------------------------------------------------------------------------
// 2. Box-box collisions
// ---------------------------------------------------------------------------
describe("Shape interactions — box-box", () => {
  it("two boxes should collide head-on", () => {
    const space = new Space(new Vec2(0, 0));

    const a = new Body(BodyType.DYNAMIC, new Vec2(-50, 0));
    a.shapes.add(new Polygon(Polygon.box(20, 20)));
    a.velocity = new Vec2(100, 0);
    a.space = space;

    const b = new Body(BodyType.DYNAMIC, new Vec2(50, 0));
    b.shapes.add(new Polygon(Polygon.box(20, 20)));
    b.velocity = new Vec2(-100, 0);
    b.space = space;

    let collided = false;
    const listener = new InteractionListener(
      CbEvent.BEGIN,
      InteractionType.COLLISION,
      CbType.ANY_BODY,
      CbType.ANY_BODY,
      () => { collided = true; },
    );
    listener.space = space;

    step(space, 30);
    expect(collided).toBe(true);
  });

  it("box stack should settle on floor", () => {
    const space = new Space(new Vec2(0, 300));
    const floor = staticFloor(200);
    floor.space = space;

    for (let i = 0; i < 3; i++) {
      const b = new Body(BodyType.DYNAMIC, new Vec2(0, 200 - 25 * (i + 1)));
      b.shapes.add(new Polygon(Polygon.box(20, 20)));
      b.space = space;
    }

    step(space, 300);

    for (let i = 0; i < space.bodies.length; i++) {
      const body = space.bodies.at(i);
      if (body.type === BodyType.DYNAMIC) {
        expect(body.position.y).toBeLessThanOrEqual(205);
      }
    }
  });
});

// ---------------------------------------------------------------------------
// 3. Circle-box collisions
// ---------------------------------------------------------------------------
describe("Shape interactions — circle-box", () => {
  it("circle should bounce off box", () => {
    const space = new Space(new Vec2(0, 0));

    const box = new Body(BodyType.STATIC, new Vec2(100, 0));
    box.shapes.add(new Polygon(Polygon.box(40, 40)));
    box.space = space;

    const ball = new Body(BodyType.DYNAMIC, new Vec2(0, 0));
    ball.shapes.add(new Circle(10));
    ball.velocity = new Vec2(200, 0);
    ball.space = space;

    let collided = false;
    const listener = new InteractionListener(
      CbEvent.BEGIN,
      InteractionType.COLLISION,
      CbType.ANY_BODY,
      CbType.ANY_BODY,
      () => { collided = true; },
    );
    listener.space = space;

    step(space, 60);
    expect(collided).toBe(true);
    // Ball should have bounced back
    expect(ball.position.x).toBeLessThan(100);
  });

  it("circle falling onto box should rest on top", () => {
    const space = new Space(new Vec2(0, 300));

    const box = new Body(BodyType.STATIC, new Vec2(0, 100));
    box.shapes.add(new Polygon(Polygon.box(100, 20)));
    box.space = space;

    const ball = new Body(BodyType.DYNAMIC, new Vec2(0, 0));
    ball.shapes.add(new Circle(10));
    ball.space = space;

    step(space, 120);

    expect(ball.position.y).toBeLessThanOrEqual(100);
    expect(ball.position.y).toBeGreaterThan(50);
  });
});

// ---------------------------------------------------------------------------
// 4. Capsule collisions
// ---------------------------------------------------------------------------
describe("Shape interactions — capsule", () => {
  it("capsule should collide with floor", () => {
    const space = new Space(new Vec2(0, 300));
    const floor = staticFloor(200);
    floor.space = space;

    const capsuleBody = new Body(BodyType.DYNAMIC, new Vec2(0, 100));
    capsuleBody.shapes.add(new Capsule(20, 8));
    capsuleBody.space = space;

    let collided = false;
    const listener = new InteractionListener(
      CbEvent.BEGIN,
      InteractionType.COLLISION,
      CbType.ANY_BODY,
      CbType.ANY_BODY,
      () => { collided = true; },
    );
    listener.space = space;

    step(space, 60);
    expect(collided).toBe(true);
    expect(capsuleBody.position.y).toBeLessThanOrEqual(200);
  });

  it("capsule should collide with circle", () => {
    const space = new Space(new Vec2(0, 0));

    const capsuleBody = new Body(BodyType.DYNAMIC, new Vec2(-100, 0));
    capsuleBody.shapes.add(new Capsule(30, 10));
    capsuleBody.velocity = new Vec2(200, 0);
    capsuleBody.space = space;

    const circleBody = new Body(BodyType.STATIC, new Vec2(100, 0));
    circleBody.shapes.add(new Circle(20));
    circleBody.space = space;

    let collided = false;
    const listener = new InteractionListener(
      CbEvent.BEGIN,
      InteractionType.COLLISION,
      CbType.ANY_BODY,
      CbType.ANY_BODY,
      () => { collided = true; },
    );
    listener.space = space;

    step(space, 60);
    expect(collided).toBe(true);
  });

  it("capsule should collide with box", () => {
    const space = new Space(new Vec2(0, 300));

    const box = new Body(BodyType.STATIC, new Vec2(0, 100));
    box.shapes.add(new Polygon(Polygon.box(200, 20)));
    box.space = space;

    const capsuleBody = new Body(BodyType.DYNAMIC, new Vec2(0, 0));
    capsuleBody.shapes.add(new Capsule(25, 8));
    capsuleBody.space = space;

    step(space, 60);
    expect(capsuleBody.position.y).toBeLessThanOrEqual(100);
  });
});

// ---------------------------------------------------------------------------
// 5. Material properties — friction and elasticity
// ---------------------------------------------------------------------------
describe("Shape interactions — material properties", () => {
  it("high friction should slow sliding body faster", () => {
    // Low friction
    const space1 = new Space(new Vec2(0, 300));
    const floor1 = staticFloor(200);
    floor1.shapes.at(0).material = new Material(0.01, 0, 0, 1, 0);
    floor1.space = space1;
    const ball1 = new Body(BodyType.DYNAMIC, new Vec2(0, 170));
    ball1.shapes.add(new Circle(10));
    ball1.shapes.at(0).material = new Material(0.01, 0, 0, 1, 0);
    ball1.velocity = new Vec2(200, 0);
    ball1.space = space1;

    // High friction
    const space2 = new Space(new Vec2(0, 300));
    const floor2 = staticFloor(200);
    floor2.shapes.at(0).material = new Material(10, 10, 0, 1, 0);
    floor2.space = space2;
    const ball2 = new Body(BodyType.DYNAMIC, new Vec2(0, 170));
    ball2.shapes.add(new Circle(10));
    ball2.shapes.at(0).material = new Material(10, 10, 0, 1, 0);
    ball2.velocity = new Vec2(200, 0);
    ball2.space = space2;

    step(space1, 120);
    step(space2, 120);

    // High friction body should travel less distance
    expect(ball2.position.x).toBeLessThan(ball1.position.x);
  });

  it("high elasticity should result in higher bounce", () => {
    // Low elasticity: Material(elasticity, dynamicFriction, staticFriction, density, rollingFriction)
    const space1 = new Space(new Vec2(0, 300));
    const floor1 = staticFloor(200);
    floor1.shapes.at(0).material = new Material(0, 1, 2, 1, 0);
    floor1.space = space1;
    const ball1 = new Body(BodyType.DYNAMIC, new Vec2(0, 0));
    ball1.shapes.add(new Circle(10));
    ball1.shapes.at(0).material = new Material(0, 1, 2, 1, 0);
    ball1.space = space1;

    // High elasticity
    const space2 = new Space(new Vec2(0, 300));
    const floor2 = staticFloor(200);
    floor2.shapes.at(0).material = new Material(0.95, 1, 2, 1, 0);
    floor2.space = space2;
    const ball2 = new Body(BodyType.DYNAMIC, new Vec2(0, 0));
    ball2.shapes.add(new Circle(10));
    ball2.shapes.at(0).material = new Material(0.95, 1, 2, 1, 0);
    ball2.space = space2;

    // Drop both, let them hit floor then check after some time
    // First let both hit the floor
    step(space1, 60);
    step(space2, 60);

    // Now step a bit more — elastic ball should still be bouncing
    const pos1Before = ball1.position.y;
    const pos2Before = ball2.position.y;
    step(space1, 30);
    step(space2, 30);

    // The elastic ball should have moved more (bouncing) than the inelastic one (settled)
    const move1 = Math.abs(ball1.position.y - pos1Before);
    const move2 = Math.abs(ball2.position.y - pos2Before);
    expect(move2).toBeGreaterThanOrEqual(move1);
  });
});

// ---------------------------------------------------------------------------
// 6. InteractionFilter — collision groups
// ---------------------------------------------------------------------------
describe("Shape interactions — InteractionFilter groups", () => {
  it("should prevent collision between bodies in different groups", () => {
    const space = new Space(new Vec2(0, 0));

    const a = new Body(BodyType.DYNAMIC, new Vec2(-50, 0));
    const shapeA = new Circle(15);
    shapeA.filter = new InteractionFilter(1, ~2); // group 1, doesn't collide with group 2
    a.shapes.add(shapeA);
    a.velocity = new Vec2(100, 0);
    a.space = space;

    const b = new Body(BodyType.DYNAMIC, new Vec2(50, 0));
    const shapeB = new Circle(15);
    shapeB.filter = new InteractionFilter(2, ~1); // group 2, doesn't collide with group 1
    b.shapes.add(shapeB);
    b.velocity = new Vec2(-100, 0);
    b.space = space;

    step(space, 60);

    // They should pass through each other
    expect(a.position.x).toBeGreaterThan(0);
    expect(b.position.x).toBeLessThan(0);
  });

  it("should allow collision between bodies in matching groups", () => {
    const space = new Space(new Vec2(0, 0));

    const a = new Body(BodyType.DYNAMIC, new Vec2(-50, 0));
    const shapeA = new Circle(15);
    shapeA.filter = new InteractionFilter(1, 0xFFFFFFFF);
    a.shapes.add(shapeA);
    a.velocity = new Vec2(100, 0);
    a.space = space;

    const b = new Body(BodyType.DYNAMIC, new Vec2(50, 0));
    const shapeB = new Circle(15);
    shapeB.filter = new InteractionFilter(1, 0xFFFFFFFF);
    b.shapes.add(shapeB);
    b.velocity = new Vec2(-100, 0);
    b.space = space;

    let collided = false;
    const listener = new InteractionListener(
      CbEvent.BEGIN,
      InteractionType.COLLISION,
      CbType.ANY_BODY,
      CbType.ANY_BODY,
      () => { collided = true; },
    );
    listener.space = space;

    step(space, 30);
    expect(collided).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// 7. Multiple shapes on one body
// ---------------------------------------------------------------------------
describe("Shape interactions — multi-shape bodies", () => {
  it("body with two circles should collide with both shapes", () => {
    const space = new Space(new Vec2(0, 300));
    const floor = staticFloor(200);
    floor.space = space;

    const b = new Body(BodyType.DYNAMIC, new Vec2(0, 100));
    b.shapes.add(new Circle(10, new Vec2(-15, 0)));
    b.shapes.add(new Circle(10, new Vec2(15, 0)));
    b.space = space;

    step(space, 120);
    expect(b.position.y).toBeLessThanOrEqual(200);
  });

  it("body with circle and polygon should behave correctly", () => {
    const space = new Space(new Vec2(0, 300));
    const floor = staticFloor(200);
    floor.space = space;

    const b = new Body(BodyType.DYNAMIC, new Vec2(0, 100));
    b.shapes.add(new Circle(10));
    b.shapes.add(new Polygon(Polygon.box(30, 5)));
    b.space = space;

    step(space, 120);
    expect(b.position.y).toBeLessThanOrEqual(200);
  });
});
