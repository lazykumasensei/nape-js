import { describe, it, expect, vi } from "vitest";
import { PerformanceOverlay } from "../../src/profiler/PerformanceOverlay";
import { PhysicsMetrics } from "../../src/profiler/PhysicsMetrics";

// Minimal mock of the Space-like interface
function createMockSpace() {
  return {
    profilerEnabled: false,
    metrics: new PhysicsMetrics(),
  };
}

// Minimal Canvas2D context mock
function createMockCanvas() {
  const ctx = {
    scale: vi.fn(),
    clearRect: vi.fn(),
    fillRect: vi.fn(),
    strokeRect: vi.fn(),
    fillText: vi.fn(),
    measureText: vi.fn(() => ({ width: 30 })),
    beginPath: vi.fn(),
    moveTo: vi.fn(),
    lineTo: vi.fn(),
    quadraticCurveTo: vi.fn(),
    arc: vi.fn(),
    closePath: vi.fn(),
    stroke: vi.fn(),
    fill: vi.fn(),
    save: vi.fn(),
    restore: vi.fn(),
    clip: vi.fn(),
    setLineDash: vi.fn(),
    fillStyle: "",
    strokeStyle: "",
    lineWidth: 1,
    font: "",
  };
  const canvas = {
    getContext: vi.fn(() => ctx),
    width: 0,
    height: 0,
    style: {
      position: "",
      zIndex: "",
      pointerEvents: "",
      top: "",
      bottom: "",
      left: "",
      right: "",
      width: "",
      height: "",
    },
    parentNode: null as any,
    removeChild: vi.fn(),
  } as any;
  return { canvas, ctx };
}

describe("PerformanceOverlay", () => {
  it("should enable profiler on the space when constructed", () => {
    const space = createMockSpace();
    const { canvas } = createMockCanvas();
    expect(space.profilerEnabled).toBe(false);
    new PerformanceOverlay(space, { canvas, scale: 1 });
    expect(space.profilerEnabled).toBe(true);
  });

  it("should accept custom options", () => {
    const space = createMockSpace();
    const { canvas } = createMockCanvas();
    new PerformanceOverlay(space, {
      canvas,
      position: "bottom-right",
      width: 400,
      height: 250,
      graphHistory: 60,
      showGraph: false,
      showCounters: false,
      showBreakdown: false,
      backgroundColor: "red",
      textColor: "blue",
      scale: 2,
    });
    // Canvas should be sized according to options
    expect(canvas.width).toBe(800); // 400 * 2
    expect(canvas.height).toBe(500); // 250 * 2
    expect(canvas.style.width).toBe("400px");
    expect(canvas.style.height).toBe("250px");
  });

  it("should call ctx.scale with the scale factor", () => {
    const space = createMockSpace();
    const { canvas, ctx } = createMockCanvas();
    new PerformanceOverlay(space, { canvas, scale: 2 });
    expect(ctx.scale).toHaveBeenCalledWith(2, 2);
  });

  it("should render without errors on update()", () => {
    const space = createMockSpace();
    const { canvas, ctx } = createMockCanvas();
    const overlay = new PerformanceOverlay(space, { canvas, scale: 1 });

    // Simulate some metrics
    space.metrics.totalStepTime = 1.5;
    space.metrics.broadphaseTime = 0.3;
    space.metrics.narrowphaseTime = 0.2;
    space.metrics.bodyCount = 10;

    expect(() => overlay.update()).not.toThrow();
    expect(ctx.clearRect).toHaveBeenCalled();
    expect(ctx.fillText).toHaveBeenCalled();
  });

  it("should handle multiple update() calls", () => {
    const space = createMockSpace();
    const { canvas } = createMockCanvas();
    const overlay = new PerformanceOverlay(space, { canvas, scale: 1 });

    for (let i = 0; i < 10; i++) {
      space.metrics.totalStepTime = Math.random() * 2;
      expect(() => overlay.update()).not.toThrow();
    }
  });

  it("should not throw when all display options are disabled", () => {
    const space = createMockSpace();
    const { canvas } = createMockCanvas();
    const overlay = new PerformanceOverlay(space, {
      canvas,
      scale: 1,
      showGraph: false,
      showCounters: false,
      showBreakdown: false,
    });
    space.metrics.totalStepTime = 1.0;
    expect(() => overlay.update()).not.toThrow();
  });

  it("should handle zero totalStepTime gracefully (no division by zero)", () => {
    const space = createMockSpace();
    const { canvas } = createMockCanvas();
    const overlay = new PerformanceOverlay(space, { canvas, scale: 1 });
    space.metrics.totalStepTime = 0;
    expect(() => overlay.update()).not.toThrow();
  });

  it("destroy() should not throw for non-owned canvas", () => {
    const space = createMockSpace();
    const { canvas } = createMockCanvas();
    const overlay = new PerformanceOverlay(space, { canvas, scale: 1 });
    // When canvas is passed in, it's not "owned" — destroy should be a no-op
    expect(() => overlay.destroy()).not.toThrow();
  });
});
