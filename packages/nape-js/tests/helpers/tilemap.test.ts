import { describe, it, expect } from "vitest";
import "../../src/core/engine";
import {
  buildTilemapBody,
  meshTilemap,
  tiledLayerToGrid,
  ldtkLayerToGrid,
} from "../../src/helpers/tilemap";
import { Body } from "../../src/phys/Body";
import { BodyType } from "../../src/phys/BodyType";
import { Vec2 } from "../../src/geom/Vec2";
import { Material } from "../../src/phys/Material";
import { InteractionFilter } from "../../src/dynamics/InteractionFilter";
import { CbType } from "../../src/callbacks/CbType";
import { Space } from "../../src/space/Space";
import { Polygon } from "../../src/shape/Polygon";
import { Circle } from "../../src/shape/Circle";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function rectKey(r: { x: number; y: number; w: number; h: number }): string {
  return `${r.x},${r.y},${r.w}x${r.h}`;
}

function rectsAsKeys(rects: Array<{ x: number; y: number; w: number; h: number }>): string[] {
  return rects.map(rectKey).sort();
}

/** Sum of area of a list of rectangles (in tiles²). */
function totalArea(rects: Array<{ w: number; h: number }>): number {
  let a = 0;
  for (const r of rects) a += r.w * r.h;
  return a;
}

/** Count solid cells in a grid. */
function countSolid(grid: number[][]): number {
  let n = 0;
  for (const row of grid) for (const v of row) if (v !== 0) n++;
  return n;
}

// ---------------------------------------------------------------------------
// meshTilemap
// ---------------------------------------------------------------------------

