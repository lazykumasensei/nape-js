import { describe, it, expect } from "vitest";
import "../../src/core/engine";
import { Space } from "../../src/space/Space";
import { Broadphase } from "../../src/space/Broadphase";
import { Body } from "../../src/phys/Body";
import { BodyType } from "../../src/phys/BodyType";
import { Vec2 } from "../../src/geom/Vec2";
import { AABB } from "../../src/geom/AABB";
import { Ray } from "../../src/geom/Ray";
import { Circle } from "../../src/shape/Circle";
import { Polygon } from "../../src/shape/Polygon";
import { Material } from "../../src/phys/Material";
import { InteractionFilter } from "../../src/dynamics/InteractionFilter";

// ---------------------------------------------------------------------------
// Cross-broadphase parity suite
//
// The three broadphase implementations (DYNAMIC_AABB_TREE, SWEEP_AND_PRUNE,
// SPATIAL_HASH) must agree on:
//   - simulation outcome (positions / velocities / arbiter counts)
//   - AABB queries (bodiesInAABB, shapesInAABB)
//   - point queries (bodiesUnderPoint, shapesUnderPoint)
//   - ray queries (rayCast, rayMultiCast)
//   - convex sweeps (convexCast, convexMultiCast)
//
// Each test runs the same canned scenario under all three broadphases and
// compares the results. Differences indicate either a real divergence bug or
// a missing test scenario for whichever implementation lags.
// ---------------------------------------------------------------------------

const BROADPHASES = [
  { name: "DYNAMIC_AABB_TREE", bp: Broadphase.DYNAMIC_AABB_TREE },
  { name: "SWEEP_AND_PRUNE", bp: Broadphase.SWEEP_AND_PRUNE },
  { name: "SPATIAL_HASH", bp: Broadphase.SPATIAL_HASH },
];

/** Linear-congruential RNG for reproducible scenes. */
function rng(seed: number): () => number {
  let s = seed | 0;
  return () => {
    s = (s * 1664525 + 1013904223) | 0;
    return ((s >>> 0) % 1_000_000) / 1_000_000;
  };
}

interface SceneConfig {
  /** Number of dynamic bodies. */
  dynCount: number;
  /** Number of static bodies (always size 30 boxes). */
  staticCount: number;
  /** World bounds for placement. */
  width: number;
  height: number;
  /** Seed for the placement RNG. */
  seed: number;
  /** Mix of polygon vs circle shapes among dynamic bodies. */
  polygonRatio?: number;
  /** Initial velocity magnitude (uniform direction). */
  velocity?: number;
}

/**
 * Build a deterministic scene under the given broadphase. Call sites pass
 * the same `cfg` to every broadphase; the resulting scenes must produce
 * identical simulation results when stepped.
 */
function buildScene(bp: Broadphase, cfg: SceneConfig): Space {
  const space = new Space(new Vec2(0, 200), bp);
  space.deterministic = true; // soft determinism — required for parity
  const r = rng(cfg.seed);
  const polyRatio = cfg.polygonRatio ?? 0.5;
  const vMag = cfg.velocity ?? 0;

  // Static obstacles — fixed-size boxes scattered evenly.
  for (let i = 0; i < cfg.staticCount; i++) {
    const x = r() * cfg.width;
    const y = r() * cfg.height;
    const body = new Body(BodyType.STATIC, new Vec2(x, y));
    body.shapes.add(new Polygon(Polygon.box(30, 30), new Material(0.1, 0.5, 0.7, 1)));
    body.space = space;
  }

  // Dynamic bodies — mixed circles + small polygons.
  for (let i = 0; i < cfg.dynCount; i++) {
    const x = r() * cfg.width;
    const y = r() * cfg.height;
    const body = new Body(BodyType.DYNAMIC, new Vec2(x, y));
    if (r() < polyRatio) {
      const w = 6 + r() * 10;
      const h = 6 + r() * 10;
      body.shapes.add(new Polygon(Polygon.box(w, h), new Material(0.05, 0.5, 0.7, 1)));
    } else {
      const radius = 4 + r() * 8;
      body.shapes.add(new Circle(radius, undefined, new Material(0.05, 0.5, 0.7, 1)));
    }
    if (vMag > 0) {
      const ang = r() * Math.PI * 2;
      body.velocity = new Vec2(Math.cos(ang) * vMag, Math.sin(ang) * vMag);
    }
    body.space = space;
  }

  return space;
}

