/**
 * Canvas-based debug overlay that visualises per-step physics metrics.
 *
 * Renders (top → bottom, uniform gaps):
 * 1. Step time (ms)
 * 2. Rolling step-time graph
 * 3. Phase breakdown bar (1-second average) + legend with percentages
 * 4. Entity counters
 *
 * The overlay auto-enables `space.profilerEnabled` when constructed.
 *
 * @example
 * ```ts
 * import { PerformanceOverlay } from "nape-js/profiler";
 *
 * const overlay = new PerformanceOverlay(space, { canvas: myCanvas });
 * // In game loop, after space.step():
 * overlay.update();
 * ```
 */

import type { PhysicsMetricsData } from "./PhysicsMetrics";

/** Options for {@link PerformanceOverlay}. */
export interface PerformanceOverlayOptions {
  /** Target canvas element. If omitted, a new one is created and appended to `document.body`. */
  canvas?: HTMLCanvasElement;
  /** Corner position of the overlay. Default: `"top-left"`. */
  position?: "top-left" | "top-right" | "bottom-left" | "bottom-right";
  /** Overlay width in CSS pixels. Default: `260`. */
  width?: number;
  /** Overlay height in CSS pixels. Auto-computed from enabled sections if omitted. */
  height?: number;
  /** Number of frames kept in the rolling history graph. Default: `120`. */
  graphHistory?: number;
  /** Show the rolling step-time graph. Default: `true`. */
  showGraph?: boolean;
  /** Show entity counters. Default: `true`. */
  showCounters?: boolean;
  /** Show phase breakdown bar. Default: `true`. */
  showBreakdown?: boolean;
  /** Background colour (any CSS colour string). Default: `"rgba(13,17,23,0.88)"`. */
  backgroundColor?: string;
  /** Text colour (any CSS colour string). Default: `"#00ff88"`. */
  textColor?: string;
  /** Scale factor for HiDPI displays. Default: `window.devicePixelRatio ?? 1`. */
  scale?: number;
}

/** Minimal Space-like interface so the overlay doesn't import the full engine. */
interface SpaceLike {
  profilerEnabled: boolean;
  metrics: PhysicsMetricsData;
}

interface PhaseDef {
  field: keyof PhysicsMetricsData;
  color: string;
  label: string;
}

const PHASES: PhaseDef[] = [
  { field: "broadphaseTime", color: "#4fc3f7", label: "Broad" },
  { field: "narrowphaseTime", color: "#ffb74d", label: "Narrow" },
  { field: "velocitySolverTime", color: "#81c784", label: "VelSolve" },
  { field: "positionSolverTime", color: "#ce93d8", label: "PosSolve" },
  { field: "ccdTime", color: "#ef5350", label: "CCD" },
  { field: "sleepTime", color: "#90a4ae", label: "Sleep" },
];

