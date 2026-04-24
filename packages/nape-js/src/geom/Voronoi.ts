/**
 * Voronoi diagram generation for 2D point sets.
 *
 * Uses the half-plane intersection method: for each site, start with the
 * bounding box and clip by the perpendicular bisector against every other site.
 * This is O(n²) but perfectly robust for the fracture use-case (typically 4–30
 * sites). Every cell is guaranteed to be a finite, closed, convex polygon.
 *
 * Designed for use in fracture/destruction systems.
 */

/** A 2D point (plain object — avoids coupling to Vec2 pooling). */
export interface VoronoiPoint {
  x: number;
  y: number;
}

/** A single Voronoi cell: the site that generated it and its polygon vertices (CCW). */
export interface VoronoiCell {
  /** The generating site index (into the original points array). */
  siteIndex: number;
  /** The generating site coordinates. */
  site: VoronoiPoint;
  /** Cell polygon vertices in counter-clockwise order. */
  vertices: VoronoiPoint[];
}

/** Result of a Voronoi diagram computation. */
export interface VoronoiResult {
  /** One cell per input site, in the same order as the input points. */
  cells: VoronoiCell[];
}

const EPSILON = 1e-10;

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Compute the Voronoi diagram for a set of 2D points, clipped to a bounding box.
 *
 * Uses half-plane intersection: for each site, clips the bounding rectangle by
 * the perpendicular bisector with every other site. Produces one convex cell per
 * site, all cells together tile the bounding box exactly.
 *
 * @param points - Array of site points. Must contain at least 1 point.
 * @param bounds - Clipping rectangle `{ minX, minY, maxX, maxY }`.
 * @returns A `VoronoiResult` containing one cell per input point.
 *
 * @example
 * ```ts
 * const result = computeVoronoi(
 *   [{ x: 10, y: 10 }, { x: 90, y: 50 }, { x: 50, y: 90 }],
 *   { minX: 0, minY: 0, maxX: 100, maxY: 100 },
 * );
 * for (const cell of result.cells) {
 *   console.log(`Site ${cell.siteIndex}:`, cell.vertices);
 * }
 * ```
 */
export function computeVoronoi(
  points: ReadonlyArray<Readonly<VoronoiPoint>>,
  bounds: { minX: number; minY: number; maxX: number; maxY: number },
): VoronoiResult {
  const n = points.length;
  if (n === 0) {
    return { cells: [] };
  }

  const boundsPoly: VoronoiPoint[] = [
    { x: bounds.minX, y: bounds.minY },
    { x: bounds.maxX, y: bounds.minY },
    { x: bounds.maxX, y: bounds.maxY },
    { x: bounds.minX, y: bounds.maxY },
  ];

  // Special case: single point — the cell is the entire bounding box
  if (n === 1) {
    return {
      cells: [
        {
          siteIndex: 0,
          site: { x: points[0].x, y: points[0].y },
          vertices: boundsPoly.map((v) => ({ ...v })),
        },
      ],
    };
  }

  const cells: VoronoiCell[] = [];

  for (let i = 0; i < n; i++) {
    const si = points[i];
    // Start with the bounding box
    let region = boundsPoly.map((v) => ({ x: v.x, y: v.y }));

    // Clip against perpendicular bisector with every other site
    for (let j = 0; j < n; j++) {
      if (i === j) continue;
      if (region.length < 3) break;

      const sj = points[j];
      // Midpoint of the two sites
      const mx = (si.x + sj.x) / 2;
      const my = (si.y + sj.y) / 2;
      // Normal pointing toward site i (away from site j)
      const nx = si.x - sj.x;
      const ny = si.y - sj.y;

      region = clipToHalfPlane(region, mx, my, nx, ny);
    }

    if (region.length >= 3) {
      cells.push({
        siteIndex: i,
        site: { x: si.x, y: si.y },
        vertices: sortCCW(region),
      });
    } else {
      // Degenerate cell (e.g. duplicate points) — provide a tiny polygon
      const r = Math.min(bounds.maxX - bounds.minX, bounds.maxY - bounds.minY) * 0.001;
      cells.push({
        siteIndex: i,
        site: { x: si.x, y: si.y },
        vertices: [
          { x: si.x - r, y: si.y - r },
          { x: si.x + r, y: si.y - r },
          { x: si.x + r, y: si.y + r },
          { x: si.x - r, y: si.y + r },
        ],
      });
    }
  }

  return { cells };
}

