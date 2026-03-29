/**
 * Shared water/fluid rendering helpers for 2D Canvas, Three.js, and PixiJS.
 *
 * Used by any demo that has a fluid region (fluid-buoyancy, filtering-interactions, etc.).
 */

// ---------------------------------------------------------------------------
// Wave function — purely cosmetic sine wave
// ---------------------------------------------------------------------------

export function waveY(x, time) {
  return Math.sin(x * 0.02 + time * 2.0) * 3
       + Math.sin(x * 0.035 - time * 1.5) * 2
       + Math.sin(x * 0.07 + time * 3.0) * 1;
}

// ---------------------------------------------------------------------------
// Canvas 2D
// ---------------------------------------------------------------------------

/**
 * Draw animated water surface with gradient fill and wave line.
 *
 * @param {CanvasRenderingContext2D} ctx
 * @param {number} W       canvas width
 * @param {number} H       canvas height
 * @param {number} surfaceY physics Y of the water surface
 * @param {number} time     elapsed time in seconds
 * @param {object} [opts]   optional overrides
 * @param {number} [opts.margin=20]  wall inset
 */
export function drawWaveSurface2D(ctx, W, H, surfaceY, time, opts) {
  const margin = opts?.margin ?? 20;

  // Water fill with wave top
  ctx.save();
  ctx.beginPath();
  ctx.moveTo(margin, H - margin / 2);
  for (let x = margin; x <= W - margin; x += 3) {
    ctx.lineTo(x, surfaceY + waveY(x, time));
  }
  ctx.lineTo(W - margin, H - margin / 2);
  ctx.closePath();

  const grad = ctx.createLinearGradient(0, surfaceY - 10, 0, H);
  grad.addColorStop(0, "rgba(30,144,255,0.28)");
  grad.addColorStop(0.3, "rgba(20,100,200,0.35)");
  grad.addColorStop(1, "rgba(10,50,120,0.45)");
  ctx.fillStyle = grad;
  ctx.fill();

  // Wave surface line with glow
  ctx.beginPath();
  for (let x = margin; x <= W - margin; x += 2) {
    const wy = surfaceY + waveY(x, time);
    if (x === margin) ctx.moveTo(x, wy);
    else ctx.lineTo(x, wy);
  }
  ctx.strokeStyle = "rgba(100,200,255,0.9)";
  ctx.lineWidth = 2.5;
  ctx.shadowColor = "rgba(80,180,255,0.6)";
  ctx.shadowBlur = 10;
  ctx.stroke();

  // Secondary highlight line
  ctx.beginPath();
  for (let x = margin; x <= W - margin; x += 2) {
    const wy = surfaceY + waveY(x + 40, time * 0.8) + 4;
    if (x === margin) ctx.moveTo(x, wy);
    else ctx.lineTo(x, wy);
  }
  ctx.strokeStyle = "rgba(150,220,255,0.3)";
  ctx.lineWidth = 1;
  ctx.shadowBlur = 0;
  ctx.stroke();

  ctx.restore();
}

// ---------------------------------------------------------------------------
// Three.js 3D
// ---------------------------------------------------------------------------

/**
 * Build an animated wave surface geometry.
 */
export function buildWaveGeometry3D(THREE, W, surfaceY, time, opts) {
  const margin = opts?.margin ?? 20;
  const xMin = margin, xMax = W - margin;
  const zMin = -30, zMax = 30;
  const xSegs = 80, zSegs = 8;
  const geom = new THREE.BufferGeometry();

  const verts = [];
  const indices = [];
  const normals = [];

  for (let zi = 0; zi <= zSegs; zi++) {
    const z = zMin + (zi / zSegs) * (zMax - zMin);
    const zFactor = 1.0 - 0.3 * Math.abs(z / zMax);
    for (let xi = 0; xi <= xSegs; xi++) {
      const x = xMin + (xi / xSegs) * (xMax - xMin);
      const wy = waveY(x + z * 0.3, time) * zFactor;
      verts.push(x, -(surfaceY + wy), z);
      normals.push(0, 1, 0);
    }
  }

  for (let zi = 0; zi < zSegs; zi++) {
    for (let xi = 0; xi < xSegs; xi++) {
      const a = zi * (xSegs + 1) + xi;
      const b = a + 1;
      const c = a + (xSegs + 1);
      const d = c + 1;
      indices.push(a, b, c);
      indices.push(b, d, c);
    }
  }

  geom.setAttribute("position", new THREE.Float32BufferAttribute(verts, 3));
  geom.setAttribute("normal", new THREE.Float32BufferAttribute(normals, 3));
  geom.setIndex(indices);
  geom.computeVertexNormals();
  return geom;
}

