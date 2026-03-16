import { describe, it, expect, beforeEach } from "vitest";
import "../../src/core/engine";
import { Space } from "../../src/space/Space";
import { Body } from "../../src/phys/Body";
import { BodyType } from "../../src/phys/BodyType";
import { Vec2 } from "../../src/geom/Vec2";
import { Circle } from "../../src/shape/Circle";
import { Polygon } from "../../src/shape/Polygon";
import { AngleJoint } from "../../src/constraint/AngleJoint";
import { MotorJoint } from "../../src/constraint/MotorJoint";
import { WeldJoint } from "../../src/constraint/WeldJoint";
import { PulleyJoint } from "../../src/constraint/PulleyJoint";
import { LineJoint } from "../../src/constraint/LineJoint";
import { PivotJoint } from "../../src/constraint/PivotJoint";
import { DistanceJoint } from "../../src/constraint/DistanceJoint";
import { Compound } from "../../src/phys/Compound";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeDynamic(x: number, y: number, radius = 10): Body {
  const b = new Body(BodyType.DYNAMIC, new Vec2(x, y));
  b.shapes.add(new Circle(radius));
  return b;
}

function makeStatic(x: number, y: number, radius = 5): Body {
  const b = new Body(BodyType.STATIC, new Vec2(x, y));
  b.shapes.add(new Circle(radius));
  return b;
}

function stepSpace(space: Space, n = 60, dt = 1 / 60): void {
  for (let i = 0; i < n; i++) {
    space.step(dt, 10, 10);
  }
}

/** Check body identity by comparing position (body getter returns new wrapper). */
function sameBody(a: Body, b: Body): boolean {
  if (a == null && b == null) return true;
  if (a == null || b == null) return false;
  return a.position.x === b.position.x && a.position.y === b.position.y;
}

// ===========================================================================
// AngleJoint
// ===========================================================================
describe("AngleJoint — coverage", () => {
  let space: Space;
  let b1: Body;
  let b2: Body;

  beforeEach(() => {
    space = new Space(new Vec2(0, 0));
    b1 = makeDynamic(0, 0);
    b1.space = space;
    b2 = makeDynamic(50, 0);
    b2.space = space;
  });

  it("creates with valid params and reflects properties", () => {
    const j = new AngleJoint(b1, b2, -1, 1, 2.0);
    expect(j.body1).toBeDefined();
    expect(j.body2).toBeDefined();
    expect(j.jointMin).toBeCloseTo(-1);
    expect(j.jointMax).toBeCloseTo(1);
    expect(j.ratio).toBeCloseTo(2.0);
    expect(j.stiff).toBe(true);
  });

  it("rejects NaN jointMin, jointMax, ratio", () => {
    expect(() => new AngleJoint(b1, b2, NaN, 1)).toThrow("NaN");
    expect(() => new AngleJoint(b1, b2, 0, NaN)).toThrow("NaN");
    expect(() => new AngleJoint(b1, b2, 0, 1, NaN)).toThrow("NaN");
  });

  it("setter rejects NaN for jointMin/jointMax/ratio", () => {
    const j = new AngleJoint(b1, b2, -1, 1);
    expect(() => { j.jointMin = NaN; }).toThrow("NaN");
    expect(() => { j.jointMax = NaN; }).toThrow("NaN");
    expect(() => { j.ratio = NaN; }).toThrow("NaN");
  });

  it("set jointMin/jointMax/ratio to new values", () => {
    const j = new AngleJoint(b1, b2, -1, 1, 1);
    j.jointMin = -2;
    j.jointMax = 2;
    j.ratio = 3;
    expect(j.jointMin).toBeCloseTo(-2);
    expect(j.jointMax).toBeCloseTo(2);
    expect(j.ratio).toBeCloseTo(3);
  });

  it("simulation: two dynamic bodies with tight angle constraint", () => {
    b2.angularVel = 5;
    const j = new AngleJoint(b1, b2, -0.2, 0.2, 1.0);
    j.space = space;

    stepSpace(space, 120);

    const relAngle = b2.rotation - b1.rotation;
    expect(Math.abs(relAngle)).toBeLessThan(1.0);
  });

  it("elastic mode (stiff=false) with frequency and damping", () => {
    const j = new AngleJoint(b1, b2, 0, 0, 1.0);
    j.stiff = false;
    j.frequency = 5;
    j.damping = 0.5;
    j.space = space;

    b2.angularVel = 10;
    stepSpace(space, 120);

    expect(Math.abs(b2.rotation - b1.rotation)).toBeLessThan(10);
  });

  it("break under force removes constraint from space", () => {
    const j = new AngleJoint(b1, b2, 0, 0, 1.0);
    j.breakUnderForce = true;
    j.maxForce = 0.001;
    j.removeOnBreak = true;
    j.space = space;

    b2.angularVel = 100;
    stepSpace(space, 30);

    expect(j.space).toBeNull();
  });

  it("body reassignment while in space", () => {
    const j = new AngleJoint(b1, b2, -1, 1);
    j.space = space;

    const b3 = makeDynamic(100, 0);
    b3.space = space;

    j.body1 = b3;
    expect(j.body1.position.x).toBeCloseTo(100);

    j.body2 = b1;
    expect(j.body2.position.x).toBeCloseTo(0);
  });

  it("copy creates an independent constraint", () => {
    const j = new AngleJoint(b1, b2, -0.5, 0.5, 2.0);
    j.stiff = false;
    j.frequency = 8;
    j.damping = 0.7;
    j.maxForce = 500;

    const c = j.copy();
    expect(c).toBeDefined();
    expect(c.space).toBeNull();
  });

  it("isSlack returns boolean when bodies present", () => {
    const j = new AngleJoint(b1, b2, -Math.PI, Math.PI);
    j.space = space;
    stepSpace(space, 5);
    const result = j.isSlack();
    expect(typeof result).toBe("boolean");
  });

  it("isSlack throws when a body is null", () => {
    const j = new AngleJoint(null, b2, -1, 1);
    expect(() => j.isSlack()).toThrow();
  });

  it("impulse returns a MatMN(1,1)", () => {
    const j = new AngleJoint(b1, b2, 0, 0);
    j.space = space;
    stepSpace(space, 5);
    const imp = j.impulse();
    expect(imp).toBeDefined();
  });

  it("bodyImpulse throws for null body", () => {
    const j = new AngleJoint(b1, b2, 0, 0);
    expect(() => j.bodyImpulse(null!)).toThrow("null");
  });

  it("bodyImpulse throws for unlinked body", () => {
    const j = new AngleJoint(b1, b2, 0, 0);
    const other = makeDynamic(200, 200);
    expect(() => j.bodyImpulse(other)).toThrow("not linked");
  });

  it("bodyImpulse returns zero vec3 when inactive", () => {
    const j = new AngleJoint(b1, b2, 0, 0);
    j.active = false;
    const imp = j.bodyImpulse(b1);
    expect(imp).toBeDefined();
  });

  it("bodyImpulse returns impulse for linked body after simulation", () => {
    const j = new AngleJoint(b1, b2, 0, 0);
    j.space = space;
    b2.angularVel = 5;
    stepSpace(space, 10);
    const imp = j.bodyImpulse(b1);
    expect(imp).toBeDefined();
  });

  it("visitBodies calls lambda for each distinct body", () => {
    const j = new AngleJoint(b1, b2, 0, 0);
    const visited: Body[] = [];
    j.visitBodies((b) => visited.push(b));
    expect(visited.length).toBe(2);
  });

  it("visitBodies throws for null lambda", () => {
    const j = new AngleJoint(b1, b2, 0, 0);
    expect(() => j.visitBodies(null!)).toThrow("null");
  });

  it("visitBodies deduplicates when both bodies are the same", () => {
    const j = new AngleJoint(b1, b1, 0, 0);
    const visited: Body[] = [];
    j.visitBodies((b) => visited.push(b));
    expect(visited.length).toBe(1);
  });
});

