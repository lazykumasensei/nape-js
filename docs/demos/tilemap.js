import {
  Body, BodyType, Vec2, Capsule, Polygon, Material,
  buildTilemapBody, meshTilemap, CharacterController,
} from "../nape-js.esm.js";
import { drawBody, drawGrid, COLORS } from "../renderer.js";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const TILE = 24;
const COLS = 36;
const ROWS = 20;
const WORLD_W = COLS * TILE;
const WORLD_H = ROWS * TILE;
const PLAYER_W = 16;
const PLAYER_H = 30;
const GRAVITY = 800;
const MOVE_SPEED = 180;
const JUMP_SPEED = 380;
const COYOTE_MS = 100;
const DT = 1 / 60;

// ---------------------------------------------------------------------------
// Level grid — a small platformer level
// 1 = solid, 0 = empty
// ---------------------------------------------------------------------------

const LEVEL = [
  "111111111111111111111111111111111111",
  "100000000000000000000000000000000001",
  "100000000000000000000000000000000001",
  "100000000111000000000000000000000001",
  "100000000000000011110000000000000001",
  "100000000000000000000000000111111001",
  "100001110000000000001100000000000001",
  "100000000000111100000000000000000001",
  "100000000000000000000000000000000001",
  "100000000000000000000111100000111001",
  "111110000000111110000000000000000001",
  "100000000000000000000000000110000001",
  "100000000000111000000000000000000001",
  "100000000000000000000000000000111111",
  "100000000000000000000111110000000001",
  "100000000000111100000000000000000001",
  "100000000000000000000000001111000001",
  "100000110000000000111100000000000001",
  "111111111110000000000000111111111111",
  "111111111111111111111111111111111111",
];

function parseLevel(rows) {
  const grid = [];
  for (const row of rows) {
    const r = new Array(row.length);
    for (let i = 0; i < row.length; i++) r[i] = row.charCodeAt(i) === 49 /* '1' */ ? 1 : 0;
    grid.push(r);
  }
  return grid;
}

// ---------------------------------------------------------------------------
// Module-scope state
// ---------------------------------------------------------------------------

let grid = null;
let mapBody = null;
let mapRects = [];
let player = null;
let cc = null;
let keys = {};
let prevJumpKey = false;
let jumpBufferTimer = 0;

// ---------------------------------------------------------------------------
// Build / rebuild the tilemap body
// ---------------------------------------------------------------------------

function rebuildMap(space) {
  if (mapBody) {
    mapBody.space = null;
    mapBody = null;
  }
  mapRects = meshTilemap(grid, { merge: "greedy" });
  mapBody = buildTilemapBody(grid, {
    tileSize: TILE,
    merge: "greedy",
    material: new Material(0, 0.6, 0.8, 1),
  });
  // Tag for the renderer (skip default body fill, we draw the rects ourselves)
  try {
    mapBody.userData._isTilemap = true;
  } catch (_) {}
  mapBody.space = space;
}

// ---------------------------------------------------------------------------
// Demo
// ---------------------------------------------------------------------------

