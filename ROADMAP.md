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

Done: P21–P28, P30–P33, P35, P37–P43, P46, P48, P50, P52, P53, P57.
Cancelled: P34 (tree shaking — architectural limit), P36 (server demos — superseded by P52), P49 (ECS adapter — trivial pattern).

### Active & Planned

| Priority                                  | Effort | Impact    | Risk   | Status         |
| ----------------------------------------- | ------ | --------- | ------ | -------------- |
| P29 — Test coverage ≥80%                  | L      | safety    | none   | 🔶 ~57% (4873 tests) |
| P44 — PixiJS integration package          | M      | adoption  | low    | 🔶 Phase 1 done |
| P45 — Character controller                | M      | DX        | medium | ✅ Done |
| P47 — CJS bundle dedup (serialization)    | S      | bundle    | low    | ✅ Done |
| P51 — Sub-stepping solver                 | M      | stability | low    | ✅ Done |
| P54 — Performance benchmark page          | S      | adoption  | low    | ✅ Done |
| P55 — npm/SEO optimization                | XS     | adoption  | low    | ✅ Done |
| P56 — Interactive playground              | S-M    | adoption  | low    | ⬜ Not started |
| P57 — Polygon + Material tunneling bug    | M      | stability | medium | ✅ Done |

---

## In Progress: P29 — Test Coverage

**Effort: L | Impact: safety | Risk: none | Status: 🔶 ~57% (4873 tests)**

### Integration Test Batch 1 (100 tests) — 2026-03-30

Added 7 integration test files in `tests/integration/`:

| File | Tests | Coverage Area |
|------|-------|---------------|
| `BodyLifecycle.integration.test.ts` | 24 | Add/remove bodies, type transitions (DYNAMIC↔STATIC↔KINEMATIC), compound lifecycle, mass/material, impulse, angular velocity, isBullet |
| `FluidBuoyancy.integration.test.ts` | 10 | Buoyancy, viscosity effects, multiple fluid regions, fluid callbacks, constraints in fluid |
| `CCD.integration.test.ts` | 12 | isBullet property, tunneling prevention, different shape types, multiple bullets, disableCCD |
| `CallbackSystem.integration.test.ts` | 13 | BEGIN/END/ONGOING interaction lifecycle, BodyListener (WAKE/SLEEP), PreListener (IGNORE/ACCEPT), ConstraintListener (BREAK/SLEEP) |
| `ShapeInteractions.integration.test.ts` | 16 | Circle/box/capsule collisions, friction/elasticity materials, InteractionFilter groups, multi-shape bodies |
| `Serialization.integration.test.ts` | 17 | JSON & binary round-trip, simulation continuity after deserialize, constraints/gravity/velocity preservation, fluid properties |
| `Raycasting.integration.test.ts` | 8 | Multi-body raycast, direction filtering, maxDistance, different shape types, post-simulation raycast |

#### API Findings & Gotchas Discovered

These findings should be documented in user-facing guides to prevent common mistakes:

1. **No `applyForce()` on Body** — only `applyImpulse()` and `applyAngularImpulse()` exist. Force-based API is a common expectation from other engines (Matter.js, Box2D).
2. **Compound body lifecycle** — bodies in a compound cannot have their `space` set individually; only the root `compound.space` can be assigned. Setting `body.space` on a compound member throws.
3. **ConstraintListener requires custom CbType** — using `CbType.ANY_CONSTRAINT` does not work for BREAK/SLEEP events. A dedicated `CbType` must be created and added to the joint's `cbTypes`.
4. **CCD is per-body, not per-space** — there is no `space.disableCCD`; use `body.isBullet` and `body.disableCCD` instead.
5. **Material constructor order** — `Material(elasticity, dynamicFriction, staticFriction, density, rollingFriction)` — elasticity is first, not friction (differs from some engines).
6. **Raycasting requires a step** — `space.rayCast()` on static bodies may require at least one `space.step()` call first for the broadphase to register shapes.

