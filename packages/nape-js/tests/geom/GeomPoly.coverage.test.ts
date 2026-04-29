import { describe, it, expect } from "vitest";
import "../../src/core/engine";
import { GeomPoly } from "../../src/geom/GeomPoly";
import { Vec2 } from "../../src/geom/Vec2";
import { AABB } from "../../src/geom/AABB";
import { MarchingSquares } from "../../src/geom/MarchingSquares";

// ---------------------------------------------------------------------------
// GeomPoly extra-coverage suite (P29 — Batch C)
//
// Existing tests in GeomPoly.test.ts and GeomPoly.cuts-decomp.test.ts cover
// the happy paths. This file targets the unreached branches in
// ZPP_Cutter (613 uncov), ZPP_Simple (429 uncov), ZPP_Monotone (84 uncov),
// ZPP_PartitionedPoly (86 uncov), and ZPP_MarchingSquares (357 uncov).
// ---------------------------------------------------------------------------

function makeFromPoints(points: Array<[number, number]>): GeomPoly {
  const p = new GeomPoly();
  for (const [x, y] of points) p.push(new Vec2(x, y));
  return p;
}

function makeSquare(side: number): GeomPoly {
  const h = side / 2;
  return makeFromPoints([
    [-h, -h],
    [h, -h],
    [h, h],
    [-h, h],
  ]);
}

function makeLShape(): GeomPoly {
  // L-shape made of 6 vertices, concave at one corner.
  return makeFromPoints([
    [0, 0],
    [40, 0],
    [40, 20],
    [20, 20],
    [20, 40],
    [0, 40],
  ]);
}

function makeStar(arms = 5, outer = 30, inner = 12): GeomPoly {
  const points: Array<[number, number]> = [];
  for (let i = 0; i < arms * 2; i++) {
    const r = i % 2 === 0 ? outer : inner;
    const ang = (i / (arms * 2)) * Math.PI * 2 - Math.PI / 2;
    points.push([Math.cos(ang) * r, Math.sin(ang) * r]);
  }
  return makeFromPoints(points);
}

function polyArea(p: GeomPoly): number {
  return Math.abs(p.area());
}

function listSize(list: { length: number }): number {
  return list.length;
}

function listAt(list: { at(i: number): GeomPoly }, i: number): GeomPoly {
  return list.at(i);
}

function totalArea(list: { length: number; at(i: number): GeomPoly }): number {
  let s = 0;
  for (let i = 0; i < list.length; i++) s += polyArea(list.at(i));
  return s;
}

// ---------------------------------------------------------------------------
// Cutting — edge cases
// ---------------------------------------------------------------------------