describe("meshTilemap", () => {
  describe("input validation", () => {
    it("should throw on null grid", () => {
      expect(() => meshTilemap(null as any)).toThrow(/null/);
    });

    it("should return empty rects for empty grid", () => {
      expect(meshTilemap([])).toEqual([]);
    });

    it("should return empty rects for grid with empty rows", () => {
      expect(meshTilemap([[], [], []])).toEqual([]);
    });

    it("should throw on null row", () => {
      expect(() => meshTilemap([[0, 1], null as any, [1, 0]])).toThrow(/row 1/);
    });
  });

  describe("merge: none", () => {
    it("should return one rect per solid cell", () => {
      const grid = [
        [1, 1, 0],
        [0, 1, 0],
      ];
      const rects = meshTilemap(grid, { merge: "none" });
      expect(rects.length).toBe(countSolid(grid));
      expect(rects.every((r) => r.w === 1 && r.h === 1)).toBe(true);
    });

    it("should not merge any cells", () => {
      const grid = [[1, 1, 1, 1, 1]];
      const rects = meshTilemap(grid, { merge: "none" });
      expect(rects.length).toBe(5);
    });
  });

  describe("merge: rows", () => {
    it("should merge a single horizontal run into one rect", () => {
      const grid = [[1, 1, 1, 1, 1]];
      const rects = meshTilemap(grid, { merge: "rows" });
      expect(rects).toEqual([{ x: 0, y: 0, w: 5, h: 1 }]);
    });

    it("should split rows on gaps", () => {
      const grid = [[1, 1, 0, 1, 1, 1]];
      const rects = meshTilemap(grid, { merge: "rows" });
      expect(rectsAsKeys(rects)).toEqual(
        rectsAsKeys([
          { x: 0, y: 0, w: 2, h: 1 },
          { x: 3, y: 0, w: 3, h: 1 },
        ]),
      );
    });

    it("should NOT merge vertically", () => {
      const grid = [
        [1, 1],
        [1, 1],
      ];
      const rects = meshTilemap(grid, { merge: "rows" });
      // Two separate row-strips, not a single 2x2
      expect(rects.length).toBe(2);
      expect(rects.every((r) => r.h === 1)).toBe(true);
    });
  });

  describe("merge: greedy (default)", () => {
    it("should default to greedy", () => {
      const grid = [
        [1, 1],
        [1, 1],
      ];
      const rects = meshTilemap(grid);
      expect(rects).toEqual([{ x: 0, y: 0, w: 2, h: 2 }]);
    });

    it("should merge a 2x2 solid block into one rect", () => {
      const grid = [
        [1, 1],
        [1, 1],
      ];
      const rects = meshTilemap(grid, { merge: "greedy" });
      expect(rects).toEqual([{ x: 0, y: 0, w: 2, h: 2 }]);
    });

    it("should merge a horizontal-then-vertical pattern correctly", () => {
      // Top row 3 wide, bottom row only 2 wide -> top can extend down only 2 wide
      const grid = [
        [1, 1, 1],
        [1, 1, 0],
      ];
      const rects = meshTilemap(grid, { merge: "greedy" });
      // Greedy reads first cell (0,0), expands right to w=3, can't go down (row 1 col 2 is 0).
      // Then leftover at (0,1)+(1,1) merges into width-2 strip.
      expect(rectsAsKeys(rects)).toEqual(
        rectsAsKeys([
          { x: 0, y: 0, w: 3, h: 1 },
          { x: 0, y: 1, w: 2, h: 1 },
        ]),
      );
    });

    it("should split into multiple rects on an L-shape", () => {
      // L-shape:  XX
      //           X.
      const grid = [
        [1, 1],
        [1, 0],
      ];
      const rects = meshTilemap(grid, { merge: "greedy" });
      expect(rects.length).toBeGreaterThanOrEqual(2);
      expect(totalArea(rects)).toBe(countSolid(grid));
    });

    it("should produce <= rects than rows mode for 2D blocks", () => {
      const grid = [
        [1, 1, 1],
        [1, 1, 1],
        [1, 1, 1],
      ];
      const greedy = meshTilemap(grid, { merge: "greedy" });
      const rows = meshTilemap(grid, { merge: "rows" });
      expect(greedy.length).toBeLessThanOrEqual(rows.length);
      expect(greedy.length).toBe(1);
      expect(rows.length).toBe(3);
    });

    it("should always preserve total solid area (no overlap, no gaps)", () => {
      const grid = [
        [1, 1, 0, 0, 1],
        [1, 1, 1, 0, 1],
        [0, 1, 1, 0, 1],
        [1, 0, 0, 0, 1],
      ];
      const rects = meshTilemap(grid, { merge: "greedy" });
      expect(totalArea(rects)).toBe(countSolid(grid));
    });

    it("should handle single isolated cells", () => {
      const grid = [
        [1, 0, 1],
        [0, 0, 0],
        [1, 0, 1],
      ];
      const rects = meshTilemap(grid, { merge: "greedy" });
      expect(rects.length).toBe(4);
      expect(rects.every((r) => r.w === 1 && r.h === 1)).toBe(true);
    });

    it("should handle a fully solid grid as one rect", () => {
      const grid = [
        [1, 1, 1, 1],
        [1, 1, 1, 1],
        [1, 1, 1, 1],
      ];
      const rects = meshTilemap(grid, { merge: "greedy" });
      expect(rects).toEqual([{ x: 0, y: 0, w: 4, h: 3 }]);
    });

    it("should handle ragged rows (different lengths)", () => {
      const grid = [
        [1, 1, 1, 1],
        [1, 1],
        [1, 1, 1],
      ];
      const rects = meshTilemap(grid, { merge: "greedy" });
      // Total tiles = 4 + 2 + 3 = 9
      expect(totalArea(rects)).toBe(9);
    });
  });

  describe("solid predicate", () => {
    it("should treat any non-zero value as solid by default", () => {
      const grid = [[2, 5, 0, 99]];
      const rects = meshTilemap(grid);
      expect(rects).toEqual([
        { x: 0, y: 0, w: 2, h: 1 },
        { x: 3, y: 0, w: 1, h: 1 },
      ]);
    });

    it("should respect a custom solid predicate", () => {
      const grid = [[1, 2, 1, 2]];
      // Treat only `2` as solid
      const rects = meshTilemap(grid, { solid: (v) => v === 2 });
      expect(rectsAsKeys(rects)).toEqual(
        rectsAsKeys([
          { x: 1, y: 0, w: 1, h: 1 },
          { x: 3, y: 0, w: 1, h: 1 },
        ]),
      );
    });

    it("should pass coordinates to the predicate", () => {
      const seen: Array<[number, number, number]> = [];
      const grid = [
        [1, 1],
        [1, 1],
      ];
      meshTilemap(grid, {
        solid: (v, x, y) => {
          seen.push([v, x, y]);
          return v !== 0;
        },
      });
      // Each cell visited at least once
      expect(seen.length).toBeGreaterThanOrEqual(4);
    });
  });
});

