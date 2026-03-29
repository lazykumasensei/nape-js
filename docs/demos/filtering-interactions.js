import {
  Body, BodyType, Vec2, Circle, Polygon, InteractionFilter, FluidProperties,
} from "../nape-js.esm.js";
import { drawBody, drawGrid, drawConstraints } from "../renderer.js";
import { loadThree } from "../renderers/threejs-adapter.js";
import {
  drawWaveSurface2D,
  createWater3D, updateWater3D,
  drawWaterPixi,
} from "../renderers/water-renderer.js";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const COUNT = 20;          // objects per shape type
const BOX_SZ = 30;
const CIRCLE_R = 15;
const PENT_R = 15;
const GRAVITY = 600;

// ---------------------------------------------------------------------------
// Color indices for each group
// ---------------------------------------------------------------------------
const COLOR_BOX = 0;   // blue
const COLOR_CIRCLE = 2; // green
const COLOR_PENT = 1;  // yellow

// ---------------------------------------------------------------------------
// State
// ---------------------------------------------------------------------------
let _fluidBody = null;
let _fluidY = 0;
let _W = 0;
let _H = 0;
let _time = 0;
let _THREE = null;
let _waterMesh3d = null;
let _lastScene = null;

// ---------------------------------------------------------------------------
// Shape spawners
// ---------------------------------------------------------------------------

function spawnBox(space, x, y) {
  const b = new Body(BodyType.DYNAMIC, new Vec2(x, y));
  const shape = new Polygon(
    Polygon.box(BOX_SZ, BOX_SZ),
    undefined,
    // Boxes: collisionGroup=1, collisionMask=~2 (skip circles & pentagons)
    new InteractionFilter(1, ~2),
  );
  b.shapes.add(shape);
  try { b.userData._colorIdx = COLOR_BOX; b.userData._type = "box"; } catch (_) {}
  b.space = space;
  return b;
}

function spawnCircle(space, x, y) {
  const b = new Body(BodyType.DYNAMIC, new Vec2(x, y));
  const shape = new Circle(
    CIRCLE_R,
    undefined,
    undefined,
    // Circles: collisionGroup=2, default collisionMask (-1)
    // sensorGroup=2, sensorMask=2 — sensor-interact only with each other
    new InteractionFilter(2, -1, 2, 2),
  );
  shape.sensorEnabled = true;
  b.shapes.add(shape);
  try { b.userData._colorIdx = COLOR_CIRCLE; b.userData._type = "circle"; } catch (_) {}

  // Counter-act gravity so circles float weightlessly
  const mass = b.mass;
  b.force = new Vec2(0, -GRAVITY * mass);
  b.space = space;
  return b;
}

function spawnPentagon(space, x, y) {
  const b = new Body(BodyType.DYNAMIC, new Vec2(x, y));
  const shape = new Polygon(
    Polygon.regular(PENT_R, PENT_R, 5),
    undefined,
    // Pentagons: collisionGroup=2, default collisionMask
    // fluidGroup=2 — matches fluid's fluidMask
    new InteractionFilter(2, -1, 1, -1, 2, -1),
  );
  b.shapes.add(shape);
  try { b.userData._colorIdx = COLOR_PENT; b.userData._type = "pent"; } catch (_) {}
  b.space = space;
  return b;
}

// ---------------------------------------------------------------------------
// Custom 2D render — draws fluid overlay
// ---------------------------------------------------------------------------

function renderFiltering(ctx, space, W, H, showOutlines) {
  _time += 1 / 60;
  drawGrid(ctx, W, H);
  drawConstraints(ctx, space);

  // Draw non-fluid bodies
  for (const body of space.bodies) {
    if (body === _fluidBody) continue;
    drawBody(ctx, body, showOutlines);
  }

  // Draw fluid region with animated waves
  if (_fluidBody) {
    drawWaveSurface2D(ctx, W, H, _fluidY, _time);
  }
}

// ---------------------------------------------------------------------------
// Demo export
// ---------------------------------------------------------------------------

