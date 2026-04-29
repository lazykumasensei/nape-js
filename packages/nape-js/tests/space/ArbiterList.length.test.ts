import { describe, it, expect } from "vitest";
import "../../src/core/engine";
import { Space } from "../../src/space/Space";
import { Body } from "../../src/phys/Body";
import { BodyType } from "../../src/phys/BodyType";
import { Vec2 } from "../../src/geom/Vec2";
import { Circle } from "../../src/shape/Circle";
import { Polygon } from "../../src/shape/Polygon";

// ---------------------------------------------------------------------------
// Regression: `space.arbiters.length` returns a live number, not undefined.
//
// `space.arbiters` is typed as `ArbiterList` (TypedListLike) which has a
// `length: number`. The runtime impl is `ZPP_SpaceArbiterList`; without the
// `length` getter shim on its prototype, callers got `undefined`. Earlier
// tests masked this by writing `if (space.arbiters.length > 0)` — `undefined
// > 0` is `false`, so the conditional silently stayed unentered.
// ---------------------------------------------------------------------------

describe("Space.arbiters.length — regression", () => {
  it("is a number on a fresh space (zero arbiters)", () => {
    const space = new Space(new Vec2(0, 0));
    expect(typeof space.arbiters.length).toBe("number");
    expect(space.arbiters.length).toBe(0);
  });

  it("reports the live arbiter count after a step produces a contact", () => {
    const space = new Space(new Vec2(0, 0));
    const a = new Body(BodyType.DYNAMIC, new Vec2(0, 0));
    a.shapes.add(new Circle(10));
    a.space = space;
    const b = new Body(BodyType.DYNAMIC, new Vec2(8, 0)); // overlapping
    b.shapes.add(new Circle(10));
    b.space = space;
    space.step(1 / 60);
    expect(space.arbiters.length).toBeGreaterThan(0);
  });

  it("matches the manually-iterated count via .at()", () => {
    const space = new Space(new Vec2(0, 200));
    const floor = new Body(BodyType.STATIC, new Vec2(0, 100));
    floor.shapes.add(new Polygon(Polygon.box(400, 10)));
    floor.space = space;
    for (let i = 0; i < 5; i++) {
      const ball = new Body(BodyType.DYNAMIC, new Vec2(i * 22, 50));
      ball.shapes.add(new Circle(10));
      ball.space = space;
    }
    for (let i = 0; i < 60; i++) space.step(1 / 60);

    const len = space.arbiters.length;
    let count = 0;
    for (let i = 0; i < len; i++) {
      if (space.arbiters.at(i) != null) count++;
    }
    expect(count).toBe(len);
    expect(len).toBeGreaterThan(0);
  });

  it("drops back to zero after every body is removed", () => {
    const space = new Space(new Vec2(0, 0));
    const a = new Body(BodyType.DYNAMIC, new Vec2(0, 0));
    a.shapes.add(new Circle(10));
    a.space = space;
    const b = new Body(BodyType.DYNAMIC, new Vec2(8, 0));
    b.shapes.add(new Circle(10));
    b.space = space;
    space.step(1 / 60);
    expect(space.arbiters.length).toBeGreaterThan(0);

    a.space = null;
    b.space = null;
    space.step(1 / 60);
    expect(space.arbiters.length).toBe(0);
  });
});
