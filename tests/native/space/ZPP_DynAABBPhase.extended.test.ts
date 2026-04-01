/**
 * ZPP_DynAABBPhase — CCD sync, pending sync states, tree management.
 * ZPP_Broadphase — validateShape transformation paths.
 *
 * Targets: CCD bullet body sync through DynAABBPhase, pending sync with
 * large teleports, broadphase algorithm switching, and AABB validation
 * under shape transformations.
 */

import { describe, it, expect } from "vitest";
import "../../../src/core/engine";
import { Space } from "../../../src/space/Space";
import { Body } from "../../../src/phys/Body";
import { BodyType } from "../../../src/phys/BodyType";
import { Vec2 } from "../../../src/geom/Vec2";
import { AABB } from "../../../src/geom/AABB";
import { Circle } from "../../../src/shape/Circle";
import { Polygon } from "../../../src/shape/Polygon";
import { Capsule } from "../../../src/shape/Capsule";
import { Broadphase } from "../../../src/space/Broadphase";
import { InteractionListener } from "../../../src/callbacks/InteractionListener";
import { CbEvent } from "../../../src/callbacks/CbEvent";
import { CbType } from "../../../src/callbacks/CbType";
import { InteractionType } from "../../../src/callbacks/InteractionType";

function step(space: Space, n = 1): void {
  for (let i = 0; i < n; i++) space.step(1 / 60);
}

// ---------------------------------------------------------------------------
// CCD sync — bullet bodies through DynAABBPhase
// ---------------------------------------------------------------------------

