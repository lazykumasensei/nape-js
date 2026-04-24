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
- **Serialization** — JSON + binary for save/load/multiplayer rollback
- **Debug draw** — abstract `DebugDraw` interface, reference impls for Canvas/Three.js/PixiJS/p5.js
- **Character controller** — geometric collide-and-slide (`CharacterController` class)
- **~87 KB** minified ESM bundle (~16 KB gzip), TSDoc documented, 5275 tests

## Repo Layout (npm workspaces)

```
packages/
  nape-js/        # @newkrok/nape-js — published physics engine (src/, tests/, dist/)
  nape-pixi/      # @newkrok/nape-pixi — PixiJS v8 integration (scaffolded, Phase 1+)
benchmarks/       # cross-package perf suite
docs/             # GitHub Pages site + demos
scripts/          # repo-wide tooling
```

Root `package.json` is a private workspaces manifest; published package lives at
`packages/nape-js/package.json`. Root scripts (`npm run build`, `npm test`, …)
delegate into the nape-js workspace.

## Build & Test

```bash
npm run build        # tsup → packages/nape-js/dist/
npm test             # vitest (runs in packages/nape-js/)
npm run lint         # eslint + prettier
```

## Pre-push Checklist

**Before every `git push`, always run all four:**

1. `npm run format:check` — must pass (Prettier code style)
2. `npm run lint` — must pass (catches unused vars, ESLint rules)
3. `npm test` — all tests must pass
4. `npm run build` — DTS generation must succeed (catches type errors vitest misses)

## Architecture

```
Public API wrappers (packages/nape-js/src/{phys,shape,constraint,callbacks,dynamics,geom,space}/)
        ↕
Internal ZPP_* classes (packages/nape-js/src/native/)  — 85 classes
        ↕
Engine bootstrap (packages/nape-js/src/core/engine.ts → ZPPRegistry.ts + bootstrap.ts)
```

## Detailed Guides

| Guide | Path | Content |
|-------|------|---------|
| Architecture | `docs/guides/architecture.md` | Internal patterns, registration flow, factory callbacks, `any` rules, ESM constraints |
| Roadmap | `ROADMAP.md` | Priority table, status, competitive analysis, feature details |
| Testing | `docs/guides/testing.md` | Vitest config, test patterns, coverage metrics, best practices |
| Workflow | `docs/guides/workflow.md` | Build system, CI/CD, linting, commit conventions, doc update matrix, all scripts |
| Multiplayer | `docs/guides/multiplayer-guide.md` | Server-authoritative architecture, binary protocol, prediction, deployment |