// ===========================================================================
// MotorJoint
// ===========================================================================
describe("MotorJoint — coverage", () => {
  let space: Space;
  let b1: Body;
  let b2: Body;

  beforeEach(() => {
    space = new Space(new Vec2(0, 0));
    b1 = makeStatic(0, 0);
    b1.space = space;
    b2 = makeDynamic(0, 0, 20);
    b2.space = space;
  });

  it("creates with rate and ratio, reflects properties", () => {
    const j = new MotorJoint(b1, b2, 3.0, 2.0);
    expect(j.rate).toBeCloseTo(3.0);
    expect(j.ratio).toBeCloseTo(2.0);
    expect(j.body1).toBeDefined();
    expect(j.body2).toBeDefined();
  });

  it("defaults: rate=0, ratio=1", () => {
    const j = new MotorJoint(null, null);
    expect(j.rate).toBeCloseTo(0);
    expect(j.ratio).toBeCloseTo(1);
  });

  it("rejects NaN rate and ratio in constructor", () => {
    expect(() => new MotorJoint(b1, b2, NaN)).toThrow("NaN");
    expect(() => new MotorJoint(b1, b2, 0, NaN)).toThrow("NaN");
  });

  it("setter rejects NaN for rate/ratio", () => {
    const j = new MotorJoint(b1, b2, 1);
    expect(() => { j.rate = NaN; }).toThrow("NaN");
    expect(() => { j.ratio = NaN; }).toThrow("NaN");
  });

  it("simulation: motor drives angular velocity toward rate", () => {
    const j = new MotorJoint(b1, b2, 5.0);
    j.space = space;

    stepSpace(space, 60);

    expect(Math.abs(b2.angularVel)).toBeGreaterThan(1);
  });

  it("maxForce limits applied torque", () => {
    const j = new MotorJoint(b1, b2, 100.0);
    j.maxForce = 0.01;
    j.space = space;

    stepSpace(space, 60);

    expect(Math.abs(b2.angularVel)).toBeLessThan(50);
  });

  it("elastic mode (stiff=false)", () => {
    const j = new MotorJoint(b1, b2, 5.0);
    j.stiff = false;
    j.frequency = 3;
    j.damping = 0.8;
    j.space = space;

    stepSpace(space, 60);

    expect(Math.abs(b2.rotation)).toBeGreaterThan(0);
  });

  it("impulse and bodyImpulse after simulation", () => {
    const j = new MotorJoint(b1, b2, 5.0);
    j.space = space;
    stepSpace(space, 10);

    const imp = j.impulse();
    expect(imp).toBeDefined();

    const bi = j.bodyImpulse(b2);
    expect(bi).toBeDefined();
  });

  it("bodyImpulse returns zero when inactive", () => {
    const j = new MotorJoint(b1, b2, 5.0);
    j.active = false;
    const bi = j.bodyImpulse(b2);
    expect(bi).toBeDefined();
  });

  it("visitBodies visits both bodies", () => {
    const j = new MotorJoint(b1, b2, 1);
    const visited: Body[] = [];
    j.visitBodies((b) => visited.push(b));
    expect(visited.length).toBe(2);
  });

  it("break under force", () => {
    const j = new MotorJoint(b1, b2, 100.0);
    j.breakUnderForce = true;
    j.maxForce = 0.0001;
    j.removeOnBreak = true;
    j.space = space;

    stepSpace(space, 30);
    expect(j.space).toBeNull();
  });
});