/** Run `n` simulation steps and return per-body (x, y, angle) snapshot. */
function runAndSnapshot(space: Space, steps: number): Array<[number, number, number]> {
  for (let i = 0; i < steps; i++) space.step(1 / 60);
  const out: Array<[number, number, number]> = [];
  for (let i = 0; i < space.bodies.length; i++) {
    const b = space.bodies.at(i);
    out.push([b.position.x, b.position.y, b.rotation]);
  }
  return out;
}

/**
 * Count the active arbiters in `space.arbiters`.
 *
 * `space.arbiters` is typed as `ArbiterList` (which has `.length`), but the
 * runtime returns a `ZPP_SpaceArbiterList` directly — that class only
 * exposes `zpp_gl()` for the live-scanned count. Iterating over it via a
 * normal `.length` returns `undefined`. This shim normalises the access
 * path for the parity tests; once the public list is fixed, calls to this
 * function can be replaced with `arbiterCount(space)`.
 */
function arbiterCount(space: Space): number {
  return (space.arbiters as unknown as { zpp_gl(): number }).zpp_gl();
}

// ---------------------------------------------------------------------------
// Static query helper — set up the same scene under each broadphase and
// return the three-element tuple of query results (or whatever each test
// computes). Lets every parity test stay tight.
// ---------------------------------------------------------------------------

function forEachBroadphase<T>(fn: (space: Space, name: string) => T): T[] {
  return BROADPHASES.map(({ bp, name }) => {
    const space = new Space(new Vec2(0, 0), bp);
    space.deterministic = true;
    return fn(space, name);
  });
}

/** Build a populated scene for query tests. */
function querySceneFactory(): (space: Space) => void {
  // Layout (static):
  //   - 5 boxes at well-known positions
  //   - 3 circles at well-known positions
  // Each body gets a stable per-scene index in `userData._idx` so query
  // results can be compared across freshly-built spaces (where the global
  // body id counter would otherwise differ).
  return (space) => {
    const boxes = [
      { x: 50, y: 50, w: 30, h: 30 },
      { x: 200, y: 50, w: 30, h: 30 },
      { x: 50, y: 200, w: 30, h: 30 },
      { x: 200, y: 200, w: 30, h: 30 },
      { x: 350, y: 350, w: 50, h: 50 },
    ];
    const circles = [
      { x: 125, y: 125, r: 20 },
      { x: 275, y: 125, r: 15 },
      { x: 125, y: 275, r: 25 },
    ];
    let idx = 0;
    for (const c of boxes) {
      const b = new Body(BodyType.STATIC, new Vec2(c.x, c.y));
      b.shapes.add(new Polygon(Polygon.box(c.w, c.h)));
      b.userData._idx = idx++;
      b.space = space;
    }
    for (const c of circles) {
      const b = new Body(BodyType.STATIC, new Vec2(c.x, c.y));
      b.shapes.add(new Circle(c.r));
      b.userData._idx = idx++;
      b.space = space;
    }
  };
}

/** Extract sorted per-scene indices from a body list. */
function sceneIndices(list: {
  length: number;
  at(i: number): { userData: { _idx?: number } };
}): number[] {
  const ix: number[] = [];
  for (let i = 0; i < list.length; i++) {
    const v = list.at(i).userData._idx;
    if (typeof v === "number") ix.push(v);
  }
  ix.sort((a, b) => a - b);
  return ix;
}