#### Remaining Coverage Gaps (for future batches)

- Character controller integration (platformer scenarios, slopes, one-way platforms)
- Convex sweep / convexCast advanced scenarios
- Debug draw integration with full simulation
- Concave body creation + simulation
- InteractionGroup hierarchy testing
- Large-scene stress tests (100+ bodies)

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

## Done: P45 — Character Controller

**Effort: M | Impact: DX | Risk: medium**

### Overview

Two-layer geometric character controller inspired by Rapier's `KinematicCharacterController`
and Box2D v3.1's character mover toolkit. Unlike dynamic-body approaches (force/impulse driven),
a geometric controller uses shape-casting ("collide-and-slide") for pixel-perfect, single-frame
movement resolution — the same approach used by Celeste, Hollow Knight, and most acclaimed
2D platformers.

**What sets nape-js apart from competitors:**

| Feature | Rapier 2D | Box2D v3.1 | Matter/Planck | nape-js P45 |
|---------|-----------|------------|---------------|-------------|
| Abstraction level | High-level only | Low-level only | None | Both layers |
| Moving platforms | Broken (open issue) | Manual | N/A | Built-in via surfaceVel |
| One-way platforms | Manual filter | Manual filter | N/A | Built-in PreListener |
| Fluid/swim mode | No | No | No | Built-in (buoyancy) |
| TypeScript native | WASM bindings | C bindings | JS | Pure strict TS |
| Serializable | No | No | No | Yes (JSON + binary) |

### Architecture: Two-Layer API

**High-level — `CharacterController` class** (batteries-included):

```typescript
const cc = new CharacterController(space, body, {
  maxSlopeAngle: Math.PI / 4,  // 45° climbable
  stepHeight: 8,                // auto-step small ledges
  skinWidth: 0.5,               // numerical stability margin
  snapToGround: 4,              // stick to ground on slopes
  oneWayPlatformTag: platformCbType, // auto-setup PreListener
  trackMovingPlatforms: true,   // inherit kinematic velocity
});

// Game loop:
const result = cc.move(desiredDelta); // Vec2
result.grounded;          // boolean
result.groundNormal;      // Vec2 | null
result.groundBody;        // Body | null
result.onMovingPlatform;  // boolean
result.slopeAngle;        // radians
result.wallLeft;          // boolean
result.wallRight;         // boolean
result.numCollisions;     // number
result.getCollision(i);   // { normal, point, body, shape }
```

**Low-level — exported utilities** (advanced / custom controllers):

```typescript
import { castShape, solvePlanes, clipVelocity } from 'nape-js';

const hit = space.castShape(shape, translation, filter);
const planes = space.collideMover(capsule, filter);
const solved = solvePlanes(position, planes);
const clipped = clipVelocity(velocity, planes);
```

### Features

| Feature | Description |
|---------|-------------|
| Ground detection | Downward shape cast + normal angle check → `grounded`, `groundNormal`, `groundBody` |
| Slope handling | `maxSlopeAngle` threshold — steeper slopes block movement; gentle slopes walk normally |
| Step climbing | Up → forward → down cast sequence, bounded by `stepHeight` |
| One-way platforms | Auto-configured PreListener — accept collision only when normal points up |
| Moving platforms | Track kinematic body velocity; character inherits platform motion when grounded on it |
| Snap to ground | Pre-step downward cast — prevents bouncing on slopes and stair edges |
| Wall detection | Lateral shape casts → `wallLeft` / `wallRight` booleans + `wallNormal` |
| Fluid/swim mode | Detect buoyancy shapes — reduce gravity, apply drag, enable swim movement |
| Coyote time helper | `timeSinceGrounded` counter — game layer decides the window |
| Collide-and-slide | Core algorithm: shape cast → slide along surface → repeat (max 3 iterations) |

### Demo: Interactive Platformer Showcase

