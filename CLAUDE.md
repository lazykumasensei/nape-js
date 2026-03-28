# nape-js

A fully typed TypeScript 2D physics engine — modernized rewrite of the original
[nape](https://napephys.com/) Haxe engine.

## Key Features

- **Pure TypeScript**, `strict: true`, zero DOM dependencies (runs on Node.js + browser)
- **Rigid body dynamics** — circles, convex polygons, compounds, static/dynamic/kinematic bodies
- **Constraint system** — PivotJoint, DistanceJoint, AngleJoint, MotorJoint, LineJoint, PulleyJoint, WeldJoint, UserConstraint
- **Collision detection** — broadphase (sweep-and-prune / dynamic AABB tree / spatial hash grid), narrowphase, CCD, raycasting, convex sweep
- **Callback system** — body/interaction/constraint listeners, pre-collision callbacks
- **Fluid simulation** — buoyancy and drag via fluid-enabled shapes (unique among JS engines)
- **Serialization** — JSON (`spaceToJSON` / `spaceFromJSON`) + binary (`spaceToBinary` / `spaceFromBinary`) for save/load/multiplayer rollback
- **Debug draw** — abstract `DebugDraw` interface (Box2D pattern), reference impls for Canvas/Three.js/PixiJS/p5.js
- **Character controller** — geometric collide-and-slide (`CharacterController` class), ground/slope/step/one-way/moving platform support
- **~87 KB** minified ESM bundle (~16 KB gzip), TSDoc documented, 4666 tests

## Build & Test

```bash
npm run build        # tsup → dist/
npm test             # vitest
npm run lint         # eslint + prettier
```

## Pre-push Checklist

**Before every `git push`, always run all four:**

1. `npm run format:check` — must pass (Prettier code style)
2. `npm run lint` — must pass (catches unused vars, ESLint rules)
3. `npm test` — all tests must pass
4. `npm run build` — DTS generation must succeed (catches type errors vitest misses)

**Documentation to review** — when the PR changes features, APIs, priorities, or versions:

| File | What to update | When |
| ---- | -------------- | ---- |
| `CLAUDE.md` | Status table, test count, key features list | Priority status changes, new features |
| `docs/guides/roadmap.md` | Priority table, detailed descriptions, competitive analysis | New/changed/completed priorities |
| `docs/guides/architecture.md` | Internal patterns, registration flow, `any` rules | Architecture or bootstrap changes |
| `docs/guides/multiplayer-guide.md` | Multiplayer patterns, server setup, protocol, prediction | Multiplayer architecture changes |
| `README.md` | Quick start, API tables, test count, badge versions | Public API changes, releases |
| `llms.txt` | Class list, links, quick start example | Public API additions/removals |
| `llms-full.txt` | Complete API reference, version number (line 1) | Any public API change, releases |
| `package.json` | `version` field | Releases |

## Architecture

```
Public API wrappers (src/{phys,shape,constraint,callbacks,dynamics,geom,space}/)
        ↕
Internal ZPP_* classes (src/native/)  — 85 classes
        ↕
Engine bootstrap (src/core/engine.ts → ZPPRegistry.ts + bootstrap.ts)
```

For detailed internal patterns (registration flow, factory callbacks, `any` rules,
iterator patterns, ESM constraints) see `docs/guides/architecture.md`.

## Current Status

Completed: P21–P43, P45, P46, P47, P48, P50, P51, P52, P53, P54, P55. Cancelled: P34, P36, P49.

| What                     | Status |
| ------------------------ | ------ |
| Test coverage            | 🔶 ~60% statements (4666 tests), target ≥80% — P29 |
| PixiJS integration       | 🔶 Phase 1 done (CodePen demos + Sprite adapter); npm package pending — P44 |
| Character controller     | ✅ Done — P45 (`CharacterController` class, camera system, platformer demo) |
| CJS bundle dedup         | ✅ Done — P47 (splitting + treeshake, serialization CJS 920→22 KB) |
| Sub-stepping solver      | ✅ Done — P51 (`space.subSteps`, tunneling demo) |
| Performance benchmark    | ✅ Done — P54 (nape-js vs Matter.js vs Planck.js vs Rapier) |
| npm/SEO optimization     | ✅ Done — P55 (keywords, meta tags, JSON-LD, social card) |
| Interactive playground   | ⬜ Planned — P56 (StackBlitz/CodeSandbox template) |
| Polygon+Material bug     | ⬜ Open — P57 (dynamic Polygon + explicit Material tunnels through floors) |

Full roadmap with details, competitor analysis, and history: `docs/guides/roadmap.md`