/** Same, but for a shape list — pulls the index off the shape's body. */
function sceneShapeIndices(list: {
  length: number;
  at(i: number): { body: { userData: { _idx?: number } } };
}): number[] {
  const ix: number[] = [];
  for (let i = 0; i < list.length; i++) {
    const v = list.at(i).body.userData._idx;
    if (typeof v === "number") ix.push(v);
  }
  ix.sort((a, b) => a - b);
  return ix;
}

// ---------------------------------------------------------------------------
// Simulation parity
// ---------------------------------------------------------------------------

describe("Broadphase parity — simulation outcome", () => {
  it("identical body positions after 60 steps across all 3 broadphases", () => {
    const cfg: SceneConfig = {
      dynCount: 30,
      staticCount: 4,
      width: 400,
      height: 300,
      seed: 1234,
      polygonRatio: 0.5,
    };
    const snapshots = BROADPHASES.map(({ bp }) => runAndSnapshot(buildScene(bp, cfg), 60));
    // Every broadphase must produce the same body count.
    expect(snapshots[0].length).toBe(snapshots[1].length);
    expect(snapshots[1].length).toBe(snapshots[2].length);
    // And, with deterministic mode on, the same positions to high precision.
    for (let i = 0; i < snapshots[0].length; i++) {
      for (let bp = 1; bp < 3; bp++) {
        expect(snapshots[bp][i][0]).toBeCloseTo(snapshots[0][i][0], 3);
        expect(snapshots[bp][i][1]).toBeCloseTo(snapshots[0][i][1], 3);
        expect(snapshots[bp][i][2]).toBeCloseTo(snapshots[0][i][2], 3);
      }
    }
  });

  it("identical arbiter count after 30 steps in a colliding-bodies scene", () => {
    const cfg: SceneConfig = {
      dynCount: 40,
      staticCount: 0,
      width: 200,
      height: 200,
      seed: 99,
      polygonRatio: 0.3,
    };
    const arbCounts = BROADPHASES.map(({ bp }) => {
      const space = buildScene(bp, cfg);
      for (let i = 0; i < 30; i++) space.step(1 / 60);
      return arbiterCount(space);
    });
    expect(arbCounts[0]).toBe(arbCounts[1]);
    expect(arbCounts[1]).toBe(arbCounts[2]);
    // Sanity: the scene must actually produce some arbiters, otherwise the
    // test is vacuous.
    expect(arbCounts[0]).toBeGreaterThan(0);
  });

  it("empty space steps without errors on every broadphase", () => {
    for (const { bp, name } of BROADPHASES) {
      const space = new Space(new Vec2(0, 0), bp);
      expect(() => {
        for (let i = 0; i < 5; i++) space.step(1 / 60);
      }, `broadphase ${name}`).not.toThrow();
      expect(space.bodies.length).toBe(0);
      expect(arbiterCount(space)).toBe(0);
    }
  });

  it("single-body scene falls under gravity identically across broadphases", () => {
    const finalY = BROADPHASES.map(({ bp }) => {
      const space = new Space(new Vec2(0, 500), bp);
      space.deterministic = true;
      const ball = new Body(BodyType.DYNAMIC, new Vec2(0, 0));
      ball.shapes.add(new Circle(8));
      ball.space = space;
      for (let i = 0; i < 60; i++) space.step(1 / 60);
      return ball.position.y;
    });
    expect(finalY[0]).toBeCloseTo(finalY[1], 3);
    expect(finalY[1]).toBeCloseTo(finalY[2], 3);
    // ½ * 500 * 1² = 250
    expect(finalY[0]).toBeGreaterThan(200);
    expect(finalY[0]).toBeLessThan(280);
  });

  it("all-static scene produces no arbiters and stable state across broadphases", () => {
    for (const { bp, name } of BROADPHASES) {
      const space = new Space(new Vec2(0, 500), bp);
      // 4 static boxes that overlap at the origin — static-static arbiters
      // are not generated, so this should be a no-op for the solver.
      for (let i = 0; i < 4; i++) {
        const b = new Body(BodyType.STATIC, new Vec2(i * 5, 0));
        b.shapes.add(new Polygon(Polygon.box(20, 20)));
        b.space = space;
      }
      for (let i = 0; i < 30; i++) space.step(1 / 60);
      expect(arbiterCount(space), `broadphase ${name}`).toBe(0);
    }
  });

  it("teleporting a body still produces correct collisions on every broadphase", () => {
    // This stresses the AABB-update path on each broadphase.
    for (const { bp, name } of BROADPHASES) {
      const space = new Space(new Vec2(0, 0), bp);
      const ball = new Body(BodyType.DYNAMIC, new Vec2(0, 0));
      ball.shapes.add(new Circle(10));
      ball.space = space;
      const wall = new Body(BodyType.STATIC, new Vec2(500, 0));
      wall.shapes.add(new Polygon(Polygon.box(20, 200)));
      wall.space = space;
      space.step(1 / 60);
      expect(arbiterCount(space), `before teleport / ${name}`).toBe(0);
      // Teleport ball next to the wall.
      ball.position = new Vec2(485, 0);
      space.step(1 / 60);
      expect(arbiterCount(space), `after teleport / ${name}`).toBeGreaterThan(0);
    }
  });
});