// ---------------------------------------------------------------------------
// Half-plane clipping
// ---------------------------------------------------------------------------

/**
 * Clip a convex polygon to the half-plane defined by: dot(p - point, normal) >= 0.
 * Uses the Sutherland–Hodgman algorithm for a single clipping edge.
 */
function clipToHalfPlane(
  polygon: VoronoiPoint[],
  px: number,
  py: number,
  nx: number,
  ny: number,
): VoronoiPoint[] {
  if (polygon.length === 0) return [];

  const output: VoronoiPoint[] = [];
  for (let i = 0; i < polygon.length; i++) {
    const curr = polygon[i];
    const prev = polygon[(i + polygon.length - 1) % polygon.length];
    const currDist = (curr.x - px) * nx + (curr.y - py) * ny;
    const prevDist = (prev.x - px) * nx + (prev.y - py) * ny;

    if (currDist >= -EPSILON) {
      if (prevDist < -EPSILON) {
        const t = prevDist / (prevDist - currDist);
        output.push({
          x: prev.x + t * (curr.x - prev.x),
          y: prev.y + t * (curr.y - prev.y),
        });
      }
      output.push(curr);
    } else if (prevDist >= -EPSILON) {
      const t = prevDist / (prevDist - currDist);
      output.push({
        x: prev.x + t * (curr.x - prev.x),
        y: prev.y + t * (curr.y - prev.y),
      });
    }
  }
  return output;
}

// ---------------------------------------------------------------------------
// Sort polygon vertices CCW around centroid
// ---------------------------------------------------------------------------

function sortCCW(vertices: VoronoiPoint[]): VoronoiPoint[] {
  if (vertices.length <= 2) return vertices;
  let cx = 0;
  let cy = 0;
  for (const v of vertices) {
    cx += v.x;
    cy += v.y;
  }
  cx /= vertices.length;
  cy /= vertices.length;
  return vertices.sort((a, b) => Math.atan2(a.y - cy, a.x - cx) - Math.atan2(b.y - cy, b.x - cx));
}

// ---------------------------------------------------------------------------
// Fracture site generation
// ---------------------------------------------------------------------------

/**
 * Generate random Voronoi fracture sites within a polygon.
 *
 * Places `count` random points inside the given polygon using rejection
 * sampling. Useful for generating fracture patterns.
 *
 * @param vertices - Polygon vertices (as VoronoiPoint[]).
 * @param count - Number of sites to generate.
 * @param random - Optional RNG function (default `Math.random`).
 * @returns Array of points guaranteed to be inside the polygon.
 */
export function generateFractureSites(
  vertices: ReadonlyArray<Readonly<VoronoiPoint>>,
  count: number,
  random: () => number = Math.random,
): VoronoiPoint[] {
  if (count <= 0 || vertices.length < 3) return [];

  let minX = Infinity,
    minY = Infinity,
    maxX = -Infinity,
    maxY = -Infinity;
  for (const v of vertices) {
    if (v.x < minX) minX = v.x;
    if (v.y < minY) minY = v.y;
    if (v.x > maxX) maxX = v.x;
    if (v.y > maxY) maxY = v.y;
  }

  const sites: VoronoiPoint[] = [];
  let attempts = 0;
  const maxAttempts = count * 100;

  while (sites.length < count && attempts < maxAttempts) {
    attempts++;
    const x = minX + random() * (maxX - minX);
    const y = minY + random() * (maxY - minY);
    if (pointInPolygon(x, y, vertices)) {
      sites.push({ x, y });
    }
  }

  return sites;
}

/**
 * Point-in-polygon test using ray casting.
 */
function pointInPolygon(
  x: number,
  y: number,
  polygon: ReadonlyArray<Readonly<VoronoiPoint>>,
): boolean {
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
