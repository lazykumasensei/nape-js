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
| **Interactive playground** | Browser sandbox (CodeSandbox/StackBlitz template) for instant try-out | S-M | 🔥 High |
| **Performance benchmark page** | Public comparison vs Matter.js/Planck.js — publishable to HN/Reddit | S | ⭐ Easy win |
| **Soft body / cloth sim** | No competitor has this in pure JS — market gap | L | High |
| **Particle system** | Simple physics-aware particle emitter — commonly requested by gamedevs | S-M | Medium |
| **Tilemap collision helper** | Tiled/LDtk map → physics body conversion — common gamedev need | S | Medium |
| **npm/SEO optimization** | Keywords, README badges, "2d physics engine typescript" ranking | XS | ⭐ Easy win |

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

### Completed (P21–P39)

| Priority                              | Effort | Impact   | Status       |
| ------------------------------------- | ------ | -------- | ------------ |
| P21 — Drop `__class__` / `$hxClasses` | S      | medium   | ✅ Done      |
| P22 — Minification                    | XS     | large    | ✅ Done      |
| P23 — `__zpp` → direct imports        | M      | large    | ✅ Done      |
| P24 — Namespace reduction             | S      | medium   | ✅ Done      |
| P25 — `Any` → real types              | XL     | largest  | ✅ Done      |
| P26 — Tree shaking                    | L      | large    | ✅ Done      |
| P27 — HaxeShims audit                 | S      | small    | ✅ Done      |
| P28 — API ergonomics (28a+28b+28c)    | M      | DX       | ✅ Done      |
| P30 — TSDoc documentation             | L      | DX       | ✅ Done      |
| P31 — API ergonomics additions        | M      | DX       | ✅ Done      |
| P32 — Internal accessor cleanup       | S      | small    | ✅ Done      |
| P33 — Benchmark CI                    | M      | medium   | ✅ Done      |
| P34 — Granular tree shaking           | XL     | large    | ❌ Cancelled |
| P35 — Type system improvements        | S      | DX       | ✅ Done      |
| P37 — Serialization API               | L      | medium   | ✅ Done      |
| P38 — Debug draw API                  | M      | DX       | ✅ Done      |
| P39 — Binary serialization            | M      | critical | ✅ Done      |
| P40 — Haxe remnant cleanup             | M      | medium   | ✅ Done      |
| P41 — Capsule shape                    | S      | medium   | ✅ Done      |

### Active & Planned

| Priority                                  | Effort | Impact   | Risk   | Status         |
| ----------------------------------------- | ------ | -------- | ------ | -------------- |
| P29 — Test coverage ≥80%                  | L      | safety   | none   | 🔶 ~54% (3251 tests) |
| P36 — Server-side + demo examples         | M      | medium   | low    | ❌ Cancelled   |
| P52 — Multiplayer demo                    | M      | adoption | low    | ✅ Done        |
| P42 — Web Worker helper                   | M      | perf/DX  | medium | ✅ Done        |
| P43 — Concave polygon helper              | M      | high     | low    | ✅ Done        |
| P44 — PixiJS integration package          | M      | adoption | low    | 🔶 Phase 1 done |
| P45 — Character controller                | M      | DX       | medium | ⬜ Not started |
| P46 — Hot-path optimization               | M      | perf     | low    | ✅ Done        |
| P47 — CJS bundle dedup (serialization)    | S      | bundle   | low    | ⬜ Not started |
| P48 — Deterministic mode (soft)           | L      | critical | high   | ⬜ Not started |
| P49 — ECS adapter layer                   | M      | DX       | medium | ⬜ Not started |
| P50 — Spatial hash grid broadphase        | S-M    | perf     | low    | ✅ Done        |
| P51 — Sub-stepping solver                 | XL     | stability| high   | ⬜ Not started |
| P53 — Polygon-Polygon narrowphase bug fix | M      | critical | high   | ⬜ Not started |

---

## Active: P29 — Test Coverage ≥80%

Steps 1–6 done (+959 tests, 2269 → 3228). All previously crashing APIs are now fixed and tested.

**Current coverage: ~54.3% statements.**

**Remaining gaps (Step 7):**
- `ZPP_Collide` ~21%, `ZPP_Broadphase` ~27%, `ZPP_Ray` ~44%
- `ZPP_Space` ~57%, `ZPP_Body` ~73%
- 40 native files have no dedicated test file, including `ZPP_Space.ts` (12,781 lines)

---

## Cancelled: P36 — Server-side + Demo Examples

**Decision: Cancelled.** A standalone Node.js script with CI has no demonstrable value
without hosting. Superseded by P52 which delivers a real hosted multiplayer demo.

---

## Done: P52 — Multiplayer Demo

**Effort: M | Impact: adoption | Risk: low**

