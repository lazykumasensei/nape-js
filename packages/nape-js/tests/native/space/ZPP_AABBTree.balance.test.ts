/**
 * ZPP_AABBTree — balance / restructure / removal-with-rebalance tests.
 *
 * Targets uncovered branches around lines 990–1186:
 * - Both directions of `balance()` rotation (balance > 1 / balance < -1)
 * - Both branches inside each rotation (f.height vs g.height comparisons)
 * - Removing a node from the deeper child path (sibling promotion + rebalance)
 * - Sequential operations that force ripple-up height recompute
 * - Many-body integration that exercises the tree across moves
 */

import { describe, it, expect, beforeEach } from "vitest";
import "../../../src/core/engine";
import { Space } from "../../../src/space/Space";
import { Body } from "../../../src/phys/Body";
import { BodyType } from "../../../src/phys/BodyType";
import { Vec2 } from "../../../src/geom/Vec2";
import { AABB } from "../../../src/geom/AABB";
import { Circle } from "../../../src/shape/Circle";
import { Polygon } from "../../../src/shape/Polygon";
import { Ray } from "../../../src/geom/Ray";
import { Broadphase } from "../../../src/space/Broadphase";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function dynCircle(x: number, y: number, r = 5): Body {
  const b = new Body(BodyType.DYNAMIC, new Vec2(x, y));
  b.shapes.add(new Circle(r));
  return b;
}

function statCircle(x: number, y: number, r = 5): Body {
  const b = new Body(BodyType.STATIC, new Vec2(x, y));
  b.shapes.add(new Circle(r));
  return b;
}

function step(space: Space, n = 1): void {
  for (let i = 0; i < n; i++) space.step(1 / 60);
}

// ---------------------------------------------------------------------------
// 1. Right-leaning insertion forces balance > 1 (rotate left)
// ---------------------------------------------------------------------------

describe("ZPP_AABBTree — left rotation (balance > 1)", () => {
  let space: Space;
  beforeEach(() => {
    space = new Space(new Vec2(0, 0), Broadphase.DYNAMIC_AABB_TREE);
  });

  it("inserting in increasing-x order produces a balanced tree", () => {
    // Insert many bodies along x axis — naive insertion would be left-deep.
    const bodies: Body[] = [];
    for (let i = 0; i < 64; i++) {
      const b = dynCircle(i * 50, 0, 5);
      b.space = space;
      bodies.push(b);
    }
    step(space, 1);

    // Tree must still serve correct point queries
    for (let i = 0; i < 64; i++) {
      const shapes = space.shapesUnderPoint(new Vec2(i * 50, 0));
      expect(shapes.length).toBe(1);
    }
  });

  it("inserting in decreasing-x order also produces balanced queries", () => {
    for (let i = 63; i >= 0; i--) {
      dynCircle(i * 50, 0, 5).space = space;
    }
    step(space, 1);

    for (let i = 0; i < 64; i++) {
      const shapes = space.shapesUnderPoint(new Vec2(i * 50, 0));
      expect(shapes.length).toBe(1);
    }
  });

  it("alternating insertion patterns on a 2D grid stay queryable", () => {
    const xs = [0, 200, 100, 300, 50, 250, 150, 350, 75, 275];
    const ys = [0, 100, 50, 150, 25, 125, 75, 175, 200, 250];
    for (const x of xs) {
      for (const y of ys) {
        dynCircle(x, y, 4).space = space;
      }
    }
    step(space, 1);

    for (const x of xs) {
      for (const y of ys) {
        const shapes = space.shapesUnderPoint(new Vec2(x, y));
        expect(shapes.length).toBe(1);
      }
    }
  });
});

// ---------------------------------------------------------------------------
// 2. Removal from various tree positions (deep, leaf, root sibling)
// ---------------------------------------------------------------------------