// Layout constants
const PAD = 12;
const GAP = 10;
const GRAPH_H = 34;
const BAR_H = 8;
const LEGEND_ROW = 12;
const LINE_H = 14;
const RADIUS = 6;

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
): void {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

export class PerformanceOverlay {
  private readonly space: SpaceLike;
  private readonly canvas: HTMLCanvasElement;
  private readonly ctx: CanvasRenderingContext2D;
  private readonly opts: Required<PerformanceOverlayOptions>;
  private readonly history: number[];
  private readonly phaseAccum: number[];
  private readonly phaseDisplay: number[];
  private historyIndex = 0;
  private ownedCanvas: boolean;
  private lastTime = 0;
  private frameCount = 0;
  private fps = 0;
  private fpsAccum = 0;
  private accumFrames = 0;
  private lastFlush = 0;

  constructor(space: SpaceLike, options: PerformanceOverlayOptions = {}) {
    this.space = space;
    space.profilerEnabled = true;

    const scale =
      options.scale ?? (typeof window !== "undefined" ? (window.devicePixelRatio ?? 1) : 1);

    const width = options.width ?? 260;
    const height =
      options.height ??
      this._computeHeight(
        options.showGraph ?? true,
        options.showBreakdown ?? true,
        options.showCounters ?? true,
      );

    this.opts = {
      canvas: options.canvas ?? null!,
      position: options.position ?? "top-left",
      width,
      height,
      graphHistory: options.graphHistory ?? 120,
      showGraph: options.showGraph ?? true,
      showCounters: options.showCounters ?? true,
      showBreakdown: options.showBreakdown ?? true,
      backgroundColor: options.backgroundColor ?? "rgba(13,17,23,0.88)",
      textColor: options.textColor ?? "#00ff88",
      scale,
    };

    if (options.canvas) {
      this.canvas = options.canvas;
      this.ownedCanvas = false;
    } else {
      this.canvas = document.createElement("canvas");
      this.canvas.style.position = "fixed";
      this.canvas.style.zIndex = "99999";
      this.canvas.style.pointerEvents = "none";
      this._applyPosition();
      document.body.appendChild(this.canvas);
      this.ownedCanvas = true;
    }

    this.canvas.width = this.opts.width * scale;
    this.canvas.height = this.opts.height * scale;
    this.canvas.style.width = `${this.opts.width}px`;
    this.canvas.style.height = `${this.opts.height}px`;

    this.ctx = this.canvas.getContext("2d")!;
    this.ctx.scale(scale, scale);

    this.history = new Array(this.opts.graphHistory).fill(0);
    this.phaseAccum = new Array(PHASES.length).fill(0);
    this.phaseDisplay = new Array(PHASES.length).fill(0);
  }

  /** Update the overlay. Call once per frame after `space.step()`. */
  update(): void {
    const now = performance.now();
    this.frameCount++;
    this.fpsAccum += now - (this.lastTime || now);
    if (this.fpsAccum >= 1000) {
      this.fps = Math.round((this.frameCount * 1000) / this.fpsAccum);
      this.frameCount = 0;
      this.fpsAccum = 0;
    }
    this.lastTime = now;

    const m = this.space.metrics;
    this.history[this.historyIndex % this.opts.graphHistory] = m.totalStepTime;
    this.historyIndex++;

    // Accumulate phase times
    for (let i = 0; i < PHASES.length; i++) {
      this.phaseAccum[i] += m[PHASES[i].field] as number;
    }
    this.accumFrames++;

    // Flush every ~1 second
    if (now - this.lastFlush >= 1000 && this.accumFrames > 0) {
      for (let i = 0; i < PHASES.length; i++) {
        this.phaseDisplay[i] = this.phaseAccum[i] / this.accumFrames;
        this.phaseAccum[i] = 0;
      }
      this.accumFrames = 0;
      this.lastFlush = now;
    }

    this._render(m);
  }

  /** Remove the overlay canvas from the DOM (only if it was auto-created). */
  destroy(): void {
    if (this.ownedCanvas && this.canvas.parentNode) {
      this.canvas.parentNode.removeChild(this.canvas);
    }
  }

  // --- Private ---

  private _computeHeight(graph: boolean, breakdown: boolean, counters: boolean): number {
    let h = PAD + LINE_H; // step header always present
    if (graph) h += GAP + GRAPH_H;
    if (breakdown) h += GAP + LINE_H + 4 + BAR_H + 4 + LEGEND_ROW * 2;
    if (counters) h += GAP + LINE_H + 2 + LINE_H;
    return h + PAD;
  }

  private _applyPosition(): void {
    const s = this.canvas.style;
    const p = this.opts.position;
    s.top = p.startsWith("top") ? "8px" : "";
    s.bottom = p.startsWith("bottom") ? "8px" : "";
    s.left = p.endsWith("left") ? "8px" : "";
    s.right = p.endsWith("right") ? "8px" : "";
  }

  private _render(m: PhysicsMetricsData): void {
    const { ctx, opts } = this;
    const W = opts.width;
    const H = opts.height;
    const innerW = W - PAD * 2;

    // Background
    ctx.clearRect(0, 0, W, H);
    roundRect(ctx, 0, 0, W, H, RADIUS);
    ctx.fillStyle = opts.backgroundColor;
    ctx.fill();
    ctx.strokeStyle = "rgba(255,255,255,0.08)";
    ctx.lineWidth = 1;
    ctx.stroke();

    let y = PAD;

    // === Step time ===
    ctx.font = "bold 11px monospace";
    ctx.fillStyle = opts.textColor;
    ctx.fillText(`FPS: ${this.fps}  Step: ${m.totalStepTime.toFixed(2)} ms`, PAD, y + 10);
    y += LINE_H;

    // === Graph ===
    if (opts.showGraph) {
      y += GAP;
      const len = this.opts.graphHistory;

      roundRect(ctx, PAD, y, innerW, GRAPH_H, 3);
      ctx.fillStyle = "rgba(0,255,136,0.06)";
      ctx.fill();

      let max = 0;
      for (let i = 0; i < len; i++) {
        if (this.history[i] > max) max = this.history[i];
      }
      if (max < 0.5) max = 0.5;

      // Budget line
      const budgetFrac = 16.67 / max;
      if (budgetFrac < 1) {
        const refY = y + GRAPH_H - budgetFrac * GRAPH_H;
        ctx.strokeStyle = "rgba(239,83,80,0.3)";
        ctx.setLineDash([2, 3]);
        ctx.beginPath();
        ctx.moveTo(PAD, refY);
        ctx.lineTo(PAD + innerW, refY);
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.fillStyle = "rgba(239,83,80,0.5)";
        ctx.font = "8px monospace";
        ctx.fillText("16.67ms", PAD + 3, refY - 2);
      }

      ctx.strokeStyle = opts.textColor;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      for (let i = 0; i < len; i++) {
        const idx = (this.historyIndex + i) % len;
        const px = PAD + (i / (len - 1)) * innerW;
        const py = y + GRAPH_H - Math.min(this.history[idx] / max, 1) * GRAPH_H;
        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.stroke();
      ctx.lineWidth = 1;
      y += GRAPH_H;
    }

    // === Phase breakdown ===
    if (opts.showBreakdown) {
      y += GAP;

      ctx.font = "10px monospace";
      ctx.fillStyle = "rgba(255,255,255,0.4)";
      ctx.fillText("PHASE BREAKDOWN", PAD, y + 10);
      y += LINE_H + 4;

      let displaySum = 0;
      for (let i = 0; i < PHASES.length; i++) displaySum += this.phaseDisplay[i];
      if (displaySum < 0.0001) displaySum = 1;

      // Rounded bar
      roundRect(ctx, PAD, y, innerW, BAR_H, 3);
      ctx.save();
      ctx.clip();
      let bx = PAD;
      for (let i = 0; i < PHASES.length; i++) {
        const w = (this.phaseDisplay[i] / displaySum) * innerW;
        if (w > 0.3) {
          ctx.fillStyle = PHASES[i].color;
          ctx.fillRect(bx, y, w, BAR_H);
        }
        bx += w;
      }
      ctx.restore();
      y += BAR_H + 4;

      // Legend
      ctx.font = "9px monospace";
      const colW = Math.floor(innerW / 3);
      for (let row = 0; row < 2; row++) {
        let lx = PAD;
        for (let col = 0; col < 3; col++) {
          const i = row * 3 + col;
          const pct = Math.round((this.phaseDisplay[i] / displaySum) * 100);
          ctx.fillStyle = PHASES[i].color;
          ctx.beginPath();
          ctx.arc(lx + 3, y + 3, 3, 0, Math.PI * 2);
          ctx.fill();
          ctx.fillStyle = "rgba(255,255,255,0.55)";
          ctx.fillText(`${PHASES[i].label} ${pct}%`, lx + 9, y + 7);
          lx += colW;
        }
        y += LEGEND_ROW;
      }
    }

    // === Counters ===
    if (opts.showCounters) {
      y += GAP;

      ctx.font = "11px monospace";
      ctx.fillStyle = "#c9d1d9";
      const bodyLabel = `Bodies: ${m.bodyCount}  `;
      ctx.fillText(bodyLabel, PAD, y + 10);
      const bw = ctx.measureText(bodyLabel).width;
      ctx.fillStyle = "rgba(255,255,255,0.4)";
      ctx.font = "10px monospace";
      ctx.fillText(
        `D:${m.dynamicBodyCount} S:${m.staticBodyCount} K:${m.kinematicBodyCount}`,
        PAD + bw,
        y + 10,
      );
      y += LINE_H + 2;

      ctx.font = "11px monospace";
      ctx.fillStyle = "#c9d1d9";
      ctx.fillText(
        `Sleep: ${m.sleepingBodyCount}  Contacts: ${m.contactCount}  Constr: ${m.constraintCount}`,
        PAD,
        y + 10,
      );
    }
  }
}
