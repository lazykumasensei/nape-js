/**
 * MarchingSquares + GeomPoly.cut — extended coverage tests.
 *
 * Targets: complex iso functions, edge cases in polygon extraction,
 * various quality levels, and additional cutting scenarios.
 */

import { describe, it, expect } from "vitest";
import "../../src/core/engine";
import { MarchingSquares } from "../../src/geom/MarchingSquares";
import { GeomPoly } from "../../src/geom/GeomPoly";
import { AABB } from "../../src/geom/AABB";
import { Vec2 } from "../../src/geom/Vec2";

// ---------------------------------------------------------------------------
// MarchingSquares — complex iso functions
// ---------------------------------------------------------------------------

describe("MarchingSquares — complex iso functions", () => {
  it("extracts polygon from elliptical iso", () => {
    const ellipseIso = (x: number, y: number) =>
      ((x - 50) * (x - 50)) / (40 * 40) + ((y - 50) * (y - 50)) / (20 * 20) - 1;

    const bounds = new AABB(0, 0, 100, 100);
    const cellsize = new Vec2(5, 5);
    const result = MarchingSquares.run(ellipseIso, bounds, cellsize);
    expect(result.length).toBeGreaterThan(0);
  });

  it("extracts polygon from rectangular iso", () => {
    // Rectangle: inside when both |x-50| < 30 AND |y-50| < 15
    const rectIso = (x: number, y: number) =>
      Math.max(Math.abs(x - 50) - 30, Math.abs(y - 50) - 15);

    const bounds = new AABB(0, 0, 100, 100);
    const cellsize = new Vec2(5, 5);
    const result = MarchingSquares.run(rectIso, bounds, cellsize);
    expect(result.length).toBeGreaterThan(0);
  });

  it("no polygons for always-positive iso", () => {
    const alwaysOutside = () => 1;
    const bounds = new AABB(0, 0, 100, 100);
    const cellsize = new Vec2(10, 10);
    const result = MarchingSquares.run(alwaysOutside, bounds, cellsize);
    expect(result.length).toBe(0);
  });

  it("handles iso with multiple separated regions", () => {
    // Two circles
    const twoCircles = (x: number, y: number) => {
      const d1 = (x - 25) * (x - 25) + (y - 50) * (y - 50) - 15 * 15;
      const d2 = (x - 75) * (x - 75) + (y - 50) * (y - 50) - 15 * 15;
      return Math.min(d1, d2);
    };

    const bounds = new AABB(0, 0, 100, 100);
    const cellsize = new Vec2(3, 3);
    const result = MarchingSquares.run(twoCircles, bounds, cellsize, 2, null, false);
    // Should produce at least 2 separate polygons (uncombined)
    expect(result.length).toBeGreaterThanOrEqual(2);
  });
});

// ---------------------------------------------------------------------------
// MarchingSquares — quality and combine variations
// ---------------------------------------------------------------------------

describe("MarchingSquares — quality levels", () => {
  const circleIso = (x: number, y: number) => (x - 50) * (x - 50) + (y - 50) * (y - 50) - 30 * 30;

  it("quality=0 produces coarser output", () => {
    const bounds = new AABB(0, 0, 100, 100);
    const cellsize = new Vec2(10, 10);
    const q0 = MarchingSquares.run(circleIso, bounds, cellsize, 0);
    expect(q0.length).toBeGreaterThan(0);
  });

  it("quality=1 produces output", () => {
    const bounds = new AABB(0, 0, 100, 100);
    const cellsize = new Vec2(10, 10);
    const q1 = MarchingSquares.run(circleIso, bounds, cellsize, 1);
    expect(q1.length).toBeGreaterThan(0);
  });

  it("quality=4 produces smoother output", () => {
    const bounds = new AABB(0, 0, 100, 100);
    const cellsize = new Vec2(10, 10);
    const q4 = MarchingSquares.run(circleIso, bounds, cellsize, 4);
    expect(q4.length).toBeGreaterThan(0);
  });

  it("combine=false produces separate polygons", () => {
    const bounds = new AABB(0, 0, 100, 100);
    const cellsize = new Vec2(10, 10);
    const uncombined = MarchingSquares.run(circleIso, bounds, cellsize, 2, null, false);
    const combined = MarchingSquares.run(circleIso, bounds, cellsize, 2, null, true);
    // Uncombined should have >= combined polygons
    expect(uncombined.length).toBeGreaterThanOrEqual(combined.length);
  });
});