// ---------------------------------------------------------------------------
// AABB query parity
// ---------------------------------------------------------------------------

describe("Broadphase parity — bodiesInAABB / shapesInAABB", () => {
  it("non-strict overlap query returns the same body set across broadphases", () => {
    const populate = querySceneFactory();
    const aabb = new AABB(0, 0, 250, 250);
    const idSets = forEachBroadphase((space) => {
      populate(space);
      return sceneIndices(space.bodiesInAABB(aabb, false, false));
    });
    expect(idSets[1]).toEqual(idSets[0]);
    expect(idSets[2]).toEqual(idSets[0]);
    expect(idSets[0].length).toBeGreaterThan(0);
  });

  it("strict (exact-shape) overlap returns the same body set", () => {
    // Strict mode tests the actual shape geometry; circles partly outside
    // the AABB should be excluded depending on the half they lie in.
    const populate = querySceneFactory();
    const aabb = new AABB(100, 100, 50, 50); // intersects circle at (125, 125)
    const idSets = forEachBroadphase((space) => {
      populate(space);
      return sceneIndices(space.bodiesInAABB(aabb, false, true));
    });
    expect(idSets[1]).toEqual(idSets[0]);
    expect(idSets[2]).toEqual(idSets[0]);
  });

  it("containment mode returns only fully-inside bodies, identically", () => {
    const populate = querySceneFactory();
    // Big box that fully contains the (50,50,30,30) box but only partly the
    // circle at (125, 125) with radius 20.
    const aabb = new AABB(20, 20, 80, 80);
    const idSets = forEachBroadphase((space) => {
      populate(space);
      return sceneIndices(space.bodiesInAABB(aabb, true, true));
    });
    expect(idSets[1]).toEqual(idSets[0]);
    expect(idSets[2]).toEqual(idSets[0]);
  });

  it("filter exclusion is honoured by every broadphase", () => {
    const populate = querySceneFactory();
    // Filter that matches nothing — every shape uses default group=1, so
    // a filter with collisionMask=0 (matches no group) returns empty.
    const filter = new InteractionFilter(1, 0);
    const counts = forEachBroadphase((space) => {
      populate(space);
      return space.bodiesInAABB(new AABB(0, 0, 1000, 1000), false, false, filter).length;
    });
    expect(counts).toEqual([0, 0, 0]);
  });

  it("shapesInAABB result identical across broadphases", () => {
    const populate = querySceneFactory();
    const aabb = new AABB(0, 0, 250, 250);
    const idSets = forEachBroadphase((space) => {
      populate(space);
      return sceneShapeIndices(space.shapesInAABB(aabb, false, false));
    });
    expect(idSets[1]).toEqual(idSets[0]);
    expect(idSets[2]).toEqual(idSets[0]);
  });

  it("empty AABB region returns empty list across broadphases", () => {
    const populate = querySceneFactory();
    // Far-away box with no scene objects.
    const aabb = new AABB(10000, 10000, 50, 50);
    const counts = forEachBroadphase((space) => {
      populate(space);
      return space.bodiesInAABB(aabb).length;
    });
    expect(counts).toEqual([0, 0, 0]);
  });

  it("after a body moves, query reflects new position on every broadphase", () => {
    // Tests the AABB-update path on each broadphase implementation.
    forEachBroadphase((space, name) => {
      const ball = new Body(BodyType.DYNAMIC, new Vec2(0, 0));
      ball.shapes.add(new Circle(10));
      ball.space = space;
      space.step(1 / 60);
      // Initially at origin, should be in (-50..50, -50..50) AABB.
      expect(space.bodiesInAABB(new AABB(-50, -50, 100, 100)).length, `before / ${name}`).toBe(1);
      // Move ball far away.
      ball.position = new Vec2(500, 0);
      space.step(1 / 60);
      // Now should NOT be in the original AABB.
      expect(space.bodiesInAABB(new AABB(-50, -50, 100, 100)).length, `after move / ${name}`).toBe(
        0,
      );
      expect(space.bodiesInAABB(new AABB(450, -50, 100, 100)).length, `at new pos / ${name}`).toBe(
        1,
      );
    });
  });
});

