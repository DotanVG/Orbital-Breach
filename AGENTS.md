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

## Knowledge graph policy

When `graphify-out/graph.json` exists:

1. For unfamiliar, architectural, debugging, cross-cutting or likely multi-file tasks, query Graphify before performing broad repository exploration.
2. Use the graph to identify likely files, symbols, dependencies and execution paths.
3. Open and verify the authoritative source files before editing.
4. Never trust stale graph data over current source.
5. For a clearly isolated edit, skip Graphify.
6. After material structural changes, perform an incremental graph update when practical.
7. After a major refactor, perform a full rebuild.
8. Never commit `graphify-out/`.
9. Do not block ordinary work only because the optional local graph is absent.

Codex discovers the repository skill at `.agents/skills/graphify/SKILL.md`.
Claude Code discovers the canonical skill at `.claude/skills/graphify/SKILL.md`.
A fast `SessionStart` hook only announces an existing graph; it never builds or
updates one. Use `node scripts/graphify.mjs status` to check freshness and
`node scripts/graphify.mjs query "<question>"` for intentional bounded queries.

## Reuse first

Before implementing a feature or config, search installed dependencies and their
READMEs, this repo's `PROVENANCE.md`, and the relevant personal DotanVG siblings
(BeatEmPie-Phaser, Count-Dawn, Orbital-Breach). Check `DotanVG/game-kit`'s
`packages/INDEX.md` if that project exists; do not assume packages are published.
For an unfamiliar feature, compare existing open-source approaches, license,
maintenance and security first. Record findings and the reuse decision in the PR body.

Prefer an existing shared package or native API. Do not copy source files,
directories, workflows, configs or security logic between repositories, including
from old branches or node_modules. A small game-specific idea can be implemented
locally; shared security policy deserves a shared config/package proposal.
An explicitly approved exception must record source repo/path/full commit SHA,
date, reason, intentional differences and intended shared-package destination in
`PROVENANCE.md` and the PR body. Phase 0's documented drift-tool bootstrap is one
such authorized exception. Asset reuse also requires license/inventory attribution.

Propose a shared component only for two concrete consumers. Put the proposal in
`docs/reuse-proposals/<name>.md` in a PR: existing locations and SHAs, consumers,
API/parameters, engine boundary, risks and checks. Keep Phaser-specific, Three.js-
specific and engine-agnostic code separate. Obtain approval before creating or
publishing a package; use a human-merged version/Changesets PR if adopted. Do not
vendor modified dependencies or commit local `file:` dependencies as a substitute.

Run `node tools/drift-check.mjs <sibling-checkout-or-url>` before changing listed
shared configs. Review intentional differences rather than forcing equality.
Never put secrets, game hostnames, analytics IDs or origins into shared defaults;
take game-specific values as parameters. The drift check remains advisory and
must not be added to deploy/build gates. Use PR bodies for evidence, not comments.