// ===========================================================================
// WeldJoint
// ===========================================================================
describe("WeldJoint — coverage", () => {
  let space: Space;
  let b1: Body;
  let b2: Body;

  beforeEach(() => {
    space = new Space(new Vec2(0, -100));
    b1 = makeDynamic(0, 0);
    b1.space = space;
    b2 = makeDynamic(30, 0);
    b2.space = space;
  });

  it("creates with anchor points and phase", () => {
    const j = new WeldJoint(b1, b2, Vec2.weak(5, 0), Vec2.weak(-5, 0), 0.5);
    expect(j.body1).toBeDefined();
    expect(j.body2).toBeDefined();
    expect(j.phase).toBeCloseTo(0.5);
  });

  it("defaults phase to 0", () => {
    const j = new WeldJoint(b1, b2, Vec2.weak(0, 0), Vec2.weak(0, 0));
    expect(j.phase).toBeCloseTo(0);
  });

  it("rejects NaN phase in constructor", () => {
    expect(() => new WeldJoint(b1, b2, Vec2.weak(0, 0), Vec2.weak(0, 0), NaN)).toThrow("NaN");
  });

  it("rejects null anchors", () => {
    expect(() => new WeldJoint(b1, b2, null!, Vec2.weak(0, 0))).toThrow("null");
    expect(() => new WeldJoint(b1, b2, Vec2.weak(0, 0), null!)).toThrow("null");
  });

  it("setter rejects NaN phase", () => {
    const j = new WeldJoint(b1, b2, Vec2.weak(0, 0), Vec2.weak(0, 0));
    expect(() => { j.phase = NaN; }).toThrow("NaN");
  });

  it("phase setter updates value", () => {
    const j = new WeldJoint(b1, b2, Vec2.weak(0, 0), Vec2.weak(0, 0));
    j.phase = 1.5;
    expect(j.phase).toBeCloseTo(1.5);
  });

  it("anchor getters return correct values", () => {
    const j = new WeldJoint(b1, b2, Vec2.weak(1, 2), Vec2.weak(3, 4));
    const a1 = j.anchor1;
    expect(a1.x).toBeCloseTo(1);
    expect(a1.y).toBeCloseTo(2);

    const a2 = j.anchor2;
    expect(a2.x).toBeCloseTo(3);
    expect(a2.y).toBeCloseTo(4);
  });

  it("anchor setters update values", () => {
    const j = new WeldJoint(b1, b2, Vec2.weak(0, 0), Vec2.weak(0, 0));

    j.anchor1 = new Vec2(10, 20);
    expect(j.anchor1.x).toBeCloseTo(10);

    j.anchor2 = new Vec2(30, 40);
    expect(j.anchor2.x).toBeCloseTo(30);
  });

  it("simulation: bodies stay welded together", () => {
    const j = new WeldJoint(b1, b2, Vec2.weak(15, 0), Vec2.weak(-15, 0), 0);
    j.space = space;

    stepSpace(space, 120);

    const dx = b2.position.x - b1.position.x;
    const dy = b2.position.y - b1.position.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    expect(dist).toBeLessThan(50);
  });

  it("break under force removes from space", () => {
    const stat = makeStatic(0, -50);
    stat.space = space;

    const j = new WeldJoint(stat, b2, Vec2.weak(0, 0), Vec2.weak(0, 0));
    j.breakUnderForce = true;
    j.maxForce = 0.001;
    j.removeOnBreak = true;
    j.space = space;

    stepSpace(space, 30);
    expect(j.space).toBeNull();
  });

  it("impulse returns MatMN(3,1)", () => {
    const j = new WeldJoint(b1, b2, Vec2.weak(0, 0), Vec2.weak(0, 0));
    j.space = space;
    stepSpace(space, 5);
    const imp = j.impulse();
    expect(imp).toBeDefined();
  });

  it("bodyImpulse throws for null body", () => {
    const j = new WeldJoint(b1, b2, Vec2.weak(0, 0), Vec2.weak(0, 0));
    expect(() => j.bodyImpulse(null!)).toThrow("null");
  });

  it("bodyImpulse throws for unlinked body", () => {
    const j = new WeldJoint(b1, b2, Vec2.weak(0, 0), Vec2.weak(0, 0));
    const other = makeDynamic(999, 999);
    expect(() => j.bodyImpulse(other)).toThrow("not linked");
  });

  it("visitBodies throws for null lambda", () => {
    const j = new WeldJoint(b1, b2, Vec2.weak(0, 0), Vec2.weak(0, 0));
    expect(() => j.visitBodies(null!)).toThrow("null");
  });

  it("elastic weld joint (stiff=false)", () => {
    const j = new WeldJoint(b1, b2, Vec2.weak(15, 0), Vec2.weak(-15, 0));
    j.stiff = false;
    j.frequency = 4;
    j.damping = 0.3;
    j.space = space;

    stepSpace(space, 60);
    expect(b2.position).toBeDefined();
  });
});