A hosted, real-time multiplayer physics demo showcasing the engine to new users.

**Delivered:**
- `docs/multiplayer.html` — client page, linked from examples grid, GitHub "View source" link
- `server/index.js` — Railway-hosted Node.js WebSocket server, 60 Hz physics loop
- `railway.toml` — Railway deploy config
- Server-authoritative simulation (all physics server-side)
- Custom binary delta frame protocol — only changed bodies sent each tick (vs full state)
- Platformer scene: static walls/floor/ceiling, one-way platforms, scattered balls & boxes
- 5 hanging pendulums via `DistanceJoint` (soft spring, pushable)
- Player character: vertical `Capsule` shape (28×46px), WASD/arrow keys
- Ground detection via `space.arbiters` + `isSleeping` fallback
- Up to 8 players — 9th+ connection enters **spectator mode** (watches, no body)
- Player count indicator, ping display (server-side pong response)
- Player color badges, "you" indicator dot above own character
- Reconnect on disconnect (players only)

**Implementation guide:** See [`docs/guides/multiplayer-guide.md`](./multiplayer-guide.md) for
server architecture recommendations, protocol design, interpolation, prediction,
determinism considerations, and scaling advice.

---

## Done: P39 — Binary Serialization (Uint8Array Snapshots)

**Effort: M | Impact: critical (multiplayer) | Risk: medium**

Compact binary snapshot format for sub-millisecond rollback netcode:

- `spaceToBinary(space): Uint8Array` — compact binary state snapshot (little-endian)
- `spaceFromBinary(data): Uint8Array` — fast restore
- `BINARY_SNAPSHOT_VERSION` — format version constant
- All exported from `@newkrok/nape-js/serialization` (same entry point as JSON API)

**Key differences from JSON serialization:**
- ~40–60% smaller payload than equivalent JSON
- No `userData` (arbitrary JSON cannot be efficiently binary-encoded)
- Same constraint/body coverage (UserConstraint skipped)
- Magic header `"NAPE"` + version guard for data integrity

**Remaining future work (separate priorities):**
- Delta encoding for network sync (only send changed bodies) — future priority
- P48 — Deterministic mode for cross-platform multiplayer

**Use cases:** rollback netcode, client-side prediction, fast save/load, replay recording.

---

## Done: P40 — Haxe Remnant Cleanup

**Effort: M | Impact: medium (bundle, perf, code quality) | Risk: low**

Removed all remaining Haxe compilation artifacts from the codebase:

- `__name__` static arrays — removed from 151 files (166 occurrences)
- `__class__` instance fields — removed from 15 files, plus filter conditions in prototype-copy code
- `__super__` static fields — removed from 24+ files (30 occurrences), including bootstrap.ts assignments
- Prototype-copy `_init()` — DynAABBPhase & SweepPhase now use proper `extends ZPP_Broadphase`
- `const _gthis = this` — replaced with direct `this` in 4 ZPP_Space.ts methods
- `__name__` copies in ZPPRegistry.ts — removed 9 registry propagation lines
- Test cleanup — removed 103 Haxe metadata tests (3354 → 3251 tests)

---

## Done: P41 — Capsule Shape

**Effort: S | Impact: medium | Risk: low**

Convenience `Capsule` class that builds a Body from two Circle end-caps + a rectangular
Polygon middle section. Commonly needed for character controllers and rounded obstacles.

- `Capsule.create(width, height, material?, filter?)` — horizontal capsule
- `Capsule.createVertical(width, height, material?, filter?)` — vertical capsule
- Exported from `@newkrok/nape-js` main entry point
- Interactive demo: `examples/capsule-demo.html`
- 26 tests covering creation, validation, material/filter propagation, physics integration

---

## Done: P42 — Web Worker Helper

**Effort: M | Impact: perf/DX | Risk: medium**

Run physics simulation off the main thread using Web Workers + SharedArrayBuffer.

**Delivered:**
- `@newkrok/nape-js/worker` sub-export — tree-shakeable, no core engine dependency
- `PhysicsWorkerManager` class — main-thread controller for the worker lifecycle
- `buildWorkerScript(napeUrl)` — generates self-contained worker code (inline Blob or hosted file)
- Flat transform buffer layout: `[bodyCount, timestamp, stepMs, x0, y0, rot0, x1, y1, rot1, ...]`
- SharedArrayBuffer zero-copy reads when COOP/COEP headers present
- Automatic `postMessage` fallback when SharedArrayBuffer unavailable
- Typed message protocol for body management (add/remove/force/impulse/velocity/position)
- Auto-step mode (fixed 60 Hz loop in worker) or manual stepping
- `docs/demos/web-worker.js` stress test demo — 300 bodies off-thread, smooth main-thread rendering
- ~9.5 KB ESM bundle (separate from core engine)

