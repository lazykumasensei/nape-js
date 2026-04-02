import {
  Body, BodyType, Vec2, Circle, Polygon, Space,
  fractureBody, computeVoronoi, generateFractureSites,
} from "../nape-js.esm.js";

// Fracture color palette — warm tones for fragments
const FRAG_COLORS = [
  "#f85149", "#d29922", "#58a6ff", "#a371f7", "#3fb950", "#dbabff",
  "#ff7b72", "#ffa657", "#79c0ff", "#d2a8ff", "#7ee787", "#f0883e",
];

let blastRadius = 300;
let fragmentCount = 10;

function createBreakableBox(space, x, y, w, h, colorIdx) {
  const body = new Body(BodyType.DYNAMIC, new Vec2(x, y));
  body.shapes.add(new Polygon(Polygon.box(w, h)));
  body.userData._colorIdx = colorIdx;
  body.userData._breakable = true;
  body.space = space;
  return body;
}

function createBreakableHex(space, x, y, r, colorIdx) {
  const body = new Body(BodyType.DYNAMIC, new Vec2(x, y));
  body.shapes.add(new Polygon(Polygon.regular(r, r, 6)));
  body.userData._colorIdx = colorIdx;
  body.userData._breakable = true;
  body.space = space;
  return body;
}

function createBreakableOctagon(space, x, y, r, colorIdx) {
  const body = new Body(BodyType.DYNAMIC, new Vec2(x, y));
  body.shapes.add(new Polygon(Polygon.regular(r, r, 8)));
  body.userData._colorIdx = colorIdx;
  body.userData._breakable = true;
  body.space = space;
  return body;
}

function doFracture(clickX, clickY, space) {
  // Find all breakable bodies near click
  const toFracture = [];
  for (const body of space.bodies) {
    if (body.isStatic()) continue;
    if (!body.userData._breakable) continue;
    const dx = body.position.x - clickX;
    const dy = body.position.y - clickY;
    if (dx * dx + dy * dy < blastRadius * blastRadius) {
      toFracture.push(body);
    }
  }

  for (const body of toFracture) {
    // Determine a color for fragments based on original
    const baseColor = (body.userData._colorIdx || 0) % FRAG_COLORS.length;

    try {
      const result = fractureBody(body, Vec2.get(clickX, clickY), {
        fragmentCount,
        explosionImpulse: 150,
      });

      // Color the fragments
      result.fragments.forEach((f, i) => {
        f.userData._colorIdx = (baseColor + i) % FRAG_COLORS.length;
        f.userData._breakable = true; // fragments can be re-fractured!
        f.userData._fragment = true;
      });
    } catch {
      // Skip bodies that can't be fractured (e.g. circles)
    }
  }
}

