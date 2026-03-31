# nape-js — Development Workflow

## Pre-push Checklist

**Before every `git push`, always run all four:**

```bash
npm run format:check   # Prettier code style
npm run lint           # ESLint (unused vars, rules)
npm test               # all tests must pass
npm run build          # DTS generation (catches type errors vitest misses)
```

CI runs the same checks — a local failure will also fail on GitHub.

---

## Agent Orchestration

Claude acts as an **orchestrator** — delegates work to sub-agents to keep the main context clean.

| Task type | Delegate? | How |
|-----------|-----------|-----|
| Exploring codebase / finding files | Yes | `Explore` agent |
| Implementing a feature or fix | Yes | `general-purpose` agent (with clear spec) |
| Writing / updating tests | Yes | `general-purpose` agent |
| Code review | Yes | `general-purpose` agent (review prompt) |
| Simple file edits (< 3 files) | No | Do inline |
| Running commands (lint/test/build) | No | Do inline |
| Doc updates | No | Do inline |

**Sub-agent prompts must include:**
- Clear task description with acceptance criteria
- Relevant file paths to focus on
- Constraints (e.g., "don't modify the public API", "follow existing patterns")
- What NOT to do (e.g., "don't update docs, I'll handle that")

### Step-by-Step

1. **Understand** — Read the issue, identify affected files, read relevant source
2. **Implement** — Delegate to sub-agent(s), parallelize where possible
3. **Verify** — Run lint/test/build in main session
4. **Review** — Launch review agent checking: code quality, type safety, test coverage, performance, security
5. **Commit** — Conventional message + `Co-Authored-By: Claude <noreply@anthropic.com>`
6. **Docs** — Update per Documentation Update Matrix below
7. **Push** — Verify CI passes

### Workflow Checklist

```
[ ] Read and understand the task
[ ] Read relevant source code
[ ] Delegate implementation to sub-agent(s)
[ ] Delegate test writing to sub-agent (or same agent)
[ ] Run: npm run format:check ✓
[ ] Run: npm run lint ✓
[ ] Run: npm test ✓
[ ] Run: npm run build ✓
[ ] Launch review agent → address feedback
[ ] Commit with conventional message
[ ] Update docs (CLAUDE.md, README, ROADMAP.md, llms.txt/llms-full.txt)
[ ] Push and verify CI
```

---

## Build System

**Bundler:** tsup (ESM + CJS, minified, sourcemaps)

| Entry | Output |
|-------|--------|
| `src/index.ts` | `dist/index.js` / `dist/index.cjs` |
| `src/serialization/index.ts` | `dist/serialization/index.js` / `.cjs` |
| `src/worker/index.ts` | `dist/worker/index.js` / `.cjs` |

- **Target:** ES2020
- **Splitting + treeshake** enabled (P47 — CJS dedup)
- **`__PACKAGE_VERSION__`** injected at build time
- **Result:** ~87 KB minified ESM, ~16 KB gzip

---

## Linting & Formatting

**ESLint** (`eslint.config.js`):
- TypeScript ESLint recommended + Prettier integration
- `@typescript-eslint/no-explicit-any: off` — allowed per architecture (circular dep prevention)
- `_`-prefixed unused args allowed
- Special exemptions for Haxe-ported files in `src/native/` (self-assign, no-var, etc.)

**Prettier** (`.prettierrc`):
- Double quotes, semicolons, trailing commas
- 100-char line width

```bash
npm run format          # auto-fix formatting
npm run format:check    # verify (CI mode)
npm run lint            # lint src/ and tests/
```

---

## CI/CD Pipelines

### ci.yml — Every push & PR

Runs in parallel on Node 22:

| Job | Command |
|-----|---------|
| Build | `npm run build` |
| Tests | `npm test` |
| Lint | `npm run lint` |
| Format | `npm run format:check` |
| Circular deps | `npm run check:circular` (≤27 allowed) |

### release.yml — Auto-publish on master

Triggered by push to `master` (skips release commits to prevent loops):

1. Reads commit messages since last tag
2. Determines version bump via conventional commits:
   - `BREAKING CHANGE` / `!:` → **major**
   - `feat:` → **minor**
   - `fix:` / `perf:` / `refactor:` / etc. → **patch**
3. Updates `package.json`, creates git tag, pushes
4. Publishes to npm, creates GitHub Release

### deploy-pages.yml — Docs site

Runs `npm run build:docs` (tsup + TypeDoc) → deploys `docs/` to GitHub Pages.

### benchmark.yml — Performance budget

On PRs: compares against master baseline, fails if >10% regression.
On master: saves new baseline for future PRs.

---

## Commit Conventions

Use [Conventional Commits](https://www.conventionalcommits.org/):

```
feat(scope): add new feature
fix(scope): fix bug description
refactor(scope): restructure without behavior change
perf(scope): performance improvement
docs: update documentation
chore: maintenance task
```

Breaking changes: use `feat!:` or add `BREAKING CHANGE` footer.

---

## Documentation Update Matrix

When a PR changes features, APIs, priorities, or versions:

| File | What to update | When |
|------|----------------|------|
| `CLAUDE.md` | Test count, key features | New features |
| `ROADMAP.md` | Priority table, status, competitive analysis | Priority changes |
| `docs/guides/architecture.md` | Internal patterns, registration flow | Architecture changes |
| `docs/guides/multiplayer-guide.md` | Server setup, protocol, prediction | Multiplayer changes |
| `docs/guides/cookbook.md` | Add recipe for new feature, update existing recipes | New features, API changes |
| `docs/guides/troubleshooting.md` | Add entry for new gotchas, update fixes | Bug fixes, API gotchas |
| `docs/guides/anti-patterns.md` | Add entry for new pitfalls | Bug fixes, performance changes |
| `README.md` | Quick start, API tables, badge versions | Public API changes, releases |
| `llms.txt` | Class list, links, quick start | Public API additions/removals |
| `llms-full.txt` | Complete API reference, gotchas, version (line 1) | Any public API change |
| `package.json` | `version` field | Releases |

---

## Available Scripts

| Command | Purpose |
|---------|---------|
| `npm run build` | tsup → `dist/` |
| `npm test` | vitest (all tests once) |
| `npm run test:watch` | vitest watch mode |
| `npm run lint` | ESLint on `src/` and `tests/` |
| `npm run format` | Prettier auto-fix |
| `npm run format:check` | Prettier verify |
| `npm run check:circular` | madge circular dep check |
| `npm run benchmark` | Performance benchmark |
| `npm run benchmark:compare` | Compare vs baseline |
| `npm run benchmark:update-baseline` | Save new baseline |
| `npm run build:docs` | Build bundle + TypeDoc |
| `npm run build:typedoc` | TypeDoc only |
| `npm run serve:docs` | Local docs server (port 5500) |
| `npm run dev:multiplayer` | Docs (5500) + server (3001) |

---

## Circular Dependencies

Checked via `npm run check:circular` (madge). Current limit: **≤27 cycles**.

The ZPP_* internal layer has inherent circular references from the Haxe port.
These are managed via the registration/bootstrap pattern — see `docs/guides/architecture.md`.

---

## Node & Platform

- **Node:** ≥18 (package.json `engines`)
- **CI:** Node 22, Ubuntu latest
- **Runtime deps:** zero (pure TypeScript)