Wide scrolling level (~3000×600 px) demonstrating every feature, with keyboard controls
(WASD/arrows + Space). Requires a **camera system** in the demo framework (see below).

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│  ★ Coins                Moving Platform →                                       │
│                          ═══════                    ┌──┐                        │
│         ┌──┐                                  steps │  │                        │
│  ───    │  │ step                              ─────┘  └───                     │
│  ─────  └──┘        /                                        ≈≈≈≈≈≈≈≈          │
│                    / slope        ═══════                    ≈ water ≈          │
│  ─ ─ ─ ─ ─       /                                          ≈≈≈≈≈≈≈≈          │
│  one-way      ═══════                                                           │
│                                                                                 │
│  ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓ │
└─────────────────────────────────────────────────────────────────────────────────┘
```

### Demo Framework: Camera System

New opt-in camera for demos whose physics world exceeds the 900×500 canvas viewport:

- **`demo.camera`** config — `{ follow: bodyRef, offset, bounds, lerp, deadzone }`
- Camera state stored per-demo, managed by DemoRunner
- `Canvas2DAdapter` applies `ctx.translate(-camX, -camY)` before rendering
- `drawGrid()` extended to tile infinitely within viewport
- Pointer events inverse-transformed from screen → world coords
- Other demos unaffected (no camera = identity transform)
- Reusable by future demos (e.g. large constraint scenes, vehicle levels)

### Implementation Order

1. Camera system in demo framework (DemoRunner + Canvas2DAdapter + renderer)
2. `CharacterController` core — collide-and-slide, `move()`, ground detection
3. Slope handling + step climbing
4. One-way platforms (PreListener auto-setup)
5. Moving platform tracking
6. Snap to ground + wall detection
7. Fluid/swim mode integration
8. Coyote time / helper properties
9. Interactive platformer demo (wide level, keyboard controls)
10. Unit + integration tests
11. Docs update (API reference, guide, `CLAUDE.md`, README)

### Competitive Analysis

- **Rapier 2D**: High-level `KinematicCharacterController` with config. Known issues: moving
  platforms broken (GitHub #488), slope angle settings were non-functional for months. Generic
  design disclaimer: "may not work perfectly out-of-the-box for all game types."
- **Box2D v3.1**: Low-level toolkit (`b2World_CastMover` + `b2SolvePlanes`). Capsule only.
  Labeled "experimental." No built-in ground/slope/step helpers.
- **Matter.js / Planck.js**: No character controller at all — developers build from scratch.
- **Celeste / Hollow Knight**: Custom pixel-by-pixel systems with no physics engine for character
  movement. Validates the geometric approach over dynamic bodies.

---

## Done: P47 — CJS Bundle Dedup

**Effort: S | Impact: bundle size | Risk: low**

The serialization CJS bundle duplicated the entire engine (920 KB). Fixed by adding
`splitting`, `treeshake`, and `target: "es2020"` to tsup config. CJS now code-splits
into shared chunks — `serialization/index.cjs` dropped from 920 KB to 22 KB,
`index.cjs` from 1006 KB to 103 KB.

---

## Done: P51 — Sub-stepping Solver

**Effort: M | Impact: stability | Risk: low**

Added `space.subSteps` property (default: 1). When set to N > 1, each `step(dt)` call
internally runs N sub-steps with `dt/N`, improving simulation stability for fast objects,
stacking, and stiff constraints at the cost of proportionally more CPU time.

**API:** `space.subSteps = 4` — good balance for most games. `1` = zero overhead (default).

**Implementation:** The core physics pipeline (broadphase → narrowphase → prestep →
velocity solve → position update → CCD → position solve → sleep management) runs N times
per `step()` call, while outer bookkeeping (midstep flag, stamp, callbacks) runs once.

**Tests:** 17 tests covering property validation, backward compatibility, tunneling
prevention, stacking stability, joint stiffness, energy conservation, deterministic mode
combo, and runtime changes.

**Demo:** `docs/demos/sub-stepping.js` — fires bullets at a thin wall, left side
(`subSteps=1`) shows tunneling, right side (`subSteps=4`) catches all bullets.

---

## Done: P54 — Performance Benchmark Page

**Effort: S | Impact: adoption | Risk: low | Status: ✅ Done**

Public comparison page at `docs/benchmark.html` — nape-js vs Matter.js vs Planck.js vs Rapier (WASM):

- **6 scenarios:** Falling Bodies (250/500/1000), Pyramid Stack, Constraint Chain, Mixed Shapes
- **Visual preview:** live Canvas2D rendering during benchmark for each engine
- **Fair methodology:** deterministic seeded layouts, warmup phase, median-based timing
- **Feature matrix:** CCD, fluid sim, TypeScript, serialization, bundle size comparison
- **Engine toggles:** enable/disable individual engines, run single or all scenarios
- Links from index.html hero, demo tabs, and examples.html banner
- Rapier (WASM) included with explicit note about JS vs WASM performance difference

---

## Completed: P55 — npm/SEO Optimization

**Effort: XS | Impact: adoption | Risk: low | Status: ✅ Done**

Improved discoverability on npm and search engines:

- ✅ Expanded package.json `keywords` from 7 to 20 (game-physics, fluid-simulation, multiplayer, etc.)
- ✅ Optimized package.json `description` with high-value search terms
- ✅ Set `homepage` to docs site (newkrok.github.io/nape-js)
- ✅ README badges (npm version, downloads, CI, bundle size, license, docs)
- ✅ Prominent docs/demos/API links in README header
- ✅ JSON-LD structured data (SoftwareSourceCode schema) on landing page
- ✅ Open Graph / Twitter Card with `summary_large_image` and social card
- ✅ `theme-color` meta tag on all pages
- ✅ Consistent meta descriptions across npm, GitHub, and docs site
- ✅ Sitemap `lastmod` dates added
- ✅ Version cache-buster strings synced to 3.16.1 across all HTML pages

---

## Planned: P56 — Interactive Playground

**Effort: S-M | Impact: adoption | Risk: low**

Browser-based sandbox for instant try-out without local setup:

- StackBlitz or CodeSandbox template with pre-configured nape-js
- Editable examples: falling shapes, constraints, fluid sim, CCD
- Link from README and docs landing page

---

## Done: P57 — Polygon + Material Tunneling

**Effort: M | Impact: stability | Risk: medium | Status: ✅ Done**

Dynamic `Polygon` shapes with an explicit `Material` parameter tunneled through static `Polygon` floors (fall through without collision). Discovered 2026-03-28 during multiplayer platformer development. Fixed 2026-03-30.

**Root cause:** The `Polygon` constructor signature was `(localVerts, material?, filter?)` while `Circle` was `(radius, localCOM?, material?, filter?)` and `Capsule` was `(width, height, localCOM?, material?, filter?)`. Users naturally wrote `new Polygon(verts, undefined, material)` following the Circle/Capsule pattern, but this silently passed `Material` into the `filter` parameter slot, breaking collision detection.

**Fix:** Added `localCOM` parameter to `Polygon` constructor with smart overload detection. The 2nd parameter now accepts `Vec2 | Material` — if `Material` is detected, parameters shift automatically. `InteractionFilter` in the 3rd position is also detected for full backward compatibility.

**Supported call patterns (all work correctly):**
```js
new Polygon(verts)                              // no material
new Polygon(verts, material)                    // legacy — still works
new Polygon(verts, undefined, material)         // P57 pattern — now works
new Polygon(verts, localCOM, material, filter)  // new consistent API
new Polygon(verts, undefined, filter)           // legacy — still works
new Polygon(verts, material, filter)            // legacy — still works
```

**Tests:** 107 new tests covering: P57 regression (23), Shape × Material collision matrix (52), Material assignment timing (13), ZPP_Polygon native layer (19).
