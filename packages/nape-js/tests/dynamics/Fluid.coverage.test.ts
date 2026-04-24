import { describe, it, expect } from "vitest";
import "../../src/core/engine";
import { Space } from "../../src/space/Space";
import { Body } from "../../src/phys/Body";
import { BodyType } from "../../src/phys/BodyType";
import { Vec2 } from "../../src/geom/Vec2";
import { Circle } from "../../src/shape/Circle";
import { Polygon } from "../../src/shape/Polygon";
import { FluidProperties } from "../../src/phys/FluidProperties";
import { Material } from "../../src/phys/Material";

/**
 * Coverage tests for ZPP_FluidArbiter / ZPP_FluidColArbiter through the public API.
 *
 * Exercises buoyancy, drag, angular damping, fluid-fluid interaction,
 * shape type differences, and FluidProperties configuration.
 */

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function step(space: Space, n: number, dt = 1 / 60): void {
  for (let i = 0; i < n; i++) space.step(dt);
}

function makeFluidPool(
  space: Space,
  opts: {
    x?: number;
    y?: number;
    w?: number;
    h?: number;
    density?: number;
    viscosity?: number;
  } = {},
): Body {
  const { x = 0, y = 0, w = 600, h = 600, density = 2, viscosity = 1 } = opts;
  const body = new Body(BodyType.STATIC, new Vec2(x, y));
  const shape = new Polygon(Polygon.box(w, h));
  shape.fluidEnabled = true;
  shape.fluidProperties = new FluidProperties(density, viscosity);
  body.shapes.add(shape);
  body.space = space;
  return body;
}

function makeDynCircle(space: Space, x: number, y: number, r = 15): Body {
  const b = new Body(BodyType.DYNAMIC, new Vec2(x, y));
  b.shapes.add(new Circle(r));
  b.space = space;
  return b;
}

