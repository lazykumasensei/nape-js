import { describe, expect, it, vi } from "vitest";
import type { Space } from "@newkrok/nape-js";
import { FixedStepper } from "../src/FixedStepper.js";

/**
 * Minimal Space stub — tracks step() calls without pulling in the real engine.
 */
function makeSpace() {
  const stub = {
    calls: [] as Array<{ dt: number; vIters: number; pIters: number }>,
    step(dt: number, vIters: number, pIters: number) {
      stub.calls.push({ dt, vIters, pIters });
    },
  };
  return stub;
}

function asSpace(stub: ReturnType<typeof makeSpace>): Space {
  return stub as unknown as Space;
}

describe("FixedStepper", () => {
  it("defaults to 60 Hz with dt = 1/60", () => {
    const s = new FixedStepper();
    expect(s.hz).toBe(60);
    expect(s.dt).toBeCloseTo(1 / 60, 12);
  });

  it("runs exactly one step when fed a single dt of equal size", () => {
    const stepper = new FixedStepper({ hz: 60 });
    const stub = makeSpace();
    const alpha = stepper.step(asSpace(stub), 1 / 60);
    expect(stub.calls).toHaveLength(1);
    expect(stub.calls[0].dt).toBeCloseTo(1 / 60, 12);
    expect(alpha).toBeCloseTo(0, 10);
  });

  it("forwards velocity and position iteration counts to space.step", () => {
    const stepper = new FixedStepper({
      hz: 60,
      velocityIterations: 7,
      positionIterations: 3,
    });
    const stub = makeSpace();
    stepper.step(asSpace(stub), 1 / 60);
    expect(stub.calls[0].vIters).toBe(7);
    expect(stub.calls[0].pIters).toBe(3);
  });

  it("runs zero steps when dt is below the step size, but accumulates", () => {
    const stepper = new FixedStepper({ hz: 60 });
    const stub = makeSpace();
    const alpha = stepper.step(asSpace(stub), 1 / 120);
    expect(stub.calls).toHaveLength(0);
    expect(alpha).toBeCloseTo(0.5, 10);
  });

  it("runs multiple steps across successive frames and reports alpha in [0,1)", () => {
    const stepper = new FixedStepper({ hz: 60 });
    const stub = makeSpace();
    const a1 = stepper.step(asSpace(stub), 1 / 30); // two full steps
    expect(stub.calls).toHaveLength(2);
    expect(a1).toBeCloseTo(0, 10);

    const a2 = stepper.step(asSpace(stub), 1 / 60 + 1 / 240); // one step + 0.25
    expect(stub.calls).toHaveLength(3);
    expect(a2).toBeCloseTo(0.25, 10);
  });

  it("clamps catch-up at maxStepsPerFrame and drops the remaining backlog", () => {
    const stepper = new FixedStepper({ hz: 60, maxStepsPerFrame: 3 });
    const stub = makeSpace();
    stepper.step(asSpace(stub), 10); // way more than 3 steps worth
    expect(stub.calls).toHaveLength(3);
    expect(stepper.alpha).toBe(0);
  });

  it("fires before/after hooks in order, once per step", () => {
    const stepper = new FixedStepper({ hz: 60 });
    const stub = makeSpace();
    const order: string[] = [];
    stepper.onBeforeStep(() => order.push("before"));
    stepper.onAfterStep(() => order.push("after"));
    stepper.step(asSpace(stub), 1 / 30); // two steps
    expect(order).toEqual(["before", "after", "before", "after"]);
  });

  it("supports unsubscribing hooks", () => {
    const stepper = new FixedStepper({ hz: 60 });
    const stub = makeSpace();
    const before = vi.fn();
    const unsub = stepper.onBeforeStep(before);
    stepper.step(asSpace(stub), 1 / 60);
    unsub();
    stepper.step(asSpace(stub), 1 / 60);
    expect(before).toHaveBeenCalledTimes(1);
  });

  it("reset() clears the accumulator", () => {
    const stepper = new FixedStepper({ hz: 60 });
    const stub = makeSpace();
    stepper.step(asSpace(stub), 1 / 120); // accumulates 0.5 of a step
    expect(stepper.alpha).toBeCloseTo(0.5, 10);
    stepper.reset();
    expect(stepper.alpha).toBe(0);
    expect(stepper.accumulatorSeconds).toBe(0);
  });

  it("ignores negative or non-finite deltaSec without advancing the accumulator", () => {
    const stepper = new FixedStepper({ hz: 60 });
    const stub = makeSpace();
    stepper.step(asSpace(stub), -1);
    stepper.step(asSpace(stub), Number.NaN);
    stepper.step(asSpace(stub), Number.POSITIVE_INFINITY);
    expect(stub.calls).toHaveLength(0);
    expect(stepper.alpha).toBe(0);
  });

  it("throws on non-positive hz", () => {
    expect(() => new FixedStepper({ hz: 0 })).toThrow(RangeError);
    expect(() => new FixedStepper({ hz: -30 })).toThrow(RangeError);
    expect(() => new FixedStepper({ hz: Number.NaN })).toThrow(RangeError);
  });
});
