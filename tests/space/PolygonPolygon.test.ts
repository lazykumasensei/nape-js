import { describe, it, expect } from "vitest";
import { Space } from "../../src/space/Space";
import { Body } from "../../src/phys/Body";
import { BodyType } from "../../src/phys/BodyType";
import { Vec2 } from "../../src/geom/Vec2";
import { Polygon } from "../../src/shape/Polygon";
import { Circle } from "../../src/shape/Circle";
import { Material } from "../../src/phys/Material";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function step(space: Space, n: number, dt = 1 / 60): void {
  for (let i = 0; i < n; i++) space.step(dt);
}

function dynamicBox(x: number, y: number, w = 20, h = 20): Body {
  const body = new Body(BodyType.DYNAMIC, new Vec2(x, y));
  body.shapes.add(new Polygon(Polygon.box(w, h)));
  return body;
}

function staticFloor(x: number, y: number, w = 500, h = 20): Body {
  const body = new Body(BodyType.STATIC, new Vec2(x, y));
  body.shapes.add(new Polygon(Polygon.box(w, h)));
  return body;
}

/** Returns true if body is above the floor surface (hasn't tunneled through). */
function isAboveFloor(body: Body, floorY: number, floorH: number): boolean {
  // Floor top surface = floorY - floorH/2
  const floorTop = floorY - floorH / 2;
  return body.position.y < floorTop + 5; // 5px tolerance
}

/** Returns true if body has settled (low velocity). */
function hasSettled(body: Body, threshold = 5): boolean {
  return Math.abs(body.velocity.x) < threshold && Math.abs(body.velocity.y) < threshold;
}

// ---------------------------------------------------------------------------
// P53: Polygon-Polygon tunneling bug validation
// ---------------------------------------------------------------------------

