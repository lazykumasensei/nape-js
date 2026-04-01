/**
 * Minimal DOM type declarations for the profiler overlay.
 * The core engine is DOM-free (lib: ["ES2020"] only), so we declare
 * just the subset of DOM APIs used by PerformanceOverlay here.
 */

interface CSSStyleDeclaration {
  position: string;
  zIndex: string;
  pointerEvents: string;
  top: string;
  bottom: string;
  left: string;
  right: string;
  width: string;
  height: string;
}

interface HTMLCanvasElement {
  width: number;
  height: number;
  style: CSSStyleDeclaration;
  parentNode: ParentNode | null;
  getContext(contextId: "2d"): CanvasRenderingContext2D | null;
}

interface TextMetrics {
  width: number;
}

interface CanvasRenderingContext2D {
  fillStyle: string | CanvasGradient | CanvasPattern;
  strokeStyle: string | CanvasGradient | CanvasPattern;
  lineWidth: number;
  font: string;
  scale(x: number, y: number): void;
  clearRect(x: number, y: number, w: number, h: number): void;
  fillRect(x: number, y: number, w: number, h: number): void;
  strokeRect(x: number, y: number, w: number, h: number): void;
  fillText(text: string, x: number, y: number): void;
  measureText(text: string): TextMetrics;
  beginPath(): void;
  closePath(): void;
  moveTo(x: number, y: number): void;
  lineTo(x: number, y: number): void;
  quadraticCurveTo(cpx: number, cpy: number, x: number, y: number): void;
  arc(x: number, y: number, radius: number, startAngle: number, endAngle: number): void;
  stroke(): void;
  fill(): void;
  save(): void;
  restore(): void;
  clip(): void;
  setLineDash(segments: number[]): void;
}

// eslint-disable-next-line @typescript-eslint/no-empty-object-type
interface CanvasGradient {}
// eslint-disable-next-line @typescript-eslint/no-empty-object-type
interface CanvasPattern {}

interface ParentNode {
  removeChild(child: unknown): unknown;
}

interface Document {
  createElement(tagName: "canvas"): HTMLCanvasElement;
  body: HTMLElement;
}

interface HTMLElement extends ParentNode {
  appendChild(node: unknown): unknown;
}

declare const document: Document;
declare const window: {
  devicePixelRatio?: number;
};

declare function performance_now(): number;

interface Performance {
  now(): number;
}
declare const performance: Performance;