// ---------------------------------------------------------------------------
// buildTilemapBody
// ---------------------------------------------------------------------------

describe("buildTilemapBody", () => {
  describe("basic construction", () => {
    it("should default to BodyType.STATIC", () => {
      const grid = [[1]];
      const body = buildTilemapBody(grid, { tileSize: 16 });
      expect(body.type).toBe(BodyType.STATIC);
    });

    it("should accept BodyType.KINEMATIC", () => {
      const grid = [[1]];
      const body = buildTilemapBody(grid, { tileSize: 16, bodyType: BodyType.KINEMATIC });
      expect(body.type).toBe(BodyType.KINEMATIC);
    });

    it("should produce no shapes for an all-empty grid", () => {
      const grid = [
        [0, 0, 0],
        [0, 0, 0],
      ];
      const body = buildTilemapBody(grid, { tileSize: 16 });
      expect(body.shapes.length).toBe(0);
    });

    it("should produce one polygon shape per merged rect", () => {
      const grid = [
        [1, 1, 0],
        [0, 1, 0],
      ];
      const body = buildTilemapBody(grid, { tileSize: 8, merge: "greedy" });
      const greedyRects = meshTilemap(grid, { merge: "greedy" });
      expect(body.shapes.length).toBe(greedyRects.length);
      for (const shape of body.shapes) {
        expect(shape.isPolygon()).toBe(true);
      }
    });

    it("should have all polygon shapes valid", () => {
      const grid = [
        [1, 1, 1, 0],
        [1, 1, 0, 1],
        [1, 0, 0, 1],
      ];
      const body = buildTilemapBody(grid, { tileSize: 32 });
      for (const shape of body.shapes) {
        const poly = shape as Polygon;
        // Should be a valid convex polygon (no error string)
        expect(String(poly.validity())).toMatch(/valid/i);
      }
    });
  });

  describe("tileSize", () => {
    it("should accept a number tileSize", () => {
      const grid = [[1]];
      const body = buildTilemapBody(grid, { tileSize: 32 });
      expect(body.shapes.length).toBe(1);
    });

    it("should accept a {w, h} tileSize", () => {
      const grid = [[1]];
      const body = buildTilemapBody(grid, { tileSize: { w: 24, h: 16 } });
      expect(body.shapes.length).toBe(1);
    });

    it("should throw on zero / negative tileSize", () => {
      const grid = [[1]];
      expect(() => buildTilemapBody(grid, { tileSize: 0 })).toThrow();
      expect(() => buildTilemapBody(grid, { tileSize: -8 })).toThrow();
    });

    it("should throw on NaN / Infinity tileSize", () => {
      const grid = [[1]];
      expect(() => buildTilemapBody(grid, { tileSize: NaN })).toThrow();
      expect(() => buildTilemapBody(grid, { tileSize: Infinity })).toThrow();
    });

    it("should throw on invalid {w, h}", () => {
      const grid = [[1]];
      expect(() => buildTilemapBody(grid, { tileSize: { w: 0, h: 16 } })).toThrow();
      expect(() => buildTilemapBody(grid, { tileSize: { w: 16, h: -1 } })).toThrow();
    });

    it("should produce correctly-sized rectangles", () => {
      const grid = [[1, 1, 1]];
      const body = buildTilemapBody(grid, { tileSize: 10, merge: "greedy" });
      expect(body.shapes.length).toBe(1);
      // World vertices of the (only) shape should span a 30x10 rect at the
      // body's origin, since body.position defaults to (0, 0).
      const verts = (body.shapes.at(0) as Polygon).localVerts;
      let minX = Infinity,
        maxX = -Infinity,
        minY = Infinity,
        maxY = -Infinity;
      for (let i = 0; i < verts.length; i++) {
        const v = verts.at(i);
        if (v.x < minX) minX = v.x;
        if (v.x > maxX) maxX = v.x;
        if (v.y < minY) minY = v.y;
        if (v.y > maxY) maxY = v.y;
      }
      expect(maxX - minX).toBeCloseTo(30, 5);
      expect(maxY - minY).toBeCloseTo(10, 5);
      // Top-left corner is at (0, 0) in body-local space
      expect(minX).toBeCloseTo(0, 5);
      expect(minY).toBeCloseTo(0, 5);
    });
  });

  describe("position", () => {
    it("should default body position to origin", () => {
      const body = buildTilemapBody([[1]], { tileSize: 8 });
      expect(body.position.x).toBeCloseTo(0, 5);
      expect(body.position.y).toBeCloseTo(0, 5);
    });

    it("should set body position from options", () => {
      const body = buildTilemapBody([[1]], { tileSize: 8, position: Vec2.get(120, 60) });
      expect(body.position.x).toBeCloseTo(120, 5);
      expect(body.position.y).toBeCloseTo(60, 5);
    });
  });

  describe("material / filter / cbTypes", () => {
    it("should apply material to all generated shapes", () => {
      const mat = new Material(0.4, 0.7, 0.5, 1.5);
      const body = buildTilemapBody(
        [
          [1, 1],
          [0, 1],
        ],
        { tileSize: 16, material: mat },
      );
      expect(body.shapes.length).toBeGreaterThan(0);
      for (const shape of body.shapes) {
        expect(shape.material.elasticity).toBeCloseTo(0.4, 5);
        expect(shape.material.dynamicFriction).toBeCloseTo(0.7, 5);
      }
    });

    it("should apply filter to all generated shapes", () => {
      const filter = new InteractionFilter(8, 16);
      const body = buildTilemapBody([[1, 1, 1]], { tileSize: 16, filter });
      for (const shape of body.shapes) {
        expect(shape.filter.collisionGroup).toBe(8);
        expect(shape.filter.collisionMask).toBe(16);
      }
    });

    it("should add cbTypes to every shape", () => {
      const tag = new CbType();
      const body = buildTilemapBody([[1, 1, 0, 1]], { tileSize: 16, cbTypes: [tag] });
      expect(body.shapes.length).toBe(2);
      for (const shape of body.shapes) {
        expect(shape.cbTypes.has(tag)).toBe(true);
      }
    });
  });

  describe("appending to existing body", () => {
    it("should add shapes to a provided body", () => {
      const existing = new Body(BodyType.STATIC, new Vec2(0, 0));
      existing.shapes.add(new Circle(4));
      const before = existing.shapes.length;

      const result = buildTilemapBody([[1, 1, 1]], { tileSize: 8, body: existing });
      expect(result).toBe(existing);
      expect(existing.shapes.length).toBe(before + 1);
    });

    it("should ignore bodyType when body is provided", () => {
      const existing = new Body(BodyType.KINEMATIC, new Vec2(0, 0));
      const result = buildTilemapBody([[1]], {
        tileSize: 8,
        body: existing,
        bodyType: BodyType.STATIC,
      });
      expect(result.type).toBe(BodyType.KINEMATIC);
    });
  });

  describe("physics integration", () => {
    it("should support adding to a Space and being collided with", () => {
      const space = new Space(new Vec2(0, 600));
      // 1 row of 5 solid tiles -> floor
      const body = buildTilemapBody([[1, 1, 1, 1, 1]], {
        tileSize: 32,
        position: Vec2.get(0, 200),
      });
      body.space = space;

      // Drop a ball above the floor; it should land on top of it
      const ball = new Body(BodyType.DYNAMIC, new Vec2(80, 0));
      ball.shapes.add(new Circle(8));
      ball.space = space;

      for (let i = 0; i < 120; i++) space.step(1 / 60);

      // Ball should not pass through the floor (top of floor at y = 200)
      expect(ball.position.y).toBeLessThan(220);
    });

    it("should be tagged as static (non-moving) when bodyType is STATIC", () => {
      const space = new Space(new Vec2(0, 600));
      const body = buildTilemapBody(
        [
          [1, 1],
          [1, 1],
        ],
        { tileSize: 16, position: Vec2.get(100, 100) },
      );
      body.space = space;
      const xBefore = body.position.x;
      const yBefore = body.position.y;
      for (let i = 0; i < 60; i++) space.step(1 / 60);
      expect(body.position.x).toBeCloseTo(xBefore, 5);
      expect(body.position.y).toBeCloseTo(yBefore, 5);
    });
  });
});