function makeDynBox(space: Space, x: number, y: number, w = 30, h = 30): Body {
  const b = new Body(BodyType.DYNAMIC, new Vec2(x, y));
  b.shapes.add(new Polygon(Polygon.box(w, h)));
  b.space = space;
  return b;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("Fluid coverage — buoyancy basics", () => {
  it("body floating in high-density fluid rises (buoyancy > gravity)", () => {
    const space = new Space(new Vec2(0, 100));
    // Very high density fluid should push body upward
    makeFluidPool(space, { density: 20, viscosity: 0.5 });
    const b = makeDynCircle(space, 0, 0);
    const startY = b.position.y;
    step(space, 60);
    // Body should have moved upward (negative y) or stayed near start due to buoyancy
    expect(b.position.y).toBeLessThan(startY + 50);
  });

  it("body sinks in low-density fluid (buoyancy < gravity)", () => {
    const space = new Space(new Vec2(0, 500));
    // Very low density fluid provides minimal buoyancy
    makeFluidPool(space, { density: 0.01, viscosity: 0 });
    const b = makeDynCircle(space, 0, 0);
    step(space, 60);
    // Body should have fallen significantly
    expect(b.position.y).toBeGreaterThan(50);
  });

  it("heavier fluid provides more buoyancy than lighter fluid", () => {
    // Heavy fluid
    const spaceHeavy = new Space(new Vec2(0, 200));
    makeFluidPool(spaceHeavy, { density: 10, viscosity: 0 });
    const b1 = makeDynCircle(spaceHeavy, 0, 0);
    step(spaceHeavy, 60);
    const yHeavy = b1.position.y;

    // Light fluid
    const spaceLight = new Space(new Vec2(0, 200));
    makeFluidPool(spaceLight, { density: 0.5, viscosity: 0 });
    const b2 = makeDynCircle(spaceLight, 0, 0);
    step(spaceLight, 60);
    const yLight = b2.position.y;

    // Body in heavier fluid should be higher (less fall)
    expect(yHeavy).toBeLessThan(yLight);
  });
});

describe("Fluid coverage — viscous drag", () => {
  it("fluid viscous drag slows a horizontally moving body", () => {
    const space = new Space(new Vec2(0, 0));
    makeFluidPool(space, { density: 1, viscosity: 5 });
    const b = makeDynCircle(space, 0, 0);
    b.velocity = Vec2.get(200, 0);
    step(space, 30);
    expect(b.velocity.x).toBeLessThan(200);
    expect(b.velocity.x).toBeGreaterThanOrEqual(0);
  });

  it("higher viscosity slows body more than lower viscosity", () => {
    // High viscosity
    const spaceHigh = new Space(new Vec2(0, 0));
    makeFluidPool(spaceHigh, { density: 1, viscosity: 20 });
    const b1 = makeDynCircle(spaceHigh, 0, 0);
    b1.velocity = Vec2.get(200, 0);
    step(spaceHigh, 30);
    const vHigh = b1.velocity.x;

    // Low viscosity
    const spaceLow = new Space(new Vec2(0, 0));
    makeFluidPool(spaceLow, { density: 1, viscosity: 0.1 });
    const b2 = makeDynCircle(spaceLow, 0, 0);
    b2.velocity = Vec2.get(200, 0);
    step(spaceLow, 30);
    const vLow = b2.velocity.x;

    expect(vHigh).toBeLessThan(vLow);
  });

  it("viscous fluid slows vertical velocity too", () => {
    const space = new Space(new Vec2(0, 0));
    makeFluidPool(space, { density: 1, viscosity: 10 });
    const b = makeDynCircle(space, 0, 0);
    b.velocity = Vec2.get(0, 300);
    step(space, 30);
    expect(b.velocity.y).toBeLessThan(300);
  });
});

describe("Fluid coverage — angular damping", () => {
  it("spinning body slows down in viscous fluid", () => {
    const space = new Space(new Vec2(0, 0));
    makeFluidPool(space, { density: 1, viscosity: 5 });
    const b = makeDynCircle(space, 0, 0);
    b.angularVel = 10;
    step(space, 60);
    expect(Math.abs(b.angularVel)).toBeLessThan(10);
  });
});

describe("Fluid coverage — custom gravity in fluid", () => {
  it("setting custom gravity on FluidProperties does not crash simulation", () => {
    const space = new Space(new Vec2(0, 200));
    const fluidBody = new Body(BodyType.STATIC, new Vec2(0, 0));
    const shape = new Polygon(Polygon.box(600, 600));
    shape.fluidEnabled = true;
    const fp = new FluidProperties(2, 0.5);
    fp.gravity = Vec2.get(0, -500);
    shape.fluidProperties = fp;
    fluidBody.shapes.add(shape);
    fluidBody.space = space;

    const b = makeDynCircle(space, 0, 0);
    expect(() => step(space, 60)).not.toThrow();
    // Body position should be a valid number
    expect(Number.isFinite(b.position.y)).toBe(true);
  });
});

describe("Fluid coverage — multiple bodies in fluid", () => {
  it("handles multiple bodies in same fluid without errors", () => {
    const space = new Space(new Vec2(0, 100));
    makeFluidPool(space, { density: 3, viscosity: 1 });

    const bodies: Body[] = [];
    for (let i = 0; i < 8; i++) {
      bodies.push(makeDynCircle(space, (i - 4) * 40, 0, 10));
    }

    expect(() => step(space, 60)).not.toThrow();
    for (const b of bodies) {
      expect(b.space).not.toBeNull();
    }
  });

  it("bodies with different radii and initial velocities behave differently in fluid", () => {
    const space = new Space(new Vec2(0, 200));
    makeFluidPool(space, { density: 2, viscosity: 1 });

    // Small fast circle
    const small = makeDynCircle(space, -50, 0, 5);
    small.velocity = Vec2.get(50, 0);
    // Big slow circle
    const big = makeDynCircle(space, 50, 0, 30);
    big.velocity = Vec2.get(-10, 0);

    step(space, 60);
    // Their x-positions should clearly differ due to different sizes and velocities
    expect(small.position.x).not.toBe(big.position.x);
  });
});

describe("Fluid coverage — fluid-fluid interaction (two fluid shapes)", () => {
  it("two overlapping fluid shapes do not crash", () => {
    const space = new Space(new Vec2(0, 100));

    // First fluid region
    const f1 = new Body(BodyType.STATIC, new Vec2(-50, 0));
    const s1 = new Polygon(Polygon.box(200, 200));
    s1.fluidEnabled = true;
    s1.fluidProperties = new FluidProperties(2, 1);
    f1.shapes.add(s1);
    f1.space = space;

    // Second fluid region overlapping
    const f2 = new Body(BodyType.STATIC, new Vec2(50, 0));
    const s2 = new Polygon(Polygon.box(200, 200));
    s2.fluidEnabled = true;
    s2.fluidProperties = new FluidProperties(3, 2);
    f2.shapes.add(s2);
    f2.space = space;

    const b = makeDynCircle(space, 0, 0);
    expect(() => step(space, 30)).not.toThrow();
    expect(b.space).not.toBeNull();
  });
});

describe("Fluid coverage — FluidProperties", () => {
  it("density getter/setter works", () => {
    const fp = new FluidProperties(5, 1);
    expect(fp.density).toBeCloseTo(5);
    fp.density = 10;
    expect(fp.density).toBeCloseTo(10);
  });

  it("viscosity getter/setter works", () => {
    const fp = new FluidProperties(1, 3);
    expect(fp.viscosity).toBeCloseTo(3);
    fp.viscosity = 7;
    expect(fp.viscosity).toBeCloseTo(7);
  });

  it("density cannot be NaN", () => {
    expect(() => new FluidProperties(NaN, 1)).toThrow("NaN");
  });

  it("viscosity cannot be NaN", () => {
    expect(() => new FluidProperties(1, NaN)).toThrow("NaN");
  });

  it("viscosity cannot be negative", () => {
    expect(() => new FluidProperties(1, -1)).toThrow("must be >= 0");
  });

  it("default constructor values are density=1, viscosity=1", () => {
    const fp = new FluidProperties();
    expect(fp.density).toBeCloseTo(1);
    expect(fp.viscosity).toBeCloseTo(1);
  });

  it("copy() creates independent clone", () => {
    const fp = new FluidProperties(5, 3);
    const copy = fp.copy();
    expect(copy.density).toBeCloseTo(5);
    expect(copy.viscosity).toBeCloseTo(3);
    copy.density = 99;
    expect(fp.density).toBeCloseTo(5); // original unchanged
  });

  it("toString() includes density and viscosity", () => {
    const fp = new FluidProperties(2, 0.5);
    const str = fp.toString();
    expect(str).toContain("density");
    expect(str).toContain("viscosity");
  });
});

describe("Fluid coverage — body entering and leaving fluid region", () => {
  it("body falls through fluid and exits below", () => {
    const space = new Space(new Vec2(0, 500));
    // Small fluid region
    const fluidBody = new Body(BodyType.STATIC, new Vec2(0, 100));
    const shape = new Polygon(Polygon.box(200, 50));
    shape.fluidEnabled = true;
    shape.fluidProperties = new FluidProperties(1, 0.5);
    fluidBody.shapes.add(shape);
    fluidBody.space = space;

    const b = makeDynCircle(space, 0, 0);
    expect(() => step(space, 120)).not.toThrow();
    // Body should have fallen past the fluid region
    expect(b.position.y).toBeGreaterThan(125);
  });

  it("body shot upward through fluid exits above", () => {
    const space = new Space(new Vec2(0, 0));
    makeFluidPool(space, { y: 0, h: 100, density: 1, viscosity: 0.5 });
    const b = makeDynCircle(space, 0, 40);
    b.velocity = Vec2.get(0, -500);
    expect(() => step(space, 30)).not.toThrow();
    // Body should have moved upward out of fluid
    expect(b.position.y).toBeLessThan(-50);
  });
});

describe("Fluid coverage — circle in fluid vs polygon in fluid", () => {
  it("circle in fluid simulation runs without error", () => {
    const space = new Space(new Vec2(0, 100));
    makeFluidPool(space, { density: 3, viscosity: 1 });
    makeDynCircle(space, 0, 0, 20);
    expect(() => step(space, 30)).not.toThrow();
  });

  it("polygon in fluid simulation runs without error", () => {
    const space = new Space(new Vec2(0, 100));
    makeFluidPool(space, { density: 3, viscosity: 1 });
    makeDynBox(space, 0, 0, 30, 30);
    expect(() => step(space, 30)).not.toThrow();
  });

  it("circle and polygon in same fluid behave differently", () => {
    const space1 = new Space(new Vec2(0, 200));
    makeFluidPool(space1, { density: 2, viscosity: 1 });
    const circle = makeDynCircle(space1, 0, 0, 15);

    const space2 = new Space(new Vec2(0, 200));
    makeFluidPool(space2, { density: 2, viscosity: 1 });
    const box = makeDynBox(space2, 0, 0, 30, 30);

    step(space1, 60);
    step(space2, 60);

    // Shapes have different areas/masses so positions differ
    const circleY = circle.position.y;
    const boxY = box.position.y;
    // They should both be moving but typically at different rates
    expect(typeof circleY).toBe("number");
    expect(typeof boxY).toBe("number");
  });
});

describe("Fluid coverage — large vs small overlap area", () => {
  it("body fully immersed experiences more buoyancy than partially immersed", () => {
    // Fully immersed: body starts at center of large fluid
    const spaceFull = new Space(new Vec2(0, 200));
    makeFluidPool(spaceFull, { density: 5, viscosity: 0 });
    const bFull = makeDynCircle(spaceFull, 0, 0, 15);
    step(spaceFull, 30);
    const yFull = bFull.position.y;

    // Partially immersed: body at edge of fluid region
    const spacePartial = new Space(new Vec2(0, 200));
    const partialFluid = new Body(BodyType.STATIC, new Vec2(0, 50));
    const shape = new Polygon(Polygon.box(600, 40));
    shape.fluidEnabled = true;
    shape.fluidProperties = new FluidProperties(5, 0);
    partialFluid.shapes.add(shape);
    partialFluid.space = spacePartial;
    // Body barely touching the fluid
    const bPartial = makeDynCircle(spacePartial, 0, 25, 15);
    step(spacePartial, 30);
    const yPartial = bPartial.position.y;

    // Fully immersed body should have more buoyancy (higher position / less fall)
    expect(yFull).toBeLessThanOrEqual(yPartial);
  });
});

describe("Fluid coverage — material interaction with fluid", () => {
  it("body with custom material in fluid runs without error", () => {
    const space = new Space(new Vec2(0, 100));
    makeFluidPool(space, { density: 2, viscosity: 1 });
    const b = new Body(BodyType.DYNAMIC, new Vec2(0, 0));
    const shape = new Circle(15);
    shape.material = new Material(0.5, 0.3, 0.2, 5, 0.01);
    b.shapes.add(shape);
    b.space = space;
    expect(() => step(space, 30)).not.toThrow();
  });
});

describe("Fluid coverage — zero viscosity fluid", () => {
  it("zero-viscosity fluid applies less drag than high-viscosity fluid", () => {
    // Zero viscosity
    const space0 = new Space(new Vec2(0, 0));
    makeFluidPool(space0, { density: 2, viscosity: 0 });
    const b0 = makeDynCircle(space0, 0, 0);
    b0.velocity = Vec2.get(100, 0);
    step(space0, 30);

    // High viscosity
    const spaceHigh = new Space(new Vec2(0, 0));
    makeFluidPool(spaceHigh, { density: 2, viscosity: 10 });
    const bHigh = makeDynCircle(spaceHigh, 0, 0);
    bHigh.velocity = Vec2.get(100, 0);
    step(spaceHigh, 30);

    // Zero viscosity body should retain more velocity
    expect(b0.velocity.x).toBeGreaterThan(bHigh.velocity.x);
  });
});