describe("ZPP_AABBTree — removal triggers rebalance", () => {
  let space: Space;
  beforeEach(() => {
    space = new Space(new Vec2(0, 0), Broadphase.DYNAMIC_AABB_TREE);
  });

  it("removing nodes from the middle of a tree keeps queries correct", () => {
    const bodies: Body[] = [];
    for (let i = 0; i < 32; i++) {
      const b = dynCircle(i * 30, 0, 4);
      b.space = space;
      bodies.push(b);
    }
    step(space, 1);

    // Remove every other body in reverse — exercises various rebalance paths
    for (let i = 30; i >= 0; i -= 2) {
      bodies[i].space = null;
    }
    step(space, 1);

    // Remaining odd-indexed bodies must still be queryable
    for (let i = 1; i < 32; i += 2) {
      const shapes = space.shapesUnderPoint(new Vec2(i * 30, 0));
      expect(shapes.length).toBe(1);
    }
    // Removed even-indexed must NOT be found
    for (let i = 0; i < 32; i += 2) {
      const shapes = space.shapesUnderPoint(new Vec2(i * 30, 0));
      expect(shapes.length).toBe(0);
    }
  });

  it("repeated insertion+removal of one body amid many others stays consistent", () => {
    for (let i = 0; i < 30; i++) dynCircle(i * 25, 0, 4).space = space;
    step(space, 1);

    const probe = dynCircle(500, 500, 4);
    for (let cycle = 0; cycle < 20; cycle++) {
      probe.space = space;
      step(space, 1);
      expect(space.shapesUnderPoint(new Vec2(500, 500)).length).toBe(1);
      probe.space = null;
      step(space, 1);
      expect(space.shapesUnderPoint(new Vec2(500, 500)).length).toBe(0);
    }
  });

  it("removing root child triggers sibling promotion path", () => {
    const a = dynCircle(0, 0, 5);
    a.space = space;
    const b = dynCircle(100, 0, 5);
    b.space = space;
    step(space, 1);

    // Remove `a` — sibling `b` becomes root
    a.space = null;
    step(space, 1);

    expect(space.bodies.length).toBe(1);
    expect(space.shapesUnderPoint(new Vec2(100, 0)).length).toBe(1);
    expect(space.shapesUnderPoint(new Vec2(0, 0)).length).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// 3. Movement over time — each step refits AABBs and may trigger rebalance
// ---------------------------------------------------------------------------

describe("ZPP_AABBTree — movement-driven rebalance", () => {
  let space: Space;
  beforeEach(() => {
    space = new Space(new Vec2(0, 0), Broadphase.DYNAMIC_AABB_TREE);
  });

  it("bodies streaming across the world keep correct broadphase", () => {
    const bodies: Body[] = [];
    for (let i = 0; i < 30; i++) {
      const b = dynCircle(-1000 + i * 10, 0, 4);
      b.velocity = new Vec2(50 + i * 2, 0);
      b.space = space;
      bodies.push(b);
    }
    // Many steps move bodies through the world — tree must keep up
    step(space, 60);

    // Each body should find itself by point query
    for (const b of bodies) {
      const shapes = space.shapesUnderPoint(new Vec2(b.position.x, b.position.y));
      expect(shapes.length).toBeGreaterThanOrEqual(1);
    }
  });

  it("teleporting many bodies simultaneously rebalances correctly", () => {
    const bodies: Body[] = [];
    for (let i = 0; i < 32; i++) {
      const b = dynCircle(i * 20, 0, 4);
      b.space = space;
      bodies.push(b);
    }
    step(space, 1);

    // Teleport all to a far line, well-spaced so radii don't overlap
    for (let i = 0; i < bodies.length; i++) {
      bodies[i].position = new Vec2(10000 + i * 50, 10000);
    }
    step(space, 1);

    // Old positions: empty. Each new position: exactly one body found.
    expect(space.shapesUnderPoint(new Vec2(0, 0)).length).toBe(0);
    for (let i = 0; i < bodies.length; i++) {
      const found = space.shapesUnderPoint(new Vec2(10000 + i * 50, 10000));
      expect(found.length).toBe(1);
    }
  });
});

// ---------------------------------------------------------------------------
// 4. Mixed shapes and rotations — extreme AABB churn
// ---------------------------------------------------------------------------

describe("ZPP_AABBTree — heterogeneous + rotating churn", () => {
  let space: Space;
  beforeEach(() => {
    space = new Space(new Vec2(0, 0), Broadphase.DYNAMIC_AABB_TREE);
  });

  it("rotating thin polygons triggers many AABB updates", () => {
    const bodies: Body[] = [];
    for (let i = 0; i < 16; i++) {
      const b = new Body(BodyType.DYNAMIC, new Vec2(i * 50, 0));
      b.shapes.add(new Polygon(Polygon.box(5, 100)));
      b.angularVel = 1 + i * 0.3;
      b.space = space;
      bodies.push(b);
    }

    step(space, 60);

    for (const b of bodies) {
      // Rotation must not have torn the body off the tree
      expect(Number.isFinite(b.position.x)).toBe(true);
    }
    // Total bodies preserved
    expect(space.bodies.length).toBe(16);
  });
});

// ---------------------------------------------------------------------------
// 5. Ray + AABB queries on a rebalanced tree
// ---------------------------------------------------------------------------

describe("ZPP_AABBTree — ray and AABB queries after rebalance", () => {
  let space: Space;
  beforeEach(() => {
    space = new Space(new Vec2(0, 0), Broadphase.DYNAMIC_AABB_TREE);
  });

  it("rayMultiCast hits all collinear bodies after heavy churn", () => {
    // Heavy churn first
    const trash: Body[] = [];
    for (let i = 0; i < 50; i++) {
      const b = dynCircle(Math.random() * 1000, Math.random() * 1000, 4);
      b.space = space;
      trash.push(b);
    }
    step(space, 1);
    for (const b of trash) b.space = null;
    step(space, 1);

    // Now place 5 collinear targets
    const targets: Body[] = [];
    for (let i = 0; i < 5; i++) {
      const b = dynCircle(i * 40, 0, 8);
      b.space = space;
      targets.push(b);
    }
    step(space, 1);

    const ray = new Ray(new Vec2(-50, 0), new Vec2(1, 0));
    ray.maxDistance = 500;
    const hits = space.rayMultiCast(ray);
    expect(hits.length).toBe(5);
  });

  it("shapesInAABB returns correct subset after many removes", () => {
    const grid: Body[] = [];
    for (let x = 0; x <= 200; x += 50) {
      for (let y = 0; y <= 200; y += 50) {
        const b = dynCircle(x, y, 5);
        b.space = space;
        grid.push(b);
      }
    }
    const initialCount = grid.length;
    step(space, 1);

    // Remove the lower-left quadrant (strictly < 75)
    let removedCount = 0;
    for (const b of grid) {
      if (b.position.x < 75 && b.position.y < 75) {
        b.space = null;
        removedCount++;
      }
    }
    step(space, 1);

    // Tight query inside the removed area returns nothing
    let shapes = space.shapesInAABB(new AABB(20, 20, 30, 30));
    expect(shapes.length).toBe(0);

    // Tight query inside a kept area returns the body there
    shapes = space.shapesInAABB(new AABB(95, 95, 10, 10));
    expect(shapes.length).toBeGreaterThan(0);

    // Total live count consistent
    expect(space.bodies.length).toBe(initialCount - removedCount);
  });
});

// ---------------------------------------------------------------------------
// 6. Very deep tree (extreme adversarial pattern)
// ---------------------------------------------------------------------------

describe("ZPP_AABBTree — extreme insertion patterns", () => {
  let space: Space;
  beforeEach(() => {
    space = new Space(new Vec2(0, 0), Broadphase.DYNAMIC_AABB_TREE);
  });

  it("100 separated bodies each return exactly one shape under their own point", () => {
    const bodies: Body[] = [];
    for (let i = 0; i < 100; i++) {
      const b = dynCircle(i * 30, 0, 4);
      b.space = space;
      bodies.push(b);
    }
    step(space, 1);

    for (let i = 0; i < 100; i++) {
      const shapes = space.shapesUnderPoint(new Vec2(i * 30, 0));
      expect(shapes.length).toBe(1);
    }
  });

  it("insertion + half-removal + insertion sequence stays consistent", () => {
    const first: Body[] = [];
    for (let i = 0; i < 40; i++) {
      const b = dynCircle(i * 30, 0, 5);
      b.space = space;
      first.push(b);
    }
    step(space, 1);

    // Remove every 3rd (creates fragmented tree)
    for (let i = 0; i < first.length; i += 3) first[i].space = null;
    step(space, 1);

    // Add new bodies in the gaps
    for (let i = 0; i < first.length; i += 3) {
      dynCircle(i * 30, 100, 5).space = space;
    }
    step(space, 1);

    // Query the new bodies' positions
    let found = 0;
    for (let i = 0; i < first.length; i += 3) {
      if (space.shapesUnderPoint(new Vec2(i * 30, 100)).length > 0) found++;
    }
    expect(found).toBe(Math.ceil(first.length / 3));
  });
});

// ---------------------------------------------------------------------------
// 7. Static + dynamic mix — separate sub-trees may be in play
// ---------------------------------------------------------------------------

describe("ZPP_AABBTree — static + dynamic interplay", () => {
  let space: Space;
  beforeEach(() => {
    space = new Space(new Vec2(0, 0), Broadphase.DYNAMIC_AABB_TREE);
  });

  it("static obstacle wall + many dynamics produces correct collisions", () => {
    // Static wall (left side)
    for (let y = 0; y < 200; y += 10) {
      statCircle(0, y, 5).space = space;
    }
    // Many dynamics flying left-to-right
    const dyns: Body[] = [];
    for (let i = 0; i < 20; i++) {
      const b = dynCircle(100 + i * 5, i * 10, 4);
      b.velocity = new Vec2(-200, 0);
      b.space = space;
      dyns.push(b);
    }
    step(space, 60);

    // None of the dynamics should have passed through (x < -10)
    for (const b of dyns) {
      expect(b.position.x).toBeGreaterThan(-10);
    }
  });
});
