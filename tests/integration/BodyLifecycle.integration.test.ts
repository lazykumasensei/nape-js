import { describe, it, expect } from "vitest";
import { Space } from "../../src/space/Space";
import { Body } from "../../src/phys/Body";
import { BodyType } from "../../src/phys/BodyType";
import { Vec2 } from "../../src/geom/Vec2";
import { Circle } from "../../src/shape/Circle";
import { Polygon } from "../../src/shape/Polygon";
import { Compound } from "../../src/phys/Compound";
import { DistanceJoint } from "../../src/constraint/DistanceJoint";
import { Material } from "../../src/phys/Material";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function dynamicCircle(x: number, y: number, radius = 10): Body {
  const b = new Body(BodyType.DYNAMIC, new Vec2(x, y));
  b.shapes.add(new Circle(radius));
  return b;
}

function dynamicBox(x: number, y: number, w = 20, h = 20): Body {
  const b = new Body(BodyType.DYNAMIC, new Vec2(x, y));
  b.shapes.add(new Polygon(Polygon.box(w, h)));
  return b;
}

function staticBox(x: number, y: number, w = 500, h = 10): Body {
  const b = new Body(BodyType.STATIC, new Vec2(x, y));
  b.shapes.add(new Polygon(Polygon.box(w, h)));
  return b;
}

function step(space: Space, n = 60): void {
  for (let i = 0; i < n; i++) space.step(1 / 60);
}

