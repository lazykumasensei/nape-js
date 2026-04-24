import { describe, it, expect } from "vitest";
import { Space } from "../../src/space/Space";
import { Body } from "../../src/phys/Body";
import { BodyType } from "../../src/phys/BodyType";
import { Vec2 } from "../../src/geom/Vec2";
import { Circle } from "../../src/shape/Circle";
import { SpringJoint } from "../../src/constraint/SpringJoint";
import "../../src/geom/MatMN";
import { ZPP_SpringJoint } from "../../src/native/constraint/ZPP_SpringJoint";

function makeDynamic(space: any, x = 0, y = 0): any {
  const b = new Body(BodyType.DYNAMIC, new Vec2(x, y));
  b.shapes.add(new Circle(10));
  b.space = space;
  return b;
}

describe("SpringJoint", () => {
  // ── Construction ──────────────────────────────────────────────────────────

  it("should use ZPP_SpringJoint directly", () => {
    const joint = new SpringJoint(null, null, new Vec2(0, 0), new Vec2(0, 0), 50);
    expect(joint.zpp_inner).toBeInstanceOf(ZPP_SpringJoint);
    expect(joint.zpp_inner.outer).toBe(joint);
    expect(joint.zpp_inner.outer_zn).toBe(joint);
  });

  it("should set anchor coordinates directly on ZPP", () => {
    const joint = new SpringJoint(null, null, new Vec2(5, 10), new Vec2(15, 20), 100);
    expect(joint.zpp_inner.a1localx).toBeCloseTo(5);
    expect(joint.zpp_inner.a1localy).toBeCloseTo(10);
    expect(joint.zpp_inner.a2localx).toBeCloseTo(15);
    expect(joint.zpp_inner.a2localy).toBeCloseTo(20);
  });

  it("should store restLength", () => {
    const joint = new SpringJoint(null, null, new Vec2(0, 0), new Vec2(0, 0), 75);
    expect(joint.restLength).toBe(75);
  });

  it("should default to soft mode (frequency=8, damping=1)", () => {
    const joint = new SpringJoint(null, null, new Vec2(0, 0), new Vec2(0, 0), 50);
    expect(joint.stiff).toBe(false);
    expect(joint.frequency).toBe(8);
    expect(joint.damping).toBe(1);
  });

  // ── Validation ────────────────────────────────────────────────────────────

  it("should throw on NaN restLength", () => {
    expect(() => {
      new SpringJoint(null, null, new Vec2(0, 0), new Vec2(0, 0), NaN);
    }).toThrow("NaN");
  });

  it("should throw on negative restLength", () => {
    const joint = new SpringJoint(null, null, new Vec2(0, 0), new Vec2(0, 0), 50);
    expect(() => {
      joint.restLength = -5;
    }).toThrow(">= 0");
  });

  it("should throw on null anchor1", () => {
    expect(() => {
      new SpringJoint(null, null, null as any, new Vec2(0, 0), 50);
    }).toThrow("cannot be null");
  });

  it("should throw on null anchor2", () => {
    expect(() => {
      new SpringJoint(null, null, new Vec2(0, 0), null as any, 50);
    }).toThrow("cannot be null");
  });

  // ── Stiff override ────────────────────────────────────────────────────────

  it("should ignore stiff=true (always soft)", () => {
    const joint = new SpringJoint(null, null, new Vec2(0, 0), new Vec2(0, 0), 50);
    joint.stiff = true;
    expect(joint.stiff).toBe(false);
  });

  // ── Anchor accessors ─────────────────────────────────────────────────────

  it("should get anchor1/anchor2 as Vec2 wrappers", () => {
    const joint = new SpringJoint(null, null, new Vec2(5, 10), new Vec2(15, 20), 100);
    const a1 = joint.anchor1;
    expect(a1.x).toBeCloseTo(5);
    expect(a1.y).toBeCloseTo(10);
    const a2 = joint.anchor2;
    expect(a2.x).toBeCloseTo(15);
    expect(a2.y).toBeCloseTo(20);
  });

  it("should set anchor1/anchor2 via setter", () => {
    const joint = new SpringJoint(null, null, new Vec2(0, 0), new Vec2(0, 0), 50);
    joint.anchor1 = new Vec2(7, 14);
    expect(joint.anchor1.x).toBeCloseTo(7);
    expect(joint.anchor1.y).toBeCloseTo(14);
    joint.anchor2 = new Vec2(21, 28);
    expect(joint.anchor2.x).toBeCloseTo(21);
    expect(joint.anchor2.y).toBeCloseTo(28);
  });

  // ── Body accessors ────────────────────────────────────────────────────────

  it("should set body1/body2 with constraint-space integration", () => {
    const space = new Space(new Vec2(0, 0));
    const b1 = makeDynamic(space, 0, 0);
    const b2 = makeDynamic(space, 100, 0);
    const joint = new SpringJoint(b1, b2, new Vec2(0, 0), new Vec2(0, 0), 100);
    expect(joint.zpp_inner.b1).toBe(b1.zpp_inner);
    expect(joint.zpp_inner.b2).toBe(b2.zpp_inner);
  });

  // ── restLength property ───────────────────────────────────────────────────

  it("should update restLength and wake constraint", () => {
    const joint = new SpringJoint(null, null, new Vec2(0, 0), new Vec2(0, 0), 50);
    joint.restLength = 120;
    expect(joint.restLength).toBe(120);
  });

  it("should allow restLength=0", () => {
    const joint = new SpringJoint(null, null, new Vec2(0, 0), new Vec2(0, 0), 0);
    expect(joint.restLength).toBe(0);
  });

  // ── Simulation ────────────────────────────────────────────────────────────

  it("should pull bodies together when stretched beyond restLength", () => {
    const space = new Space(new Vec2(0, 0));
    const b1 = makeDynamic(space, 0, 0);
    const b2 = makeDynamic(space, 200, 0);
    const joint = new SpringJoint(b1, b2, new Vec2(0, 0), new Vec2(0, 0), 50);
    joint.frequency = 10;
    joint.damping = 1;
    joint.space = space;

    for (let i = 0; i < 60; i++) {
      space.step(1 / 60);
    }

    // Bodies should have moved closer together
    const dx = b2.position.x - b1.position.x;
    expect(dx).toBeLessThan(200);
  });

  it("should push bodies apart when compressed below restLength", () => {
    const space = new Space(new Vec2(0, 0));
    const b1 = makeDynamic(space, 0, 0);
    const b2 = makeDynamic(space, 10, 0);
    const joint = new SpringJoint(b1, b2, new Vec2(0, 0), new Vec2(0, 0), 100);
    joint.frequency = 10;
    joint.damping = 1;
    joint.space = space;

    for (let i = 0; i < 60; i++) {
      space.step(1 / 60);
    }

    // Bodies should have moved further apart
    const dx = b2.position.x - b1.position.x;
    expect(dx).toBeGreaterThan(10);
  });

  it("should oscillate when underdamped", () => {
    const space = new Space(new Vec2(0, 0));
    const b1 = new Body(BodyType.STATIC);
    b1.shapes.add(new Circle(10));
    b1.space = space;
    const b2 = makeDynamic(space, 200, 0);

    const joint = new SpringJoint(b1, b2, new Vec2(0, 0), new Vec2(0, 0), 100);
    joint.frequency = 3;
    joint.damping = 0.1; // very underdamped — should oscillate
    joint.space = space;

    // Track if body2 ever goes past the rest position (overshoot)
    let minDx = Infinity;
    for (let i = 0; i < 120; i++) {
      space.step(1 / 60);
      const dx = b2.position.x;
      if (dx < minDx) minDx = dx;
    }

    // Underdamped spring should overshoot past rest length (100)
    expect(minDx).toBeLessThan(100);
  });

  it("should settle near restLength when critically damped", () => {
    const space = new Space(new Vec2(0, 0));
    const b1 = new Body(BodyType.STATIC);
    b1.shapes.add(new Circle(10));
    b1.space = space;
    const b2 = makeDynamic(space, 200, 0);

    const joint = new SpringJoint(b1, b2, new Vec2(0, 0), new Vec2(0, 0), 100);
    joint.frequency = 5;
    joint.damping = 1; // critically damped
    joint.space = space;

    for (let i = 0; i < 300; i++) {
      space.step(1 / 60);
    }

    // Should settle near rest length
    const dx = b2.position.x;
    expect(dx).toBeCloseTo(100, 0); // within ~1 pixel
  });

  // ── impulse / bodyImpulse ─────────────────────────────────────────────────

  it("should return impulse after stepping", () => {
    const space = new Space(new Vec2(0, 0));
    const b1 = makeDynamic(space, 0, 0);
    const b2 = makeDynamic(space, 200, 0);
    const joint = new SpringJoint(b1, b2, new Vec2(0, 0), new Vec2(0, 0), 50);
    joint.space = space;

    space.step(1 / 60);

    const imp = joint.impulse();
    expect(imp).toBeDefined();
  });

  it("should return bodyImpulse for connected bodies", () => {
    const space = new Space(new Vec2(0, 0));
    const b1 = makeDynamic(space, 0, 0);
    const b2 = makeDynamic(space, 200, 0);
    const joint = new SpringJoint(b1, b2, new Vec2(0, 0), new Vec2(0, 0), 50);
    joint.space = space;

    space.step(1 / 60);

    const imp1 = joint.bodyImpulse(b1);
    const imp2 = joint.bodyImpulse(b2);
    expect(imp1).toBeDefined();
    expect(imp2).toBeDefined();
  });

  it("should throw bodyImpulse for unlinked body", () => {
    const space = new Space(new Vec2(0, 0));
    const b1 = makeDynamic(space, 0, 0);
    const b2 = makeDynamic(space, 100, 0);
    const b3 = makeDynamic(space, 200, 0);
    const joint = new SpringJoint(b1, b2, new Vec2(0, 0), new Vec2(0, 0), 50);
    joint.space = space;

    expect(() => joint.bodyImpulse(b3)).toThrow("not linked");
  });

  // ── visitBodies ───────────────────────────────────────────────────────────

  it("should visit both bodies", () => {
    const space = new Space(new Vec2(0, 0));
    const b1 = makeDynamic(space, 0, 0);
    const b2 = makeDynamic(space, 100, 0);
    const joint = new SpringJoint(b1, b2, new Vec2(0, 0), new Vec2(0, 0), 50);

    const visited: Body[] = [];
    joint.visitBodies((b) => visited.push(b));
    expect(visited).toHaveLength(2);
    expect(visited).toContain(b1);
    expect(visited).toContain(b2);
  });

  // ── frequency / damping ───────────────────────────────────────────────────

  it("should allow changing frequency and damping", () => {
    const joint = new SpringJoint(null, null, new Vec2(0, 0), new Vec2(0, 0), 50);
    joint.frequency = 20;
    joint.damping = 0.5;
    expect(joint.frequency).toBe(20);
    expect(joint.damping).toBe(0.5);
  });

  it("higher frequency should produce stiffer spring", () => {
    const space1 = new Space(new Vec2(0, 0));
    const s1b1 = new Body(BodyType.STATIC);
    s1b1.shapes.add(new Circle(10));
    s1b1.space = space1;
    const s1b2 = makeDynamic(space1, 200, 0);
    const j1 = new SpringJoint(s1b1, s1b2, new Vec2(0, 0), new Vec2(0, 0), 100);
    j1.frequency = 2;
    j1.damping = 1;
    j1.space = space1;

    const space2 = new Space(new Vec2(0, 0));
    const s2b1 = new Body(BodyType.STATIC);
    s2b1.shapes.add(new Circle(10));
    s2b1.space = space2;
    const s2b2 = makeDynamic(space2, 200, 0);
    const j2 = new SpringJoint(s2b1, s2b2, new Vec2(0, 0), new Vec2(0, 0), 100);
    j2.frequency = 20;
    j2.damping = 1;
    j2.space = space2;

    // Step both 10 frames
    for (let i = 0; i < 10; i++) {
      space1.step(1 / 60);
      space2.step(1 / 60);
    }

    // Higher frequency spring should converge faster
    const dx1 = Math.abs(s1b2.position.x - 100);
    const dx2 = Math.abs(s2b2.position.x - 100);
    expect(dx2).toBeLessThan(dx1);
  });
});