// ---------------------------------------------------------------------------
// Tiled / LDtk parsers
// ---------------------------------------------------------------------------

describe("tiledLayerToGrid", () => {
  it("should convert a Tiled tile layer into a 2D grid", () => {
    const layer = {
      width: 3,
      height: 2,
      data: [1, 0, 1, 0, 1, 0],
    };
    const grid = tiledLayerToGrid(layer);
    expect(grid).toEqual([
      [1, 0, 1],
      [0, 1, 0],
    ]);
  });

  it("should ignore extra Tiled fields", () => {
    const layer: any = {
      width: 2,
      height: 2,
      data: [1, 1, 1, 1],
      name: "ground",
      type: "tilelayer",
      visible: true,
    };
    const grid = tiledLayerToGrid(layer);
    expect(grid).toEqual([
      [1, 1],
      [1, 1],
    ]);
  });

  it("should plug into buildTilemapBody", () => {
    const layer = { width: 4, height: 1, data: [1, 1, 0, 1] };
    const grid = tiledLayerToGrid(layer);
    const body = buildTilemapBody(grid, { tileSize: 16 });
    expect(body.shapes.length).toBe(2);
  });

  it("should throw on null layer", () => {
    expect(() => tiledLayerToGrid(null as any)).toThrow(/null/);
  });

  it("should throw on missing data", () => {
    expect(() => tiledLayerToGrid({ width: 2, height: 2 } as any)).toThrow(/data/);
  });

  it("should throw on bad dimensions", () => {
    expect(() => tiledLayerToGrid({ width: 0, height: 2, data: [] })).toThrow(/positive/);
    expect(() => tiledLayerToGrid({ width: 2, height: -1, data: [] })).toThrow(/positive/);
  });

  it("should throw when data is too short", () => {
    expect(() => tiledLayerToGrid({ width: 4, height: 4, data: [1, 1, 1] })).toThrow(/length/);
  });
});