**API:**
```ts
import { PhysicsWorkerManager } from "@newkrok/nape-js/worker";

const mgr = new PhysicsWorkerManager({ gravityY: 600, maxBodies: 256 });
await mgr.init();
const id = mgr.addBody("dynamic", 100, 50, [{ type: "circle", radius: 20 }]);
mgr.start();

// Read transforms (zero-copy with SharedArrayBuffer)
const t = mgr.getTransform(id); // { x, y, rotation }
```

**Requirements:**
- COOP/COEP headers for SharedArrayBuffer (falls back to postMessage without them)
- Worker imports nape-js ESM bundle at runtime (CDN default, overridable via `napeUrl`)

---

## Done: P43 — Concave Polygon Helper

**Effort: M | Impact: high (user demand) | Risk: low**

Convenience API for creating bodies from concave polygon vertices. Wraps
`GeomPoly.convexDecomposition()` into a user-friendly function:

- `createConcaveBody(vertices, options?)` — exported from main `@newkrok/nape-js`
- Accepts `Vec2[]` or `GeomPoly`, returns `Body` with multiple convex `Polygon` shapes
- Automatic winding order normalization (clockwise for decomposition)
- Input validation: null/degenerate/self-intersecting checks
- Optional simplification via `simplify` option (Ramer–Douglas–Peucker)
- Delaunay refinement option for higher-quality decomposition
- Convex passthrough: already-convex input creates a single shape (no decomposition overhead)
- Options: `type`, `position`, `material`, `filter`, `delaunay`, `simplify`
- 38 tests covering validation, decomposition, options, physics integration, edge cases

---

## In Progress: P44 — PixiJS Integration Package

**Effort: M | Impact: adoption | Risk: low | Status: 🔶 Phase 1 done**

PixiJS (~46.6k stars, ~403k npm/week) is the #1 pure 2D renderer and the most natural
pairing for an external physics engine.

### Phase 1 — Demo & CodePen support (✅ Done)

- ✅ PixiJS adapter rewritten to Sprite + `generateTexture` pattern (real game architecture)
- ✅ `RENDERER_PIXI` CodePen helper with body→Sprite sync, grid, constraint overlays
- ✅ 28 demos have native `codePixi` snippets (PixiJS v8 API, not canvas2d fallback)
- ✅ CodePen template with `PIXI.Application` init, proper imports, `addWalls` helper
- ✅ Fixed `getDemoCode` fallback: pixijs/threejs never fall back to incompatible code2d
- 4 demos excluded (destructible-terrain, body-from-graphic, drop-image-body, web-worker) — canvas bitmap APIs

### Phase 2 — Public npm package (⬜ Pending)

Target: `@newkrok/nape-pixi` or `@newkrok/nape-js/pixi` subpath export

- Auto-sync body transforms → PixiJS Sprite/Container transforms (`NapePixiSync`)
- Create/destroy hooks for body lifecycle (spawn sprite, remove sprite)
- Texture atlas / sprite sheet support (vs current per-body `generateTexture`)
- Typed API with full TSDoc
- Example scenes: platformer, top-down, falling shapes

---

## Planned: P45 — Character Controller

**Effort: M | Impact: DX | Risk: medium**

Geometric character controller (Box2D v3.1 pattern) separate from the physics world:

- Ground detection, slope handling, step climbing
- One-way platform support (builds on existing PreListener pattern)
- Moving platform support via kinematic body tracking
- Common in platformers — currently requires manual implementation

---

## Done: P46 — Hot-path Optimization

**Effort: M | Impact: perf | Risk: low | Status: ✅ Done**

Performance improvements applied to the simulation hot path:

- ✅ Deduplicated body invalidation loops in `step()` — extracted `_invalidateBodyList()` helper (~60 lines removed)
- ✅ Extracted inlined linked-list operations in `prestep()` — `_prestepArbiterList()` helper for fluid/sensor arbiters (~100 lines removed)
- ✅ Fixed pool bypass: 19 inline pool-check blocks replaced with `ZPP_Vec2.get()` calls (ZPP_Collide, ZPP_SweepDistance, ZPP_SweepPhase, ZPP_ToiEvent)
- ✅ Optimized `DynAABBPhase.__remove`: added `gprev` doubly-linked pointer to `ZPP_AABBPair` for O(1) pair unlinking; `_linkPair`/`_unlinkPair` helpers; O(n) global scan → O(k) per-shape iteration
- ✅ Narrowed `any` → concrete types in hot-path files (ZPP_Space, ZPP_Body, ZPP_ColArbiter, ZPP_Collide, ZPP_DynAABBPhase) for V8 monomorphic inline caches
- Net result: −429 lines, 7 new pair-consistency tests (3844 → 3851)

---

## Planned: P47 — CJS Bundle Dedup

**Effort: S | Impact: bundle size | Risk: low**

