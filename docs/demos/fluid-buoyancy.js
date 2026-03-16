import {
  Body, BodyType, Vec2, Circle, Polygon, FluidProperties,
} from "../nape-js.esm.js";
import { drawBody, drawGrid, drawConstraints } from "../renderer.js";
import { loadThree } from "../demo-runner.js";

// ---------------------------------------------------------------------------
// State
// ---------------------------------------------------------------------------

let _waterBody = null;
let _waterY = 0;
let _W = 0;
let _H = 0;
let _time = 0;
let _THREE = null;
let _waterMesh3d = null;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function spawnObject(space, x, y, type) {
  const body = new Body(BodyType.DYNAMIC, new Vec2(x, y));

  switch (type) {
    case 0: { // Light beach ball — floats high
      body.shapes.add(new Circle(18));
      for (const s of body.shapes) {
        s.material.density = 0.3;
        s.material.elasticity = 0.6;
      }
      try { body.userData._colorIdx = 0; body.userData._label = "ball"; } catch (_) {}
      break;
    }
    case 1: { // Wooden crate — floats partially submerged
      body.shapes.add(new Polygon(Polygon.box(28, 28)));
      for (const s of body.shapes) {
        s.material.density = 0.7;
        s.material.elasticity = 0.2;
      }
      try { body.userData._colorIdx = 1; body.userData._label = "wood"; } catch (_) {}
      break;
    }
    case 2: { // Rubber duck (small circle) — bobs on surface
      body.shapes.add(new Circle(12));
      for (const s of body.shapes) {
        s.material.density = 0.5;
        s.material.elasticity = 0.4;
      }
      try { body.userData._colorIdx = 5; body.userData._label = "duck"; } catch (_) {}
      break;
    }
    case 3: { // Steel block — sinks slowly
      body.shapes.add(new Polygon(Polygon.box(22, 22)));
      for (const s of body.shapes) {
        s.material.density = 3.0;
        s.material.elasticity = 0.1;
      }
      try { body.userData._colorIdx = 3; body.userData._label = "steel"; } catch (_) {}
      break;
    }
    case 4: { // Heavy anchor — sinks fast
      body.shapes.add(new Circle(14));
      for (const s of body.shapes) {
        s.material.density = 7.0;
        s.material.elasticity = 0.05;
      }
      try { body.userData._colorIdx = 4; body.userData._label = "anchor"; } catch (_) {}
      break;
    }
  }

  body.space = space;
  return body;
}

function spawnBoat(space, x, y) {
  const body = new Body(BodyType.DYNAMIC, new Vec2(x, y));

  // Hull — wide trapezoid (boat bottom)
  const hullVerts = [
    new Vec2(-40, -4),
    new Vec2(40, -4),
    new Vec2(32, 12),
    new Vec2(-32, 12),
  ];
  const hull = new Polygon(hullVerts);
  hull.material.density = 0.25;
  hull.material.elasticity = 0.1;
  hull.material.dynamicFriction = 0.4;
  hull.material.staticFriction = 0.4;
  body.shapes.add(hull);

  // Bow (front triangle)
  const bowVerts = [
    new Vec2(40, -4),
    new Vec2(55, 4),
    new Vec2(40, 12),
  ];
  const bow = new Polygon(bowVerts);
  bow.material.density = 0.25;
  bow.material.elasticity = 0.1;
  body.shapes.add(bow);

  // Stern (back triangle)
  const sternVerts = [
    new Vec2(-40, -4),
    new Vec2(-40, 12),
    new Vec2(-52, 4),
  ];
  const stern = new Polygon(sternVerts);
  stern.material.density = 0.25;
  stern.material.elasticity = 0.1;
  body.shapes.add(stern);

  // Cabin — small box on top (offset upward via explicit vertices)
  const cabinVerts = [
    new Vec2(-15, -18),
    new Vec2(5, -18),
    new Vec2(5, -4),
    new Vec2(-15, -4),
  ];
  const cabin = new Polygon(cabinVerts);
  cabin.material.density = 0.15;
  body.shapes.add(cabin);

  try {
    body.userData._colorIdx = 1;
    body.userData._isBoat = true;
  } catch (_) {}

  body.space = space;
  return body;
}

