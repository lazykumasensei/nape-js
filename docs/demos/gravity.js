import { Body, BodyType, Vec2, Circle, Polygon } from "../nape-js.esm.js";
import { spawnRandomShape } from "../demo-runner.js";

// Module-level planet position (reset in setup)
let _planetX = 0;
let _planetY = 0;

export default {
  id: "gravity",
  label: "Orbital Gravity",
  tags: ["Zero Gravity", "Custom Force", "Orbital", "Click"],
  featured: true,
  featuredOrder: 5,
  desc: 'Mario Galaxy-style gravity: bodies are pulled toward a central planet. <b>Click</b> to spawn orbiting bodies.',
  walls: false,
  moduleState: `let _planetX = 0;
let _planetY = 0;`,

  setup(space, W, H) {
    space.gravity = new Vec2(0, 0); // no global gravity

    _planetX = W / 2;
    _planetY = H / 2;

    // Central "planet"
    const planet = new Body(BodyType.STATIC, new Vec2(W / 2, H / 2));
    planet.shapes.add(new Circle(40));
    planet.space = space;

    // Orbiting bodies
    for (let i = 0; i < 50; i++) {
      const angle = Math.random() * Math.PI * 2;
      const dist = 100 + Math.random() * 180;
      const b = spawnRandomShape(
        space,
        W / 2 + Math.cos(angle) * dist,
        H / 2 + Math.sin(angle) * dist,
      );
      // Give tangential velocity for orbit
      const speed = 80 + Math.random() * 60;
      b.velocity = new Vec2(
        -Math.sin(angle) * speed,
        Math.cos(angle) * speed,
      );
    }
  },

  step(space, W, H) {
    // Apply gravity toward center for all dynamic bodies
    const cx = _planetX;
    const cy = _planetY;
    const G = 800000;
    for (const body of space.bodies) {
      if (body.isStatic()) continue;
      const dx = cx - body.position.x;
      const dy = cy - body.position.y;
      const distSq = dx * dx + dy * dy;
      if (distSq < 100) continue;
      const dist = Math.sqrt(distSq);
      const force = G / distSq;
      body.force = new Vec2(dx / dist * force, dy / dist * force);
    }
  },

  click(x, y, space, W, H) {
    const b = spawnRandomShape(space, x, y);
    const dx = _planetX - x;
    const dy = _planetY - y;
    const dist = Math.sqrt(dx * dx + dy * dy) || 1;
    const speed = 100;
    b.velocity = new Vec2(-dy / dist * speed, dx / dist * speed);
  },
};
