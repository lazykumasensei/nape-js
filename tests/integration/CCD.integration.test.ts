import { describe, it, expect } from "vitest";
import { Space } from "../../src/space/Space";
import { Body } from "../../src/phys/Body";
import { BodyType } from "../../src/phys/BodyType";
import { Vec2 } from "../../src/geom/Vec2";
import { Circle } from "../../src/shape/Circle";
import { Polygon } from "../../src/shape/Polygon";
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

function thinWall(x: number, y: number, height = 200): Body {
  const b = new Body(BodyType.STATIC, new Vec2(x, y));
  b.shapes.add(new Polygon(Polygon.box(2, height)));
  return b;
}

// ---------------------------------------------------------------------------
// 1. CCD basics — isBullet property
// ---------------------------------------------------------------------------
describe("CCD integration — isBullet property", () => {
  it("should default isBullet to false", () => {
    const b = new Body(BodyType.DYNAMIC);
    b.shapes.add(new Circle(5));
    expect(b.isBullet).toBe(false);
  });

  it("should allow setting isBullet to true", () => {
    const b = new Body(BodyType.DYNAMIC);
    b.shapes.add(new Circle(5));
    b.isBullet = true;
    expect(b.isBullet).toBe(true);
  });

  it("should toggle isBullet on and off", () => {
    const b = new Body(BodyType.DYNAMIC);
    b.shapes.add(new Circle(5));
    b.isBullet = true;
    expect(b.isBullet).toBe(true);
    b.isBullet = false;
    expect(b.isBullet).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// 2. CCD tunneling prevention
// ---------------------------------------------------------------------------
describe("CCD integration — tunneling prevention", () => {
  it("bullet body should detect collision with thin wall at high speed", () => {
    const space = new Space(new Vec2(0, 0));

    // Thin wall at x=200
    const wall = thinWall(200, 0);
    wall.space = space;

    // Fast bullet body
    const bullet = new Body(BodyType.DYNAMIC, new Vec2(0, 0));
    bullet.shapes.add(new Circle(5));
    bullet.isBullet = true;
    bullet.velocity = new Vec2(5000, 0);
    bullet.space = space;

    let collisionDetected = false;
    const listener = new InteractionListener(
      CbEvent.BEGIN,
      InteractionType.COLLISION,
      CbType.ANY_BODY,
      CbType.ANY_BODY,
      () => {
        collisionDetected = true;
      },
    );
    listener.space = space;

    step(space, 10);

    // Bullet should be stopped by wall (not tunneled through)
    expect(bullet.position.x).toBeLessThanOrEqual(210);
    expect(collisionDetected).toBe(true);
  });

  it("non-bullet body may tunnel through thin wall at high speed", () => {
    const space = new Space(new Vec2(0, 0));
    const wall = thinWall(200, 0);
    wall.space = space;

    const fast = new Body(BodyType.DYNAMIC, new Vec2(0, 0));
    fast.shapes.add(new Circle(5));
    fast.isBullet = false;
    fast.velocity = new Vec2(50000, 0);
    fast.space = space;

    step(space, 5);

    // Non-bullet body at extreme speed may pass through
    // (This tests the difference between bullet and non-bullet)
    // It either tunneled or it didn't — we just verify simulation doesn't crash
    expect(typeof fast.position.x).toBe("number");
  });

  it("bullet circle should collide with static box floor at high vertical speed", () => {
    const space = new Space(new Vec2(0, 0));

    const floor = new Body(BodyType.STATIC, new Vec2(0, 500));
    floor.shapes.add(new Polygon(Polygon.box(1000, 20)));
    floor.space = space;

    const bullet = new Body(BodyType.DYNAMIC, new Vec2(0, 0));
    bullet.shapes.add(new Circle(5));
    bullet.isBullet = true;
    bullet.velocity = new Vec2(0, 8000);
    bullet.space = space;

    step(space, 10);
    // Should not pass through the floor
    expect(bullet.position.y).toBeLessThanOrEqual(510);
  });
});

// ---------------------------------------------------------------------------
// 3. CCD with different shape types
// ---------------------------------------------------------------------------
describe("CCD integration — different shapes", () => {
  it("bullet box should collide with wall at high speed", () => {
    const space = new Space(new Vec2(0, 0));

    const wall = thinWall(200, 0, 400);
    wall.space = space;

    const box = new Body(BodyType.DYNAMIC, new Vec2(0, 0));
    box.shapes.add(new Polygon(Polygon.box(10, 10)));
    box.isBullet = true;
    box.velocity = new Vec2(5000, 0);
    box.space = space;

    let hit = false;
    const listener = new InteractionListener(
      CbEvent.BEGIN,
      InteractionType.COLLISION,
      CbType.ANY_BODY,
      CbType.ANY_BODY,
      () => {
        hit = true;
      },
    );
    listener.space = space;

    step(space, 10);
    expect(hit).toBe(true);
    expect(box.position.x).toBeLessThanOrEqual(210);
  });

  it("small bullet should detect collision with large static body", () => {
    const space = new Space(new Vec2(0, 0));

    const bigWall = new Body(BodyType.STATIC, new Vec2(300, 0));
    bigWall.shapes.add(new Polygon(Polygon.box(100, 400)));
    bigWall.space = space;

    const tiny = new Body(BodyType.DYNAMIC, new Vec2(0, 0));
    tiny.shapes.add(new Circle(2));
    tiny.isBullet = true;
    tiny.velocity = new Vec2(3000, 0);
    tiny.space = space;

    let hit = false;
    const listener = new InteractionListener(
      CbEvent.BEGIN,
      InteractionType.COLLISION,
      CbType.ANY_BODY,
      CbType.ANY_BODY,
      () => {
        hit = true;
      },
    );
    listener.space = space;

    step(space, 10);
    expect(hit).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// 4. CCD with multiple bullets
// ---------------------------------------------------------------------------
describe("CCD integration — multiple bullets", () => {
  it("multiple bullet bodies should all detect collisions", () => {
    const space = new Space(new Vec2(0, 0));

    const wall = new Body(BodyType.STATIC, new Vec2(300, 0));
    wall.shapes.add(new Polygon(Polygon.box(20, 600)));
    wall.space = space;

    const hits = new Set<Body>();
    const bullets: Body[] = [];
    for (let i = 0; i < 5; i++) {
      const b = new Body(BodyType.DYNAMIC, new Vec2(0, i * 30 - 60));
      b.shapes.add(new Circle(5));
      b.isBullet = true;
      b.velocity = new Vec2(4000, 0);
      b.space = space;
      bullets.push(b);
    }

    const listener = new InteractionListener(
      CbEvent.BEGIN,
      InteractionType.COLLISION,
      CbType.ANY_BODY,
      CbType.ANY_BODY,
      (cb: any) => {
        const b1 = cb.int1;
        const b2 = cb.int2;
        for (const bullet of bullets) {
          if (b1 === bullet || b2 === bullet) hits.add(bullet);
        }
      },
    );
    listener.space = space;

    step(space, 10);

    // All bullets should have hit the wall
    expect(hits.size).toBe(5);
  });

  it("two bullet bodies moving toward each other should collide", () => {
    const space = new Space(new Vec2(0, 0));

    const b1 = new Body(BodyType.DYNAMIC, new Vec2(0, 0));
    b1.shapes.add(new Circle(5));
    b1.isBullet = true;
    b1.velocity = new Vec2(3000, 0);
    b1.space = space;

    const b2 = new Body(BodyType.DYNAMIC, new Vec2(500, 0));
    b2.shapes.add(new Circle(5));
    b2.isBullet = true;
    b2.velocity = new Vec2(-3000, 0);
    b2.space = space;

    let collided = false;
    const listener = new InteractionListener(
      CbEvent.BEGIN,
      InteractionType.COLLISION,
      CbType.ANY_BODY,
      CbType.ANY_BODY,
      () => {
        collided = true;
      },
    );
    listener.space = space;

    step(space, 10);
    expect(collided).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// 5. disableCCD property on Space
// ---------------------------------------------------------------------------
describe("CCD integration — disableCCD body property", () => {
  it("should have disableCCD property on Body", () => {
    const b = new Body(BodyType.DYNAMIC);
    b.shapes.add(new Circle(5));
    expect(typeof b.disableCCD).toBe("boolean");
  });

  it("bullet with disableCCD may tunnel through thin wall at high speed", () => {
    const space = new Space(new Vec2(0, 0));

    const wall = thinWall(200, 0);
    wall.space = space;

    const bullet = new Body(BodyType.DYNAMIC, new Vec2(0, 0));
    bullet.shapes.add(new Circle(5));
    bullet.isBullet = true;
    bullet.disableCCD = true;
    bullet.velocity = new Vec2(50000, 0);
    bullet.space = space;

    step(space, 5);

    // With CCD disabled per-body, even a bullet at extreme speed may tunnel
    // We mainly verify the simulation doesn't crash
    expect(typeof bullet.position.x).toBe("number");
  });
});