export default {
  id: "filtering-interactions",
  label: "Filtering Interactions",
  featured: false,
  tags: ["InteractionFilter", "Sensor", "Fluid", "Groups", "Bitmask"],
  desc: 'Demonstrates all three interaction types via <code>InteractionFilter</code> bitmasks: <b>collision</b> (boxes bounce off each other), <b>sensor</b> (circles detect overlaps without physics response), and <b>fluid</b> (pentagons experience buoyancy). <b>Click</b> to spawn more shapes.',
  walls: false,
  workerCompatible: false,

  setup(space, W, H) {
    _W = W;
    _H = H;
    _time = 0;
    _fluidBody = null;
    _waterMesh3d = null;
    space.gravity = new Vec2(0, GRAVITY);

    const t = 20; // wall thickness

    // Walls
    const floor = new Body(BodyType.STATIC, new Vec2(W / 2, H - t / 2));
    floor.shapes.add(new Polygon(Polygon.box(W, t)));
    floor.space = space;

    const left = new Body(BodyType.STATIC, new Vec2(t / 2, H / 2));
    left.shapes.add(new Polygon(Polygon.box(t, H)));
    left.space = space;

    const right = new Body(BodyType.STATIC, new Vec2(W - t / 2, H / 2));
    right.shapes.add(new Polygon(Polygon.box(t, H)));
    right.space = space;

    const ceil = new Body(BodyType.STATIC, new Vec2(W / 2, t / 2));
    ceil.shapes.add(new Polygon(Polygon.box(W, t)));
    ceil.space = space;

    // Fluid body — bottom 50% of the stage
    _fluidY = H * 0.5;
    const waterH = H - _fluidY;
    const fluidBody = new Body(BodyType.STATIC, new Vec2(W / 2, _fluidY + waterH / 2));
    const fluidShape = new Polygon(Polygon.box(W - 2 * t, waterH));
    fluidShape.fluidEnabled = true;
    fluidShape.fluidProperties = new FluidProperties(3, 6);
    // Fluid collides with nothing, fluid-interacts only with group 2
    fluidShape.filter = new InteractionFilter(1, 0, 1, -1, 1, 2);
    fluidShape.body = fluidBody;
    try { fluidBody.userData._hidden3d = true; } catch (_) {}
    fluidBody.space = space;
    _fluidBody = fluidBody;

    // Spawn boxes — upper area
    for (let i = 0; i < COUNT; i++) {
      spawnBox(
        space,
        40 + Math.random() * (W - 80),
        30 + Math.random() * (_fluidY - 60),
      );
    }

    // Spawn circles — scattered (they float)
    for (let i = 0; i < COUNT; i++) {
      spawnCircle(
        space,
        40 + Math.random() * (W - 80),
        40 + Math.random() * (H - 80),
      );
    }

    // Spawn pentagons — upper area (they fall into fluid)
    for (let i = 0; i < COUNT; i++) {
      spawnPentagon(
        space,
        40 + Math.random() * (W - 80),
        30 + Math.random() * (_fluidY - 60),
      );
    }
  },

  click(x, y, space, W, H) {
    // Spawn one of each near the click
    const off = () => (Math.random() - 0.5) * 40;
    spawnBox(space, x + off(), y + off());
    spawnCircle(space, x + off(), y + off());
    spawnPentagon(space, x + off(), y + off());
  },

  render(ctx, space, W, H, showOutlines) {
    renderFiltering(ctx, space, W, H, showOutlines);
  },

  render3d(renderer, scene, camera, space, W, H) {
    _time += 1 / 60;

    if (scene !== _lastScene) {
      _waterMesh3d = null;
      _lastScene = scene;
    }

    if (!_THREE) {
      loadThree().then(mod => { _THREE = mod; });
      renderer.render(scene, camera);
      return;
    }

    // Create/update animated wave water surface
    if (!_waterMesh3d) {
      _waterMesh3d = createWater3D(_THREE, W, H, _fluidY, _time);
      scene.add(_waterMesh3d.group);
    } else {
      updateWater3D(_waterMesh3d, W, _fluidY, _time);
    }

    // Sync body meshes
    const spaceBodies = new Set();
    for (const body of space.bodies) spaceBodies.add(body);

    if (!scene.userData._filterMeshes) scene.userData._filterMeshes = [];
    const meshes = scene.userData._filterMeshes;
    const COLORS3D = { box: 0x58a6ff, circle: 0x3fb950, pent: 0xd29922 };

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
      const type = body.userData?._type;
      for (const shape of body.shapes) {
        let geom;
        if (shape.isCircle()) {
          geom = new _THREE.SphereGeometry(shape.castCircle.radius, 16, 16);
        } else if (shape.isPolygon()) {
          const verts = shape.castPolygon.localVerts;
          if (verts.length < 3) continue;
          const pts = [];
          for (let vi = 0; vi < verts.length; vi++) pts.push(new _THREE.Vector2(verts.at(vi).x, verts.at(vi).y));
          geom = new _THREE.ExtrudeGeometry(new _THREE.Shape(pts), {
            depth: 20, bevelEnabled: true, bevelSize: 1.5, bevelThickness: 1.5, bevelSegments: 2,
          });
          geom.applyMatrix4(new _THREE.Matrix4().makeScale(1, -1, 1));
          geom.computeVertexNormals();
          geom.translate(0, 0, -10);
        }
        if (!geom) continue;
        const color = body.isStatic() ? 0x455a64 : (COLORS3D[type] || 0x888888);
        const mat = new _THREE.MeshPhongMaterial({ color, shininess: 80, specular: 0x444444, side: _THREE.DoubleSide });
        if (type === "circle") { mat.transparent = true; mat.opacity = 0.7; }
        const mesh = new _THREE.Mesh(geom, mat);
        scene.add(mesh);
        const edges = new _THREE.LineSegments(
          new _THREE.EdgesGeometry(geom, 15),
          new _THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.4 }),
        );
        mesh.add(edges);
        meshes.push({ mesh, body });
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
    ctx.save();
    ctx.font = "11px monospace";
    const labels = [
      { color: "#58a6ff", text: "Boxes — collide only with each other" },
      { color: "#3fb950", text: "Circles — sensor overlap (pass through)" },
      { color: "#d29922", text: "Pentagons — buoyant in fluid" },
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
    ctx.fillText("Click to spawn shapes", lx, ly + 6);
    ctx.restore();
  },

  renderPixi(adapter, space, W, H) {
    _time += 1 / 60;
    const { PIXI, app } = adapter.getEngine();
    if (!PIXI || !app) return;

    adapter.syncBodies(space);

    // Lazy-create water overlay Graphics
    if (!app.stage._waterGfx) {
      app.stage._waterGfx = new PIXI.Graphics();
      app.stage.addChild(app.stage._waterGfx);
    }
    const gfx = app.stage._waterGfx;
    app.stage.setChildIndex(gfx, app.stage.children.length - 1);

    gfx.clear();
    drawWaterPixi(gfx, W, H, _fluidY, _time);

    app.render();
  },

  // -------------------------------------------------------------------------
  // Canvas 2D CodePen
  // -------------------------------------------------------------------------
  code2d: `// Filtering Interactions — collision, sensor & fluid via bitmasks
const W = canvas.width, H = canvas.height;
const space = new Space(new Vec2(0, 600));
const t = 20;

// Walls
let b;
b = new Body(BodyType.STATIC, new Vec2(W/2, H-t/2)); b.shapes.add(new Polygon(Polygon.box(W,t))); b.space = space;
b = new Body(BodyType.STATIC, new Vec2(t/2, H/2)); b.shapes.add(new Polygon(Polygon.box(t,H))); b.space = space;
b = new Body(BodyType.STATIC, new Vec2(W-t/2, H/2)); b.shapes.add(new Polygon(Polygon.box(t,H))); b.space = space;
b = new Body(BodyType.STATIC, new Vec2(W/2, t/2)); b.shapes.add(new Polygon(Polygon.box(W,t))); b.space = space;

// Fluid — bottom 50%
const fluidY = H * 0.5;
const fb = new Body(BodyType.STATIC, new Vec2(W/2, fluidY + (H-fluidY)/2));
const fs = new Polygon(Polygon.box(W-2*t, H-fluidY));
fs.fluidEnabled = true;
fs.fluidProperties = new FluidProperties(3, 6);
fs.filter = new InteractionFilter(1, 0, 1, -1, 1, 2);
fs.body = fb;
fb.space = space;

// Boxes — collide only with each other (group 1, mask ~2)
for (let i = 0; i < 20; i++) {
  const body = new Body(BodyType.DYNAMIC, new Vec2(
    40 + Math.random() * (W-80), 30 + Math.random() * (fluidY-60)));
  body.shapes.add(new Polygon(Polygon.box(30,30), undefined, new InteractionFilter(1, ~2)));
  body.space = space;
}

// Circles — sensor overlap, float weightlessly
for (let i = 0; i < 20; i++) {
  const body = new Body(BodyType.DYNAMIC, new Vec2(
    40 + Math.random() * (W-80), 40 + Math.random() * (H-80)));
  const sh = new Circle(15, undefined, undefined, new InteractionFilter(2, -1, 2, 2));
  sh.sensorEnabled = true;
  body.shapes.add(sh);
  body.space = space;
  body.force = new Vec2(0, -600 * body.mass);
}

// Pentagons — collide + buoyant (fluidGroup=2 matches fluid)
for (let i = 0; i < 20; i++) {
  const body = new Body(BodyType.DYNAMIC, new Vec2(
    40 + Math.random() * (W-80), 30 + Math.random() * (fluidY-60)));
  body.shapes.add(new Polygon(Polygon.regular(15,15,5), undefined,
    new InteractionFilter(2, -1, 1, -1, 2, -1)));
  body.space = space;
}

let time = 0;
function loop() {
  space.step(1/60, 8, 3);
  time += 1/60;
  ctx.clearRect(0, 0, W, H);
  drawGrid();

  // Draw bodies
  for (const body of space.bodies) {
    if (body === fb) continue;
    drawBody(body);
  }

  // Draw fluid
  ctx.save();
  ctx.beginPath();
  ctx.moveTo(t, H-t);
  for (let x = t; x <= W-t; x += 3) {
    ctx.lineTo(x, fluidY + Math.sin(x*0.025+time*1.5)*2 + Math.sin(x*0.05-time*2)*1);
  }
  ctx.lineTo(W-t, H-t);
  ctx.closePath();
  const grad = ctx.createLinearGradient(0, fluidY, 0, H);
  grad.addColorStop(0, "rgba(30,144,255,0.22)");
  grad.addColorStop(1, "rgba(10,50,120,0.35)");
  ctx.fillStyle = grad;
  ctx.fill();
  ctx.restore();

  // Legend
  ctx.font = "11px monospace";
  ctx.globalAlpha = 0.85;
  const lbl = [
    {c:"#58a6ff",t:"Boxes — collide only with each other"},
    {c:"#3fb950",t:"Circles — sensor overlap (pass through)"},
    {c:"#d29922",t:"Pentagons — buoyant in fluid"},
  ];
  for (let i = 0; i < lbl.length; i++) {
    ctx.fillStyle = lbl[i].c;
    ctx.fillRect(30, 30+i*18, 10, 10);
    ctx.fillStyle = "#c9d1d9";
    ctx.fillText(lbl[i].t, 46, 39+i*18);
  }
  ctx.globalAlpha = 1;

  requestAnimationFrame(loop);
}
loop();`,

  // -------------------------------------------------------------------------
  // PixiJS CodePen
  // -------------------------------------------------------------------------
  codePixi: `// Filtering Interactions — collision, sensor & fluid via bitmasks
const space = new Space(new Vec2(0, 600));
const t = 20;

// Walls
let b;
b = new Body(BodyType.STATIC, new Vec2(W/2, H-t/2)); b.shapes.add(new Polygon(Polygon.box(W,t))); b.space = space;
b = new Body(BodyType.STATIC, new Vec2(t/2, H/2)); b.shapes.add(new Polygon(Polygon.box(t,H))); b.space = space;
b = new Body(BodyType.STATIC, new Vec2(W-t/2, H/2)); b.shapes.add(new Polygon(Polygon.box(t,H))); b.space = space;
b = new Body(BodyType.STATIC, new Vec2(W/2, t/2)); b.shapes.add(new Polygon(Polygon.box(W,t))); b.space = space;

// Fluid
const fluidY = H * 0.5;
const fb = new Body(BodyType.STATIC, new Vec2(W/2, fluidY + (H-fluidY)/2));
const fs = new Polygon(Polygon.box(W-2*t, H-fluidY));
fs.fluidEnabled = true;
fs.fluidProperties = new FluidProperties(3, 6);
fs.filter = new InteractionFilter(1, 0, 1, -1, 1, 2);
fs.body = fb;
fb.space = space;

// Boxes
for (let i = 0; i < 20; i++) {
  const body = new Body(BodyType.DYNAMIC, new Vec2(
    40 + Math.random() * (W-80), 30 + Math.random() * (fluidY-60)));
  body.shapes.add(new Polygon(Polygon.box(30,30), undefined, new InteractionFilter(1, ~2)));
  body.space = space;
}

// Circles
for (let i = 0; i < 20; i++) {
  const body = new Body(BodyType.DYNAMIC, new Vec2(
    40 + Math.random() * (W-80), 40 + Math.random() * (H-80)));
  const sh = new Circle(15, undefined, undefined, new InteractionFilter(2, -1, 2, 2));
  sh.sensorEnabled = true;
  body.shapes.add(sh);
  body.space = space;
  body.force = new Vec2(0, -600 * body.mass);
}

// Pentagons
for (let i = 0; i < 20; i++) {
  const body = new Body(BodyType.DYNAMIC, new Vec2(
    40 + Math.random() * (W-80), 30 + Math.random() * (fluidY-60)));
  body.shapes.add(new Polygon(Polygon.regular(15,15,5), undefined,
    new InteractionFilter(2, -1, 1, -1, 2, -1)));
  body.space = space;
}

function loop() {
  space.step(1/60, 8, 3);
  drawGrid();
  syncBodies(space);
  app.render();
  requestAnimationFrame(loop);
}
loop();`,

  // -------------------------------------------------------------------------
  // Three.js 3D CodePen
  // -------------------------------------------------------------------------
  code3d: `// Filtering Interactions — 3D
const container = document.getElementById("container");
const W = 900, H = 500;
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x0d1117);
const fov = 45;
const camZ = (W / 2) / Math.tan((fov / 2) * Math.PI / 180) / (W / H);
const camera = new THREE.PerspectiveCamera(fov, W / H, 1, camZ * 6);
camera.position.set(W / 2, -H / 2, camZ);
camera.lookAt(W / 2, -H / 2, 0);
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(W, H);
container.appendChild(renderer.domElement);
const keyLight = new THREE.DirectionalLight(0xfff5e0, 2.0); keyLight.position.set(-W*0.3, H*0.6, 800); scene.add(keyLight);
const fillLight = new THREE.DirectionalLight(0xadd8ff, 0.6); fillLight.position.set(W*1.2, -H*0.3, 400); scene.add(fillLight);
scene.add(new THREE.AmbientLight(0x1a1a2e, 1.0));

// Physics
const space = new Space(new Vec2(0, 600));
const t = 20;
const meshes = [];

// Walls
let wb;
wb = new Body(BodyType.STATIC, new Vec2(W/2, H-t/2)); wb.shapes.add(new Polygon(Polygon.box(W,t))); wb.space = space;
wb = new Body(BodyType.STATIC, new Vec2(t/2, H/2)); wb.shapes.add(new Polygon(Polygon.box(t,H))); wb.space = space;
wb = new Body(BodyType.STATIC, new Vec2(W-t/2, H/2)); wb.shapes.add(new Polygon(Polygon.box(t,H))); wb.space = space;
wb = new Body(BodyType.STATIC, new Vec2(W/2, t/2)); wb.shapes.add(new Polygon(Polygon.box(W,t))); wb.space = space;

// Fluid
const fluidY = H * 0.5;
const fb = new Body(BodyType.STATIC, new Vec2(W/2, fluidY + (H-fluidY)/2));
const fs = new Polygon(Polygon.box(W-2*t, H-fluidY));
fs.fluidEnabled = true;
fs.fluidProperties = new FluidProperties(3, 6);
fs.filter = new InteractionFilter(1, 0, 1, -1, 1, 2);
fs.body = fb;
fb.space = space;

// Water plane
const waterGeom = new THREE.PlaneGeometry(W - 2*t, H - fluidY);
const waterMat = new THREE.MeshPhongMaterial({
  color: 0x1e90ff, transparent: true, opacity: 0.25, side: THREE.DoubleSide
});
const waterMesh = new THREE.Mesh(waterGeom, waterMat);
waterMesh.position.set(W/2, -(fluidY + (H-fluidY)/2), 0);
scene.add(waterMesh);

const COLORS = { box: 0x58a6ff, circle: 0x3fb950, pent: 0xd29922 };

function createMesh(body, type) {
  let geom;
  const shape = body.shapes.at(0);
  if (shape.isCircle()) {
    geom = new THREE.SphereGeometry(shape.castCircle.radius, 16, 16);
  } else {
    const verts = shape.castPolygon.localVerts;
    const pts = [];
    for (let i = 0; i < verts.length; i++) pts.push(new THREE.Vector2(verts.at(i).x, verts.at(i).y));
    const s2d = new THREE.Shape(pts);
    geom = new THREE.ExtrudeGeometry(s2d, { depth: 20, bevelEnabled: true, bevelSize: 1.5, bevelThickness: 1.5, bevelSegments: 2 });
    geom.translate(0, 0, -10);
  }
  const mat = new THREE.MeshPhongMaterial({ color: COLORS[type] || 0x888888, shininess: 80, specular: 0x444444 });
  if (type === "circle") { mat.transparent = true; mat.opacity = 0.7; }
  const mesh = new THREE.Mesh(geom, mat);
  scene.add(mesh);
  meshes.push({ mesh, body });
}

// Boxes
for (let i = 0; i < 20; i++) {
  const body = new Body(BodyType.DYNAMIC, new Vec2(
    40 + Math.random() * (W-80), 30 + Math.random() * (fluidY-60)));
  body.shapes.add(new Polygon(Polygon.box(30,30), undefined, new InteractionFilter(1, ~2)));
  body.space = space;
  createMesh(body, "box");
}

// Circles
for (let i = 0; i < 20; i++) {
  const body = new Body(BodyType.DYNAMIC, new Vec2(
    40 + Math.random() * (W-80), 40 + Math.random() * (H-80)));
  const sh = new Circle(15, undefined, undefined, new InteractionFilter(2, -1, 2, 2));
  sh.sensorEnabled = true;
  body.shapes.add(sh);
  body.space = space;
  body.force = new Vec2(0, -600 * body.mass);
  createMesh(body, "circle");
}

// Pentagons
for (let i = 0; i < 20; i++) {
  const body = new Body(BodyType.DYNAMIC, new Vec2(
    40 + Math.random() * (W-80), 30 + Math.random() * (fluidY-60)));
  body.shapes.add(new Polygon(Polygon.regular(15,15,5), undefined,
    new InteractionFilter(2, -1, 1, -1, 2, -1)));
  body.space = space;
  createMesh(body, "pent");
}

function loop() {
  space.step(1/60, 8, 3);
  for (const { mesh, body } of meshes) {
    mesh.position.set(body.position.x, -body.position.y, 0);
    mesh.rotation.z = -body.rotation;
  }
  renderer.render(scene, camera);
  requestAnimationFrame(loop);
}
loop();`,
};