describe("ZPP_DynAABBPhase — CCD bullet sync", () => {
  it("bullet body is queryable after high-speed move", () => {
    const space = new Space(new Vec2(0, 0), Broadphase.DYNAMIC_AABB_TREE);

    const bullet = new Body(BodyType.DYNAMIC, new Vec2(0, 0));
    bullet.shapes.add(new Circle(5));
    bullet.isBullet = true;
    bullet.velocity = new Vec2(3000, 0);
    bullet.space = space;

    const wall = new Body(BodyType.STATIC, new Vec2(500, 0));
    wall.shapes.add(new Polygon(Polygon.box(20, 200)));
    wall.space = space;

    step(space, 5);

    // Bullet should have been stopped by wall
    expect(bullet.position.x).toBeLessThan(520);
    // And should still be queryable
    const shapes = space.shapesUnderPoint(new Vec2(bullet.position.x, bullet.position.y));
    expect(shapes.length).toBeGreaterThanOrEqual(1);
  });

  it("CCD bullet polygon collides with thin wall", () => {
    const space = new Space(new Vec2(0, 0), Broadphase.DYNAMIC_AABB_TREE);

    const wall = new Body(BodyType.STATIC, new Vec2(200, 0));
    wall.shapes.add(new Polygon(Polygon.box(2, 200)));
    wall.space = space;

    const box = new Body(BodyType.DYNAMIC, new Vec2(0, 0));
    box.shapes.add(new Polygon(Polygon.box(10, 10)));
    box.isBullet = true;
    box.velocity = new Vec2(5000, 0);
    box.space = space;

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

    step(space, 10);
    expect(hit).toBe(true);
  });

  it("bullet with angular velocity detects collision", () => {
    const space = new Space(new Vec2(0, 0), Broadphase.DYNAMIC_AABB_TREE);

    const wall = new Body(BodyType.STATIC, new Vec2(200, 0));
    wall.shapes.add(new Polygon(Polygon.box(20, 400)));
    wall.space = space;

    const spinner = new Body(BodyType.DYNAMIC, new Vec2(0, 0));
    spinner.shapes.add(new Polygon(Polygon.box(20, 5)));
    spinner.isBullet = true;
    spinner.velocity = new Vec2(3000, 0);
    spinner.angularVel = 50;
    spinner.space = space;

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

    step(space, 10);
    expect(hit).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Broadphase sync with large teleports
// ---------------------------------------------------------------------------

describe("ZPP_DynAABBPhase — large position changes", () => {
  it("body teleported far away is still found by queries", () => {
    const space = new Space(new Vec2(0, 0), Broadphase.DYNAMIC_AABB_TREE);
    const b = new Body(BodyType.DYNAMIC, new Vec2(0, 0));
    b.shapes.add(new Circle(10));
    b.space = space;
    step(space);

    // Teleport very far
    b.position = Vec2.weak(10000, 10000);
    step(space);

    const shapes = space.shapesUnderPoint(new Vec2(10000, 10000));
    expect(shapes.length).toBe(1);
  });

  it("multiple rapid teleports work correctly", () => {
    const space = new Space(new Vec2(0, 0), Broadphase.DYNAMIC_AABB_TREE);
    const b = new Body(BodyType.DYNAMIC, new Vec2(0, 0));
    b.shapes.add(new Circle(10));
    b.space = space;

    for (let i = 0; i < 10; i++) {
      b.position = Vec2.weak(i * 1000, 0);
      step(space);
    }

    // Should be at last position
    const shapes = space.shapesUnderPoint(new Vec2(9000, 0));
    expect(shapes.length).toBe(1);
    const shapesOld = space.shapesUnderPoint(new Vec2(0, 0));
    expect(shapesOld.length).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// Broadphase validateShape — various shape types
// ---------------------------------------------------------------------------

describe("ZPP_Broadphase — validateShape for shape types", () => {
  it("rotated polygon is findable after rotation change", () => {
    const space = new Space(new Vec2(0, 0));
    const b = new Body(BodyType.DYNAMIC, new Vec2(100, 100));
    b.shapes.add(new Polygon(Polygon.box(10, 100)));
    b.space = space;
    step(space);

    // Rotate significantly
    b.rotation = Math.PI / 3;
    step(space);

    const shapes = space.shapesUnderPoint(new Vec2(100, 100));
    expect(shapes.length).toBe(1);
  });

  it("capsule shape is queryable", () => {
    const space = new Space(new Vec2(0, 0));
    const b = new Body(BodyType.DYNAMIC, new Vec2(100, 100));
    b.shapes.add(new Capsule(30, 10));
    b.space = space;
    step(space);

    const shapes = space.shapesUnderPoint(new Vec2(100, 100));
    expect(shapes.length).toBe(1);
  });

  it("capsule in shapesInAABB", () => {
    const space = new Space(new Vec2(0, 0));
    const b = new Body(BodyType.DYNAMIC, new Vec2(100, 100));
    b.shapes.add(new Capsule(30, 10));
    b.space = space;
    step(space);

    const shapes = space.shapesInAABB(new AABB(70, 70, 60, 60));
    expect(shapes.length).toBe(1);
  });

  it("capsule in shapesInCircle", () => {
    const space = new Space(new Vec2(0, 0));
    const b = new Body(BodyType.DYNAMIC, new Vec2(100, 100));
    b.shapes.add(new Capsule(20, 8));
    b.space = space;
    step(space);

    const shapes = space.shapesInCircle(new Vec2(100, 100), 40);
    expect(shapes.length).toBe(1);
  });

  it("triangle polygon is correctly validated", () => {
    const space = new Space(new Vec2(0, 0));
    const b = new Body(BodyType.DYNAMIC, new Vec2(100, 100));
    b.shapes.add(new Polygon([new Vec2(0, -20), new Vec2(20, 20), new Vec2(-20, 20)]));
    b.space = space;
    step(space);

    const shapes = space.shapesUnderPoint(new Vec2(100, 100));
    expect(shapes.length).toBe(1);
  });

  it("regular polygon (hexagon) is correctly validated", () => {
    const space = new Space(new Vec2(0, 0));
    const b = new Body(BodyType.DYNAMIC, new Vec2(100, 100));
    b.shapes.add(new Polygon(Polygon.regular(20, 20, 6)));
    b.space = space;
    step(space);

    const shapes = space.shapesUnderPoint(new Vec2(100, 100));
    expect(shapes.length).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// DynAABBPhase — shape add/remove from body mid-simulation
// ---------------------------------------------------------------------------

describe("ZPP_DynAABBPhase — shape add/remove on existing body", () => {
  it("adding a shape to an existing body makes it queryable", () => {
    const space = new Space(new Vec2(0, 0), Broadphase.DYNAMIC_AABB_TREE);
    const b = new Body(BodyType.DYNAMIC, new Vec2(100, 100));
    b.shapes.add(new Circle(10));
    b.space = space;
    step(space);

    // Add a second shape offset
    const c2 = new Circle(10);
    b.shapes.add(c2);
    step(space);

    // Both shapes should be at body position
    const shapes = space.shapesUnderPoint(new Vec2(100, 100));
    expect(shapes.length).toBe(2);
  });

  it("removing a shape from body updates broadphase", () => {
    const space = new Space(new Vec2(0, 0), Broadphase.DYNAMIC_AABB_TREE);
    const b = new Body(BodyType.DYNAMIC, new Vec2(100, 100));
    const c1 = new Circle(10);
    const c2 = new Circle(10);
    b.shapes.add(c1);
    b.shapes.add(c2);
    b.space = space;
    step(space);

    expect(space.shapesUnderPoint(new Vec2(100, 100)).length).toBe(2);

    b.shapes.remove(c2);
    step(space);

    expect(space.shapesUnderPoint(new Vec2(100, 100)).length).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// SweepPhase — CCD bullet interaction
// ---------------------------------------------------------------------------

describe("SWEEP_AND_PRUNE — CCD bullet", () => {
  it("bullet body collides with wall", () => {
    const space = new Space(new Vec2(0, 0), Broadphase.SWEEP_AND_PRUNE);

    const wall = new Body(BodyType.STATIC, new Vec2(200, 0));
    wall.shapes.add(new Polygon(Polygon.box(20, 200)));
    wall.space = space;

    const bullet = new Body(BodyType.DYNAMIC, new Vec2(0, 0));
    bullet.shapes.add(new Circle(5));
    bullet.isBullet = true;
    bullet.velocity = new Vec2(5000, 0);
    bullet.space = space;

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

    step(space, 10);
    expect(hit).toBe(true);
    expect(bullet.position.x).toBeLessThan(220);
  });
});

// ---------------------------------------------------------------------------
// SPATIAL_HASH — CCD bullet
// ---------------------------------------------------------------------------

describe("SPATIAL_HASH — CCD bullet", () => {
  it("bullet body collides with wall", () => {
    const space = new Space(new Vec2(0, 0), Broadphase.SPATIAL_HASH);

    const wall = new Body(BodyType.STATIC, new Vec2(200, 0));
    wall.shapes.add(new Polygon(Polygon.box(20, 200)));
    wall.space = space;

    const bullet = new Body(BodyType.DYNAMIC, new Vec2(0, 0));
    bullet.shapes.add(new Circle(5));
    bullet.isBullet = true;
    bullet.velocity = new Vec2(5000, 0);
    bullet.space = space;

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

    step(space, 10);
    expect(hit).toBe(true);
    expect(bullet.position.x).toBeLessThan(220);
  });
});
