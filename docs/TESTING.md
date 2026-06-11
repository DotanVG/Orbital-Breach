# Testing Guide

Orbital Breach combines a [vitest](https://vitest.dev/) unit suite with a
manual smoke checklist for browser-only behavior. The unit suite runs from the
repo root in a Node environment; smoke tests cover the surfaces that need a
real browser, multiplayer server, mobile device, or analytics backend.

---

## Commands

All commands run from the **repo root** unless noted. Use the local
`node_modules/.bin/tsc` binary — TypeScript is not installed globally.

```bash
# Unit tests (vitest)
npm test                   # single run, CI-style
npm run test:watch         # watch mode

# TypeScript typecheck (run before any commit)
cd client && node_modules/.bin/tsc --noEmit
cd server && node_modules/.bin/tsc --noEmit

# Production builds (mirror what Vercel + Render run)
npm run build --prefix client
npm run build --prefix server

# Local dev stack (server on :2567, client on :5173, Vite proxies /matchmake + /ws)
npm run dev
```

The `client` build script also runs `tsc --noEmit` before invoking Vite, so a
clean `npm run build --prefix client` is a stricter check than typecheck alone.

---

## Vitest harness

Config at the repo root:
- `vitest.config.ts` — `environment: 'node'`, includes `tests/**/*.test.ts` and
  `shared/**/*.test.ts`, `globals: false`, aliases `three` to
  `client/node_modules/three/build/three.module.js`.
- `tsconfig.test.json` — TypeScript scope for the test compile.

### Root harness package.json (gitignored — recreate on fresh clones)

The root `package.json` is deliberately **gitignored** (root-level dev tooling,
not part of deployable code — Vercel builds from `client/` only, see
`vercel.json`). A fresh clone therefore cannot run `npm test` until it exists.
Recreate it with exactly this content, then `npm install`:

```json
{
  "name": "orbital-breach-root",
  "private": true,
  "scripts": {
    "test": "vitest run",
    "test:watch": "vitest",
    "dev": "concurrently \"npm run dev --prefix server\" \"npm run dev --prefix client\""
  },
  "devDependencies": {
    "@types/node": "^22.10.2",
    "@vitest/coverage-v8": "^3.2.4",
    "concurrently": "^9.1.0",
    "vitest": "^3.2.4"
  }
}
```

Claude Code on the web does this automatically via the SessionStart hook
(`.claude/hooks/session-start.mjs`), which also installs `client/` and
`server/` dependencies. If you change the harness deps, update both this
section and the hook — they must stay in sync.

Conventions:
- Explicit imports — `import { describe, it, expect } from 'vitest';`
- Import paths are relative to the **repo root**:
  `import { foo } from '../shared/foo';` /
  `import { bar } from '../client/src/match/bar';`
- One `describe` per exported function; tests named as plain statements
  (`'is deterministic for the same seed'`).

### What to unit-test

Pure (side-effect-free) helpers only — no DOM, no scene graph, no socket I/O.
Good fits include `shared/` utilities, arena geometry, hit math, match-flow,
roster shaping, parsers, and pure UI builders.

### What to skip

| Surface | Why |
|---|---|
| Three.js `Mesh` / `Scene` / `Renderer` | Needs WebGL |
| HUD / menu DOM mutation | Node has no `document` |
| Live Colyseus rooms | Needs a running server + WebSocket |
| `InputManager`, pointer-lock APIs | Browser-only |
| GLB animation crossfades | Needs a loaded GLTF + renderer |

For these, rely on the manual smoke checklist below.

---

## Current coverage (42 test files, 243 tests)

The suite covers physics, arena generation, diamond obstacle invariants, both
win paths, bot AI, online reconciliation, portal placement, debrief stats,
mobile input logic, embed detection, fullscreen behavior, analytics events,
room directory, profanity filtering, scoreboard / kill-feed builders, and
regression cases. The exact file list lives in `tests/` and
`shared/**/*.test.ts`; run `npm test` to see counts and timing.

Notable groups:

| Area | Files | What they cover |
|---|---|---|
| Shared logic | `arena-gen`, `physics`, `playerLogic`, `match`, `matchFlow`, `multiplayer`, `profanity` | Deterministic generation, physics helpers, match rules |
| Arena obstacles | `diamond-obstacles` | Gate-blocker corridor invariant ×200 seeds, all 5 diamond archetypes, edge-bar geometry, wall bar bounds and normals |
| Solo runtime | `localMatch`, `botBrain`, `roundController`, `matchStatsTracker` | Round lifecycle, bot AI, stat accumulation |
| Online runtime | `onlineMatch`, `onlineActorDamage`, `onlineBotTargeting`, `onlineGrabSync`, `onlineRoomLeave`, `reconciliation`, `roomDirectory` | Snapshot reconciliation, damage sync, room browser |
| Geometry / collision | `breachRoomQueries`, `bulletCollision`, `projectileActorCollision`, `cameraYawFromBreach` | AABB hit math, segment–sphere test, breach queries |
| Vibe Jam | `vibeJamPortal`, `portalPlacement` | Portal param parsing, spawn placement |
| UI / platform | `scoreboard`, `scoreboardCursor`, `overlayCursor`, `creditsContent`, `instructionsContent`, `linkIcons`, `teamPresentation`, `firstTimeTutorial`, `embedMode`, `fullscreen`, `mobileInputLogic`, `analytics` | Pure DOM builders, cursor logic, analytics events |
| Sanity | `smoke` | Import sanity |

### Diamond obstacle test suite (`tests/diamond-obstacles.test.ts`)

Added with the arena overhaul. Key invariants:

| Test group | What it asserts |
|---|---|
| Gate-blocker invariant (200 seeds) | Every layout has exactly one `diamond_huge` at `(0,0,0)` whose inset bullet AABB (×0.65 + bullet radius) covers the full portal opening on both axes |
| Archetype coverage | All five archetypes appear across 50 seeds; specs have correct positive half-extents |
| Determinism | Same seed → identical `obstacles` and `wallBars` arrays every time |
| Mirrored pairs | Every band diamond has a mirror with matching archetype + size and negated goal-axis position |
| Wall bars | Count is 32–48 per layout (4 walls × 8–12); all positions inside arena bounds; one axis flush against a non-portal wall face; normals point inward |
| Edge bars | `generateDiamondEdgeBars` always produces exactly 12 bars; normals are unit vectors |
| Layout validity (200 seeds) | No NaN positions anywhere; goal axis is always x or z; all obstacle sizes positive |

---

## Adding a test

1. Create `tests/<module>.test.ts` (or co-locate as `shared/<module>.test.ts`).
2. Import vitest explicitly and the function under test by repo-relative path.
3. One `describe` per export; statement-style `it` names.
4. Keep the test pure — no real Colyseus rooms, real renderer, or real DOM.

Example:

```typescript
import { describe, it, expect } from 'vitest';
import { findMatchWinner } from '../shared/match-flow';

describe('findMatchWinner', () => {
  it('returns null while neither team has hit the target', () => {
    expect(findMatchWinner({ team0: 4, team1: 4 }, 5)).toBeNull();
  });

  it('returns the team that reaches the target first', () => {
    expect(findMatchWinner({ team0: 5, team1: 3 }, 5)).toBe(0);
  });
});
```

Three.js math is fine in tests (the alias resolves `three` to its ES module
build) as long as you avoid `new THREE.Mesh(...)`, `scene.add(...)`, or
`renderer.render(...)`.

---

## Test policy

Every new feature that adds a pure helper **must** ship with vitest coverage
for that helper. Extract math and decision logic into pure functions so they
are testable; keep the WebGL / DOM / socket side at the edges.

---

## Manual smoke checklist

Run before any release-bound merge to `main`. The unit suite cannot exercise
these paths.

### Desktop browser (Chrome + Firefox at minimum)

- [ ] Boot loads, welcome / call-sign capture works on first visit.
- [ ] Solo: 1v1, 2v2, 5v5, 10v10, 20v20 — bots fill empty seats; LMB fires; E
      grabs; Space launches with mouse-Y aim power.
- [ ] **Win path A — Breach**: float through enemy portal while at least one
      enemy is unfrozen; round point awarded.
- [ ] **Win path B — Full freeze**: freeze every enemy; round point awarded
      even with no breach.
- [ ] First team to 5 round wins triggers match-end + debrief + victory dance.
- [ ] HUD: power meter, hit-zone damage state, frozen status, kill feed.
- [ ] Tab roster shows team rosters with bot badges, frozen status, ping
      column when online.
- [ ] Session menu (Esc) → settings, credits, safe-exit. Esc releases cursor.
- [ ] Help overlay (H) renders.

### Mobile portrait + landscape (iOS Safari + Android Chrome)

- [ ] Touch joystick + look area appear; GRAB / JUMP-LAUNCH / FIRE / 1ST-3RD
      buttons respond.
- [ ] Orientation change does not break the layout or the canvas size.
- [ ] Fullscreen toggle works on Android. On iPhone Safari it is disabled
      (non-video fullscreen unsupported).

### Online lobby + room browser

- [ ] **Join Online** quick-matches into `orbital_lobby`; ready check starts
      countdown when both teams are full and humans are ready.
- [ ] **Rooms & Invites** lists current public rooms from `/rooms`.
- [ ] Create public + private rooms with custom name, max-player cap from the
      playlist sizes (2 / 4 / 10 / 20 / 40).
- [ ] **Fill Lobby** adds bots; **Humans Only** drops them; later human join
      reclaims a bot seat.
- [ ] Move To Cyan / Magenta works; ready state, disconnected state, own-pilot
      highlight all visible.

### Private invite + QR join

- [ ] Invite URL with `?roomId=…` opens directly into the right room.
- [ ] Copy / Share buttons populate the system share sheet on mobile.
- [ ] QR code scans into the same room on a second device.

### Vibe Jam portals

- [ ] Outbound portal in the arena opens `https://vibej.am/portal/2026` in a
      new tab.
- [ ] Inbound: visit with `?portal=true&ref=<url>` — return portal renders in
      the breach room and points back at `ref`. Console logs the detected
      params and ref.
- [ ] Other portal params (`username`, `color`, etc.) are reflected if used.

### Fullscreen / itch.io embed

- [ ] Direct Vercel URL: fullscreen toggle works on supported browsers.
- [ ] itch.io page: game runs inside the iframe. The embed shell does not
      double up controls. Fullscreen via the toggle (where supported) or the
      itch fullscreen button works.

### Analytics presence

- [ ] DevTools Network shows requests to `_vercel/insights/*` for both
      Web Analytics and Speed Insights on a fresh page load.
- [ ] Custom `track()` events fire for the documented landing / match events
      (see `client/src/analytics/analytics.ts`).

### Disconnect / rejoin cleanup

- [ ] Hard-close the tab mid-round → bot fills the seat at round end.
- [ ] Rejoin from the same browser into the same room → seat is reclaimed
      from the bot, not added on top.
- [ ] Render cold start: first join after idle hits `/wake`; UI shows the
      warm-up state instead of erroring.

---

## Debugging tips

- Server logs on Render include join / leave / round-result lines from
  `OrbitalLobbyRoom` — start there for online-only bugs.
- `/rooms` returns the live public room directory; useful when the browser UI
  disagrees with the server.
- `client/src/featureFlags.ts` toggles dev overlays (gun-tune, float-arm-tune,
  scoreboard cursor) without rebuilding.
- `?portal=true&ref=…` URL params are the only way to exercise the inbound
  Vibe Jam path locally.