// ---------------------------------------------------------------------------
// Wave surface helper — purely cosmetic sine wave
// ---------------------------------------------------------------------------

function waveY(x, time) {
  return Math.sin(x * 0.02 + time * 2.0) * 3
       + Math.sin(x * 0.035 - time * 1.5) * 2
       + Math.sin(x * 0.07 + time * 3.0) * 1;
}

function drawWaveSurface(ctx, W, H, surfaceY, time) {
  // Water fill with wave top
  ctx.save();
  ctx.beginPath();
  ctx.moveTo(20, H - 10);
  for (let x = 20; x <= W - 20; x += 3) {
    ctx.lineTo(x, surfaceY + waveY(x, time));
  }
  ctx.lineTo(W - 20, H - 10);
  ctx.closePath();

  // Gradient fill
  const grad = ctx.createLinearGradient(0, surfaceY - 10, 0, H);
  grad.addColorStop(0, "rgba(30,144,255,0.28)");
  grad.addColorStop(0.3, "rgba(20,100,200,0.35)");
  grad.addColorStop(1, "rgba(10,50,120,0.45)");
  ctx.fillStyle = grad;
  ctx.fill();

  // Wave surface line with glow
  ctx.beginPath();
  for (let x = 20; x <= W - 20; x += 2) {
    const wy = surfaceY + waveY(x, time);
    if (x === 20) ctx.moveTo(x, wy);
    else ctx.lineTo(x, wy);
  }
  ctx.strokeStyle = "rgba(100,200,255,0.9)";
  ctx.lineWidth = 2.5;
  ctx.shadowColor = "rgba(80,180,255,0.6)";
  ctx.shadowBlur = 10;
  ctx.stroke();

  // Secondary highlight line
  ctx.beginPath();
  for (let x = 20; x <= W - 20; x += 2) {
    const wy = surfaceY + waveY(x + 40, time * 0.8) + 4;
    if (x === 20) ctx.moveTo(x, wy);
    else ctx.lineTo(x, wy);
  }
  ctx.strokeStyle = "rgba(150,220,255,0.3)";
  ctx.lineWidth = 1;
  ctx.shadowBlur = 0;
  ctx.stroke();

  ctx.restore();
}

// ---------------------------------------------------------------------------
// Custom 2D renderer
// ---------------------------------------------------------------------------

function renderFluid(ctx, space, W, H, showOutlines) {
  _time += 1 / 60;

  drawGrid(ctx, W, H);
  drawConstraints(ctx, space);

  // Separate bodies into above/below water for layering
  const below = [];
  const above = [];
  for (const body of space.bodies) {
    if (body === _waterBody) continue;
    if (body.isStatic()) continue;
    if (body.position.y > _waterY - 10) {
      below.push(body);
    } else {
      above.push(body);
    }
  }

  // Draw submerged bodies
  for (const body of below) drawBody(ctx, body, showOutlines);

  // Draw water with animated waves
  drawWaveSurface(ctx, W, H, _waterY, _time);

  // Draw above-water bodies
  for (const body of above) drawBody(ctx, body, showOutlines);

  // Draw walls (static bodies except water)
  for (const body of space.bodies) {
    if (body.isStatic() && body !== _waterBody) drawBody(ctx, body, showOutlines);
  }

  // Draw boat details (mast + flag) on top of any boat body
  for (const body of space.bodies) {
    if (!body.userData?._isBoat) continue;
    ctx.save();
    ctx.translate(body.position.x, body.position.y);
    ctx.rotate(body.rotation);

    // Mast
    ctx.strokeStyle = "#c8a060";
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(-5, -18);
    ctx.lineTo(-5, -55);
    ctx.stroke();

    // Flag (small triangle)
    ctx.fillStyle = "rgba(248,81,73,0.8)";
    ctx.beginPath();
    ctx.moveTo(-5, -55);
    ctx.lineTo(15, -47);
    ctx.lineTo(-5, -40);
    ctx.closePath();
    ctx.fill();

    ctx.restore();
  }

  // Legend
  ctx.save();
  ctx.font = "11px monospace";
  const labels = [
    { color: "#58a6ff", text: "Light (0.3)" },
    { color: "#d29922", text: "Wood (0.7)" },
    { color: "#dbabff", text: "Rubber (0.5)" },
    { color: "#f85149", text: "Steel (3.0)" },
    { color: "#a371f7", text: "Anchor (7.0)" },
    { color: "#c8a060", text: "Boat (0.25)" },
  ];
  const lx = 30;
  let ly = 24;
  for (const l of labels) {
    ctx.fillStyle = l.color;
    ctx.fillRect(lx, ly - 8, 10, 10);
    ctx.fillStyle = "rgba(200,220,255,0.7)";
    ctx.fillText(l.text, lx + 14, ly);
    ly += 14;
  }
  ctx.fillStyle = "rgba(200,220,255,0.5)";
  ctx.fillText("Click to drop objects", lx, ly + 6);
  ctx.restore();
}


