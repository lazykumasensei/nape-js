import { Body, BodyType, Vec2, Circle, DistanceJoint, PivotJoint } from "../nape-js.esm.js";
import { drawBody, drawGrid } from "../renderer.js";

// ── Module-level state for drag + texture ──────────────────────────────────
let _mouseBody = null;
let _grabJoint = null;
let _pendingGrab = null;
let _pendingRelease = false;
let _dragX = 0, _dragY = 0;
let _clothBodies = null;   // 2D grid [row][col] of particle bodies
let _clothCols = 0;
let _clothRows = 0;
let _logoImg = null;

function loadLogo() {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => { _logoImg = img; resolve(); };
    img.onerror = () => resolve(); // graceful fallback — no texture
    img.src = "./logo.svg";
  });
}

export default {
  id: "cloth",
  label: "Cloth Simulation",
  featured: false,
  tags: ["DistanceJoint", "Springs", "Grid"],
  desc: "A grid of particles connected by springs, simulating cloth with a logo texture. <b>Drag</b> the cloth with the mouse. A circle obstacle drifts across.",

  async preload() {
    await loadLogo();
  },

  setup(space, W, H) {
    space.gravity = new Vec2(0, 300);

    const cols = 20, rows = 14, gap = 16;
    _clothCols = cols;
    _clothRows = rows;
    const startX = W / 2 - (cols * gap) / 2;
    const startY = 30;
    const bodies = [];

    for (let r = 0; r < rows; r++) {
      bodies[r] = [];
      for (let c = 0; c < cols; c++) {
        const isTop = r === 0 && (c % 4 === 0);
        const b = new Body(
          isTop ? BodyType.STATIC : BodyType.DYNAMIC,
          new Vec2(startX + c * gap, startY + r * gap),
        );
        b.shapes.add(new Circle(2));
        try { b.userData._colorIdx = isTop ? 3 : (r + c) % 6; } catch(_) {}
        b.space = space;
        bodies[r][c] = b;
      }
    }
    _clothBodies = bodies;

    function connect(b1, b2, rest) {
      const dj = new DistanceJoint(b1, b2, new Vec2(0, 0), new Vec2(0, 0), rest * 0.9, rest * 1.1);
      dj.stiff = false;
      dj.frequency = 20;
      dj.damping = 0.3;
      dj.space = space;
    }

    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        if (c < cols - 1) connect(bodies[r][c], bodies[r][c + 1], gap);
        if (r < rows - 1) connect(bodies[r][c], bodies[r + 1][c], gap);
      }
    }

    // Moving circle obstacle — 100px higher, 10% smaller (radius 36)
    const obstacleR = 36;
    const obstacle = new Body(BodyType.KINEMATIC, new Vec2(W / 2, H * 0.55 - 100));
    obstacle.shapes.add(new Circle(obstacleR));
    try { obstacle.userData._colorIdx = 4; } catch(_) {}
    try { obstacle.userData._clothObstacle = true; } catch(_) {}
    obstacle.space = space;

    // Kinematic mouse anchor for dragging
    _mouseBody = new Body(BodyType.KINEMATIC, new Vec2(-1000, -1000));
    _mouseBody.space = space;
    _grabJoint = null;
    _pendingGrab = null;
    _pendingRelease = false;
  },

  step(space, W, H) {
    // Animate the kinematic obstacle — full canvas width
    const obstacleR = 36;
    for (const body of space.bodies) {
      try {
        if (!body.userData._clothObstacle) continue;
      } catch(_) { continue; }
      const range = W / 2 - obstacleR - 20; // go near the edges (20px margin)
      const cx = W / 2;
      const speed = 0.5;
      const t = performance.now() / 1000;
      const targetX = cx + Math.sin(t * speed) * range;
      body.velocity = new Vec2((targetX - body.position.x) * 5, 0);
      break;
    }

    // Handle drag release
    if (_pendingRelease) {
      _pendingRelease = false;
      if (_grabJoint) {
        _grabJoint.space = null;
        _grabJoint = null;
      }
      _mouseBody.position.setxy(-1000, -1000);
      _mouseBody.velocity.setxy(0, 0);
    }

    // Handle pending grab
    if (_pendingGrab) {
      const { body, localPt } = _pendingGrab;
      _pendingGrab = null;
      if (_grabJoint) { _grabJoint.space = null; _grabJoint = null; }
      _mouseBody.position.setxy(_dragX, _dragY);
      _grabJoint = new PivotJoint(
        _mouseBody, body,
        new Vec2(0, 0), localPt,
      );
      _grabJoint.stiff = false;
      _grabJoint.frequency = 8;
      _grabJoint.damping = 0.9;
      _grabJoint.space = space;
    }

    // Move mouse body toward cursor
    if (_grabJoint) {
      const dx = _dragX - _mouseBody.position.x;
      const dy = _dragY - _mouseBody.position.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      const maxSpeed = 600;
      if (dist > 1) {
        const speed = Math.min(dist * 60, maxSpeed);
        _mouseBody.velocity.setxy(dx / dist * speed, dy / dist * speed);
      } else {
        _mouseBody.velocity.setxy(0, 0);
      }
    }
  },

  click(x, y, space) {
    _dragX = x;
    _dragY = y;
    // Find nearest dynamic cloth particle
    let best = null, bestDist = 40;
    for (const body of space.bodies) {
      if (!body.isDynamic()) continue;
      const dx = body.position.x - x;
      const dy = body.position.y - y;
      const d = Math.sqrt(dx * dx + dy * dy);
      if (d < bestDist) { bestDist = d; best = body; }
    }
    if (!best) return;
    const localPt = best.worldPointToLocal(new Vec2(x, y));
    _pendingGrab = { body: best, localPt };
  },

  drag(x, y) {
    _dragX = x;
    _dragY = y;
  },

  release() {
    _pendingRelease = true;
  },

  render(ctx, space, W, H, showOutlines) {
    drawGrid(ctx, W, H);

    // Draw textured cloth quads
    if (_clothBodies && _logoImg) {
      const cols = _clothCols;
      const rows = _clothRows;

      for (let r = 0; r < rows - 1; r++) {
        for (let c = 0; c < cols - 1; c++) {
          const tl = _clothBodies[r][c].position;
          const tr = _clothBodies[r][c + 1].position;
          const bl = _clothBodies[r + 1][c].position;
          const br = _clothBodies[r + 1][c + 1].position;

          // UV coords for this quad cell
          const u0 = c / (cols - 1);
          const u1 = (c + 1) / (cols - 1);
          const v0 = r / (rows - 1);
          const v1 = (r + 1) / (rows - 1);

          // Draw two textured triangles per quad using canvas transform trick
          drawTexturedTriangle(ctx, _logoImg,
            tl.x, tl.y, tr.x, tr.y, bl.x, bl.y,
            u0, v0, u1, v0, u0, v1,
          );
          drawTexturedTriangle(ctx, _logoImg,
            tr.x, tr.y, br.x, br.y, bl.x, bl.y,
            u1, v0, u1, v1, u0, v1,
          );
        }
      }
    } else if (_clothBodies) {
      // Fallback: draw white quads without texture
      const cols = _clothCols;
      const rows = _clothRows;
      for (let r = 0; r < rows - 1; r++) {
        for (let c = 0; c < cols - 1; c++) {
          const tl = _clothBodies[r][c].position;
          const tr = _clothBodies[r][c + 1].position;
          const bl = _clothBodies[r + 1][c].position;
          const br = _clothBodies[r + 1][c + 1].position;
          ctx.beginPath();
          ctx.moveTo(tl.x, tl.y);
          ctx.lineTo(tr.x, tr.y);
          ctx.lineTo(br.x, br.y);
          ctx.lineTo(bl.x, bl.y);
          ctx.closePath();
          ctx.fillStyle = "rgba(255,255,255,0.85)";
          ctx.fill();
          ctx.strokeStyle = "rgba(255,255,255,0.15)";
          ctx.lineWidth = 0.5;
          ctx.stroke();
        }
      }
    }

    // Draw non-cloth bodies (obstacle, static anchors) on top
    for (const body of space.bodies) {
      if (body === _mouseBody) continue;
      // Skip cloth particles — they're part of the texture
      let isCloth = false;
      if (_clothBodies) {
        outer:
        for (let r = 0; r < _clothRows; r++) {
          for (let c = 0; c < _clothCols; c++) {
            if (_clothBodies[r][c] === body) { isCloth = true; break outer; }
          }
        }
      }
      if (isCloth) continue;
      drawBody(ctx, body, showOutlines);
    }
  },
};