export default {
  id: "fracture",
  label: "Voronoi Fracture",
  tags: ["Destruction", "Voronoi", "Click", "Compound"],
  featured: true,
  featuredOrder: 2,
  desc:
    '<b>Click</b> on objects to shatter them with Voronoi fracture. Fragments can be re-fractured! <b>Scroll</b> to change blast radius.',
  walls: true,
  workerCompatible: false,

  setup(space, W, H) {
    space.gravity = new Vec2(0, 600);

    // Build a wall of breakable objects
    const bw = 70, bh = 50;
    const cols = 7, rows = 5;
    const startX = (W - cols * bw) / 2 + bw / 2;
    const startY = H - 60 - rows * bh + bh / 2;

    let colorIdx = 0;
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const x = startX + c * bw + (r % 2 ? bw / 2 : 0);
        const y = startY + r * bh;
        if (x > W - 60 || x < 60) continue;
        createBreakableBox(space, x, y, bw - 4, bh - 4, colorIdx++ % 6);
      }
    }

    // Add some hexagons and octagons on top
    for (let i = 0; i < 5; i++) {
      createBreakableHex(space, 200 + i * 130, startY - 80, 30, colorIdx++ % 6);
    }
    for (let i = 0; i < 3; i++) {
      createBreakableOctagon(space, 250 + i * 170, startY - 160, 35, colorIdx++ % 6);
    }
  },

  click(x, y, space) {
    doFracture(x, y, space);
  },

  wheel(deltaY) {
    blastRadius = Math.max(50, Math.min(500, blastRadius + deltaY * 0.5));
    fragmentCount = Math.max(4, Math.min(20, Math.round(blastRadius / 30)));
  },

  // Custom render: show blast radius circle and fragment outlines
  render(ctx, space, W, H, showOutlines, camX, camY) {
    // Blast radius indicator follows the mouse — stored via hover
    if (this._mouseX != null) {
      ctx.beginPath();
      ctx.arc(this._mouseX, this._mouseY, blastRadius, 0, Math.PI * 2);
      ctx.strokeStyle = "rgba(248,81,73,0.3)";
      ctx.lineWidth = 2;
      ctx.setLineDash([8, 6]);
      ctx.stroke();
      ctx.setLineDash([]);
    }
  },

  hover(x, y) {
    this._mouseX = x;
    this._mouseY = y;
  },

  code2d: `// Voronoi Fracture — click to shatter objects
const W = canvas.width, H = canvas.height;
const space = new Space(new Vec2(0, 600));

addWalls();

let blastRadius = 300, fragmentCount = 10;

// Build a wall of breakable boxes
const bw = 70, bh = 50;
const cols = 7, rows = 5;
const startX = (W - cols * bw) / 2 + bw / 2;
const startY = H - 60 - rows * bh + bh / 2;

for (let r = 0; r < rows; r++) {
  for (let c = 0; c < cols; c++) {
    const x = startX + c * bw + (r % 2 ? bw / 2 : 0);
    const y = startY + r * bh;
    if (x > W - 60 || x < 60) continue;
    const body = new Body(BodyType.DYNAMIC, new Vec2(x, y));
    body.shapes.add(new Polygon(Polygon.box(bw - 4, bh - 4)));
    body.userData._breakable = true;
    body.space = space;
  }
}

// Click to fracture
canvasWrap.addEventListener("click", (e) => {
  const rect = canvasWrap.getBoundingClientRect();
  const sx = W / rect.width, sy = H / rect.height;
  const cx = (e.clientX - rect.left) * sx;
  const cy = (e.clientY - rect.top) * sy;

  const toFracture = [];
  for (const body of space.bodies) {
    if (body.isStatic() || !body.userData._breakable) continue;
    const dx = body.position.x - cx;
    const dy = body.position.y - cy;
    if (dx * dx + dy * dy < blastRadius * blastRadius) {
      toFracture.push(body);
    }
  }

  for (const body of toFracture) {
    try {
      const result = fractureBody(body, Vec2.get(cx, cy), {
        fragmentCount,
        explosionImpulse: 150,
      });
      result.fragments.forEach((f) => {
        f.userData._breakable = true;
      });
    } catch {}
  }
});

function loop() {
  space.step(1 / 60, 8, 3);
  ctx.clearRect(0, 0, W, H);
  drawGrid();
  for (const body of space.bodies) drawBody(body);
  requestAnimationFrame(loop);
}
loop();`,

  codePixi: `// Voronoi Fracture — click to shatter objects
const space = new Space(new Vec2(0, 600));

addWalls();

let blastRadius = 300, fragmentCount = 10;

const bw = 70, bh = 50;
const cols = 7, rows = 5;
const startX = (W - cols * bw) / 2 + bw / 2;
const startY = H - 60 - rows * bh + bh / 2;

for (let r = 0; r < rows; r++) {
  for (let c = 0; c < cols; c++) {
    const x = startX + c * bw + (r % 2 ? bw / 2 : 0);
    const y = startY + r * bh;
    if (x > W - 60 || x < 60) continue;
    const body = new Body(BodyType.DYNAMIC, new Vec2(x, y));
    body.shapes.add(new Polygon(Polygon.box(bw - 4, bh - 4)));
    body.userData._breakable = true;
    body.space = space;
  }
}

app.canvas.addEventListener("click", (e) => {
  const rect = app.canvas.getBoundingClientRect();
  const sx = W / rect.width, sy = H / rect.height;
  const cx = (e.clientX - rect.left) * sx;
  const cy = (e.clientY - rect.top) * sy;

  const toFracture = [];
  for (const body of space.bodies) {
    if (body.isStatic() || !body.userData._breakable) continue;
    const dx = body.position.x - cx;
    const dy = body.position.y - cy;
    if (dx * dx + dy * dy < blastRadius * blastRadius) {
      toFracture.push(body);
    }
  }

  for (const body of toFracture) {
    try {
      const result = fractureBody(body, Vec2.get(cx, cy), {
        fragmentCount,
        explosionImpulse: 150,
      });
      result.fragments.forEach((f) => {
        f.userData._breakable = true;
      });
    } catch {}
  }
});

function loop() {
  space.step(1 / 60, 8, 3);
  drawGrid();
  syncBodies(space);
  app.render();
  requestAnimationFrame(loop);
}
loop();`,

  code3d: `// Voronoi Fracture 3D — click to shatter
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

const space = new Space(new Vec2(0, 600));
addWalls();

const COLORS = [0xf85149, 0xd29922, 0x58a6ff, 0xa371f7, 0x3fb950, 0xdbabff];
const meshMap = new Map();

function addMesh(body, color) {
  const shape = body.shapes.at(0);
  let geom;
  if (shape.isCircle()) {
    geom = new THREE.SphereGeometry(shape.castCircle.radius, 16, 16);
  } else {
    const verts = shape.castPolygon.localVerts;
    const pts = [];
    for (let i = 0; i < verts.length; i++) pts.push(new THREE.Vector2(verts.at(i).x, verts.at(i).y));
    const s = new THREE.Shape(pts);
    geom = new THREE.ExtrudeGeometry(s, { depth: 20, bevelEnabled: true, bevelSize: 1.5, bevelThickness: 1.5, bevelSegments: 2 });
    geom.translate(0, 0, -10);
  }
  const mesh = new THREE.Mesh(geom, new THREE.MeshPhongMaterial({ color, shininess: 80 }));
  scene.add(mesh);
  meshMap.set(body, mesh);
}

function removeMesh(body) {
  const mesh = meshMap.get(body);
  if (mesh) { scene.remove(mesh); meshMap.delete(body); }
}

// Build wall
const bw = 70, bh = 50;
const cols = 7, rows = 5;
const startX = (W - cols * bw) / 2 + bw / 2;
const startY = H - 60 - rows * bh + bh / 2;
let ci = 0;
for (let r = 0; r < rows; r++) {
  for (let c = 0; c < cols; c++) {
    const x = startX + c * bw + (r % 2 ? bw / 2 : 0);
    const y = startY + r * bh;
    if (x > W - 60 || x < 60) continue;
    const body = new Body(BodyType.DYNAMIC, new Vec2(x, y));
    body.shapes.add(new Polygon(Polygon.box(bw - 4, bh - 4)));
    body.userData._breakable = true;
    body.space = space;
    addMesh(body, COLORS[ci++ % COLORS.length]);
  }
}

renderer.domElement.addEventListener("click", (e) => {
  const rect = renderer.domElement.getBoundingClientRect();
  const cx = (e.clientX - rect.left) / rect.width * W;
  const cy = (e.clientY - rect.top) / rect.height * H;
  const toFracture = [];
  for (const body of space.bodies) {
    if (body.isStatic() || !body.userData._breakable) continue;
    const dx = body.position.x - cx;
    const dy = body.position.y - cy;
    if (dx * dx + dy * dy < 90000) toFracture.push(body);
  }
  for (const body of toFracture) {
    const color = meshMap.get(body)?.material?.color?.getHex?.() ?? COLORS[0];
    removeMesh(body);
    try {
      const result = fractureBody(body, Vec2.get(cx, cy), {
        fragmentCount: 10,
        explosionImpulse: 150,
      });
      result.fragments.forEach((f, i) => {
        f.userData._breakable = true;
        addMesh(f, COLORS[(ci + i) % COLORS.length]);
      });
      ci += result.fragments.length;
    } catch {}
  }
});

function loop() {
  space.step(1 / 60, 8, 3);
  for (const [body, mesh] of meshMap) {
    if (!body.space) { scene.remove(mesh); meshMap.delete(body); continue; }
    mesh.position.set(body.position.x, -body.position.y, 0);
    mesh.rotation.z = -body.rotation;
  }
  renderer.render(scene, camera);
  requestAnimationFrame(loop);
}
loop();`,
};