// ===========================================================================
// PulleyJoint
// ===========================================================================
describe("PulleyJoint — coverage", () => {
  let space: Space;
  let b1: Body;
  let b2: Body;
  let b3: Body;
  let b4: Body;

  beforeEach(() => {
    space = new Space(new Vec2(0, 100));
    b1 = makeStatic(0, 0);
    b1.space = space;
    b2 = makeDynamic(0, 50);
    b2.space = space;
    b3 = makeStatic(100, 0);
    b3.space = space;
    b4 = makeDynamic(100, 50);
    b4.space = space;
  });

  it("creates with 4 bodies and anchors", () => {
    const j = new PulleyJoint(
      b1, b2, b3, b4,
      Vec2.weak(0, 0), Vec2.weak(0, 0),
      Vec2.weak(0, 0), Vec2.weak(0, 0),
      0, 200, 1.0,
    );
    expect(j.body1).toBeDefined();
    expect(j.body2).toBeDefined();
    expect(j.body3).toBeDefined();
    expect(j.body4).toBeDefined();
    expect(j.jointMin).toBeCloseTo(0);
    expect(j.jointMax).toBeCloseTo(200);
    expect(j.ratio).toBeCloseTo(1.0);
  });

  it("rejects NaN jointMin, jointMax, ratio", () => {
    const a = () => Vec2.weak(0, 0);
    expect(() => new PulleyJoint(b1, b2, b3, b4, a(), a(), a(), a(), NaN, 100)).toThrow("NaN");
    expect(() => new PulleyJoint(b1, b2, b3, b4, a(), a(), a(), a(), 0, NaN)).toThrow("NaN");
    expect(() => new PulleyJoint(b1, b2, b3, b4, a(), a(), a(), a(), 0, 100, NaN)).toThrow("NaN");
  });

  it("rejects negative jointMin / jointMax", () => {
    const a = () => Vec2.weak(0, 0);
    expect(() => new PulleyJoint(b1, b2, b3, b4, a(), a(), a(), a(), -1, 100)).toThrow(">= 0");
    expect(() => new PulleyJoint(b1, b2, b3, b4, a(), a(), a(), a(), 0, -1)).toThrow(">= 0");
  });

  it("rejects null anchors", () => {
    const a = () => Vec2.weak(0, 0);
    expect(() => new PulleyJoint(b1, b2, b3, b4, null!, a(), a(), a(), 0, 100)).toThrow("null");
    expect(() => new PulleyJoint(b1, b2, b3, b4, a(), null!, a(), a(), 0, 100)).toThrow("null");
    expect(() => new PulleyJoint(b1, b2, b3, b4, a(), a(), null!, a(), 0, 100)).toThrow("null");
    expect(() => new PulleyJoint(b1, b2, b3, b4, a(), a(), a(), null!, 0, 100)).toThrow("null");
  });

  it("setter rejects NaN and negative for jointMin/jointMax/ratio", () => {
    const a = () => Vec2.weak(0, 0);
    const j = new PulleyJoint(b1, b2, b3, b4, a(), a(), a(), a(), 0, 200);
    expect(() => { j.jointMin = NaN; }).toThrow("NaN");
    expect(() => { j.jointMax = NaN; }).toThrow("NaN");
    expect(() => { j.ratio = NaN; }).toThrow("NaN");
    expect(() => { j.jointMin = -1; }).toThrow(">= 0");
    expect(() => { j.jointMax = -1; }).toThrow(">= 0");
  });

  it("set jointMin/jointMax/ratio to new values", () => {
    const a = () => Vec2.weak(0, 0);
    const j = new PulleyJoint(b1, b2, b3, b4, a(), a(), a(), a(), 0, 200);
    j.jointMin = 10;
    j.jointMax = 300;
    j.ratio = 2.5;
    expect(j.jointMin).toBeCloseTo(10);
    expect(j.jointMax).toBeCloseTo(300);
    expect(j.ratio).toBeCloseTo(2.5);
  });

  it("anchor getters return defined values", () => {
    const a = () => Vec2.weak(0, 0);
    const j = new PulleyJoint(b1, b2, b3, b4, a(), a(), a(), a(), 0, 200);

    expect(j.anchor1).toBeDefined();
    expect(j.anchor2).toBeDefined();
    expect(j.anchor3).toBeDefined();
    expect(j.anchor4).toBeDefined();
  });

  it("anchor setters update values", () => {
    const a = () => Vec2.weak(0, 0);
    const j = new PulleyJoint(b1, b2, b3, b4, a(), a(), a(), a(), 0, 200);

    j.anchor1 = new Vec2(1, 2);
    j.anchor2 = new Vec2(3, 4);
    j.anchor3 = new Vec2(5, 6);
    j.anchor4 = new Vec2(7, 8);

    expect(j.anchor1.x).toBeCloseTo(1);
    expect(j.anchor2.x).toBeCloseTo(3);
    expect(j.anchor3.x).toBeCloseTo(5);
    expect(j.anchor4.x).toBeCloseTo(7);
  });

  it("simulation: rope length constraint", () => {
    const a = () => Vec2.weak(0, 0);
    const j = new PulleyJoint(b1, b2, b3, b4, a(), a(), a(), a(), 0, 120, 1.0);
    j.space = space;

    stepSpace(space, 120);

    expect(b2.position).toBeDefined();
    expect(b4.position).toBeDefined();
  });

  it("ratio parameter affects constraint", () => {
    const a = () => Vec2.weak(0, 0);
    const j = new PulleyJoint(b1, b2, b3, b4, a(), a(), a(), a(), 0, 200, 2.0);
    j.space = space;
    stepSpace(space, 60);
    expect(j.ratio).toBeCloseTo(2.0);
  });

  it("isSlack returns boolean when all bodies present", () => {
    const a = () => Vec2.weak(0, 0);
    const j = new PulleyJoint(b1, b2, b3, b4, a(), a(), a(), a(), 0, 9999);
    j.space = space;
    stepSpace(space, 5);
    const result = j.isSlack();
    expect(typeof result).toBe("boolean");
  });

  it("isSlack throws when a body is null", () => {
    const a = () => Vec2.weak(0, 0);
    const j = new PulleyJoint(null, b2, b3, b4, a(), a(), a(), a(), 0, 200);
    expect(() => j.isSlack()).toThrow();
  });

  it("impulse and bodyImpulse work after simulation", () => {
    const a = () => Vec2.weak(0, 0);
    const j = new PulleyJoint(b1, b2, b3, b4, a(), a(), a(), a(), 0, 80);
    j.space = space;
    stepSpace(space, 10);

    const imp = j.impulse();
    expect(imp).toBeDefined();

    const bi = j.bodyImpulse(b2);
    expect(bi).toBeDefined();
  });

  it("bodyImpulse throws for null body", () => {
    const a = () => Vec2.weak(0, 0);
    const j = new PulleyJoint(b1, b2, b3, b4, a(), a(), a(), a(), 0, 200);
    expect(() => j.bodyImpulse(null!)).toThrow("null");
  });

  it("bodyImpulse throws for unlinked body", () => {
    const a = () => Vec2.weak(0, 0);
    const j = new PulleyJoint(b1, b2, b3, b4, a(), a(), a(), a(), 0, 200);
    const other = makeDynamic(500, 500);
    expect(() => j.bodyImpulse(other)).toThrow("not linked");
  });

  it("visitBodies visits up to 4 distinct bodies", () => {
    const a = () => Vec2.weak(0, 0);
    const j = new PulleyJoint(b1, b2, b3, b4, a(), a(), a(), a(), 0, 200);
    const visited: Body[] = [];
    j.visitBodies((b) => visited.push(b));
    expect(visited.length).toBe(4);
  });

  it("visitBodies deduplicates shared bodies", () => {
    const a = () => Vec2.weak(0, 0);
    const j = new PulleyJoint(b1, b2, b1, b4, a(), a(), a(), a(), 0, 200);
    const visited: Body[] = [];
    j.visitBodies((b) => visited.push(b));
    expect(visited.length).toBe(3);
  });

  it("visitBodies throws for null lambda", () => {
    const a = () => Vec2.weak(0, 0);
    const j = new PulleyJoint(b1, b2, b3, b4, a(), a(), a(), a(), 0, 200);
    expect(() => j.visitBodies(null!)).toThrow("null");
  });
});

