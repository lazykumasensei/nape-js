# nape-js — Roadmap

## Completed Items

Done: P21-P28, P30-P33, P35, P37-P43, P44, P45-P48, P50-P55, P57, P63, P64, P66-P68.
Cancelled: P34 (tree shaking — architectural limit), P36 (server demos — superseded by P52), P49 (ECS adapter — trivial pattern).

### P44 — PixiJS integration (`@newkrok/nape-pixi` 0.1.0)

Shipped as a sibling workspace package. Published to npm on first master
merge via the independent per-package auto-release pipeline
(`scripts/ci/release.mjs`).

- `BodySpriteBinding` — body → PIXI display sync, body-local offsets, auto-cleanup on space removal, sub-step interpolation via `FixedStepper`.
- `FixedStepper` — fixed-timestep driver, spiral-of-death cap, before/after hooks, `alpha ∈ [0, 1)` for render interpolation.
- `PixiDebugDraw` — on-demand shape + constraint overlay. Per-body Graphics cache with togglable layers. Zero `pixi.js` build coupling (structural `GraphicsLike` / `ContainerLike` with user-injected PIXI factory).
- `WorkerBridge` + transform protocol — off-thread physics helper. `SharedArrayBuffer` when available, `postMessage` fallback otherwise. Doesn't prescribe the worker script — provides the wire format + the main-thread glue.
- 71 tests, ~10 KB minified ESM, 17 KB d.ts, PIXI v8 peer-dep.

---

## Active Priorities

| #   | Priority                         | Effort | Impact   | Status                                                         |
| --- | -------------------------------- | ------ | -------- | -------------------------------------------------------------- |
| P29 | Test coverage >= 80%             | L      | safety   | :diamonds: ~55% (4895 tests)                                   |
| P56 | Interactive playground           | S-M    | adoption | :white_square_button: Not started                              |

---

## New Priorities

### Ecosystem & Integrations

| #   | Priority                     | Effort | Impact          | Why                                                                                                                                                   |
| --- | ---------------------------- | ------ | --------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| P58 | **Phaser plugin/adapter**    | M      | :fire: adoption | Phaser is the #1 JS game framework — direct integration = massive reach. Phaser Box2D exists but lacks fluid sim, character controller, serialization |
| P59 | **React/R3F integration**    | M      | :fire: adoption | `@react-three/rapier`-style package for the React gamedev community. Growing market segment                                                           |
| P60 | **Tilemap collision helper** | S      | DX              | Tiled/LDtk map -> physics body conversion. Common gamedev need, low effort, high utility                                                              |

### Developer Experience & Onboarding

| #   | Priority                            | Effort | Impact          | Why                                                                                                                                                                                                                                                  |
| --- | ----------------------------------- | ------ | --------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| P65 | **One-click game templates**        | M      | :fire: adoption | `npm create nape-game@latest` or StackBlitz templates: platformer starter (CharacterController + tilemap + camera), top-down car, ragdoll fighter, pinball. A running first game in 5 minutes = the most important onboarding element                 |

### Physics Features

| #   | Priority                        | Effort | Impact            | Why                                                                                                                                                                                                                                               |
| --- | ------------------------------- | ------ | ----------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| P62 | **Particle system**             | S-M    | features          | Physics-aware particle emitter — a frequently requested feature by gamedevs                                                                                                                                                                       |

### Tooling & Infrastructure

| #   | Priority                                 | Effort | Impact          | Why                                                                                                                                                                                                                              |
| --- | ---------------------------------------- | ------ | --------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| P61 | **Bundle size reduction**                | S-M    | competitiveness | Close the 87 KB vs Phaser Box2D 65 KB gap. Dead code audit, hot path optimization                                                                                                                                                |
| P69 | **Deterministic replay system**          | M      | features        | Input recording + playback on top of existing serialization + deterministic mode. Debug bug reproduction, multiplayer rollback foundation, shareable replays, deterministic regression tests — one feature that connects many others |

---

## Recommended Execution Order

### Phase 1 — Finish what's started + onboarding (next)

1. ~~**P44 Phase 2** — Ship `@newkrok/nape-pixi` npm package~~ ✅ done (0.1.0)
2. **P56** — Interactive playground (StackBlitz/CodeSandbox template, editable examples)

### Phase 2 — Wow-factor + ecosystem

3. **P58** — Phaser plugin/adapter (biggest community reach opportunity)
4. **P65** — One-click game templates (first game in 5 minutes)

### Phase 3 — Ecosystem expand

5. **P60** — Tilemap collision helper (low effort, high gamedev utility)
6. **P59** — React/R3F integration (growing market)

### Phase 4 — Polish & tooling

7. **P62** — Particle system
8. **P69** — Deterministic replay system
9. **P61** — Bundle size reduction
10. **P29** — Continue test coverage push toward 80%