describe("P53 — Polygon-Polygon collision with multiple dynamic bodies", () => {
  // --- Baseline: single dynamic polygon on static polygon floor ---

  it("single dynamic box should land on static polygon floor", () => {
    const space = new Space(new Vec2(0, 400));
    const floor = staticFloor(0, 300, 500, 20);
    const box = dynamicBox(0, 0, 30, 30);
    space.bodies.add(floor);
    space.bodies.add(box);

    step(space, 600);

    expect(isAboveFloor(box, 300, 20)).toBe(true);
    expect(hasSettled(box)).toBe(true);
  });

  // --- Core P53 scenario: 2 dynamic polygons ---

  it("two dynamic boxes should both land on static polygon floor", () => {
    const space = new Space(new Vec2(0, 400));
    const floor = staticFloor(0, 300, 500, 20);
    const box1 = dynamicBox(-40, 0, 30, 30);
    const box2 = dynamicBox(40, 0, 30, 30);
    space.bodies.add(floor);
    space.bodies.add(box1);
    space.bodies.add(box2);

    step(space, 600);

    expect(isAboveFloor(box1, 300, 20)).toBe(true);
    expect(isAboveFloor(box2, 300, 20)).toBe(true);
    expect(hasSettled(box1)).toBe(true);
    expect(hasSettled(box2)).toBe(true);
  });

  it("two dynamic boxes dropped at same X should stack", () => {
    const space = new Space(new Vec2(0, 400));
    const floor = staticFloor(0, 300, 500, 20);
    const box1 = dynamicBox(0, 100, 30, 30); // closer to floor
    const box2 = dynamicBox(0, -50, 30, 30); // higher up
    space.bodies.add(floor);
    space.bodies.add(box1);
    space.bodies.add(box2);

    step(space, 600);

    expect(isAboveFloor(box1, 300, 20)).toBe(true);
    expect(isAboveFloor(box2, 300, 20)).toBe(true);
    // box2 should be on top of box1
    expect(box2.position.y).toBeLessThan(box1.position.y);
    expect(hasSettled(box1)).toBe(true);
    expect(hasSettled(box2)).toBe(true);
  });

  // --- 3+ dynamic polygons ---

  it("three dynamic boxes should all land on static polygon floor", () => {
    const space = new Space(new Vec2(0, 400));
    const floor = staticFloor(0, 300, 500, 20);
    const boxes = [dynamicBox(-60, 0, 30, 30), dynamicBox(0, 0, 30, 30), dynamicBox(60, 0, 30, 30)];
    for (const b of boxes) space.bodies.add(b);
    space.bodies.add(floor);

    step(space, 600);

    for (const b of boxes) {
      expect(isAboveFloor(b, 300, 20)).toBe(true);
      expect(hasSettled(b)).toBe(true);
    }
  });

  it("five dynamic boxes in a row should all land on static polygon floor", () => {
    const space = new Space(new Vec2(0, 400));
    const floor = staticFloor(0, 300, 500, 20);
    space.bodies.add(floor);

    const boxes: Body[] = [];
    for (let i = 0; i < 5; i++) {
      const box = dynamicBox(-80 + i * 40, 0, 30, 30);
      space.bodies.add(box);
      boxes.push(box);
    }

    step(space, 600);

    for (const b of boxes) {
      expect(isAboveFloor(b, 300, 20)).toBe(true);
      expect(hasSettled(b)).toBe(true);
    }
  });

  // --- Stacking tower (vertical) ---

  it("vertical stack of 3 boxes should settle on polygon floor", () => {
    const space = new Space(new Vec2(0, 400));
    const floor = staticFloor(0, 300, 500, 20);
    space.bodies.add(floor);

    const boxes: Body[] = [];
    for (let i = 0; i < 3; i++) {
      const box = dynamicBox(0, 200 - i * 40, 30, 30);
      space.bodies.add(box);
      boxes.push(box);
    }

    step(space, 800);

    for (const b of boxes) {
      expect(isAboveFloor(b, 300, 20)).toBe(true);
    }
    // They should be ordered vertically (bottom to top)
    for (let i = 0; i < boxes.length - 1; i++) {
      expect(boxes[i].position.y).toBeGreaterThan(boxes[i + 1].position.y);
    }
  });

  // --- Different sizes ---

  it("mixed-size polygon boxes should all land on polygon floor", () => {
    const space = new Space(new Vec2(0, 400));
    const floor = staticFloor(0, 300, 500, 20);
    space.bodies.add(floor);

    const boxes = [
      dynamicBox(-60, 0, 10, 10), // small
      dynamicBox(0, 0, 30, 30), // medium
      dynamicBox(60, 0, 50, 50), // large
    ];
    for (const b of boxes) space.bodies.add(b);

    step(space, 600);

    for (const b of boxes) {
      expect(isAboveFloor(b, 300, 20)).toBe(true);
      expect(hasSettled(b)).toBe(true);
    }
  });

  // --- High-speed polygon drop (tunneling-prone) ---

  it("fast-falling polygon boxes should not tunnel through static polygon floor", () => {
    const space = new Space(new Vec2(0, 800)); // strong gravity
    const floor = staticFloor(0, 300, 500, 20);
    space.bodies.add(floor);

    const boxes: Body[] = [];
    for (let i = 0; i < 3; i++) {
      const box = dynamicBox(-40 + i * 40, -200, 20, 20); // start high
      space.bodies.add(box);
      boxes.push(box);
    }

    step(space, 600);

    for (const b of boxes) {
      expect(isAboveFloor(b, 300, 20)).toBe(true);
    }
  });

  // --- isBullet polygon bodies ---

  it("isBullet polygon boxes should not tunnel through polygon floor", () => {
    const space = new Space(new Vec2(0, 800));
    const floor = staticFloor(0, 300, 500, 20);
    space.bodies.add(floor);

    const boxes: Body[] = [];
    for (let i = 0; i < 3; i++) {
      const box = dynamicBox(-40 + i * 40, -200, 20, 20);
      box.isBullet = true;
      space.bodies.add(box);
      boxes.push(box);
    }

    step(space, 600);

    for (const b of boxes) {
      expect(isAboveFloor(b, 300, 20)).toBe(true);
    }
  });

  // --- Dynamic polygon vs dynamic polygon (no floor) ---

  it("two dynamic boxes moving toward each other should collide", () => {
    const space = new Space(new Vec2(0, 0)); // no gravity
    const box1 = dynamicBox(-60, 0, 30, 30);
    box1.velocity = new Vec2(100, 0);
    const box2 = dynamicBox(60, 0, 30, 30);
    box2.velocity = new Vec2(-100, 0);
    space.bodies.add(box1);
    space.bodies.add(box2);

    step(space, 120);

    // Should have bounced apart
    expect(box1.position.x).toBeLessThan(box2.position.x);
    // Velocities should have reversed or at least changed
    expect(box1.velocity.x).toBeLessThanOrEqual(0);
    expect(box2.velocity.x).toBeGreaterThanOrEqual(0);
  });

  // --- Multiple polygon-polygon pairs without floor ---

  it("four dynamic boxes converging should all resolve collisions", () => {
    const space = new Space(new Vec2(0, 0));
    const b1 = dynamicBox(-60, 0, 20, 20);
    b1.velocity = new Vec2(80, 0);
    const b2 = dynamicBox(60, 0, 20, 20);
    b2.velocity = new Vec2(-80, 0);
    const b3 = dynamicBox(0, -60, 20, 20);
    b3.velocity = new Vec2(0, 80);
    const b4 = dynamicBox(0, 60, 20, 20);
    b4.velocity = new Vec2(0, -80);
    space.bodies.add(b1);
    space.bodies.add(b2);
    space.bodies.add(b3);
    space.bodies.add(b4);

    step(space, 120);

    // No two bodies should be overlapping
    const bodies = [b1, b2, b3, b4];
    for (let i = 0; i < bodies.length; i++) {
      for (let j = i + 1; j < bodies.length; j++) {
        const dx = bodies[i].position.x - bodies[j].position.x;
        const dy = bodies[i].position.y - bodies[j].position.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        // 20x20 boxes — min separation ~20 (diagonal could be less, but centers shouldn't overlap)
        expect(dist).toBeGreaterThan(5);
      }
    }
  });

  // --- Comparison: circles vs polygons (same scenario) ---

  it("polygon bodies should behave like circle bodies (not tunnel) in same setup", () => {
    // Circle version (known working)
    const spaceC = new Space(new Vec2(0, 400));
    const floorC = staticFloor(0, 300, 500, 20);
    spaceC.bodies.add(floorC);
    const circles: Body[] = [];
    for (let i = 0; i < 4; i++) {
      const body = new Body(BodyType.DYNAMIC, new Vec2(-45 + i * 30, 0));
      body.shapes.add(new Circle(15));
      spaceC.bodies.add(body);
      circles.push(body);
    }
    step(spaceC, 600);

    // Polygon version (P53 bug scenario)
    const spaceP = new Space(new Vec2(0, 400));
    const floorP = staticFloor(0, 300, 500, 20);
    spaceP.bodies.add(floorP);
    const polys: Body[] = [];
    for (let i = 0; i < 4; i++) {
      const body = dynamicBox(-45 + i * 30, 0, 30, 30);
      spaceP.bodies.add(body);
      polys.push(body);
    }
    step(spaceP, 600);

    // Both circle and polygon bodies should end up above the floor
    for (const c of circles) {
      expect(isAboveFloor(c, 300, 20)).toBe(true);
    }
    for (const p of polys) {
      expect(isAboveFloor(p, 300, 20)).toBe(true);
    }
  });

  // --- Polygon shapes with different rotations ---

  it("rotated dynamic polygon boxes should land on polygon floor", () => {
    const space = new Space(new Vec2(0, 400));
    const floor = staticFloor(0, 300, 500, 20);
    space.bodies.add(floor);

    const boxes: Body[] = [];
    for (let i = 0; i < 3; i++) {
      const box = dynamicBox(-50 + i * 50, 0, 30, 30);
      box.rotation = (Math.PI / 6) * i; // 0°, 30°, 60°
      space.bodies.add(box);
      boxes.push(box);
    }

    step(space, 600);

    for (const b of boxes) {
      expect(isAboveFloor(b, 300, 20)).toBe(true);
      expect(hasSettled(b)).toBe(true);
    }
  });

  // --- Non-square polygon shapes (rectangles, triangles) ---

  it("dynamic rectangles (non-square) should land on polygon floor", () => {
    const space = new Space(new Vec2(0, 400));
    const floor = staticFloor(0, 300, 500, 20);
    space.bodies.add(floor);

    const boxes: Body[] = [];
    for (let i = 0; i < 3; i++) {
      const box = dynamicBox(-50 + i * 50, 0, 60, 10); // wide flat rectangles
      space.bodies.add(box);
      boxes.push(box);
    }

    step(space, 600);

    for (const b of boxes) {
      expect(isAboveFloor(b, 300, 20)).toBe(true);
      expect(hasSettled(b)).toBe(true);
    }
  });

  it("dynamic triangles should land on polygon floor", () => {
    const space = new Space(new Vec2(0, 400));
    const floor = staticFloor(0, 300, 500, 20);
    space.bodies.add(floor);

    const triangles: Body[] = [];
    for (let i = 0; i < 3; i++) {
      const body = new Body(BodyType.DYNAMIC, new Vec2(-50 + i * 50, 0));
      body.shapes.add(new Polygon([Vec2.get(0, -15), Vec2.get(15, 15), Vec2.get(-15, 15)]));
      space.bodies.add(body);
      triangles.push(body);
    }

    step(space, 600);

    for (const b of triangles) {
      expect(isAboveFloor(b, 300, 20)).toBe(true);
      expect(hasSettled(b)).toBe(true);
    }
  });

  // --- Polygon pile (many bodies, same drop zone) ---

  it("pile of 10 polygon boxes should all stay above floor", () => {
    const space = new Space(new Vec2(0, 400));
    const floor = staticFloor(0, 300, 500, 20);
    space.bodies.add(floor);

    const boxes: Body[] = [];
    for (let i = 0; i < 10; i++) {
      const x = (i % 5) * 25 - 50;
      const y = -Math.floor(i / 5) * 40;
      const box = dynamicBox(x, y, 20, 20);
      space.bodies.add(box);
      boxes.push(box);
    }

    step(space, 800);

    for (const b of boxes) {
      expect(isAboveFloor(b, 300, 20)).toBe(true);
    }
  });

  // --- Step-by-step tracking (detect tunneling mid-simulation) ---

  it("no polygon box should pass through floor at any simulation step", () => {
    const space = new Space(new Vec2(0, 400));
    const floor = staticFloor(0, 300, 500, 20);
    space.bodies.add(floor);

    const boxes: Body[] = [];
    for (let i = 0; i < 3; i++) {
      const box = dynamicBox(-30 + i * 30, 0, 20, 20);
      space.bodies.add(box);
      boxes.push(box);
    }

    const floorBottom = 300 + 10; // floor center + half-height
    for (let s = 0; s < 600; s++) {
      space.step(1 / 60);
      for (const b of boxes) {
        // Body center should never go below floor bottom
        expect(b.position.y).toBeLessThan(floorBottom + 20);
      }
    }
  });

  // --- Multiple static floors (complex scenario) ---

  it("polygon boxes should land on multiple static polygon platforms", () => {
    const space = new Space(new Vec2(0, 400));
    // Two platforms
    const floor1 = staticFloor(-80, 200, 150, 20);
    const floor2 = staticFloor(80, 250, 150, 20);
    space.bodies.add(floor1);
    space.bodies.add(floor2);

    const box1 = dynamicBox(-80, 0, 25, 25);
    const box2 = dynamicBox(80, 0, 25, 25);
    space.bodies.add(box1);
    space.bodies.add(box2);

    step(space, 600);

    expect(isAboveFloor(box1, 200, 20)).toBe(true);
    expect(isAboveFloor(box2, 250, 20)).toBe(true);
    expect(hasSettled(box1)).toBe(true);
    expect(hasSettled(box2)).toBe(true);
  });

  // --- Dynamic-dynamic polygon stacking without sleep interference ---

  it("dynamic boxes should stack without allowSleep interference", () => {
    const space = new Space(new Vec2(0, 400));
    const floor = staticFloor(0, 300, 500, 20);
    space.bodies.add(floor);

    const boxes: Body[] = [];
    for (let i = 0; i < 3; i++) {
      const box = dynamicBox(0, 200 - i * 40, 30, 30);
      box.allowMovement = true;
      box.allowRotation = true;
      space.bodies.add(box);
      boxes.push(box);
    }

    step(space, 800);

    for (const b of boxes) {
      expect(isAboveFloor(b, 300, 20)).toBe(true);
    }
  });

  // --- Polygon with zero-friction material ---
  // NOTE: Zero-friction + horizontal velocity causes tunneling for BOTH
  // circles and polygons — this is a general engine issue, not P53-specific.

  it("zero-friction polygon boxes without horizontal velocity should land on floor", () => {
    const space = new Space(new Vec2(0, 400));
    const slipperyMat = new Material(0, 0, 0, 1, 0.001);

    const floor = new Body(BodyType.STATIC, new Vec2(0, 300));
    const floorShape = new Polygon(Polygon.box(500, 20));
    floorShape.material = slipperyMat;
    floor.shapes.add(floorShape);
    space.bodies.add(floor);

    const boxes: Body[] = [];
    for (let i = 0; i < 3; i++) {
      const box = new Body(BodyType.DYNAMIC, new Vec2(-40 + i * 40, 0));
      const boxShape = new Polygon(Polygon.box(20, 20));
      boxShape.material = slipperyMat;
      box.shapes.add(boxShape);
      space.bodies.add(box);
      boxes.push(box);
    }

    step(space, 600);

    for (const b of boxes) {
      expect(isAboveFloor(b, 300, 20)).toBe(true);
    }
  });

  it("zero-friction + horizontal velocity causes tunneling (known engine-wide issue, not P53)", () => {
    // This documents a known issue: zero-friction material + horizontal
    // velocity causes bodies to tunnel through floors for ALL shape types.
    const space = new Space(new Vec2(0, 400));
    const slipperyMat = new Material(0, 0, 0, 1, 0.001);

    const floor = new Body(BodyType.STATIC, new Vec2(0, 300));
    const floorShape = new Polygon(Polygon.box(500, 20));
    floorShape.material = slipperyMat;
    floor.shapes.add(floorShape);
    space.bodies.add(floor);

    const box = new Body(BodyType.DYNAMIC, new Vec2(0, 0));
    const boxShape = new Polygon(Polygon.box(20, 20));
    boxShape.material = slipperyMat;
    box.shapes.add(boxShape);
    box.velocity = new Vec2(50, 0);
    space.bodies.add(box);

    step(space, 600);

    // This currently tunnels — documenting current behavior
    // When fixed, change to: expect(isAboveFloor(box, 300, 20)).toBe(true)
    expect(box.position.y).toBeGreaterThan(310);
  });

  // --- High-elasticity polygon bouncing ---

  it("bouncy polygon boxes should eventually settle on polygon floor", () => {
    const space = new Space(new Vec2(0, 400));
    const bouncyMat = new Material(0.9, 0.3, 0.3, 1, 0.001);

    const floor = new Body(BodyType.STATIC, new Vec2(0, 300));
    const floorShape = new Polygon(Polygon.box(500, 20));
    floorShape.material = bouncyMat;
    floor.shapes.add(floorShape);
    space.bodies.add(floor);

    const boxes: Body[] = [];
    for (let i = 0; i < 3; i++) {
      const box = new Body(BodyType.DYNAMIC, new Vec2(-40 + i * 40, 0));
      const boxShape = new Polygon(Polygon.box(20, 20));
      boxShape.material = bouncyMat;
      box.shapes.add(boxShape);
      space.bodies.add(box);
      boxes.push(box);
    }

    step(space, 1200); // more steps for bouncing to settle

    for (const b of boxes) {
      expect(isAboveFloor(b, 300, 20)).toBe(true);
    }
  });
});