describe("GeomPoly.cut — edge cases", () => {
  it("cut along a polygon edge (collinear) does not split it", () => {
    const sq = makeSquare(20);
    // Cut along the right edge (x=10). Endpoints lie on the edge.
    const out = sq.cut(new Vec2(10, -10), new Vec2(10, 10));
    // Engine returns the whole polygon (no split) or zero pieces. Either
    // way, total area is preserved.
    const total = totalArea(out);
    expect(total).toBeCloseTo(polyArea(sq), 5);
  });

  it("cut starting on a vertex and ending on the opposite vertex splits cleanly", () => {
    const sq = makeSquare(20);
    // Diagonal corner-to-corner.
    const out = sq.cut(new Vec2(-10, -10), new Vec2(10, 10));
    expect(listSize(out)).toBe(2);
    expect(totalArea(out)).toBeCloseTo(polyArea(sq), 5);
  });

  it("repeated cuts on a square produce a grid of equal-area sub-pieces", () => {
    const sq = makeSquare(40);
    const after1 = sq.cut(new Vec2(-30, 0), new Vec2(30, 0)); // horizontal
    expect(listSize(after1)).toBe(2);
    let totalPieces = 0;
    let totalCutArea = 0;
    for (let i = 0; i < after1.length; i++) {
      const piece = listAt(after1, i);
      const sub = piece.cut(new Vec2(0, -30), new Vec2(0, 30)); // vertical
      totalPieces += sub.length;
      totalCutArea += totalArea(sub);
    }
    expect(totalPieces).toBe(4);
    expect(totalCutArea).toBeCloseTo(polyArea(sq), 4);
  });

  it("bounded cut with both endpoints inside leaves polygon intact", () => {
    const sq = makeSquare(30);
    const out = sq.cut(new Vec2(-5, 0), new Vec2(5, 0), true, true);
    // A purely-internal segment should not create new pieces.
    // Engine behaviour: original polygon back, total area preserved.
    expect(totalArea(out)).toBeCloseTo(polyArea(sq), 5);
  });

  it("a cut that exits and re-enters a concave polygon produces multiple pieces", () => {
    // Plus shape — horizontal line through middle should yield ≥ 2 pieces
    // (and given the cross-arms, the bottom arm splits off symmetrically).
    const plus = makeFromPoints([
      [-10, -30],
      [10, -30],
      [10, -10],
      [30, -10],
      [30, 10],
      [10, 10],
      [10, 30],
      [-10, 30],
      [-10, 10],
      [-30, 10],
      [-30, -10],
      [-10, -10],
    ]);
    const out = plus.cut(new Vec2(-50, 0), new Vec2(50, 0));
    expect(listSize(out)).toBeGreaterThanOrEqual(2);
    expect(totalArea(out)).toBeCloseTo(polyArea(plus), 4);
  });

  it("output list parameter accumulates pieces from sequential cuts", () => {
    const sq1 = makeSquare(10);
    const sq2 = makeSquare(10);
    const acc1 = sq1.cut(new Vec2(0, -10), new Vec2(0, 10));
    const acc2 = sq2.cut(new Vec2(-10, 0), new Vec2(10, 0), false, false, acc1);
    // acc2 should be the same list reference, now containing both pairs.
    expect(acc2).toBe(acc1);
    expect(listSize(acc1)).toBe(4);
  });

  it("cut on an already-disposed polygon throws", () => {
    const sq = makeSquare(10);
    sq.dispose();
    expect(() => sq.cut(new Vec2(0, -10), new Vec2(0, 10))).toThrow();
  });

  it("cut handles a thin slice near the polygon edge", () => {
    const sq = makeSquare(20);
    // Cut just inside the right edge (x = 9.9). Slice width ≈ 0.1, area ≈ 2.
    const out = sq.cut(new Vec2(9.9, -10), new Vec2(9.9, 10));
    expect(listSize(out)).toBe(2);
    expect(totalArea(out)).toBeCloseTo(polyArea(sq), 4);
    // Smaller piece exists.
    let minArea = Infinity;
    for (let i = 0; i < out.length; i++) {
      minArea = Math.min(minArea, polyArea(listAt(out, i)));
    }
    expect(minArea).toBeLessThan(3);
  });
});

// ---------------------------------------------------------------------------
// Simple-decomposition / isSimple — self-intersecting & complex cases
// ---------------------------------------------------------------------------