export default {
  id: "fluid-buoyancy",
  label: "Fluid & Buoyancy",
  featured: true,
  featuredOrder: 6,
  tags: ["Fluid", "Buoyancy", "Density", "Boat", "Click"],
  desc: 'Objects with different densities interact with a fluid pool — light ones float, heavy ones sink. A small boat bobs on the waves. <b>Click</b> to drop objects.',

  setup(space, W, H) {
    _W = W;
    _H = H;
    _time = 0;
    _waterMesh3d = null;
    space.gravity = new Vec2(0, 600);

    const t = 20;

    // Floor
    const floor = new Body(BodyType.STATIC, new Vec2(W / 2, H - t / 2));
    floor.shapes.add(new Polygon(Polygon.box(W, t)));
    floor.space = space;

    // Left wall
    const left = new Body(BodyType.STATIC, new Vec2(t / 2, H / 2));
    left.shapes.add(new Polygon(Polygon.box(t, H)));
    left.space = space;

    // Right wall
    const right = new Body(BodyType.STATIC, new Vec2(W - t / 2, H / 2));
    right.shapes.add(new Polygon(Polygon.box(t, H)));
    right.space = space;

    // Water pool — fluid-enabled static body covering bottom 60%
    _waterY = H * 0.4;
    const waterH = H - _waterY;
    const waterBody = new Body(BodyType.STATIC, new Vec2(W / 2, _waterY + waterH / 2));
    const waterShape = new Polygon(Polygon.box(W - 2 * t, waterH));
    waterShape.fluidEnabled = true;
    waterShape.fluidProperties = new FluidProperties(1.5, 3.0);
    waterShape.body = waterBody;
    try { waterBody.userData._hidden3d = true; } catch (_) {}
    waterBody.space = space;
    _waterBody = waterBody;

    // Spawn boat
    spawnBoat(space, W / 2, _waterY - 10);

    // Spawn initial objects
    const types = [0, 1, 2, 3, 4, 0, 1, 2, 3, 4, 0, 2];
    for (let i = 0; i < types.length; i++) {
      const x = 60 + (i % 6) * 140 + (Math.random() - 0.5) * 40;
      const y = 40 + Math.floor(i / 6) * 50 + (Math.random() - 0.5) * 20;
      spawnObject(space, x, y, types[i]);
    }
  },

  render(ctx, space, W, H, showOutlines) {
    renderFluid(ctx, space, W, H, showOutlines);
  },

  render3d(renderer, scene, camera, space, W, H) {
    // Lazy-load THREE (cached by loadThree from demo-runner)
    if (!_THREE) {
      loadThree().then(mod => { _THREE = mod; });
      renderer.render(scene, camera);
      return;
    }

    // Create transparent water mesh once
    if (!_waterMesh3d) {
      const waterH = H - _waterY;
      const geom = new _THREE.BoxGeometry(W - 40, waterH, 60);
      const mat = new _THREE.MeshPhongMaterial({
        color: 0x1e90ff,
        transparent: true,
        opacity: 0.28,
        shininess: 90,
        specular: 0x4488cc,
        side: _THREE.DoubleSide,
        depthWrite: false,
      });
      _waterMesh3d = new _THREE.Mesh(geom, mat);
      _waterMesh3d.position.set(W / 2, -(_waterY + waterH / 2), 0);
      _waterMesh3d.renderOrder = 999;
      scene.add(_waterMesh3d);
    }

    // Sync body meshes — replicate DemoRunner's default logic
    // Build meshes for new bodies
    const spaceBodies = new Set();
    for (const body of space.bodies) spaceBodies.add(body);

    // Lazy mesh-set on the scene
    if (!scene.userData._fluidMeshes) scene.userData._fluidMeshes = [];
    const meshes = scene.userData._fluidMeshes;
    const COLORS = [0x4fc3f7, 0xffb74d, 0x81c784, 0xef5350, 0xce93d8, 0x4dd0e1, 0xfff176, 0xff8a65];

    // Remove stale
    for (let i = meshes.length - 1; i >= 0; i--) {
      if (!spaceBodies.has(meshes[i].body)) {
        scene.remove(meshes[i].mesh);
        meshes[i].mesh.traverse(c => {
          if (c.geometry) c.geometry.dispose();
          if (c.material) {
            if (Array.isArray(c.material)) c.material.forEach(m => m.dispose());
            else c.material.dispose();
          }
        });
        meshes.splice(i, 1);
      }
    }

    // Add new
    const tracked = new Set(meshes.map(m => m.body));
    for (const body of space.bodies) {
      if (tracked.has(body)) continue;
      if (body.userData?._hidden3d) continue;
      for (const shape of body.shapes) {
        let geom;
        if (shape.isCircle()) {
          geom = new _THREE.SphereGeometry(shape.castCircle.radius, 16, 16);
        } else if (shape.isPolygon()) {
          const verts = shape.castPolygon.localVerts;
          if (verts.length < 3) continue;
          const pts = [];
          for (let i = 0; i < verts.length; i++) pts.push(new _THREE.Vector2(verts.at(i).x, verts.at(i).y));
          geom = new _THREE.ExtrudeGeometry(new _THREE.Shape(pts), {
            depth: 30, bevelEnabled: true, bevelSize: 2, bevelThickness: 2, bevelSegments: 2,
          });
          geom.applyMatrix4(new _THREE.Matrix4().makeScale(1, -1, 1));
          geom.computeVertexNormals();
          geom.translate(0, 0, -15);
        }
        if (!geom) continue;
        const cIdx = (body.userData?._colorIdx ?? 0) % COLORS.length;
        const color = body.isStatic() ? 0x455a64 : COLORS[cIdx];
        const mesh = new _THREE.Mesh(geom, new _THREE.MeshPhongMaterial({
          color, shininess: 80, specular: 0x444444, side: _THREE.DoubleSide,
        }));
        scene.add(mesh);
        const edges = new _THREE.LineSegments(
          new _THREE.EdgesGeometry(geom, 15),
          new _THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.6 }),
        );
        mesh.add(edges);
        meshes.push({ mesh, body, edges });
      }
    }

    // Sync positions
    for (const { mesh, body } of meshes) {
      mesh.position.set(body.position.x, -body.position.y, 0);
      mesh.rotation.z = -body.rotation;
    }

    renderer.render(scene, camera);
  },

  render3dOverlay(ctx, space, W, H) {
    // Draw legend on the 2D overlay in 3D mode
    ctx.save();
    ctx.font = "11px monospace";
    const labels = [
      { color: "#58a6ff", text: "Light (0.3)" },
      { color: "#d29922", text: "Wood (0.7)" },
      { color: "#dbabff", text: "Rubber (0.5)" },
      { color: "#f85149", text: "Steel (3.0)" },
      { color: "#a371f7", text: "Anchor (7.0)" },
      { color: "#c8a060", text: "Boat (0.25)" },
    ];
    const lx = 10;
    let ly = 20;
    for (const l of labels) {
      ctx.fillStyle = l.color;
      ctx.fillRect(lx, ly - 8, 10, 10);
      ctx.fillStyle = "rgba(200,220,255,0.7)";
      ctx.fillText(l.text, lx + 14, ly);
      ly += 14;
    }
    ctx.restore();
  },

  click(x, y, space) {
    const spawnY = Math.min(y, _waterY - 30);
    const type = Math.floor(Math.random() * 5);
    spawnObject(space, x, spawnY, type);
  },

  code2d: `// Fluid & Buoyancy — objects + boat in a fluid pool
const space = new Space(new Vec2(0, 600));
const W = 900, H = 500;

// Walls
const t = 20;
const floor = new Body(BodyType.STATIC, new Vec2(W / 2, H - t / 2));
floor.shapes.add(new Polygon(Polygon.box(W, t)));
floor.space = space;
const left = new Body(BodyType.STATIC, new Vec2(t / 2, H / 2));
left.shapes.add(new Polygon(Polygon.box(t, H)));
left.space = space;
const right = new Body(BodyType.STATIC, new Vec2(W - t / 2, H / 2));
right.shapes.add(new Polygon(Polygon.box(t, H)));
right.space = space;

// Water pool (bottom 60%)
const waterY = H * 0.4;
const waterH = H - waterY;
const water = new Body(BodyType.STATIC, new Vec2(W / 2, waterY + waterH / 2));
const ws = new Polygon(Polygon.box(W - 40, waterH));
ws.fluidEnabled = true;
ws.fluidProperties = new FluidProperties(1.5, 3.0);
water.shapes.add(ws);
water.space = space;

// Boat — multiple shapes on one body
const boat = new Body(BodyType.DYNAMIC, new Vec2(W / 2, waterY - 10));
// Hull (trapezoid)
boat.shapes.add(new Polygon([
  new Vec2(-40, -4), new Vec2(40, -4),
  new Vec2(32, 12), new Vec2(-32, 12),
]));
// Bow
boat.shapes.add(new Polygon([
  new Vec2(40, -4), new Vec2(55, 4), new Vec2(40, 12),
]));
// Stern
boat.shapes.add(new Polygon([
  new Vec2(-40, -4), new Vec2(-40, 12), new Vec2(-52, 4),
]));
for (const s of boat.shapes) {
  s.material.density = 0.25;
}
boat.space = space;

// Drop some objects
for (let i = 0; i < 10; i++) {
  const b = new Body(BodyType.DYNAMIC, new Vec2(
    80 + Math.random() * (W - 160), 30 + Math.random() * 80,
  ));
  if (Math.random() < 0.5) {
    b.shapes.add(new Circle(8 + Math.random() * 12));
    b.shapes.at(0).material.density = 0.3 + Math.random() * 6;
  } else {
    const sz = 12 + Math.random() * 18;
    b.shapes.add(new Polygon(Polygon.box(sz, sz)));
    b.shapes.at(0).material.density = 0.3 + Math.random() * 6;
  }
  b.space = space;
}

// Animated wave surface
let time = 0;
function waveY(x) {
  return Math.sin(x * 0.02 + time * 2) * 3
       + Math.sin(x * 0.035 - time * 1.5) * 2;
}

function loop() {
  time += 1 / 60;
  space.step(1 / 60, 8, 3);
  ctx.clearRect(0, 0, W, H);
  drawGrid();

  for (const body of space.bodies) drawBody(body);

  // Water overlay with wave surface
  ctx.save();
  ctx.beginPath();
  ctx.moveTo(20, H - 10);
  for (let x = 20; x <= W - 20; x += 3) {
    ctx.lineTo(x, waterY + waveY(x));
  }
  ctx.lineTo(W - 20, H - 10);
  ctx.closePath();
  ctx.fillStyle = "rgba(30,144,255,0.3)";
  ctx.fill();

  // Wave line
  ctx.beginPath();
  for (let x = 20; x <= W - 20; x += 2) {
    const wy = waterY + waveY(x);
    if (x === 20) ctx.moveTo(x, wy);
    else ctx.lineTo(x, wy);
  }
  ctx.strokeStyle = "rgba(100,200,255,0.9)";
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.restore();

  requestAnimationFrame(loop);
}
loop();`,
};