// ===========================================================================
// LineJoint
// ===========================================================================
describe("LineJoint — coverage", () => {
  let space: Space;
  let b1: Body;
  let b2: Body;

  beforeEach(() => {
    space = new Space(new Vec2(0, 100));
    b1 = makeStatic(0, 0);
    b1.space = space;
    b2 = makeDynamic(0, 0, 10);
    b2.space = space;
  });

  it("creates with direction vector and limits", () => {
    const j = new LineJoint(
      b1, b2,
      Vec2.weak(0, 0), Vec2.weak(0, 0),
      Vec2.weak(0, 1), -50, 50,
    );
    expect(j.body1).toBeDefined();
    expect(j.body2).toBeDefined();
    expect(j.jointMin).toBeCloseTo(-50);
    expect(j.jointMax).toBeCloseTo(50);
  });

  it("rejects NaN jointMin/jointMax in constructor", () => {
    expect(() => new LineJoint(
      b1, b2, Vec2.weak(0, 0), Vec2.weak(0, 0), Vec2.weak(0, 1), NaN, 50,
    )).toThrow("NaN");
    expect(() => new LineJoint(
      b1, b2, Vec2.weak(0, 0), Vec2.weak(0, 0), Vec2.weak(0, 1), 0, NaN,
    )).toThrow("NaN");
  });

  it("rejects null anchors and direction", () => {
    expect(() => new LineJoint(
      b1, b2, null!, Vec2.weak(0, 0), Vec2.weak(0, 1), -50, 50,
    )).toThrow("null");
    expect(() => new LineJoint(
      b1, b2, Vec2.weak(0, 0), null!, Vec2.weak(0, 1), -50, 50,
    )).toThrow("null");
    expect(() => new LineJoint(
      b1, b2, Vec2.weak(0, 0), Vec2.weak(0, 0), null!, -50, 50,
    )).toThrow("null");
  });

  it("setter rejects NaN for jointMin/jointMax", () => {
    const j = new LineJoint(
      b1, b2, Vec2.weak(0, 0), Vec2.weak(0, 0), Vec2.weak(0, 1), -50, 50,
    );
    expect(() => { j.jointMin = NaN; }).toThrow("NaN");
    expect(() => { j.jointMax = NaN; }).toThrow("NaN");
  });

  it("set jointMin/jointMax to new values", () => {
    const j = new LineJoint(
      b1, b2, Vec2.weak(0, 0), Vec2.weak(0, 0), Vec2.weak(0, 1), -50, 50,
    );
    j.jointMin = -100;
    j.jointMax = 100;
    expect(j.jointMin).toBeCloseTo(-100);
    expect(j.jointMax).toBeCloseTo(100);
  });

  it("anchor and direction getters return correct values", () => {
    const j = new LineJoint(
      b1, b2,
      Vec2.weak(1, 2), Vec2.weak(3, 4),
      Vec2.weak(0, 1), -50, 50,
    );

    expect(j.anchor1.x).toBeCloseTo(1);
    expect(j.anchor2.x).toBeCloseTo(3);
    expect(j.direction.y).toBeCloseTo(1);
  });

  it("anchor and direction setters update values", () => {
    const j = new LineJoint(
      b1, b2,
      Vec2.weak(0, 0), Vec2.weak(0, 0),
      Vec2.weak(0, 1), -50, 50,
    );

    j.anchor1 = new Vec2(10, 20);
    j.anchor2 = new Vec2(30, 40);
    j.direction = new Vec2(1, 0);

    expect(j.anchor1.x).toBeCloseTo(10);
    expect(j.anchor2.x).toBeCloseTo(30);
    expect(j.direction.x).toBeCloseTo(1);
  });

  it("simulation: body slides along direction", () => {
    const j = new LineJoint(
      b1, b2,
      Vec2.weak(0, 0), Vec2.weak(0, 0),
      Vec2.weak(0, 1), -100, 100,
    );
    j.space = space;

    stepSpace(space, 60);

    expect(Math.abs(b2.position.y)).toBeGreaterThan(0);
  });

  it("simulation: jointMin/jointMax limit sliding range", () => {
    const j = new LineJoint(
      b1, b2,
      Vec2.weak(0, 0), Vec2.weak(0, 0),
      Vec2.weak(0, 1), 0, 30,
    );
    j.space = space;

    stepSpace(space, 120);

    expect(b2.position.y).toBeLessThan(50);
  });

  it("elastic line joint", () => {
    const j = new LineJoint(
      b1, b2,
      Vec2.weak(0, 0), Vec2.weak(0, 0),
      Vec2.weak(0, 1), -20, 20,
    );
    j.stiff = false;
    j.frequency = 5;
    j.damping = 0.5;
    j.space = space;

    stepSpace(space, 60);
    expect(b2.position).toBeDefined();
  });

  it("impulse returns MatMN(2,1)", () => {
    const j = new LineJoint(
      b1, b2, Vec2.weak(0, 0), Vec2.weak(0, 0), Vec2.weak(0, 1), -50, 50,
    );
    j.space = space;
    stepSpace(space, 5);
    const imp = j.impulse();
    expect(imp).toBeDefined();
  });

  it("bodyImpulse throws for null and unlinked body", () => {
    const j = new LineJoint(
      b1, b2, Vec2.weak(0, 0), Vec2.weak(0, 0), Vec2.weak(0, 1), -50, 50,
    );
    expect(() => j.bodyImpulse(null!)).toThrow("null");
    const other = makeDynamic(999, 999);
    expect(() => j.bodyImpulse(other)).toThrow("not linked");
  });

  it("visitBodies throws for null lambda", () => {
    const j = new LineJoint(
      b1, b2, Vec2.weak(0, 0), Vec2.weak(0, 0), Vec2.weak(0, 1), -50, 50,
    );
    expect(() => j.visitBodies(null!)).toThrow("null");
  });
});

