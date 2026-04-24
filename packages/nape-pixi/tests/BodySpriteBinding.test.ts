import { beforeEach, describe, expect, it } from "vitest";
import type { Body, Space } from "@newkrok/nape-js";
import { BodySpriteBinding } from "../src/BodySpriteBinding.js";
import { FixedStepper } from "../src/FixedStepper.js";

// ---------------------------------------------------------------------------
// Minimal stubs — the binding only touches body.position.{x,y}, body.rotation,
// body.space, and sprite.{x,y,rotation}. All duck-typed.
// ---------------------------------------------------------------------------

interface StubBody {
  position: { x: number; y: number };
  rotation: number;
  space: Space | null;
}

function makeBody(x = 0, y = 0, rotation = 0): StubBody {
  return { position: { x, y }, rotation, space: {} as Space };
}

function asBody(b: StubBody): Body {
  return b as unknown as Body;
}

function makeSprite() {
  return { x: 0, y: 0, rotation: 0 };
}

function makeSpace() {
  return {
    calls: 0,
    step(_dt: number) {
      this.calls++;
    },
  };
}

function asSpace<T>(s: T): Space {
  return s as unknown as Space;
}

// ---------------------------------------------------------------------------

describe("BodySpriteBinding — basics", () => {
  let binding: BodySpriteBinding;

  beforeEach(() => {
    binding = new BodySpriteBinding();
  });

  it("writes the current body transform to the sprite on bind()", () => {
    const body = makeBody(10, 20, 1.5);
    const sprite = makeSprite();
    binding.bind(asBody(body), sprite);
    expect(sprite.x).toBe(10);
    expect(sprite.y).toBe(20);
    expect(sprite.rotation).toBe(1.5);
  });

  it("update() propagates body moves to sprite", () => {
    const body = makeBody();
    const sprite = makeSprite();
    binding.bind(asBody(body), sprite);
    body.position.x = 5;
    body.position.y = 7;
    body.rotation = 0.3;
    binding.update();
    expect(sprite.x).toBe(5);
    expect(sprite.y).toBe(7);
    expect(sprite.rotation).toBe(0.3);
  });

  it("unbind() removes the binding and later moves don't affect sprite", () => {
    const body = makeBody();
    const sprite = makeSprite();
    binding.bind(asBody(body), sprite);
    expect(binding.unbind(asBody(body))).toBe(true);
    expect(binding.has(asBody(body))).toBe(false);
    body.position.x = 999;
    binding.update();
    expect(sprite.x).toBe(0);
  });

  it("re-binding replaces the previous sprite target", () => {
    const body = makeBody();
    const a = makeSprite();
    const b = makeSprite();
    binding.bind(asBody(body), a);
    binding.bind(asBody(body), b);
    body.position.x = 42;
    binding.update();
    expect(b.x).toBe(42);
    expect(a.x).toBe(0);
    expect(binding.size).toBe(1);
  });

  it("applies an offset in body-local space (rotates with the body)", () => {
    const body = makeBody(0, 0, 0);
    const sprite = makeSprite();
    binding.bind(asBody(body), sprite, { offsetX: 10, offsetY: 0 });
    // No rotation: offset is world-aligned.
    expect(sprite.x).toBeCloseTo(10, 10);
    expect(sprite.y).toBeCloseTo(0, 10);
    // Rotate 90° CCW: local +X should become world +Y.
    body.rotation = Math.PI / 2;
    binding.update();
    expect(sprite.x).toBeCloseTo(0, 10);
    expect(sprite.y).toBeCloseTo(10, 10);
  });

  it("auto-cleans bindings for bodies whose space became null", () => {
    const body = makeBody();
    const sprite = makeSprite();
    binding.bind(asBody(body), sprite);
    body.space = null;
    binding.update();
    expect(binding.has(asBody(body))).toBe(false);
    expect(binding.size).toBe(0);
  });

  it("respects autoCleanup: false", () => {
    binding = new BodySpriteBinding({ autoCleanup: false });
    const body = makeBody();
    binding.bind(asBody(body), makeSprite());
    body.space = null;
    binding.update();
    expect(binding.has(asBody(body))).toBe(true);
  });

  it("dispose() empties the binding", () => {
    binding.bind(asBody(makeBody()), makeSprite());
    binding.bind(asBody(makeBody()), makeSprite());
    binding.dispose();
    expect(binding.size).toBe(0);
  });
});

describe("BodySpriteBinding — interpolation with FixedStepper", () => {
  it("without a stepper, alpha<1 is ignored (no interpolation)", () => {
    const binding = new BodySpriteBinding();
    const body = makeBody();
    const sprite = makeSprite();
    binding.bind(asBody(body), sprite);
    body.position.x = 100;
    binding.update(0.5);
    expect(sprite.x).toBe(100);
  });

  it("with a stepper, update(alpha) lerps between snapshot and current", () => {
    const stepper = new FixedStepper({ hz: 60 });
    const binding = new BodySpriteBinding({ stepper });
    const body = makeBody(0, 0, 0);
    const sprite = makeSprite();
    binding.bind(asBody(body), sprite);

    // First step: snapshot captures prev = (0, 0, 0), then the stepper
    // advances the simulation. We simulate the body moving to (100, 0)
    // as the post-step state.
    const stub = makeSpace();
    stepper.step(asSpace(stub), 1 / 60);
    body.position.x = 100;
    body.rotation = 1;

    binding.update(0.0);
    expect(sprite.x).toBeCloseTo(0, 10);
    expect(sprite.rotation).toBeCloseTo(0, 10);

    binding.update(0.5);
    expect(sprite.x).toBeCloseTo(50, 10);
    expect(sprite.rotation).toBeCloseTo(0.5, 10);

    binding.update(1.0);
    expect(sprite.x).toBeCloseTo(100, 10);
    expect(sprite.rotation).toBeCloseTo(1, 10);
  });

  it("angle lerp takes the shortest path across the ±π boundary", () => {
    const stepper = new FixedStepper({ hz: 60 });
    const binding = new BodySpriteBinding({ stepper });
    const body = makeBody();
    body.rotation = Math.PI - 0.1;
    const sprite = makeSprite();
    binding.bind(asBody(body), sprite);

    // Snapshot prev = PI - 0.1
    stepper.step(asSpace(makeSpace()), 1 / 60);
    // Now current rotation wrapped past +PI into the "negative" side.
    body.rotation = -Math.PI + 0.1;

    binding.update(0.5);
    // Shortest path crosses +PI (total rotation +0.2 rad), so lerp at 0.5
    // should be ~PI (wrapping), not ~0.
    const diff = Math.abs(Math.abs(sprite.rotation) - Math.PI);
    expect(diff).toBeLessThan(0.001);
  });

  it("dispose() unsubscribes the stepper hook", () => {
    const stepper = new FixedStepper({ hz: 60 });
    const binding = new BodySpriteBinding({ stepper });
    const body = makeBody();
    binding.bind(asBody(body), makeSprite());
    binding.dispose();

    // After dispose, further stepper steps shouldn't touch the binding.
    // We verify indirectly: a new body moved to (50, 0) with alpha=0 would
    // lerp from the old snapshot, but since dispose cleared items the
    // binding has nothing to update.
    body.position.x = 50;
    stepper.step(asSpace(makeSpace()), 1 / 60);
    binding.update(0.0);
    expect(binding.size).toBe(0);
  });
});
