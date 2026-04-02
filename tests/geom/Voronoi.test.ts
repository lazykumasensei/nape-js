import { describe, it, expect } from "vitest";
import {
  computeVoronoi,
  generateFractureSites,
  type VoronoiPoint,
  type VoronoiResult,
} from "../../src/geom/Voronoi";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const BOUNDS = { minX: 0, minY: 0, maxX: 100, maxY: 100 };

function totalArea(result: VoronoiResult): number {
  let total = 0;
  for (const cell of result.cells) {
    total += polygonArea(cell.vertices);
  }
  return total;
}

function polygonArea(verts: VoronoiPoint[]): number {
  let area = 0;
  const n = verts.length;
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    area += verts[i].x * verts[j].y;
    area -= verts[j].x * verts[i].y;
  }
  return Math.abs(area / 2);
}

/** Seeded PRNG for reproducible tests. */
function seededRng(seed: number) {
  let s = seed;
  return () => {
    s = (s * 16807 + 0) % 2147483647;
    return s / 2147483647;
  };
}

// ---------------------------------------------------------------------------
// computeVoronoi — basic behavior
// ---------------------------------------------------------------------------

describe("computeVoronoi", () => {
  it("returns empty cells for empty input", () => {
    const result = computeVoronoi([], BOUNDS);
    expect(result.cells).toHaveLength(0);
  });

  it("single point returns bounding box as cell", () => {
    const result = computeVoronoi([{ x: 50, y: 50 }], BOUNDS);
    expect(result.cells).toHaveLength(1);
    expect(result.cells[0].siteIndex).toBe(0);
    expect(result.cells[0].site).toEqual({ x: 50, y: 50 });
    expect(result.cells[0].vertices).toHaveLength(4);

    const area = polygonArea(result.cells[0].vertices);
    expect(area).toBeCloseTo(10000, 0); // 100 × 100
  });

  it("two points split the bounding box along perpendicular bisector", () => {
    const result = computeVoronoi(
      [
        { x: 25, y: 50 },
        { x: 75, y: 50 },
      ],
      BOUNDS,
    );
    expect(result.cells).toHaveLength(2);

    // Each cell should have roughly half the total area
    const a0 = polygonArea(result.cells[0].vertices);
    const a1 = polygonArea(result.cells[1].vertices);
    expect(a0).toBeGreaterThan(4000);
    expect(a1).toBeGreaterThan(4000);
    expect(a0 + a1).toBeCloseTo(10000, -1);
  });

  it("three non-collinear points produce 3 cells", () => {
    const result = computeVoronoi(
      [
        { x: 20, y: 20 },
        { x: 80, y: 20 },
        { x: 50, y: 80 },
      ],
      BOUNDS,
    );
    expect(result.cells).toHaveLength(3);

    for (const cell of result.cells) {
      expect(cell.vertices.length).toBeGreaterThanOrEqual(3);
    }
  });

  it("cells cover the bounding box (total area ≈ bounds area)", () => {
    const points: VoronoiPoint[] = [
      { x: 25, y: 25 },
      { x: 75, y: 25 },
      { x: 25, y: 75 },
      { x: 75, y: 75 },
      { x: 50, y: 50 },
    ];
    const result = computeVoronoi(points, BOUNDS);
    expect(result.cells).toHaveLength(5);

    // Total area should approximate bounds area (some overlap tolerance due to clipping)
    const total = totalArea(result);
    expect(total).toBeGreaterThan(9000);
    expect(total).toBeLessThan(11000);
  });

  it("each cell's site is inside its cell polygon", () => {
    const points: VoronoiPoint[] = [
      { x: 30, y: 30 },
      { x: 70, y: 30 },
      { x: 30, y: 70 },
      { x: 70, y: 70 },
    ];
    const result = computeVoronoi(points, BOUNDS);

    for (const cell of result.cells) {
      const inside = pointInPolygon(cell.site.x, cell.site.y, cell.vertices);
      expect(inside).toBe(true);
    }
  });

  it("preserves siteIndex ordering matching input", () => {
    const points: VoronoiPoint[] = [
      { x: 10, y: 10 },
      { x: 90, y: 10 },
      { x: 50, y: 90 },
    ];
    const result = computeVoronoi(points, BOUNDS);

    for (let i = 0; i < result.cells.length; i++) {
      const cell = result.cells[i];
      expect(cell.siteIndex).toBe(i);
      expect(cell.site.x).toBeCloseTo(points[i].x, 5);
      expect(cell.site.y).toBeCloseTo(points[i].y, 5);
    }
  });

  it("handles many random points without crashing", () => {
    const rng = seededRng(42);
    const points: VoronoiPoint[] = [];
    for (let i = 0; i < 50; i++) {
      points.push({ x: 5 + rng() * 90, y: 5 + rng() * 90 });
    }
    const result = computeVoronoi(points, BOUNDS);
    expect(result.cells.length).toBeGreaterThanOrEqual(40); // Some may degenerate
    for (const cell of result.cells) {
      expect(cell.vertices.length).toBeGreaterThanOrEqual(3);
    }
  });

  it("handles collinear points gracefully", () => {
    const points: VoronoiPoint[] = [
      { x: 20, y: 50 },
      { x: 50, y: 50 },
      { x: 80, y: 50 },
    ];
    const result = computeVoronoi(points, BOUNDS);
    expect(result.cells).toHaveLength(3);

    // Each cell should have valid vertices
    for (const cell of result.cells) {
      expect(cell.vertices.length).toBeGreaterThanOrEqual(3);
    }
  });

  it("handles duplicate points without crashing", () => {
    const points: VoronoiPoint[] = [
      { x: 50, y: 50 },
      { x: 50, y: 50 },
      { x: 80, y: 80 },
    ];
    // Should not throw
    const result = computeVoronoi(points, BOUNDS);
    expect(result.cells.length).toBeGreaterThanOrEqual(1);
  });

  it("works with asymmetric bounds", () => {
    const asymBounds = { minX: -200, minY: -100, maxX: 200, maxY: 100 };
    const points: VoronoiPoint[] = [
      { x: -100, y: 0 },
      { x: 0, y: 0 },
      { x: 100, y: 0 },
    ];
    const result = computeVoronoi(points, asymBounds);
    expect(result.cells).toHaveLength(3);
  });

  it("all cell vertices are within bounds (clipping)", () => {
    const rng = seededRng(123);
    const points: VoronoiPoint[] = [];
    for (let i = 0; i < 20; i++) {
      points.push({ x: 10 + rng() * 80, y: 10 + rng() * 80 });
    }
    const result = computeVoronoi(points, BOUNDS);

    for (const cell of result.cells) {
      for (const v of cell.vertices) {
        expect(v.x).toBeGreaterThanOrEqual(BOUNDS.minX - 0.01);
        expect(v.x).toBeLessThanOrEqual(BOUNDS.maxX + 0.01);
        expect(v.y).toBeGreaterThanOrEqual(BOUNDS.minY - 0.01);
        expect(v.y).toBeLessThanOrEqual(BOUNDS.maxY + 0.01);
      }
    }
  });

  it("cells have non-zero area", () => {
    const points: VoronoiPoint[] = [
      { x: 25, y: 25 },
      { x: 75, y: 25 },
      { x: 25, y: 75 },
      { x: 75, y: 75 },
    ];
    const result = computeVoronoi(points, BOUNDS);

    for (const cell of result.cells) {
      const area = polygonArea(cell.vertices);
      expect(area).toBeGreaterThan(100);
    }
  });

  it("regular grid produces roughly equal cells", () => {
    const points: VoronoiPoint[] = [];
    for (let r = 0; r < 3; r++) {
      for (let c = 0; c < 3; c++) {
        points.push({ x: 20 + c * 30, y: 20 + r * 30 });
      }
    }
    const result = computeVoronoi(points, BOUNDS);
    expect(result.cells).toHaveLength(9);

    const areas = result.cells.map((c) => polygonArea(c.vertices));
    const avg = areas.reduce((a, b) => a + b, 0) / areas.length;
    for (const a of areas) {
      // Each cell should be within 3x of average (generous for edge cells)
      expect(a).toBeGreaterThan(avg * 0.1);
      expect(a).toBeLessThan(avg * 5);
    }
  });

  it("two points with vertical bisector", () => {
    const result = computeVoronoi(
      [
        { x: 50, y: 25 },
        { x: 50, y: 75 },
      ],
      BOUNDS,
    );
    expect(result.cells).toHaveLength(2);

    const a0 = polygonArea(result.cells[0].vertices);
    const a1 = polygonArea(result.cells[1].vertices);
    expect(a0 + a1).toBeCloseTo(10000, -1);
  });
});