describe("ldtkLayerToGrid", () => {
  it("should convert an LDtk IntGrid layer (with __cWid / __cHei)", () => {
    const layer = {
      __cWid: 3,
      __cHei: 2,
      intGridCsv: [1, 0, 1, 0, 2, 0],
    };
    const grid = ldtkLayerToGrid(layer);
    expect(grid).toEqual([
      [1, 0, 1],
      [0, 2, 0],
    ]);
  });

  it("should accept fallback cWid / cHei keys", () => {
    const layer = {
      cWid: 2,
      cHei: 2,
      intGridCsv: [1, 1, 0, 1],
    };
    const grid = ldtkLayerToGrid(layer);
    expect(grid).toEqual([
      [1, 1],
      [0, 1],
    ]);
  });

  it("should plug into buildTilemapBody and produce shapes", () => {
    const layer = {
      __cWid: 4,
      __cHei: 2,
      intGridCsv: [1, 1, 0, 1, 1, 1, 0, 1],
    };
    const grid = ldtkLayerToGrid(layer);
    const body = buildTilemapBody(grid, { tileSize: 16, merge: "greedy" });
    // Greedy: (0,0)+(1,0)+(0,1)+(1,1) -> 1 rect of 2x2; then (3,0)+(3,1) -> 1 rect of 1x2
    expect(body.shapes.length).toBe(2);
  });

  it("should throw on null layer", () => {
    expect(() => ldtkLayerToGrid(null as any)).toThrow(/null/);
  });

  it("should throw on missing intGridCsv", () => {
    expect(() => ldtkLayerToGrid({ __cWid: 2, __cHei: 2 } as any)).toThrow(/intGridCsv/);
  });

  it("should throw when intGridCsv is too short", () => {
    expect(() => ldtkLayerToGrid({ __cWid: 4, __cHei: 4, intGridCsv: [1, 1, 1] })).toThrow(
      /length/,
    );
  });
});