The serialization CJS bundle duplicates the entire engine (902 KB). The ESM version
correctly code-splits (8.2 KB). Fix via tsup config: `splitting`, `treeshake`, `target: es2020`.

---

## Planned: P48 — Deterministic Mode (Soft)

**Effort: L | Impact: critical (multiplayer) | Risk: high**

Same-platform deterministic simulation (identical results on same browser/OS):

- Already has `sortContacts: true` as a foundation
- Audit all non-deterministic code paths (hash iteration, floating-point ordering)
- Ensure fixed timestep produces identical results across runs
- Document limitations vs cross-platform determinism (which requires WASM/fixed-point)

Note: True cross-platform bit-level determinism (like Rapier) is impractical in pure JS
due to IEEE 754 implementation differences. "Soft determinism" (same platform = same results)
is the achievable goal and sufficient for most multiplayer patterns.

---

## Planned: P49 — ECS Adapter Layer

**Effort: M | Impact: DX | Risk: medium**

Optional adapter for Entity Component System frameworks (bitECS, miniplex, Becsy):

- Physics components (position, velocity, mass) as flat typed arrays
- System that syncs ECS components ↔ nape-js Body objects each frame
- Enables better cache locality and easier serialization
- Growing trend in JS game development — no physics engine currently offers this

---

## Done: P50 — Spatial Hash Grid Broadphase

**Effort: S-M | Impact: perf (niche) | Risk: low | Status: ✅ Complete**

Third broadphase algorithm for dense, uniform-object scenes:

- `Broadphase.SPATIAL_HASH` — opt-in, default unchanged (`DYNAMIC_AABB_TREE`)
- O(1) expected lookup for nearby objects via uniform grid hashing
- Auto-tunes cell size to 2× average shape AABB (or accepts explicit cell size)
- Best for: particle simulations, many same-sized objects, bounded worlds
- Not useful for variable-size objects or sparse worlds
- Includes asteroid field demo (2000 drifting asteroids in zero-g)
- 34 integration tests covering collisions, spatial queries, raycasting, constraints

---

## Planned: P51 — Sub-stepping Solver

**Effort: XL | Impact: stability | Risk: high**

Box2D v3's "Soft Step" solver approach: soft constraints + sub-stepping for better stability:

- Handles higher mass ratios without jitter
- More stable long body chains and stacks
- Better convergence for complex constraint networks
- Major architectural change — requires careful testing and benchmarking
- Long-term goal, depends on P46 (hot-path optimization) as prerequisite

---

## Completed Features (Reference)

### P37 — Serialization API

**Entry point:** `import { spaceToJSON, spaceFromJSON } from '@newkrok/nape-js/serialization'`

Serializes: Space config, all bodies (position, velocity, shapes, userData), all shapes
(circle/polygon, material, filters, fluid), all constraints except UserConstraint.
Not serialized: Arbiters (rebuilt), UserConstraint, broadphase tree state, isSleeping.

### P38 — Debug Draw API

Abstract debug-rendering interface (Box2D `b2Draw` pattern). Engine traverses internal
state and calls user-provided draw callbacks — no concrete renderer in core bundle.

Classes: `DebugDraw` (abstract), `DebugDrawFlags` bitmask, `Space.debugDraw(drawer, flags)`.

Reference implementations (in docs/examples): CanvasDebugDraw, ThreeDebugDraw,
PixiDebugDraw (highest priority — PixiJS is #1 2D renderer), P5DebugDraw.

---

## Cancelled: P34 — Granular Tree Shaking

**Decision (2026-03-10): Not worth pursuing.** Tree shaking is architecturally limited
because `bootstrap.ts` imports every class unconditionally. Competing engines behave the
same way. See `docs/guides/architecture.md` for details.

---

## Known Bug: P53 — Polygon-Polygon Narrowphase Collision Failure

**Discovered (2026-03-13):** When multiple `Polygon` dynamic bodies coexist in the same space
(even without touching), their floor collision detection fails — bodies tunnel through static
`Polygon` floors. Circle-Polygon collisions work correctly; only Polygon-Polygon is affected.

**Reproduction:**
- Create a space with 4 static walls + at least 2 dynamic `Polygon.box(...)` bodies
- The Polygon bodies fall through the static Polygon floor despite `isBullet = true`
- Single Polygon in isolation works fine; second Polygon body triggers the bug

**Root cause:** Likely a narrowphase SAT solver issue when multiple Polygon-Polygon pairs are
registered simultaneously in the broadphase/narrowphase pipeline.

**Workaround (demos):** Use `Circle` physics shapes for objects that need to settle on floors,
or use `Polygon` bodies only in joint-constrained (non-free-falling) scenarios.

**Scope:** Does NOT affect Circle-Polygon, Circle-Circle, or Capsule-Polygon collisions.
