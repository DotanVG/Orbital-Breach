# CLAUDE.md — Orbital Breach Dev Guide

This file is tracked. It exists to orient Claude Code at the start of every session.

---

## What this project is

**Orbital Breach** — a browser-based zero-gravity FPS submitted to Vibe Game Jam 2026.
Two teams in a floating arena fight to breach the enemy's gravity room. Shots freeze enemies. If all enemies are frozen, their base is vulnerable. First team to physically walk through the enemy's breach portal scores.

Stack: Three.js + TypeScript client (Vite), Node.js + Colyseus server, shared/ types.

---

## Claude project files

- `CLAUDE.md` — shared repo memory and workflow instructions
- `CLAUDE.local.md` — optional private repo-specific memory; keep it gitignored
- `.claude/settings.json` — shared Claude project settings, plugins, and hooks
- `.claude/settings.local.json` — local-only Claude settings; keep it gitignored
- `.claude/skills/` — repo-local slash commands and reusable workflows
- `.claude/hooks/` — scripts referenced by `.claude/settings.json`
- `.worktreeinclude` — local-only Claude files copied into new worktrees when they exist locally

Keep private repo-specific files in `CLAUDE.local.md` and `.claude/settings.local.json` so `.worktreeinclude` brings them into new worktrees.

---

## Repo layout

```
client/src/      Vite + TypeScript browser app
  app.ts / main.ts / input.ts / camera.ts / physics.ts / combat.ts
  game/          App composition, round controller, projectile system, weapon fire
  player/        LocalPlayer facade, animation, combat, grab pose, spawn
  arena/         Arena facade, breach room queries, walls, obstacle collision, portals
  render/        SceneManager, HUD, gun viewmodel, materials
  ui/            MainMenu controller and view
  net/           Colyseus NetClient
  audio/         SoundEngine
server/src/      Node.js Colyseus game server
  index.ts / room.ts / sim.ts / player.ts / projectile.ts / arena-query.ts
  bot/brain.ts   Bot AI tick
shared/          Imported by both client and server
  schema.ts / constants.ts / physics.ts / arena-gen.ts / player-logic.ts / vec3.ts
docs/            ARCHITECTURE.md, TESTING.md
```

---

## How to run

```bash
npm run dev   # starts server + client (from repo root)
```

Server: `ws://localhost:3001`, client: `http://localhost:5173`.
Vite proxies `/ws` → `ws://localhost:3001` (see `client/vite.config.ts`).

```bash
# TypeScript check — ALWAYS run before committing
cd client && node_modules/.bin/tsc --noEmit
cd server && node_modules/.bin/tsc --noEmit
```

> Use `node_modules/.bin/tsc` not `npx tsc` — TypeScript is a local dep.

---

## Branching strategy

Feature → staging → main. Never push features directly to main.

```
feature/<name>  →  staging    via GitHub PR (squash merge OK)
staging         →  main       NEVER via GitHub PR — CLI only:
```

```bash
git fetch origin
git checkout main && git merge --ff-only origin/staging && git push origin main
```

Hotfix escape hatch: push hotfix directly to main, then sync staging:

```bash
git checkout staging && git merge origin/main && git push origin staging
```

After any sync: `origin/main` and `origin/staging` must point to the same SHA.

Branch naming: `feature/<kebab-name>` matching the PlanTracker feature name.
main must always be in a working, playable state.

---

## How to commit

Only commit when a feature is complete and TypeScript compiles clean on both client and server. Mark the feature ✅ DONE in PlanTracker.md before committing. Include the PlanTracker update in the same commit.

```bash
git add client/src/... server/src/... shared/...
git commit -m "feat: <feature name> — <one-line description>"
```

---

## Task tracker

**Read `PlanTracker.md` at the start of every session.**
Features listed in order with status (⬜ / 🔄 / ✅ DONE). Work one at a time.
When done: update PlanTracker.md → commit all code + updated file.

> PlanTracker.md is gitignored — lives on disk only, never pushed.

---

## Architecture invariants — do NOT break these

### Shooting mechanism
`input.ts` — `consumeFire()` handles LMB held + fire rate cooldown. Returns bool, sets `fireCooldown = 1/FIRE_RATE` on true.
Game loop checks `this.phase === 'PLAYING' && this.player.canFire() && this.input.consumeFire()` before spawning projectile.
Never replace with a charge-based pending-fire system — previous attempts broke shooting entirely.

### Breach win behavior
When player floats through enemy's open portal, `updateFloating()` in `player.ts` sets `currentBreachTeam`, switches `phase` to `'BREACH'`, zeros `vel.y`, increments `kills`, calls `onRoundWin`.
Do NOT change to stay in FLOATING. Camera must switch to gravity mode on entry.

