# nape-js — Roadmap

## Competitive Advantages

nape-js already leads in several areas vs Matter.js, Planck.js, and other pure-JS engines:

- **CCD** (continuous collision detection) — Matter.js lacks this entirely (#1 user complaint)
- **Fluid simulation** — buoyancy/drag unique among JS engines (only LiquidFun via WASM compares)
- **Per-interaction-type filtering** — separate group/mask for collision, sensor, fluid (more granular than Box2D)
- **Pixel-based units** — no meters-to-pixels conversion needed (Box2D pain point)
- **Full TypeScript** with `strict: true` — Matter.js relies on DefinitelyTyped
- **Serialization API** — save/load/replay/multiplayer sync
- **Debug draw API** — abstract interface, no renderer dependency in core
- **Character controller** — geometric collide-and-slide with slope/step/one-way/moving platform support
- **Sub-stepping solver** — configurable `space.subSteps` for improved stability

Key competitors to watch:
- **Phaser Box2D** (Dec 2024) — Box2D v3 port, 65KB, improved solver+CCD, speculative collision
- **Rapier** — WASM+SIMD, cross-platform determinism, binary snapshots, 2-5x faster for large scenes, but large bundle + async init
- **Matter.js** — largest community (14-16k stars) but no CCD, no TypeScript, 2+ years inactive
- **Planck.js** — Box2D v2 port, 4.8k stars, 577 npm/week, no CCD, no fluid sim
- **p2-es** — modernized p2.js fork (poimandres), ESM+TS, small community (440 npm/week)

### Competitor Feature Matrix

| Feature | nape-js | Matter.js | Planck.js | p2-es | Rapier | Phaser Box2D |
|---------|---------|-----------|-----------|-------|--------|--------------|
| **CCD** | :white_check_mark: | :x: | :x: | :x: | :white_check_mark: | :white_check_mark: |
| **Fluid Sim** | :white_check_mark: Unique | :x: | :x: | :x: | :x: | :x: |
| **Full TypeScript** | :white_check_mark: strict | :warning: DT | :x: JS | :white_check_mark: fork | :warning: WASM | :white_check_mark: |
| **Serialization** | :white_check_mark: JSON+Binary | :x: | :x: | :x: | :white_check_mark: Binary | :x: |
| **Character Controller** | :white_check_mark: | :x: | :x: | :x: | :white_check_mark: | :x: |
| **Sub-stepping** | :white_check_mark: | :x: | :x: | :x: | :white_check_mark: | :x: |
| **Web Worker Helper** | :white_check_mark: | :x: | :x: | :x: | :x: | :x: |
| **Deterministic** | :diamonds: Soft | :x: | :white_check_mark: Fixed dt | :white_check_mark: | :white_check_mark: Cross-platform | :x: |
| **Bundle Size** | 87 KB / 16 KB gz | Large | Medium | Medium | 78 KB WASM | 65 KB |
| **Debug Draw API** | :white_check_mark: Abstract | :x: Built-in | :x: | :x: | :x: | :x: |
| **Capsule Shape** | :white_check_mark: | :x: | :x: | :white_check_mark: | :white_check_mark: | :x: |
| **Concave Helper** | :white_check_mark: | :x: | :x: | :x: | :x: | :x: |
| **Community** | Growing | 14-16k :star: | 4.8k :star: | Small | Medium | Growing |
| **Active Dev** | :white_check_mark: | :x: 2+ yrs | :white_check_mark: | :white_check_mark: fork | :white_check_mark: | :white_check_mark: |

### Competitive Gaps

1. **Cross-platform determinism** — Rapier has bit-level IEEE 754 determinism; ours is "soft" (same-platform). True cross-platform is impractical in pure JS.
2. **Raw performance** — Rapier WASM+SIMD is 2-5x faster for large scenes (1000+ bodies). Hot-path optimization helps but cannot match WASM.
3. **Bundle size gap** — Phaser Box2D is 65 KB vs our 87 KB (small gap, but notable).
4. **Community size** — Matter.js has 14-16k stars despite being stale. We need marketing/visibility.

---

## Completed Items

Done: P21-P28, P30-P33, P35, P37-P43, P45-P48, P50-P55, P57.
Cancelled: P34 (tree shaking — architectural limit), P36 (server demos — superseded by P52), P49 (ECS adapter — trivial pattern).

---

## Active Priorities

| # | Priority | Effort | Impact | Status |
|---|----------|--------|--------|--------|
| P29 | Test coverage >= 80% | L | safety | :diamonds: ~57% (4873 tests) |
| P44 | PixiJS integration — npm package | M | adoption | :diamonds: Phase 1 done (demos), Phase 2 pending (npm package) |
| P56 | Interactive playground | S-M | adoption | :white_square_button: Not started |

---

## New Priorities

| # | Priority | Effort | Impact | Why |
|---|----------|--------|--------|-----|
| P58 | **Phaser plugin/adapter** | M | :fire: adoption | Phaser is the #1 JS game framework — direct integration = massive reach. Phaser Box2D exists but lacks fluid sim, character controller, serialization |
| P59 | **React/R3F integration** | M | :fire: adoption | `@react-three/rapier`-style package for the React gamedev community. Growing market segment |
| P60 | **Tilemap collision helper** | S | DX | Tiled/LDtk map -> physics body conversion. Common gamedev need, low effort, high utility |
| P61 | **Bundle size reduction** | S-M | competitiveness | Close the gap with Phaser Box2D (65 KB). Audit for dead code, optimize hot paths |
| P62 | **Particle system** | S-M | features | Simple physics-aware particle emitter — commonly requested by gamedevs |

---

## Recommended Execution Order

### Phase 1 — Finish what's started (next)

1. **P44 Phase 2** — Ship `@newkrok/nape-pixi` npm package (auto-sync transforms, typed API, TSDoc)
2. **P56** — Interactive playground (StackBlitz/CodeSandbox template, editable examples)

### Phase 2 — Ecosystem growth

3. **P58** — Phaser plugin/adapter (biggest community reach opportunity)
4. **P60** — Tilemap collision helper (low effort, high gamedev utility)
5. **P59** — React/R3F integration (growing market)

### Phase 3 — Polish & features

6. **P61** — Bundle size reduction
7. **P62** — Particle system
8. **P29** — Continue test coverage push toward 80%

### Ongoing — Marketing & Visibility

| Platform | Strategy | Priority |
|----------|----------|----------|
| **Hacker News** (Show HN) | Benchmark post: "nape-js vs Matter.js — CCD + Fluid sim in 87KB" | :fire: Very high |
| **Reddit** r/gamedev + r/javascript | Fluid simulation demo GIF/video | :fire: Very high |
| **dev.to / Medium** | "Why I rewrote a Haxe physics engine in TypeScript" | High |
| **Twitter/X #gamedev** | Short videos: fluid sim, CCD demo, multiplayer | High |
| **Phaser community forum** | Announce Phaser plugin once P58 ships | High |
| **awesome-* GitHub lists** | PRs to awesome-gamedev, awesome-typescript | :star: Easy win |
| **YouTube tutorial** | "Build a platformer with nape-js in 10 minutes" | Medium-high |
| **Gamedev jams** (Ludum Dare, js13k) | Recommend to jam participants | Medium |

---

## API Gotchas (from P29 testing)

Discovered during integration testing — should be documented in user-facing guides:

1. **No `applyForce()` on Body** — only `applyImpulse()` and `applyAngularImpulse()` exist
2. **Compound body lifecycle** — only root `compound.space` can be assigned, not individual body `space`
3. **ConstraintListener requires custom CbType** — `CbType.ANY_CONSTRAINT` does not work for BREAK/SLEEP events
4. **CCD is per-body, not per-space** — use `body.isBullet` and `body.disableCCD`
5. **Material constructor order** — `Material(elasticity, dynamicFriction, staticFriction, density, rollingFriction)`
6. **Raycasting requires a step** — `space.rayCast()` on static bodies may need at least one `space.step()` first