export default {
  id: "tilemap",
  label: "Tilemap (Greedy Meshing)",
  featured: false,
  tags: ["Tilemap", "Greedy Meshing", "Platformer", "CharacterController", "Click"],
  desc:
    "A 36×20 tile level converted to physics with <b>buildTilemapBody</b>. Greedy meshing reduces hundreds of solid tiles into a handful of rectangles — overlay shows the merged rects. <b>Click</b> a tile to toggle solid/empty (the body is rebuilt). <b>WASD/Arrows</b> + <b>Space</b> to play.",
  walls: false,

  camera: null,

  setup(space, W, H) {
    space.gravity = new Vec2(0, GRAVITY);

    grid = parseLevel(LEVEL);
    rebuildMap(space);

    // Spawn the player at the first empty tile in a solid neighbourhood
    const spawnTileX = 2;
    const spawnTileY = 17;
    const spawnX = (spawnTileX + 0.5) * TILE;
    const spawnY = (spawnTileY + 0.5) * TILE;

    player = new Body(BodyType.DYNAMIC, new Vec2(spawnX, spawnY));
    const playerShape = new Capsule(PLAYER_H, PLAYER_W, undefined, new Material(0, 0.3, 0.3, 1));
    player.shapes.add(playerShape);
    player.rotation = Math.PI / 2;
    player.allowRotation = false;
    player.isBullet = true;
    player.space = space;
    try { player.userData._colorIdx = 3; } catch (_) {}

    cc = new CharacterController(space, player, {
      maxSlopeAngle: Math.PI / 3,
    });

    // Camera
    this.camera = {
      follow: player,
      offsetX: 0,
      offsetY: 0,
      bounds: { minX: 0, minY: 0, maxX: WORLD_W, maxY: WORLD_H },
      lerp: 0.18,
    };

    keys = {};
    prevJumpKey = false;
    jumpBufferTimer = 0;

    this._onKeyDown = (e) => {
      keys[e.code] = true;
      if (e.code === "Space" || e.code === "ArrowUp" || e.code === "KeyW") e.preventDefault();
    };
    this._onKeyUp = (e) => { keys[e.code] = false; };
    window.addEventListener("keydown", this._onKeyDown);
    window.addEventListener("keyup", this._onKeyUp);
  },

  cleanup() {
    if (this._onKeyDown) window.removeEventListener("keydown", this._onKeyDown);
    if (this._onKeyUp)   window.removeEventListener("keyup", this._onKeyUp);
  },

  step(space, W, H) {
    if (!cc || !player) return;

    const left = keys["ArrowLeft"] || keys["KeyA"];
    const right = keys["ArrowRight"] || keys["KeyD"];
    const jumpKey = keys["Space"] || keys["ArrowUp"] || keys["KeyW"];
    const jumpJustPressed = jumpKey && !prevJumpKey;
    prevJumpKey = jumpKey;

    let moveX = 0;
    if (left)  moveX = -MOVE_SPEED;
    if (right) moveX =  MOVE_SPEED;

    const result = cc.update();

    if (jumpJustPressed) jumpBufferTimer = 100;
    else jumpBufferTimer = Math.max(0, jumpBufferTimer - 1000 * DT);

    const canJump = result.grounded || result.timeSinceGrounded * 1000 < COYOTE_MS;
    let velY = player.velocity.y;
    if (jumpBufferTimer > 0 && canJump) {
      velY = -JUMP_SPEED;
      jumpBufferTimer = 0;
    }
    if (!jumpKey && velY < 0) velY *= 0.85;

    player.velocity = new Vec2(moveX, velY);

    // Respawn if the player falls out of the level
    if (player.position.y > WORLD_H + 100) {
      player.position = new Vec2(2.5 * TILE, 17.5 * TILE);
      player.velocity = new Vec2(0, 0);
    }
  },

  click(x, y, space, W, H) {
    // x/y arrive in world space (demo-runner already adds the camera offset)
    const tx = Math.floor(x / TILE);
    const ty = Math.floor(y / TILE);
    if (ty < 0 || ty >= grid.length) return;
    if (tx < 0 || tx >= grid[ty].length) return;
    grid[ty][tx] = grid[ty][tx] ? 0 : 1;
    rebuildMap(space);
  },

  render(ctx, space, W, H, showOutlines, camX = 0, camY = 0) {
    ctx.save();
    ctx.translate(-camX, -camY);

    drawGrid(ctx, W, H, camX, camY);

    // 1) Draw the raw tile cells (light fill — tells the user the underlying grid)
    ctx.fillStyle = "rgba(110, 140, 200, 0.18)";
    for (let y = 0; y < grid.length; y++) {
      const row = grid[y];
      for (let x = 0; x < row.length; x++) {
        if (row[x]) ctx.fillRect(x * TILE, y * TILE, TILE, TILE);
      }
    }

    // 2) Draw the greedy-meshed rectangle outlines on top (the actual physics shapes)
    ctx.lineWidth = 2;
    ctx.strokeStyle = "#4dc1ff";
    for (const r of mapRects) {
      ctx.strokeRect(r.x * TILE + 1, r.y * TILE + 1, r.w * TILE - 2, r.h * TILE - 2);
    }

    // 3) Tile grid lines (subtle)
    ctx.strokeStyle = "rgba(255,255,255,0.04)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let x = 0; x <= COLS; x++) {
      ctx.moveTo(x * TILE, 0);
      ctx.lineTo(x * TILE, ROWS * TILE);
    }
    for (let y = 0; y <= ROWS; y++) {
      ctx.moveTo(0, y * TILE);
      ctx.lineTo(COLS * TILE, y * TILE);
    }
    ctx.stroke();

    // 4) Player
    for (const body of space.bodies) {
      if (body === mapBody) continue; // already drew the tilemap manually
      drawBody(ctx, body, showOutlines);
    }

    ctx.restore();

    // 5) HUD: stats
    const solidCount = countSolid(grid);
    ctx.fillStyle = "rgba(13,17,23,0.7)";
    ctx.fillRect(8, 8, 220, 50);
    ctx.fillStyle = COLORS?.text ?? "#e6edf3";
    ctx.font = "12px ui-monospace, monospace";
    ctx.fillText(`Solid tiles: ${solidCount}`, 16, 26);
    ctx.fillText(`Greedy rects: ${mapRects.length}` +
      (solidCount > 0 ? `  (${(solidCount / mapRects.length).toFixed(1)}× fewer shapes)` : ""), 16, 44);
  },
};

function countSolid(g) {
  let n = 0;
  for (const row of g) for (const v of row) if (v) n++;
  return n;
}