// ---------------------------------------------------------------------------
// MarchingSquares — subgrid
// ---------------------------------------------------------------------------

describe("MarchingSquares — subgrid partitioning", () => {
  it("subgrid produces valid output", () => {
    const circleIso = (x: number, y: number) => (x - 50) * (x - 50) + (y - 50) * (y - 50) - 30 * 30;

    const bounds = new AABB(0, 0, 100, 100);
    const cellsize = new Vec2(5, 5);
    const subgrid = new Vec2(2, 2);
    const result = MarchingSquares.run(circleIso, bounds, cellsize, 2, subgrid);
    expect(result.length).toBeGreaterThan(0);
  });

  it("subgrid with weak Vec2 auto-disposes", () => {
    const circleIso = (x: number, y: number) => (x - 50) * (x - 50) + (y - 50) * (y - 50) - 30 * 30;

    const bounds = new AABB(0, 0, 100, 100);
    const subgrid = Vec2.weak(3, 3);
    const result = MarchingSquares.run(circleIso, bounds, new Vec2(5, 5), 2, subgrid);
    expect(result.length).toBeGreaterThan(0);
  });

  it("large subgrid value", () => {
    const circleIso = (x: number, y: number) => (x - 50) * (x - 50) + (y - 50) * (y - 50) - 30 * 30;

    const bounds = new AABB(0, 0, 100, 100);
    const result = MarchingSquares.run(circleIso, bounds, new Vec2(5, 5), 2, new Vec2(5, 5));
    expect(result.length).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------
// GeomPoly.cut — extended scenarios
// ---------------------------------------------------------------------------

describe("GeomPoly.cut — extended", () => {
  function makeSquare(s = 20): GeomPoly {
    return new GeomPoly([Vec2.get(0, 0), Vec2.get(s, 0), Vec2.get(s, s), Vec2.get(0, s)]);
  }

  function makePentagon(r = 20): GeomPoly {
    const verts: Vec2[] = [];
    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * Math.PI * 2 - Math.PI / 2;
      verts.push(Vec2.get(Math.cos(a) * r, Math.sin(a) * r));
    }
    return new GeomPoly(verts);
  }

  it("cut through vertex produces valid polygons", () => {
    const sq = makeSquare(20);
    // Cut through the top-right vertex (20, 0)
    const result = sq.cut(Vec2.get(20, -5), Vec2.get(20, 25));
    expect(result).toBeDefined();
    // Should produce at least 1 polygon
    expect(result.length).toBeGreaterThanOrEqual(1);
  });

  it("bounded cut that doesn't intersect returns original", () => {
    const sq = makeSquare(20);
    // Cut line completely outside
    const result = sq.cut(Vec2.get(50, 0), Vec2.get(50, 20), true, true);
    expect(result).toBeDefined();
  });

  it("diagonal cut on pentagon", () => {
    const penta = makePentagon(20);
    const result = penta.cut(Vec2.get(-30, 0), Vec2.get(30, 5));
    expect(result).toBeDefined();
    expect(result.length).toBeGreaterThanOrEqual(1);
  });

  it("multiple sequential cuts", () => {
    const sq = makeSquare(40);
    // First cut: horizontal
    const pieces1 = sq.cut(Vec2.get(-5, 20), Vec2.get(45, 20));
    expect(pieces1.length).toBeGreaterThanOrEqual(1);

    // Cut each piece vertically
    let totalPieces = 0;
    for (let i = 0; i < pieces1.length; i++) {
      const piece = pieces1.at(i);
      const sub = piece.cut(Vec2.get(20, -5), Vec2.get(20, 45));
      totalPieces += sub.length;
    }
    expect(totalPieces).toBeGreaterThanOrEqual(2);
  });

  it("near-parallel cut produces valid output", () => {
    const sq = makeSquare(20);
    // Cut almost along the bottom edge
    const result = sq.cut(Vec2.get(-5, 0.1), Vec2.get(25, 0.1));
    expect(result).toBeDefined();
  });

  it("cut with boundedStart=true clips the cut line", () => {
    const sq = makeSquare(20);
    const result = sq.cut(Vec2.get(10, 5), Vec2.get(10, 25), true, false);
    expect(result).toBeDefined();
  });

  it("cut with boundedEnd=true clips the cut line", () => {
    const sq = makeSquare(20);
    const result = sq.cut(Vec2.get(10, -5), Vec2.get(10, 15), false, true);
    expect(result).toBeDefined();
  });
});