// ---------------------------------------------------------------------------
// Point query parity
// ---------------------------------------------------------------------------

describe("Broadphase parity — bodiesUnderPoint / shapesUnderPoint", () => {
  it("point inside a static box is found by every broadphase", () => {
    const populate = querySceneFactory();
    const idSets = forEachBroadphase((space) => {
      populate(space);
      return sceneIndices(space.bodiesUnderPoint(new Vec2(50, 50)));
    });
    expect(idSets[1]).toEqual(idSets[0]);
    expect(idSets[2]).toEqual(idSets[0]);
    expect(idSets[0].length).toBe(1);
    expect(idSets[0][0]).toBe(0); // first inserted = box at (50, 50)
  });

  it("point inside a static circle is found by every broadphase", () => {
    const populate = querySceneFactory();
    const idSets = forEachBroadphase((space) => {
      populate(space);
      return sceneIndices(space.bodiesUnderPoint(new Vec2(125, 125)));
    });
    expect(idSets[1]).toEqual(idSets[0]);
    expect(idSets[2]).toEqual(idSets[0]);
    expect(idSets[0].length).toBe(1);
    expect(idSets[0][0]).toBe(5); // first circle = scene idx 5
  });

  it("point outside any shape returns empty across broadphases", () => {
    const populate = querySceneFactory();
    const counts = forEachBroadphase((space) => {
      populate(space);
      return space.bodiesUnderPoint(new Vec2(800, 800)).length;
    });
    expect(counts).toEqual([0, 0, 0]);
  });

  it("point on AABB boundary: behaviour is consistent across broadphases", () => {
    const populate = querySceneFactory();
    // The (50, 50) box has half-extent 15, so its AABB is (35..65, 35..65).
    // Point (35, 50) is on the left edge.
    const counts = forEachBroadphase((space) => {
      populate(space);
      return space.bodiesUnderPoint(new Vec2(35, 50)).length;
    });
    // Whatever the answer (engine-specific), all broadphases must agree.
    expect(counts[1]).toBe(counts[0]);
    expect(counts[2]).toBe(counts[0]);
  });

  it("shapesUnderPoint matches across broadphases", () => {
    const populate = querySceneFactory();
    const idSets = forEachBroadphase((space) => {
      populate(space);
      return sceneShapeIndices(space.shapesUnderPoint(new Vec2(125, 125)));
    });
    expect(idSets[1]).toEqual(idSets[0]);
    expect(idSets[2]).toEqual(idSets[0]);
  });
});

// ---------------------------------------------------------------------------
// Ray casting parity
// ---------------------------------------------------------------------------