// ── Affine-textured triangle via canvas setTransform ────────────────────────
function drawTexturedTriangle(ctx, img,
  x0, y0, x1, y1, x2, y2,
  u0, v0, u1, v1, u2, v2,
) {
  const iw = img.naturalWidth || img.width;
  const ih = img.naturalHeight || img.height;

  // Source pixel coords
  const sx0 = u0 * iw, sy0 = v0 * ih;
  const sx1 = u1 * iw, sy1 = v1 * ih;
  const sx2 = u2 * iw, sy2 = v2 * ih;

  ctx.save();
  ctx.beginPath();
  ctx.moveTo(x0, y0);
  ctx.lineTo(x1, y1);
  ctx.lineTo(x2, y2);
  ctx.closePath();
  ctx.clip();

  // Solve affine: [sx, sy] → [dx, dy]
  // We need transform T such that T * [sx, sy, 1] = [dx, dy]
  const denom = sx0 * (sy1 - sy2) + sx1 * (sy2 - sy0) + sx2 * (sy0 - sy1);
  if (Math.abs(denom) < 1e-10) { ctx.restore(); return; }
  const invD = 1 / denom;

  const a = (x0 * (sy1 - sy2) + x1 * (sy2 - sy0) + x2 * (sy0 - sy1)) * invD;
  const b = (x0 * (sx2 - sx1) + x1 * (sx0 - sx2) + x2 * (sx1 - sx0)) * invD;
  const e = (x0 * (sx1 * sy2 - sx2 * sy1) + x1 * (sx2 * sy0 - sx0 * sy2) + x2 * (sx0 * sy1 - sx1 * sy0)) * invD;
  const c = (y0 * (sy1 - sy2) + y1 * (sy2 - sy0) + y2 * (sy0 - sy1)) * invD;
  const d = (y0 * (sx2 - sx1) + y1 * (sx0 - sx2) + y2 * (sx1 - sx0)) * invD;
  const f = (y0 * (sx1 * sy2 - sx2 * sy1) + y1 * (sx2 * sy0 - sx0 * sy2) + y2 * (sx0 * sy1 - sx1 * sy0)) * invD;

  ctx.setTransform(a, c, b, d, e, f);
  ctx.drawImage(img, 0, 0);
  ctx.restore();
}