/**
 * Update an existing wave geometry's vertex positions for animation.
 */
export function updateWaveGeometry3D(geom, W, surfaceY, time, opts) {
  const margin = opts?.margin ?? 20;
  const xMin = margin, xMax = W - margin;
  const zMin = -30, zMax = 30;
  const xSegs = 80, zSegs = 8;

  const pos = geom.attributes.position;
  let idx = 0;
  for (let zi = 0; zi <= zSegs; zi++) {
    const z = zMin + (zi / zSegs) * (zMax - zMin);
    const zFactor = 1.0 - 0.3 * Math.abs(z / zMax);
    for (let xi = 0; xi <= xSegs; xi++) {
      const x = xMin + (xi / xSegs) * (xMax - xMin);
      const wy = waveY(x + z * 0.3, time) * zFactor;
      pos.setY(idx, -(surfaceY + wy));
      idx++;
    }
  }
  pos.needsUpdate = true;
  geom.computeVertexNormals();
}

/**
 * Create the complete 3D water group (animated wave surface + deep volume box).
 * Returns { group, surfaceMesh, volumeMesh }.
 * Call `updateWater3D()` each frame to animate.
 */
export function createWater3D(THREE, W, H, surfaceY, time, opts) {
  const margin = opts?.margin ?? 20;
  const waterH = H - surfaceY;

  // Animated wave surface mesh
  const surfGeom = buildWaveGeometry3D(THREE, W, surfaceY, time, opts);
  const surfMat = new THREE.MeshPhongMaterial({
    color: 0x1e90ff,
    transparent: true,
    opacity: 0.45,
    shininess: 100,
    specular: 0x66aaff,
    emissive: 0x1e6abf,
    emissiveIntensity: 0.7,
    side: THREE.DoubleSide,
    depthWrite: false,
  });
  const surfaceMesh = new THREE.Mesh(surfGeom, surfMat);
  surfaceMesh.renderOrder = 999;

  // Deep water volume below the surface
  const volGeom = new THREE.BoxGeometry(W - 2 * margin, waterH - 6, 60);
  const volMat = new THREE.MeshPhongMaterial({
    color: 0x1464aa,
    transparent: true,
    opacity: 0.35,
    emissive: 0x0e4478,
    emissiveIntensity: 0.6,
    side: THREE.DoubleSide,
    depthWrite: false,
  });
  const volumeMesh = new THREE.Mesh(volGeom, volMat);
  volumeMesh.position.set(W / 2, -(surfaceY + waterH / 2 + 3), 0);
  volumeMesh.renderOrder = 998;

  const group = new THREE.Group();
  group.add(volumeMesh);
  group.add(surfaceMesh);

  return { group, surfaceMesh, volumeMesh };
}

/**
 * Animate an existing 3D water group (update wave geometry).
 */
export function updateWater3D(water, W, surfaceY, time, opts) {
  updateWaveGeometry3D(water.surfaceMesh.geometry, W, surfaceY, time, opts);
}

// ---------------------------------------------------------------------------
// PixiJS
// ---------------------------------------------------------------------------

/**
 * Draw animated water into a PIXI.Graphics (call each frame after `gfx.clear()`).
 *
 * @param {PIXI.Graphics} gfx
 * @param {number} W
 * @param {number} H
 * @param {number} surfaceY
 * @param {number} time
 * @param {object} [opts]
 * @param {number} [opts.margin=20]
 */
export function drawWaterPixi(gfx, W, H, surfaceY, time, opts) {
  const margin = opts?.margin ?? 20;

  // Animated wave fill
  const pts = [margin, H - margin / 2];
  for (let x = margin; x <= W - margin; x += 3) {
    pts.push(x, surfaceY + waveY(x, time));
  }
  pts.push(W - margin, H - margin / 2);
  gfx.poly(pts, true);
  gfx.fill({ color: 0x1e90ff, alpha: 0.3 });

  // Wave surface line
  gfx.moveTo(margin, surfaceY + waveY(margin, time));
  for (let x = margin + 2; x <= W - margin; x += 2) {
    gfx.lineTo(x, surfaceY + waveY(x, time));
  }
  gfx.stroke({ color: 0x64c8ff, width: 2.5, alpha: 0.9 });
}