describe("Broadphase parity — rayCast / rayMultiCast", () => {
  it("rayCast returns the same closest hit and distance across broadphases", () => {
    const populate = querySceneFactory();
    // Horizontal ray from (-100, 50) → (+x), should hit the box at (50, 50).
    const ray = new Ray(new Vec2(-100, 50), new Vec2(1, 0));
    const results = forEachBroadphase((space) => {
      populate(space);
      const r = space.rayCast(ray);
      return r ? { idx: r.shape.body.userData._idx as number, d: r.distance } : null;
    });
    expect(results[0]).not.toBeNull();
    expect(results[1]?.idx).toBe(results[0]?.idx);
    expect(results[2]?.idx).toBe(results[0]?.idx);
    // Distance must match within FP precision.
    expect(results[1]?.d).toBeCloseTo(results[0]?.d ?? 0, 6);
    expect(results[2]?.d).toBeCloseTo(results[0]?.d ?? 0, 6);
  });

  it("rayCast returns null on every broadphase when nothing is in the way", () => {
    const populate = querySceneFactory();
    // Ray fired far below all geometry.
    const ray = new Ray(new Vec2(-100, 9999), new Vec2(1, 0));
    const results = forEachBroadphase((space) => {
      populate(space);
      return space.rayCast(ray);
    });
    expect(results).toEqual([null, null, null]);
  });

  it("rayMultiCast returns the same set of hits across broadphases", () => {
    const populate = querySceneFactory();
    // Diagonal ray from origin pointing into the cluster.
    const ray = new Ray(new Vec2(-50, -50), new Vec2(1, 1));
    const idSets = forEachBroadphase((space) => {
      populate(space);
      const list = space.rayMultiCast(ray);
      const ids: number[] = [];
      for (let i = 0; i < list.length; i++) {
        const v = list.at(i).shape.body.userData._idx;
        if (typeof v === "number") ids.push(v);
      }
      ids.sort((a, b) => a - b);
      return ids;
    });
    expect(idSets[1]).toEqual(idSets[0]);
    expect(idSets[2]).toEqual(idSets[0]);
    expect(idSets[0].length).toBeGreaterThan(0);
  });

  it("rayCast through a polygon yields identical surface normal", () => {
    const populate = querySceneFactory();
    // Hit the box at (200, 50) head-on.
    const ray = new Ray(new Vec2(0, 50), new Vec2(1, 0));
    const normals = forEachBroadphase((space) => {
      populate(space);
      const r = space.rayCast(ray);
      return r ? [r.normal.x, r.normal.y] : null;
    });
    expect(normals[0]).not.toBeNull();
    expect(normals[1]?.[0]).toBeCloseTo(normals[0]?.[0] ?? 0, 6);
    expect(normals[1]?.[1]).toBeCloseTo(normals[0]?.[1] ?? 0, 6);
    expect(normals[2]?.[0]).toBeCloseTo(normals[0]?.[0] ?? 0, 6);
    expect(normals[2]?.[1]).toBeCloseTo(normals[0]?.[1] ?? 0, 6);
  });

  it("filtered ray returns nothing if filter excludes all", () => {
    const populate = querySceneFactory();
    const ray = new Ray(new Vec2(-100, 50), new Vec2(1, 0));
    const filter = new InteractionFilter(1, 0); // matches no group
    const results = forEachBroadphase((space) => {
      populate(space);
      return space.rayCast(ray, false, filter);
    });
    expect(results).toEqual([null, null, null]);
  });
});

// ---------------------------------------------------------------------------
// Convex sweep parity (covers ZPP_SweepDistance which has 642 uncov lines)
// ---------------------------------------------------------------------------

