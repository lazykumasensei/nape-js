# nape-js — Roadmap & Priority History

## Competitive Advantages

nape-js already leads in several areas vs Matter.js, Planck.js, and other pure-JS engines:

- **CCD** (continuous collision detection) — Matter.js lacks this entirely (#1 user complaint)
- **Fluid simulation** — buoyancy/drag unique among JS engines (only LiquidFun via WASM compares)
- **Per-interaction-type filtering** — separate group/mask for collision, sensor, fluid (more granular than Box2D)
- **Pixel-based units** — no meters-to-pixels conversion needed (Box2D pain point)
- **Full TypeScript** with `strict: true` — Matter.js relies on DefinitelyTyped
- **Serialization API** — save/load/replay/multiplayer sync
- **Debug draw API** — abstract interface, no renderer dependency in core

Key competitors to watch:
- **Phaser Box2D** (Dec 2024) — Box2D v3 port, 65KB, improved solver+CCD, speculative collision
- **Rapier** — WASM+SIMD, cross-platform determinism, binary snapshots, 2–5x faster for large scenes, but large bundle + async init
- **Matter.js** — largest community (14–16k stars) but no CCD, no TypeScript, 2+ years inactive
- **Planck.js** — Box2D v2 port, 4.8k stars, 577 npm/week, no CCD, no fluid sim
- **p2-es** — modernized p2.js fork (poimandres), ESM+TS, small community (440 npm/week)

### Detailed Competitor Feature Matrix

| Feature | nape-js | Matter.js | Planck.js | p2-es | Rapier | Phaser Box2D |
|---------|---------|-----------|-----------|-------|--------|--------------|
| **CCD** | ✅ | ❌ | ❌ | ❌ | ✅ | ✅ |
| **Fluid Sim** | ✅ Unique | ❌ | ❌ | ❌ | ❌ | ❌ |
| **Full TypeScript** | ✅ strict | ⚠️ DT | ❌ JS | ✅ fork | ⚠️ WASM | ✅ |
| **Serialization** | ✅ JSON+Binary | ❌ | ❌ | ❌ | ✅ Binary | ❌ |
| **Web Worker Helper** | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |
| **Deterministic** | 🔶 Soft (P48) | ❌ | ✅ Fixed dt | ✅ | ✅ Cross-platform | ❌ |
| **Bundle Size** | 87 KB / 16 KB gz | Large | Medium | Medium | 78 KB WASM | 65 KB |
| **Debug Draw API** | ✅ Abstract | ❌ Built-in | ❌ | ❌ | ❌ | ❌ |
| **Capsule Shape** | ✅ | ❌ | ❌ | ✅ | ✅ | ❌ |
| **Concave Helper** | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |
| **Community** | Growing | 14–16k ⭐ | 4.8k ⭐ | Small | Medium | Growing |
| **Active Dev** | ✅ | ❌ 2+ yrs | ✅ | ✅ fork | ✅ | ✅ |

### Competitive Gaps to Address

1. **Cross-platform determinism** — Rapier has bit-level IEEE 754 determinism; our P48 targets "soft" only (same-platform). True cross-platform is impractical in pure JS.
2. **Raw performance** — Rapier WASM+SIMD is 2–5x faster for large scenes (1000+ bodies). Our P46 hot-path optimization helps but cannot match WASM.
3. **CCD no longer exclusive** — Phaser Box2D (Dec 2024) now has CCD+speculative collision. Still an advantage vs Matter.js/Planck.js/p2.
4. **Bundle size gap** — Phaser Box2D is 65 KB vs our 87 KB (small gap, but notable).
5. **Community size** — Matter.js has 14–16k stars despite being stale. We need marketing/visibility.

---

## Ideas Not Yet on Roadmap

Potential future priorities identified via competitive analysis and market gaps:

| Idea | Why | Effort | Impact |
|------|-----|--------|--------|
| **Phaser plugin/adapter** | Phaser is the #1 JS game framework; direct integration = massive reach | M | 🔥 Very high |
| **React/R3F integration** | `@react-three/rapier`-style package for React gamedev community | M | 🔥 High |
| **Soft body / cloth sim** | No competitor has this in pure JS — market gap | L | High |
| **Particle system** | Simple physics-aware particle emitter — commonly requested by gamedevs | S-M | Medium |
| **Tilemap collision helper** | Tiled/LDtk map → physics body conversion — common gamedev need | S | Medium |

### Marketing & Visibility Opportunities

| Platform | Strategy | Priority |
|----------|----------|----------|
| **Hacker News** (Show HN) | Benchmark post: "nape-js vs Matter.js — CCD + Fluid sim in 87KB" | 🔥 Very high |
| **Reddit** r/gamedev + r/javascript | Fluid simulation demo GIF/video — visually impressive | 🔥 Very high |
| **dev.to / Medium** | "Why I rewrote a Haxe physics engine in TypeScript" — story post | High |
| **Twitter/X #gamedev** | Short videos: fluid sim, CCD demo, multiplayer demo | High |
| **Phaser community forum** | Announce Phaser plugin once ready | High |
| **PixiJS Discord** | Announce P44 PixiJS integration once shipped | Medium |
| **awesome-\* GitHub lists** | PRs to awesome-gamedev, awesome-typescript, awesome-javascript | ⭐ Easy win |
| **Gamedev jams** (Ludum Dare, js13k) | Recommend engine to jam participants | Medium |
| **YouTube tutorial** | "Build a platformer with nape-js in 10 minutes" | Medium-high |

---

## Priority Table

### Completed & Cancelled

Done: P21–P28, P30–P33, P35, P37–P43, P46, P48, P50, P52, P53.
Cancelled: P34 (tree shaking — architectural limit), P36 (server demos — superseded by P52), P49 (ECS adapter — trivial pattern).

### Active & Planned

| Priority                                  | Effort | Impact    | Risk   | Status         |
| ----------------------------------------- | ------ | --------- | ------ | -------------- |
| P29 — Test coverage ≥80%                  | L      | safety    | none   | 🔶 ~54% (3251 tests) |
| P44 — PixiJS integration package          | M      | adoption  | low    | 🔶 Phase 1 done |
| P45 — Character controller                | M      | DX        | medium | ⬜ Not started |
| P47 — CJS bundle dedup (serialization)    | S      | bundle    | low    | ⬜ Not started |
| P51 — Sub-stepping solver                 | XL     | stability | high   | ⬜ Not started |
| P54 — Performance benchmark page          | S      | adoption  | low    | ⬜ Not started |
| P55 — npm/SEO optimization                | XS     | adoption  | low    | ⬜ Not started |
| P56 — Interactive playground              | S-M    | adoption  | low    | ⬜ Not started |

---

## In Progress: P44 — PixiJS Integration Package

**Effort: M | Impact: adoption | Risk: low | Status: 🔶 Phase 1 done**

### Phase 1 — Demo & CodePen support (✅ Done)

- PixiJS adapter with Sprite + `generateTexture` pattern
- `RENDERER_PIXI` CodePen helper, 28 demos with native `codePixi` snippets

### Phase 2 — Public npm package (⬜ Pending)

Target: `@newkrok/nape-pixi` or `@newkrok/nape-js/pixi` subpath export

- Auto-sync body transforms → PixiJS Sprite/Container transforms
- Create/destroy hooks, texture atlas support, typed API with TSDoc

---

## Planned: P45 — Character Controller

**Effort: M | Impact: DX | Risk: medium**

Geometric character controller (Box2D v3.1 pattern):

- Ground detection, slope handling, step climbing
- One-way platform support (builds on existing PreListener pattern)
- Moving platform support via kinematic body tracking

---

## Planned: P47 — CJS Bundle Dedup

**Effort: S | Impact: bundle size | Risk: low**

The serialization CJS bundle duplicates the entire engine (902 KB). The ESM version
correctly code-splits (8.2 KB). Fix via tsup config: `splitting`, `treeshake`, `target: es2020`.

---

## Planned: P51 — Sub-stepping Solver

**Effort: XL | Impact: stability | Risk: high**

Box2D v3's "Soft Step" solver approach: soft constraints + sub-stepping for better stability.
Major architectural change — long-term goal, depends on P46 (hot-path optimization).

---

## Planned: P54 — Performance Benchmark Page

**Effort: S | Impact: adoption | Risk: low**

Public comparison page (nape-js vs Matter.js vs Planck.js) with reproducible benchmarks:

- Stacking stability, broadphase throughput, CCD accuracy, constraint solver convergence
- Publishable to Hacker News / Reddit for visibility
- Hosted on GitHub Pages alongside existing demos

---

## Planned: P55 — npm/SEO Optimization

**Effort: XS | Impact: adoption | Risk: low**

Improve discoverability on npm and search engines:

- Optimize package.json `keywords` for "2d physics engine typescript" ranking
- README badges (npm version, bundle size, test count, license)
- Consistent naming/description across npm, GitHub, docs

---

## Planned: P56 — Interactive Playground

**Effort: S-M | Impact: adoption | Risk: low**

Browser-based sandbox for instant try-out without local setup:

- StackBlitz or CodeSandbox template with pre-configured nape-js
- Editable examples: falling shapes, constraints, fluid sim, CCD
- Link from README and docs landing page
