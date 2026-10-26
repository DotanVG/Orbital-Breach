# AGENTS.md â€” Orbital Breach

Browser zero-G team FPS (Vibe Game Jam 2026). Three.js + TypeScript client (Vite) in `client/`, Node.js + Colyseus server in `server/`, wire types in `shared/` (compiled into both).

## Commands

```bash
npm run dev                                   # server ws://localhost:3001 + client http://localhost:5173 (repo root)
npm test                                      # vitest, from repo root
cd client && node_modules/.bin/tsc --noEmit   # typecheck â€” not `npx tsc`
cd server && node_modules/.bin/tsc --noEmit
```

The root `package.json` (vitest harness) is gitignored; `.claude/hooks/session-start.mjs` recreates it in remote sessions. Recipe: `docs/TESTING.md`.

## Branching

- `feature/<kebab-name>` â†’ PR into `staging` (squash OK). Never push features to `main`.
- `staging` â†’ `main` only by CLI fast-forward, never by PR:
  `git fetch origin && git checkout main && git merge --ff-only origin/staging && git push origin main`
- Hotfix on `main` â†’ merge `origin/main` back into `staging`. After any sync, `main` and `staging` point to the same SHA.
- `main` must always be playable.

## Before every commit

1. Both typechecks clean, `npm test` green.
2. Every new pure function gets a vitest test (`tests/` or next to it in `shared/`). Don't test Three.js scene objects, DOM or WebSocket I/O.
3. Golden path in the browser: LMB shooting, bar grab (E) + launch (Space), breach win, no console errors.
4. Feature shipped â†’ update the "Current Codebase Coverage" section of `README.md` in the same PR.
5. If you use the local `PlanTracker.md` (gitignored, disk only), read it at session start and mark the feature done.

## Invariants â€” don't break

- Fire: `InputManager.consumeFire()` (LMB held + `1/FIRE_RATE` cooldown) gated by the game loop. Never replace it with a charge/pending-fire system â€” that broke shooting before.
- Breach win: floating through the enemy's open portal switches the player to phase `BREACH` (gravity camera, round win). Don't keep the player in FLOATING.
- Camera: `setZeroGMode(player.phase !== 'BREACH')` every frame â€” free quaternion look in the arena, yaw+pitch in the breach room.
- While aiming, mouse Y feeds launch power (`setAimingMode` â†’ `consumeAimDelta`). Intentional.
- `shared/schema.ts` is the wire contract â€” change client and server atomically.
- Server is authoritative; client predicts and reconciles. `TICK_RATE` is 20 Hz â€” change it only together with the interpolation buffer delay.
- HUD and menus are plain DOM (`div`s over the canvas). No React/Vue.

## Gotchas

- Client uses `moduleResolution: Bundler` (no `.js` extensions); server is CommonJS with `moduleResolution: Node` and `rootDir: ".."` (imports `../../shared/...`).
- Portal doors: closed in COUNTDOWN, open in PLAYING (`arena.setPortalDoorsOpen`).
- Archive branches (`archive/dev`, `archive/merge-selective-dev`) exist only locally. Port from them by reading the whole file and checking it against the invariants above â€” never blind-copy.

## Ponytail / Minimal Senior Dev Mode

- Prefer deletion over addition.
- Prefer existing code, stdlib, browser/native APIs, and installed dependencies before adding new code or dependencies.
- Avoid new abstractions unless there are at least two real implementations or a clear current need.
- Keep diffs small.
- Do not add scaffolding "for later".
- Never simplify away security, trust-boundary validation, accessibility basics, or data-loss prevention.
- For deliberate shortcuts, add a comment with the format:
  // ponytail: [shortcut], upgrade when [specific condition]
- For non-trivial logic, add the smallest runnable check or test that would fail if the logic breaks.