// ---------------------------------------------------------------------------
// generateFractureSites
// ---------------------------------------------------------------------------

describe("generateFractureSites", () => {
  const square: VoronoiPoint[] = [
    { x: 0, y: 0 },
    { x: 100, y: 0 },
    { x: 100, y: 100 },
    { x: 0, y: 100 },
  ];

  it("returns empty array for count <= 0", () => {
    expect(generateFractureSites(square, 0)).toHaveLength(0);
    expect(generateFractureSites(square, -5)).toHaveLength(0);
  });

  it("returns empty array for fewer than 3 vertices", () => {
    expect(
      generateFractureSites(
        [
          { x: 0, y: 0 },
          { x: 1, y: 1 },
        ],
        5,
      ),
    ).toHaveLength(0);
  });

  it("generates the requested number of sites", () => {
    const sites = generateFractureSites(square, 10, seededRng(1));
    expect(sites).toHaveLength(10);
  });

  it("all sites are inside the polygon", () => {
    const sites = generateFractureSites(square, 50, seededRng(2));
    for (const s of sites) {
      expect(s.x).toBeGreaterThanOrEqual(0);
      expect(s.x).toBeLessThanOrEqual(100);
      expect(s.y).toBeGreaterThanOrEqual(0);
      expect(s.y).toBeLessThanOrEqual(100);
    }
  });

  it("works with a triangle", () => {
    const triangle: VoronoiPoint[] = [
      { x: 50, y: 0 },
      { x: 100, y: 100 },
      { x: 0, y: 100 },
    ];
    const sites = generateFractureSites(triangle, 20, seededRng(3));
    expect(sites.length).toBeGreaterThanOrEqual(15); // Some rejection expected
    for (const s of sites) {
      expect(pointInPolygon(s.x, s.y, triangle)).toBe(true);
    }
  });

  it("uses custom RNG for reproducibility", () => {
    const sites1 = generateFractureSites(square, 10, seededRng(42));
    const sites2 = generateFractureSites(square, 10, seededRng(42));
    expect(sites1).toEqual(sites2);
  });

  it("different seeds produce different sites", () => {
    const sites1 = generateFractureSites(square, 10, seededRng(1));
    const sites2 = generateFractureSites(square, 10, seededRng(99));
    // Very unlikely to be identical
    const same = sites1.every((s, i) => s.x === sites2[i].x && s.y === sites2[i].y);
    expect(same).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function pointInPolygon(x: number, y: number, polygon: VoronoiPoint[]): boolean {
  let inside = false;
  const n = polygon.length;
  for (let i = 0, j = n - 1; i < n; j = i++) {
    const xi = polygon[i].x,
      yi = polygon[i].y;
    const xj = polygon[j].x,
      yj = polygon[j].y;
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) {
      inside = !inside;
    }
  }
  return inside;
}