### Camera modes
`CameraController.setZeroGMode(true)` — free quaternion look (arena).
`CameraController.setZeroGMode(false)` — yaw+pitch gravity mode (breach room).
Toggled every frame: `this.cam.setZeroGMode(this.player.phase !== 'BREACH')`.

### Mouse Y during AIMING
`InputManager.setAimingMode(active)` diverts `mouseDy` → `aimDy`. `consumeAimDelta()` returns aimDy for launch power. Intentional — mouse up/down = charge aim power. Do not remove.

### Shared/ compiles into both client and server
`shared/schema.ts` is the wire contract — change both sides atomically.

---

## Archive branches (local only, not on origin)

| Branch | Contains |
|---|---|
| `archive/dev` | Full feature set: menu, lobby, NetClient, server Room/Sim, bots, sound, HUD polish, interpolation, kill feed |
| `archive/merge-selective-dev` | Partially-merged attempt — do not use, only for reference |

```bash
git show archive/dev:client/src/ui/menu.ts
```

When porting from archive: read file in full, identify conflicts with main's invariants, port carefully — never blind-copy-paste.

---

## Key design decisions

**DOM-based HUD and UI** — all menus, HUD, kill feed are `div` elements in `document.body`. No React/Vue. Canvas at z-index 0, UI at z-index 100+.

**Server is authoritative** — client does local prediction; server's physics tick is truth. Reconciliation replays inputs after server correction.

**TICK_RATE = 20hz** — server sends state 20×/sec. Client renders at 60fps with interpolation. Don't change TICK_RATE without updating interpolation buffer delay.

**Teams** — 0 = Cyan, 1 = Magenta. Color: `team === 0 ? 0x00ffff : 0xff00ff`.

**No GLTF player models yet** — `Character_Soldier.gltf` exists but is NOT loaded. Remote players render as sphere meshes. Do not attempt GLTF integration until everything else is done.

---

## Testing

```bash
npm test              # single run (from repo root)
npm run test:watch    # watch mode
```

Harness: **vitest** (`vitest.config.ts` at root), `environment: 'node'`. Three.js aliased to client's ES build.

**Every new pure function MUST have vitest tests** — add to `tests/` or co-locate in `shared/` before commit.

Good candidates: everything in `shared/`, `breachRoomQueries.ts`, `obstacleCollision.ts`, pure helpers in `game/`.
Do NOT test Three.js scene objects, DOM, or WebSocket I/O.

### Conventions
- Explicit imports: `import { describe, it, expect } from 'vitest';`
- One `describe` per exported function/module
- Import paths relative to repo root: `'../shared/arena-gen'`

See `docs/TESTING.md` for full guide.

---

## Common gotchas

- `git show archive/dev:path` — path from repo root, not from `client/`
- Server tsconfig `rootDir: ".."` — imports `../../shared/...`
- `node_modules/.bin/tsc` not `npx tsc`
- Vite: `moduleResolution: Bundler` — no `.js` extensions needed
- Server: `moduleResolution: Node` + CommonJS — different rules
- `LAUNCH_AIM_SENSITIVITY = 0.05` — controls mouse Y → launch power
- Portal doors: closed in COUNTDOWN, open at PLAYING. `arena.setPortalDoorsOpen(bool)`

---

## Claude Skills

- `web-game-foundations` — architecture, module boundaries, runtime conventions
- `three-webgl-game` — Three.js runtime, cameras, loaders, rendering
- `web-3d-asset-pipeline` — GLB/glTF cleanup, optimization, validation
- `/preflight` — repo ship checks before commit/push/PR
- `/golden-path` — manual gameplay smoke checklist
- `/ship-staging` — package and push to staging
- `/port-from-archive` — recover features from archive branches
- `/arena-debug` — debug gameplay, camera, collision, projectiles
- `/claude-audit` — verify repo Claude setup is aligned

## Claude Hooks

Shared hooks in `.claude/settings.json`, scripts in `.claude/hooks/`.
- Post-edit: run typechecks/tests in background, wake Claude if one fails
- Git ship guard: block commit/push if tracked files have unstaged changes or preflight fails

## README upkeep

`README.md` has a **Current Codebase Coverage** section (prose, not a table). When a feature ships, add or update its bullet under "Shipped and implemented", and move anything no longer pending out of the "Evidence-backed pending or transitional surfaces" list. If a feature adds new user-facing capability, update the relevant section above it (e.g. Player-Facing Features, Tech Stack) too.

---

## Testing checklist (before any commit)

1. `cd client && node_modules/.bin/tsc --noEmit` — zero errors
2. `cd server && node_modules/.bin/tsc --noEmit` — zero errors
3. `npm test` (from repo root) — all tests green
4. Start dev server, open browser, verify:
   - Feature works on golden path
   - Shooting (LMB) fires correctly
   - Bar grab (E) + launch (Space) works
   - Breach win (float through enemy portal) works
   - No console errors