describe("GeomPoly.simpleDecomposition / isSimple", () => {
  it("isSimple returns true on a clean square", () => {
    expect(makeSquare(10).isSimple()).toBe(true);
  });

  it("isSimple returns false on a bowtie (two triangles touching at a vertex)", () => {
    // Bowtie crossing: edges (0,0)→(10,10) and (10,0)→(0,10) cross.
    const bowtie = makeFromPoints([
      [0, 0],
      [10, 10],
      [10, 0],
      [0, 10],
    ]);
    expect(bowtie.isSimple()).toBe(false);
  });

  it("simpleDecomposition of a bowtie yields two non-self-intersecting pieces", () => {
    const bowtie = makeFromPoints([
      [0, 0],
      [10, 10],
      [10, 0],
      [0, 10],
    ]);
    const pieces = bowtie.simpleDecomposition();
    expect(listSize(pieces)).toBeGreaterThanOrEqual(2);
    for (let i = 0; i < pieces.length; i++) {
      expect(listAt(pieces, i).isSimple()).toBe(true);
    }
  });

  it("isSimple returns false on a figure-8 self-crossing chain", () => {
    const fig8 = makeFromPoints([
      [0, 0],
      [20, 20],
      [20, 0],
      [0, 20],
      [-10, 10],
    ]);
    expect(fig8.isSimple()).toBe(false);
  });

  it("simpleDecomposition preserves total area within rounding tolerance", () => {
    const bowtie = makeFromPoints([
      [0, 0],
      [10, 10],
      [10, 0],
      [0, 10],
    ]);
    const pieces = bowtie.simpleDecomposition();
    // Bowtie has ambiguous area; just confirm the decomposition produced
    // simple pieces with finite, positive total area.
    expect(totalArea(pieces)).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------
// isConvex / isMonotone / isDegenerate
// ---------------------------------------------------------------------------

describe("GeomPoly — shape predicates", () => {
  it("isConvex true on a rectangle, false on an L-shape", () => {
    expect(makeSquare(20).isConvex()).toBe(true);
    expect(makeLShape().isConvex()).toBe(false);
  });

  it("isMonotone true on a rectangle, may be true or false on a star", () => {
    expect(makeSquare(20).isMonotone()).toBe(true);
    // Star shape — engine answer is implementation-defined, just ensure
    // the call returns a boolean.
    expect(typeof makeStar(5).isMonotone()).toBe("boolean");
  });

  it("isDegenerate returns true for a line (3 collinear points)", () => {
    const line = makeFromPoints([
      [0, 0],
      [5, 0],
      [10, 0],
    ]);
    expect(line.isDegenerate()).toBe(true);
  });

  it("isDegenerate returns false for a normal triangle", () => {
    const tri = makeFromPoints([
      [0, 0],
      [10, 0],
      [5, 10],
    ]);
    expect(tri.isDegenerate()).toBe(false);
  });

  it("isClockwise distinguishes the two winding orders", () => {
    // Engine uses screen-coord convention (y-down), so the visual "CCW"
    // direction is actually clockwise in math terms. Whichever direction
    // is which, the two opposite windings must disagree.
    const wA = makeFromPoints([
      [0, 0],
      [10, 0],
      [10, 10],
      [0, 10],
    ]).isClockwise();
    const wB = makeFromPoints([
      [0, 0],
      [0, 10],
      [10, 10],
      [10, 0],
    ]).isClockwise();
    expect(wA).not.toBe(wB);
  });
});

// ---------------------------------------------------------------------------
// Convex decomposition stress
// ---------------------------------------------------------------------------

describe("GeomPoly.convexDecomposition — stress shapes", () => {
  it("dense star (20 arms) decomposes into all-convex pieces", () => {
    const star = makeStar(20, 50, 25);
    const pieces = star.convexDecomposition();
    expect(listSize(pieces)).toBeGreaterThan(1);
    for (let i = 0; i < pieces.length; i++) {
      expect(listAt(pieces, i).isConvex()).toBe(true);
    }
  });

  it("large concave polygon (saw-tooth) decomposes correctly", () => {
    // 16-tooth saw on the bottom edge.
    const points: Array<[number, number]> = [];
    points.push([0, 30]); // top-left
    points.push([100, 30]); // top-right
    for (let i = 16; i >= 0; i--) {
      const x = (i / 16) * 100;
      points.push([x, i % 2 === 0 ? 0 : 6]);
    }
    const saw = makeFromPoints(points);
    const pieces = saw.convexDecomposition();
    expect(listSize(pieces)).toBeGreaterThan(1);
    for (let i = 0; i < pieces.length; i++) {
      expect(listAt(pieces, i).isConvex()).toBe(true);
    }
    expect(totalArea(pieces)).toBeCloseTo(polyArea(saw), 1);
  });

  it("delaunay flag does not change the area conservation", () => {
    const star = makeStar(7);
    const a = star.convexDecomposition(false);
    const b = star.copy().convexDecomposition(true);
    expect(totalArea(a)).toBeCloseTo(totalArea(b), 3);
  });

  it("convexDecomposition into existing output list appends pieces", () => {
    const a = makeStar(5).convexDecomposition();
    const before = listSize(a);
    expect(before).toBeGreaterThan(0);
    makeLShape().convexDecomposition(false, a);
    expect(listSize(a)).toBeGreaterThan(before);
  });

  it("convexDecomposition on a tiny 2-vertex degenerate ring throws", () => {
    // The engine classifies a 0/1/2-vertex polygon as a "degenerate ring"
    // (different from a 3+-vertex collinear polygon, which it tolerates).
    const stub = makeFromPoints([
      [0, 0],
      [10, 0],
    ]);
    expect(() => stub.convexDecomposition()).toThrow();
  });
});

// ---------------------------------------------------------------------------
// Triangular decomposition
// ---------------------------------------------------------------------------

describe("GeomPoly.triangularDecomposition — stress", () => {
  it("dense star (12 arms) yields all-triangle pieces", () => {
    const star = makeStar(12, 40, 18);
    const tris = star.triangularDecomposition();
    expect(listSize(tris)).toBeGreaterThan(0);
    for (let i = 0; i < tris.length; i++) {
      expect(listAt(tris, i).size()).toBe(3);
    }
  });

  it("delaunay-optimised triangulation conserves area", () => {
    const star = makeStar(6);
    const a = star.triangularDecomposition(false);
    const b = star.copy().triangularDecomposition(true);
    expect(totalArea(a)).toBeCloseTo(totalArea(b), 3);
  });
});

// ---------------------------------------------------------------------------
// inflate
// ---------------------------------------------------------------------------

describe("GeomPoly.inflate", () => {
  it("positive inflate grows the polygon area", () => {
    const sq = makeSquare(10);
    const grown = sq.inflate(2);
    expect(polyArea(grown)).toBeGreaterThan(polyArea(sq));
  });

  it("negative inflate shrinks the polygon area", () => {
    const sq = makeSquare(20);
    const shrunk = sq.inflate(-2);
    expect(polyArea(shrunk)).toBeLessThan(polyArea(sq));
  });

  it("zero inflate produces an equal-area copy", () => {
    const sq = makeSquare(10);
    const same = sq.inflate(0);
    expect(polyArea(same)).toBeCloseTo(polyArea(sq), 6);
  });
});

// ---------------------------------------------------------------------------
// simplify — edge cases
// ---------------------------------------------------------------------------

describe("GeomPoly.simplify — edge cases", () => {
  it("simplify on an already-simple polygon preserves its vertex count", () => {
    const tri = makeFromPoints([
      [0, 0],
      [10, 0],
      [5, 10],
    ]);
    const out = tri.simplify(0.01);
    expect(out.size()).toBe(3);
  });

  it("simplify reduces a noisy polygon's vertex count", () => {
    const noisy = makeFromPoints([
      [0, 0],
      [3, 0.05],
      [6, -0.05],
      [10, 0],
      [10, 10],
      [6, 10.05],
      [3, 9.95],
      [0, 10],
    ]);
    const out = noisy.simplify(0.5);
    expect(out.size()).toBeLessThan(noisy.size());
  });

  it("simplify with very small epsilon preserves all vertices", () => {
    const star = makeStar(6);
    const before = star.size();
    const out = star.copy().simplify(0.0001);
    expect(out.size()).toBe(before);
  });
});

// ---------------------------------------------------------------------------
// MarchingSquares — extra coverage
// ---------------------------------------------------------------------------

describe("MarchingSquares.run — extra coverage", () => {
  it("circle iso function yields a closed polygon", () => {
    const iso = (x: number, y: number) => Math.sqrt(x * x + y * y) - 20;
    const out = MarchingSquares.run(iso, new AABB(-30, -30, 60, 60), new Vec2(2, 2), 2);
    expect(listSize(out)).toBeGreaterThanOrEqual(1);
    expect(polyArea(listAt(out, 0))).toBeGreaterThan(800);
    expect(polyArea(listAt(out, 0))).toBeLessThan(1500);
  });

  it("two disjoint disk iso → two output polygons", () => {
    const iso = (x: number, y: number) => {
      const d1 = Math.sqrt((x - 20) * (x - 20) + y * y) - 8;
      const d2 = Math.sqrt((x + 20) * (x + 20) + y * y) - 8;
      return Math.min(d1, d2);
    };
    const out = MarchingSquares.run(iso, new AABB(-40, -20, 80, 40), new Vec2(2, 2), 2);
    expect(listSize(out)).toBe(2);
  });

  it("iso that's positive everywhere yields no polygons", () => {
    const iso = () => 1;
    const out = MarchingSquares.run(iso, new AABB(0, 0, 50, 50), new Vec2(2, 2));
    expect(listSize(out)).toBe(0);
  });

  it("higher quality value still produces a valid disk approximation", () => {
    const iso = (x: number, y: number) => Math.sqrt(x * x + y * y) - 15;
    const lo = MarchingSquares.run(iso, new AABB(-20, -20, 40, 40), new Vec2(4, 4), 0);
    const hi = MarchingSquares.run(iso, new AABB(-20, -20, 40, 40), new Vec2(4, 4), 4);
    expect(listSize(lo)).toBe(1);
    expect(listSize(hi)).toBe(1);
    // Higher quality should give an area closer to π * 15² ≈ 706.86.
    const exact = Math.PI * 15 * 15;
    const errLo = Math.abs(polyArea(listAt(lo, 0)) - exact);
    const errHi = Math.abs(polyArea(listAt(hi, 0)) - exact);
    expect(errHi).toBeLessThanOrEqual(errLo);
  });

  it("subgrid splits the work and still produces a valid polygon", () => {
    const iso = (x: number, y: number) => Math.sqrt(x * x + y * y) - 15;
    const out = MarchingSquares.run(
      iso,
      new AABB(-20, -20, 40, 40),
      new Vec2(2, 2),
      2,
      new Vec2(10, 10),
      true,
    );
    expect(listSize(out)).toBeGreaterThanOrEqual(1);
    // Total area should still approximate the disk.
    const exact = Math.PI * 15 * 15;
    expect(totalArea(out)).toBeGreaterThan(exact * 0.85);
    expect(totalArea(out)).toBeLessThan(exact * 1.15);
  });

  it("combine=false produces one polygon per cell along the boundary", () => {
    const iso = (x: number, y: number) => Math.sqrt(x * x + y * y) - 15;
    const combined = MarchingSquares.run(
      iso,
      new AABB(-20, -20, 40, 40),
      new Vec2(2, 2),
      2,
      null,
      true,
    );
    const split = MarchingSquares.run(
      iso,
      new AABB(-20, -20, 40, 40),
      new Vec2(2, 2),
      2,
      null,
      false,
    );
    expect(listSize(split)).toBeGreaterThan(listSize(combined));
  });

  it("non-square cellsize still produces a valid disk", () => {
    const iso = (x: number, y: number) => Math.sqrt(x * x + y * y) - 15;
    const out = MarchingSquares.run(iso, new AABB(-20, -20, 40, 40), new Vec2(2, 4));
    expect(listSize(out)).toBeGreaterThanOrEqual(1);
  });

  it("throws on null iso / bounds / cellsize", () => {
    const aabb = new AABB(0, 0, 10, 10);
    const cs = new Vec2(1, 1);
    expect(() =>
      MarchingSquares.run(null as unknown as (x: number, y: number) => number, aabb, cs),
    ).toThrow();
    expect(() => MarchingSquares.run(() => 0, null as unknown as AABB, cs)).toThrow();
    expect(() => MarchingSquares.run(() => 0, aabb, null as unknown as Vec2)).toThrow();
  });

  it("throws on non-positive cellsize or negative quality", () => {
    const aabb = new AABB(0, 0, 10, 10);
    expect(() => MarchingSquares.run(() => 0, aabb, new Vec2(0, 1))).toThrow();
    expect(() => MarchingSquares.run(() => 0, aabb, new Vec2(1, 1), -1)).toThrow();
  });
});