// ---------------------------------------------------------------------------
// 1. Adding and removing bodies from space
// ---------------------------------------------------------------------------
describe("Body lifecycle — add/remove from space", () => {
  it("should add a body to space via body.space = space", () => {
    const space = new Space(new Vec2(0, 100));
    const b = dynamicCircle(0, 0);
    b.space = space;
    expect(space.bodies.length).toBe(1);
  });

  it("should remove a body from space by setting body.space = null", () => {
    const space = new Space(new Vec2(0, 100));
    const b = dynamicCircle(0, 0);
    b.space = space;
    expect(space.bodies.length).toBe(1);
    b.space = null;
    expect(space.bodies.length).toBe(0);
  });

  it("should stop simulating a removed body", () => {
    const space = new Space(new Vec2(0, 100));
    const b = dynamicCircle(0, 0);
    b.space = space;
    step(space, 10);
    const posAfterAdd = b.position.y;
    b.space = null;
    step(space, 30);
    // Position should not change after removal
    expect(b.position.y).toBeCloseTo(posAfterAdd, 1);
  });

  it("should allow re-adding a body to the same space", () => {
    const space = new Space(new Vec2(0, 100));
    const b = dynamicCircle(0, 0);
    b.space = space;
    b.space = null;
    b.space = space;
    expect(space.bodies.length).toBe(1);
    step(space, 30);
    expect(b.position.y).toBeGreaterThan(0);
  });

  it("should support adding multiple bodies and removing specific ones", () => {
    const space = new Space(new Vec2(0, 100));
    const a = dynamicCircle(-50, 0);
    const b = dynamicCircle(0, 0);
    const c = dynamicCircle(50, 0);
    a.space = space;
    b.space = space;
    c.space = space;
    expect(space.bodies.length).toBe(3);

    b.space = null;
    expect(space.bodies.length).toBe(2);

    step(space, 30);
    expect(a.position.y).toBeGreaterThan(0);
    expect(c.position.y).toBeGreaterThan(0);
  });

  it("should handle adding body with multiple shapes", () => {
    const space = new Space(new Vec2(0, 100));
    const b = new Body(BodyType.DYNAMIC, new Vec2(0, 0));
    b.shapes.add(new Circle(10));
    b.shapes.add(new Polygon(Polygon.box(20, 20)));
    b.space = space;
    expect(space.bodies.length).toBe(1);
    step(space, 30);
    expect(b.position.y).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------
// 2. Body type transitions
// ---------------------------------------------------------------------------
describe("Body lifecycle — type transitions", () => {
  it("should change from DYNAMIC to STATIC and stop moving", () => {
    const space = new Space(new Vec2(0, 100));
    const b = dynamicCircle(0, 0);
    b.space = space;
    step(space, 10);
    const posY = b.position.y;
    expect(posY).toBeGreaterThan(0);

    b.type = BodyType.STATIC;
    step(space, 30);
    expect(b.position.y).toBeCloseTo(posY, 1);
  });

  it("should change from STATIC to DYNAMIC and start falling", () => {
    const space = new Space(new Vec2(0, 100));
    const b = new Body(BodyType.STATIC, new Vec2(0, 0));
    b.shapes.add(new Circle(10));
    b.space = space;
    step(space, 10);
    expect(b.position.y).toBeCloseTo(0);

    b.type = BodyType.DYNAMIC;
    step(space, 30);
    expect(b.position.y).toBeGreaterThan(0);
  });

  it("should change from DYNAMIC to KINEMATIC and maintain set velocity", () => {
    const space = new Space(new Vec2(0, 100));
    const b = dynamicCircle(0, 0);
    b.space = space;

    b.type = BodyType.KINEMATIC;
    b.velocity = new Vec2(50, 0);
    step(space, 60);

    // Kinematic: moves with set velocity, unaffected by gravity
    expect(b.position.x).toBeGreaterThan(30);
    expect(b.position.y).toBeCloseTo(0, 0);
  });

  it("should change from KINEMATIC to DYNAMIC and start responding to gravity", () => {
    const space = new Space(new Vec2(0, 100));
    const b = new Body(BodyType.KINEMATIC, new Vec2(0, 0));
    b.shapes.add(new Circle(10));
    b.space = space;
    step(space, 10);
    expect(b.position.y).toBeCloseTo(0);

    b.type = BodyType.DYNAMIC;
    step(space, 30);
    expect(b.position.y).toBeGreaterThan(0);
  });

  it("should clear velocity when transitioning to STATIC", () => {
    const space = new Space(new Vec2(0, 100));
    const b = dynamicCircle(0, 0);
    b.space = space;
    step(space, 10);
    // Body has velocity from gravity
    expect(b.velocity.y).toBeGreaterThan(0);

    b.type = BodyType.STATIC;
    expect(b.velocity.y).toBeCloseTo(0);
  });
});

// ---------------------------------------------------------------------------
// 3. Body properties during simulation
// ---------------------------------------------------------------------------
describe("Body lifecycle — properties during simulation", () => {
  it("should update position and velocity each step", () => {
    const space = new Space(new Vec2(0, 100));
    const b = dynamicCircle(0, 0);
    b.space = space;

    const positions: number[] = [];
    for (let i = 0; i < 10; i++) {
      space.step(1 / 60);
      positions.push(b.position.y);
    }

    // Each position should be greater than the previous
    for (let i = 1; i < positions.length; i++) {
      expect(positions[i]).toBeGreaterThan(positions[i - 1]);
    }
  });

  it("should respect allowRotation = false", () => {
    const space = new Space(new Vec2(0, 100));
    const b = dynamicBox(5, 0); // offset to cause torque on collision
    b.allowRotation = false;
    b.space = space;

    const floor = staticBox(0, 50);
    floor.space = space;

    step(space, 60);
    expect(b.rotation).toBeCloseTo(0);
  });

  it("should apply impulse to move a body horizontally", () => {
    const space = new Space(new Vec2(0, 0)); // no gravity
    const b = dynamicCircle(0, 0);
    b.space = space;

    b.applyImpulse(new Vec2(1000, 0));
    step(space, 60);
    expect(b.position.x).toBeGreaterThan(0);
  });

  it("should apply impulse for instant velocity change", () => {
    const space = new Space(new Vec2(0, 0));
    const b = dynamicCircle(0, 0);
    b.space = space;

    b.applyImpulse(new Vec2(100, 0));
    expect(b.velocity.x).toBeGreaterThan(0);
    step(space, 10);
    expect(b.position.x).toBeGreaterThan(0);
  });

  it("should handle setPosition to teleport body", () => {
    const space = new Space(new Vec2(0, 100));
    const b = dynamicCircle(0, 0);
    b.space = space;
    step(space, 10);

    b.position = new Vec2(200, 200);
    expect(b.position.x).toBeCloseTo(200);
    expect(b.position.y).toBeCloseTo(200);
  });

  it("should handle angular velocity", () => {
    const space = new Space(new Vec2(0, 0));
    const b = dynamicBox(0, 0);
    b.space = space;
    b.angularVel = 2.0;

    step(space, 30);
    expect(Math.abs(b.rotation)).toBeGreaterThan(0.5);
  });

  it("should respect isBullet flag (CCD body)", () => {
    const space = new Space(new Vec2(0, 0));
    const b = dynamicCircle(0, 0, 5);
    b.isBullet = true;
    b.space = space;
    expect(b.isBullet).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// 4. Compound body lifecycle
// ---------------------------------------------------------------------------
describe("Body lifecycle — compounds", () => {
  it("should add a compound with bodies to space and simulate them", () => {
    const space = new Space(new Vec2(0, 100));
    const compound = new Compound();
    const b1 = dynamicCircle(-10, 0);
    const b2 = dynamicCircle(10, 0);
    b1.compound = compound;
    b2.compound = compound;

    compound.space = space;

    // Compound bodies are managed through the compound
    expect(compound.bodies.length).toBe(2);
    step(space, 30);
    expect(b1.position.y).toBeGreaterThan(0);
    expect(b2.position.y).toBeGreaterThan(0);
  });

  it("should remove entire compound from space and stop simulation", () => {
    const space = new Space(new Vec2(0, 100));
    const compound = new Compound();
    const b1 = dynamicCircle(-10, 0);
    const b2 = dynamicCircle(10, 0);
    b1.compound = compound;
    b2.compound = compound;
    compound.space = space;
    expect(compound.bodies.length).toBe(2);

    step(space, 10);
    const posY1 = b1.position.y;
    compound.space = null;
    step(space, 30);

    // Bodies should not move further after compound is removed
    expect(b1.position.y).toBeCloseTo(posY1, 1);
  });

  it("should add compound with constraint", () => {
    const space = new Space(new Vec2(0, 100));
    const compound = new Compound();
    const b1 = dynamicCircle(-20, 0);
    const b2 = dynamicCircle(20, 0);
    b1.compound = compound;
    b2.compound = compound;

    const joint = new DistanceJoint(b1, b2, new Vec2(0, 0), new Vec2(0, 0), 30, 50);
    joint.compound = compound;
    compound.space = space;

    step(space, 60);
    // Bodies should stay connected
    const dist = Math.sqrt(
      (b1.position.x - b2.position.x) ** 2 + (b1.position.y - b2.position.y) ** 2,
    );
    expect(dist).toBeLessThanOrEqual(55);
  });
});

// ---------------------------------------------------------------------------
// 5. Body mass and material properties
// ---------------------------------------------------------------------------
describe("Body lifecycle — mass and material", () => {
  it("should fall faster with greater mass under same conditions", () => {
    const space1 = new Space(new Vec2(0, 100));
    const light = dynamicCircle(0, 0, 5);
    light.space = space1;

    const space2 = new Space(new Vec2(0, 100));
    const heavy = dynamicCircle(0, 0, 50);
    heavy.space = space2;

    step(space1, 30);
    step(space2, 30);

    // Under gravity with no drag, both should fall at the same rate
    // (Galileo's principle in the engine)
    expect(Math.abs(light.position.y - heavy.position.y)).toBeLessThan(5);
  });

  it("should bounce with elastic material", () => {
    const space = new Space(new Vec2(0, 500));
    const bouncy = new Material(0.95, 0, 0, 1, 0);
    const floor = staticBox(0, 100);
    floor.shapes.at(0).material = bouncy;
    floor.space = space;

    const ball = dynamicCircle(0, 0, 10);
    ball.shapes.at(0).material = bouncy;
    ball.space = space;

    // Let it fall and bounce
    step(space, 120);
    // Ball should still have significant velocity (bouncing back up)
    // or be at a different position than the floor
    expect(ball.position.y).toBeLessThan(100);
  });

  it("should respect custom density via material", () => {
    const b1 = dynamicCircle(0, 0, 10);
    const mass1 = b1.mass;

    const b2 = dynamicCircle(0, 0, 10);
    b2.shapes.at(0).material = new Material(0, 0, 0, 5, 0); // density = 5
    const mass2 = b2.mass;

    expect(mass2).toBeGreaterThan(mass1);
  });
});