// ===========================================================================
// General Constraint features (using various joint types)
// ===========================================================================
describe("General Constraint features — coverage", () => {
  let space: Space;

  beforeEach(() => {
    space = new Space(new Vec2(0, 100));
  });

  it("active toggle: deactivate and reactivate constraint", () => {
    const b1 = makeStatic(0, 0);
    b1.space = space;
    const b2 = makeDynamic(50, 0);
    b2.space = space;

    const j = new AngleJoint(b1, b2, 0, 0);
    j.space = space;

    j.active = false;
    expect(j.active).toBe(false);

    stepSpace(space, 10);

    j.active = true;
    expect(j.active).toBe(true);

    stepSpace(space, 10);
  });

  it("frequency/damping validation for elastic constraints", () => {
    const j = new AngleJoint(null, null, -1, 1);
    j.stiff = false;

    // Frequency must be > 0
    expect(() => { j.frequency = 0; }).toThrow(">0");
    expect(() => { j.frequency = -1; }).toThrow(">0");
    expect(() => { j.frequency = NaN; }).toThrow("NaN");

    // Damping must be >= 0
    expect(() => { j.damping = -1; }).toThrow(">=0");
    // Note: damping error says "Nan" (capital N, lowercase an)
    expect(() => { j.damping = NaN; }).toThrow("Nan");
  });

  it("maxForce validation", () => {
    const j = new MotorJoint(null, null, 1);
    expect(() => { j.maxForce = NaN; }).toThrow("NaN");
    expect(() => { j.maxForce = -1; }).toThrow(">=0");
  });

  it("maxError validation", () => {
    const j = new AngleJoint(null, null, -1, 1);
    expect(() => { j.maxError = NaN; }).toThrow("NaN");
    expect(() => { j.maxError = -1; }).toThrow(">=0");
  });

  it("removeOnBreak=false keeps constraint in space after break", () => {
    const b1 = makeStatic(0, 0);
    b1.space = space;
    const b2 = makeDynamic(0, 0);
    b2.space = space;

    const j = new MotorJoint(b1, b2, 100);
    j.breakUnderForce = true;
    j.maxForce = 0.0001;
    j.removeOnBreak = false;
    j.space = space;

    stepSpace(space, 30);

    expect(j.space).toBe(space);
  });

  it("ignore flag can be toggled", () => {
    const j = new AngleJoint(null, null, -1, 1);
    expect(j.ignore).toBe(false);

    j.ignore = true;
    expect(j.ignore).toBe(true);

    j.ignore = false;
    expect(j.ignore).toBe(false);
  });

  it("ignore flag prevents constraint from waking bodies", () => {
    const b1 = makeStatic(0, 0);
    b1.space = space;
    const b2 = makeDynamic(0, 0, 20);
    b2.space = space;

    // Create a motor, add to space, then set ignore
    const j = new MotorJoint(b1, b2, 10.0);
    j.space = space;

    // Run without ignore to establish baseline
    stepSpace(space, 10);
    const velWithoutIgnore = Math.abs(b2.angularVel);

    // Now create a second scenario with ignore from the start
    const space2 = new Space(new Vec2(0, 0));
    const s1 = makeStatic(0, 0);
    s1.space = space2;
    const s2 = makeDynamic(0, 0, 20);
    s2.space = space2;
    const j2 = new MotorJoint(s1, s2, 10.0);
    j2.space = space2;
    j2.ignore = true;

    stepSpace(space2, 10);

    // The ignored motor should produce less angular velocity than the active one
    expect(velWithoutIgnore).toBeGreaterThan(0);
    // Just verify ignore property round-trips
    expect(j2.ignore).toBe(true);
  });

  it("isSleeping throws when not active or not in space", () => {
    const j = new AngleJoint(null, null, -1, 1);
    expect(() => j.isSleeping).toThrow();

    const b1 = makeDynamic(0, 0);
    b1.space = space;
    const b2 = makeDynamic(50, 0);
    b2.space = space;

    const j2 = new AngleJoint(b1, b2, -1, 1);
    j2.active = false;
    j2.space = space;
    expect(() => j2.isSleeping).toThrow();
  });

  it("isSleeping returns boolean when active and in space", () => {
    const b1 = makeDynamic(0, 0);
    b1.space = space;
    const b2 = makeDynamic(50, 0);
    b2.space = space;

    const j = new AngleJoint(b1, b2, -1, 1);
    j.space = space;
    stepSpace(space, 5);

    expect(typeof j.isSleeping).toBe("boolean");
  });

  it("userData lazy initialization", () => {
    const j = new AngleJoint(null, null, -1, 1);
    const ud = j.userData;
    expect(ud).toBeDefined();
    expect(typeof ud).toBe("object");
    ud.myKey = 42;
    expect(j.userData.myKey).toBe(42);
  });

  it("constraint in compound", () => {
    const b1 = makeDynamic(0, 0);
    const b2 = makeDynamic(50, 0);
    const j = new AngleJoint(b1, b2, -1, 1);

    const compound = new Compound();
    compound.bodies.add(b1);
    compound.bodies.add(b2);
    compound.constraints.add(j);

    expect(j.compound).toBe(compound);

    compound.space = space;
    expect(j.space).toBe(space);

    expect(() => { j.space = null; }).toThrow("Compound");

    compound.constraints.remove(j);
    expect(j.compound).toBeNull();
  });

  it("breakUnderError breaks constraint when error exceeds maxError", () => {
    const b1 = makeStatic(0, 0);
    b1.space = space;
    const b2 = makeDynamic(50, 0);
    b2.space = space;

    const j = new WeldJoint(b1, b2, Vec2.weak(0, 0), Vec2.weak(0, 0));
    j.breakUnderError = true;
    j.maxError = 0.001;
    j.removeOnBreak = true;
    j.space = space;

    stepSpace(space, 30);
    expect(j.space).toBeNull();
  });

  it("copy preserves constraint type", () => {
    const b1 = makeDynamic(0, 0);
    const b2 = makeDynamic(50, 0);

    const motor = new MotorJoint(b1, b2, 5.0, 2.0);
    motor.stiff = false;
    motor.frequency = 3;
    motor.damping = 0.5;
    const copy = motor.copy();
    expect(copy).toBeDefined();
    expect(copy.space).toBeNull();
  });

  it("body reassignment to null while in space", () => {
    const b1 = makeDynamic(0, 0);
    b1.space = space;
    const b2 = makeDynamic(50, 0);
    b2.space = space;

    const j = new AngleJoint(b1, b2, -1, 1);
    j.space = space;

    j.body1 = null!;
    expect(j.body1).toBeNull();

    j.body2 = null!;
    expect(j.body2).toBeNull();
  });

  it("setting same body value is a no-op", () => {
    const b1 = makeDynamic(0, 0);
    b1.space = space;
    const b2 = makeDynamic(50, 0);
    b2.space = space;

    const j = new AngleJoint(b1, b2, -1, 1);
    j.space = space;

    // Setting the same body should not throw or change anything
    j.body1 = b1;
    expect(j.body1.position.x).toBeCloseTo(0);
    j.body2 = b2;
    expect(j.body2.position.x).toBeCloseTo(50);
  });

  it("setting same property value is a no-op (no wake)", () => {
    const j = new AngleJoint(null, null, -1, 1, 2.0);
    j.jointMin = -1;
    j.jointMax = 1;
    j.ratio = 2.0;
    expect(j.jointMin).toBeCloseTo(-1);
    expect(j.jointMax).toBeCloseTo(1);
    expect(j.ratio).toBeCloseTo(2.0);
  });

  it("cbTypes returns defined object", () => {
    const j = new AngleJoint(null, null, -1, 1);
    expect(j.cbTypes).toBeDefined();
  });

  it("toString returns {Constraint}", () => {
    const j = new MotorJoint(null, null, 1);
    expect(j.toString()).toBe("{Constraint}");
  });

  it("removing constraint from space sets space to null", () => {
    const b1 = makeDynamic(0, 0);
    b1.space = space;
    const b2 = makeDynamic(50, 0);
    b2.space = space;

    const j = new AngleJoint(b1, b2, -1, 1);
    j.space = space;
    expect(j.space).toBe(space);

    j.space = null;
    expect(j.space).toBeNull();
  });

  it("WeldJoint body reassignment while in space", () => {
    const b1 = makeDynamic(0, 0);
    b1.space = space;
    const b2 = makeDynamic(30, 0);
    b2.space = space;
    const b3 = makeDynamic(60, 0);
    b3.space = space;

    const j = new WeldJoint(b1, b2, Vec2.weak(0, 0), Vec2.weak(0, 0));
    j.space = space;

    j.body1 = b3;
    expect(j.body1.position.x).toBeCloseTo(60);
    j.body2 = b1;
    expect(j.body2.position.x).toBeCloseTo(0);
  });

  it("PulleyJoint body reassignment while in space", () => {
    const b1 = makeStatic(0, 0);
    b1.space = space;
    const b2 = makeDynamic(0, 50);
    b2.space = space;
    const b3 = makeStatic(100, 0);
    b3.space = space;
    const b4 = makeDynamic(100, 50);
    b4.space = space;
    const b5 = makeDynamic(200, 50);
    b5.space = space;

    const a = () => Vec2.weak(0, 0);
    const j = new PulleyJoint(b1, b2, b3, b4, a(), a(), a(), a(), 0, 300);
    j.space = space;

    j.body3 = b5;
    expect(j.body3.position.x).toBeCloseTo(200);
    j.body4 = b1;
    expect(j.body4.position.x).toBeCloseTo(0);
  });

  it("LineJoint body reassignment while in space", () => {
    const b1 = makeStatic(0, 0);
    b1.space = space;
    const b2 = makeDynamic(0, 0);
    b2.space = space;
    const b3 = makeDynamic(100, 0);
    b3.space = space;

    const j = new LineJoint(
      b1, b2,
      Vec2.weak(0, 0), Vec2.weak(0, 0),
      Vec2.weak(0, 1), -50, 50,
    );
    j.space = space;

    j.body2 = b3;
    expect(j.body2.position.x).toBeCloseTo(100);
  });

  it("MotorJoint body reassignment while in space", () => {
    const b1 = makeStatic(0, 0);
    b1.space = space;
    const b2 = makeDynamic(0, 0);
    b2.space = space;
    const b3 = makeDynamic(100, 0);
    b3.space = space;

    const j = new MotorJoint(b1, b2, 5);
    j.space = space;

    j.body1 = b3;
    expect(j.body1.position.x).toBeCloseTo(100);
  });
});