describe("Broadphase parity — convexCast / convexMultiCast", () => {
  it("circle swept toward a wall hits identically on all broadphases", () => {
    const tois = forEachBroadphase((space) => {
      // Wall at x=100, ball at x=0 moving +x at 200 units/s.
      const wall = new Body(BodyType.STATIC, new Vec2(100, 0));
      wall.shapes.add(new Polygon(Polygon.box(20, 200)));
      wall.space = space;
      const ball = new Body(BodyType.DYNAMIC, new Vec2(0, 0));
      const ballShape = new Circle(10);
      ball.shapes.add(ballShape);
      ball.velocity = new Vec2(200, 0);
      ball.space = space;
      const r = space.convexCast(ballShape, 1.0);
      return r ? r.toi : null;
    });
    expect(tois[0]).not.toBeNull();
    expect(tois[1]).toBeCloseTo(tois[0] ?? 0, 5);
    expect(tois[2]).toBeCloseTo(tois[0] ?? 0, 5);
    // Manual TOI: wall is Polygon.box(20, 200) — half-width 10, left edge at
    // x=90. Ball edge at ball.center + radius. Contact when ball.center = 80.
    // With v=200, t = 80/200 = 0.4.
    expect(tois[0]).toBeCloseTo(0.4, 2);
  });

  it("polygon swept past a circle (miss) returns null on all broadphases", () => {
    const results = forEachBroadphase((space) => {
      const circle = new Body(BodyType.STATIC, new Vec2(0, 100));
      circle.shapes.add(new Circle(10));
      circle.space = space;
      const swept = new Body(BodyType.DYNAMIC, new Vec2(-100, 0));
      const sweptShape = new Polygon(Polygon.box(10, 10));
      swept.shapes.add(sweptShape);
      swept.velocity = new Vec2(200, 0); // moves along y=0, never hits y=100 circle
      swept.space = space;
      return space.convexCast(sweptShape, 1.0);
    });
    expect(results).toEqual([null, null, null]);
  });

  it("convexMultiCast returns the same ordered hits across broadphases", () => {
    // Sweep through a row of three statics; expect three hits in identical
    // order (ascending toi).
    const sets = forEachBroadphase((space) => {
      for (let i = 0; i < 3; i++) {
        const w = new Body(BodyType.STATIC, new Vec2(100 + i * 60, 0));
        w.shapes.add(new Polygon(Polygon.box(20, 60)));
        w.userData._idx = i;
        w.space = space;
      }
      const swept = new Body(BodyType.DYNAMIC, new Vec2(0, 0));
      const ss = new Circle(8);
      swept.shapes.add(ss);
      swept.velocity = new Vec2(400, 0);
      swept.space = space;
      const list = space.convexMultiCast(ss, 1.0);
      const out: Array<{ idx: number; toi: number }> = [];
      for (let i = 0; i < list.length; i++) {
        const r = list.at(i);
        out.push({ idx: r.shape.body.userData._idx as number, toi: r.toi });
      }
      out.sort((a, b) => a.toi - b.toi);
      return out;
    });
    expect(sets[0].length).toBe(3);
    expect(sets[1].length).toBe(3);
    expect(sets[2].length).toBe(3);
    for (let i = 0; i < 3; i++) {
      expect(sets[1][i].idx).toBe(sets[0][i].idx);
      expect(sets[2][i].idx).toBe(sets[0][i].idx);
      expect(sets[1][i].toi).toBeCloseTo(sets[0][i].toi, 5);
      expect(sets[2][i].toi).toBeCloseTo(sets[0][i].toi, 5);
    }
  });

  it("convexCast respects filter exclusion across broadphases", () => {
    const filter = new InteractionFilter(1, 0);
    const results = forEachBroadphase((space) => {
      const wall = new Body(BodyType.STATIC, new Vec2(100, 0));
      wall.shapes.add(new Polygon(Polygon.box(20, 200)));
      wall.space = space;
      const ball = new Body(BodyType.DYNAMIC, new Vec2(0, 0));
      const ballShape = new Circle(10);
      ball.shapes.add(ballShape);
      ball.velocity = new Vec2(200, 0);
      ball.space = space;
      return space.convexCast(ballShape, 1.0, false, filter);
    });
    expect(results).toEqual([null, null, null]);
  });

  it("convexCast with deltaTime=0 returns null (no movement, no hit)", () => {
    const results = forEachBroadphase((space) => {
      const wall = new Body(BodyType.STATIC, new Vec2(100, 0));
      wall.shapes.add(new Polygon(Polygon.box(20, 200)));
      wall.space = space;
      const ball = new Body(BodyType.DYNAMIC, new Vec2(0, 0));
      const ballShape = new Circle(10);
      ball.shapes.add(ballShape);
      ball.velocity = new Vec2(200, 0);
      ball.space = space;
      return space.convexCast(ballShape, 0);
    });
    // All three broadphases agree (whatever the answer — could be a hit if
    // already overlapping, or null if not). Just check parity.
    const allSame =
      (results[0] == null && results[1] == null && results[2] == null) ||
      (results[0] != null && results[1] != null && results[2] != null);
    expect(allSame).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Stress + extreme-size parity
// ---------------------------------------------------------------------------

describe("Broadphase parity — stress + extreme sizes", () => {
  it("200-body stress scene reaches the same arbiter count on every broadphase", () => {
    const counts = BROADPHASES.map(({ bp }) => {
      const space = buildScene(bp, {
        dynCount: 200,
        staticCount: 8,
        width: 600,
        height: 400,
        seed: 7777,
        polygonRatio: 0.5,
        velocity: 60,
      });
      for (let i = 0; i < 30; i++) space.step(1 / 60);
      return arbiterCount(space);
    });
    expect(counts[1]).toBe(counts[0]);
    expect(counts[2]).toBe(counts[0]);
    expect(counts[0]).toBeGreaterThan(0);
  });

  it("mix of tiny + huge bodies handled identically (worst case for SPATIAL_HASH)", () => {
    const counts = BROADPHASES.map(({ bp }) => {
      const space = new Space(new Vec2(0, 0), bp);
      space.deterministic = true;
      // One huge box covering most of the world.
      const huge = new Body(BodyType.STATIC, new Vec2(0, 0));
      huge.shapes.add(new Polygon(Polygon.box(2000, 2000)));
      huge.space = space;
      // 20 tiny circles — well inside the huge box.
      for (let i = 0; i < 20; i++) {
        const b = new Body(BodyType.DYNAMIC, new Vec2(i * 10 - 100, 0));
        b.shapes.add(new Circle(2));
        b.space = space;
      }
      for (let i = 0; i < 5; i++) space.step(1 / 60);
      return arbiterCount(space);
    });
    expect(counts[1]).toBe(counts[0]);
    expect(counts[2]).toBe(counts[0]);
  });

  it("rapid body removal between steps stays consistent across broadphases", () => {
    const counts = BROADPHASES.map(({ bp }) => {
      const space = buildScene(bp, {
        dynCount: 50,
        staticCount: 0,
        width: 200,
        height: 200,
        seed: 4242,
      });
      // After 10 steps, remove every other dynamic body.
      for (let i = 0; i < 10; i++) space.step(1 / 60);
      const toRemove: Body[] = [];
      for (let i = 0; i < space.bodies.length; i++) {
        if (i % 2 === 0) toRemove.push(space.bodies.at(i));
      }
      for (const b of toRemove) b.space = null;
      for (let i = 0; i < 20; i++) space.step(1 / 60);
      return space.bodies.length;
    });
    expect(counts[1]).toBe(counts[0]);
    expect(counts[2]).toBe(counts[0]);
  });

  it("queries against a 200-body scene return the same body count on every broadphase", () => {
    const counts = BROADPHASES.map(({ bp }) => {
      const space = buildScene(bp, {
        dynCount: 200,
        staticCount: 0,
        width: 600,
        height: 400,
        seed: 8888,
      });
      // No stepping — query the initial layout.
      return space.bodiesInAABB(new AABB(0, 0, 600, 400)).length;
    });
    expect(counts[0]).toBe(200);
    expect(counts[1]).toBe(200);
    expect(counts[2]).toBe(200);
  });
});
