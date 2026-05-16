# Orbital Breach Architecture

This document describes the production architecture of Orbital Breach as it ships
on Vercel (frontend) and Render (Colyseus multiplayer server). It reflects the
current `staging` / `main` state, including the room browser, private/invite
rooms, Vibe Jam portal handoff, mobile controls, the itch.io embed, analytics,
and stale-player cleanup.

For per-feature gameplay rules and tuning, read `CLAUDE.md` and `shared/constants.ts`.

---

## High-level shape

```
Browser (Three.js + TypeScript, built by Vite, hosted on Vercel)
   │
   │  Colyseus client over WebSocket  (ws / wss)
   ▼
Colyseus server (Node.js + Express, hosted on Render)
   │
   ├── /matchmake     room join + create
   ├── /ws            Colyseus transport
   ├── /health        Render health probe
   ├── /wake          warm-up endpoint for free-tier cold starts
   └── /rooms         public room directory
```

The same client codebase runs solo (no socket) and online (Colyseus). Solo and
online share match-flow logic in `shared/`. The browser game also embeds inside
the itch.io page via an `<iframe>` and supports the Vibe Jam 2026 portal protocol.

---

## Win conditions (authoritative)

Two independent win paths per round, both implemented in
`client/src/match/localMatch.ts` (solo) and `server/src/colyseus/OrbitalLobbyRoom.ts`
(online):

1. **Breach** — a non-frozen player from team A enters team B's breach room while
   team B's portal door is open. Portal doors open when the round phase becomes
   `PLAYING`; they are not gated on freezing the enemy team.
2. **Full freeze** — every member of one team is frozen at the same time.
   `findFullFreezeWinner` in `shared/player-logic.ts` decides this.

Match wins are first-to-`MATCH_POINT_TARGET` round wins
(`MATCH_POINT_TARGET = 5`, `shared/constants.ts`). Rounds also have a hard cap
of `ROUND_DURATION_SECONDS = 120` so a stalled round always ends. The server
runs authoritative state at `TICK_RATE = 20` Hz.

---

## Client (`client/src`)

### Entry + composition

| File | Responsibility |
|---|---|
| `main.ts` | Boot: inject Vercel Analytics + Speed Insights, then `new App().start()` |
| `app.ts` | Re-export of `game/gameApp.App` |
| `game/gameApp.ts` | Application shell: app-mode transitions (menu → solo / online lobby → match → debrief), Vibe Jam portal flow, render loop, HUD sync, projectile updates, portal-door state |
| `featureFlags.ts`, `config.ts`, `embed.ts`, `platform.ts` | Build-time / runtime flags, itch.io embed detection, mobile/desktop platform detection |

### Game systems (`client/src/game`)

| File | Responsibility |
|---|---|
| `roundController.ts` | LOBBY → COUNTDOWN → PLAYING → ROUND_END timing for solo |
| `projectileSystem.ts` | Visual projectiles + nearest-hit resolution against obstacles, portal barriers, and actors |
| `projectileActorCollision.ts` | Pure segment-vs-sphere collision helper |
| `weaponFire.ts` | Pure helper: build shot origin and direction from the camera and gun model |
| `bulletCollision.ts` | Pure swept AABB ray test (`bulletHitsBox`, `bulletHitPoint`) |
| `cameraYawFromBreach.ts` | Pure yaw math for breach-room re-entry |
| `matchStatsTracker.ts` | Per-match stat accumulation for the debrief screen |
| `gunTuneOverlay.ts`, `floatArmTuneOverlay.ts`, `overlayCursor.ts`, `scoreboardCursor.ts` | Dev / runtime overlay helpers |
| `portal/parsePortalParams.ts` | Pure parser for Vibe Jam URL params (`portal`, `ref`, `username`, etc.) |
| `portal/portalPlacement.ts` | Pure placement math for inbound/outbound portal walls |
| `portal/vibeJamPortal.ts` | Three.js portal meshes + collision triggers; outbound target is `https://vibej.am/portal/2026`, return portal points back at `params.ref` |

### Match runtime (`client/src/match`)

| File | Responsibility |
|---|---|
| `localMatch.ts` | Solo authority: bot fill, scoring, round/match end, both win paths |
| `onlineMatch.ts` | Reconciles server-authoritative snapshots into local actor state |
| `botBrain.ts` | Bot navigation, target selection, grab/launch/fire decisions |
| `arenaQueryAdapter.ts` | Adapter from Three.js arena to transport-neutral helpers in `shared/` |
| `rosterView.ts` | Pure HUD roster shaping (own team vs enemy) |
| `simulatedPlayerAvatar.ts` | Lightweight non-human actor rendering |

### Player (`client/src/player`)

| File | Responsibility |
|---|---|
| `localPlayer.ts` | Human movement, grab, launch, damage, breach scoring |
| `playerCombat.ts` | Pure hit-zone classification |
| `playerSpawn.ts` | Breach-room spawn helpers |
| `playerAnimationController.ts` | AnimationMixer crossfades for the alien rig |
| `playerThirdPersonGun.ts` | Third-person gun rig and tuning |
| `playerGrabPose.ts`, `playerAimPose.ts` | Bar-grab and aim pose math |
| `playerVictoryDance.ts` | End-of-match winning-team dance animation |
| `playerDamageGlow.ts`, `teamAccent.ts` | Damage feedback and team color accenting |
| `onlineGrabSync.ts` | Online-only sync of grab state between server and renderer |
| `alienRenderAsset.ts` | Loader/wiring for the Quaternius animated alien GLB rigs |

### Arena (`client/src/arena`)

| File | Responsibility |
|---|---|
| `arena.ts` | Arena facade: layout loading, obstacle collision, breach-room queries, portal barriers, bar lookup, `setPortalDoorsOpen` |
| `breachRoomQueries.ts` | Pure inside / depth checks |
| `obstacleCollision.ts` | Pure obstacle bounce helper |

### Render (`client/src/render`)

| File | Responsibility |
|---|---|
| `scene.ts` | `SceneManager` (Three.js scene, renderer, camera) |
| `materials.ts` | Shared Three.js materials |
| `gun.ts` | First-person gun viewmodel |
| `playerNameTag.ts` | Above-head name tags for online + bot actors |
| `hud/hud.ts` | HUD orchestration |
| `hud/scoreboard.ts` | Pure scoreboard HTML builder (Tab-held roster, bot/online badges, ping column when online, frozen state) |

### UI (`client/src/ui`)

| File | Responsibility |
|---|---|
| `menu/`, `menu.ts` | Main menu controller and DOM view: solo size selection, Join Online, Rooms & Invites, call sign, settings, credits |
| `welcome/`, `welcome.ts` | First-launch welcome / call-sign capture |
| `roomBrowser.ts` | Public room browser, public/private room creation, invite-link detection, direct join |
| `multiplayerLobby.ts` | Online lobby: rosters, ready check, fill-bots / humans-only controls, invite URL, native share, QR code |
| `mobileControls.ts` | Touch joystick, look area, GRAB / JUMP / LAUNCH / FIRE / camera-toggle buttons |
| `instructionsContent.ts`, `creditsContent.ts`, `linkIcons.ts` | Pure builders for the instructions, credits, and external-link markup |
| `kill-feed.ts` | In-match kill feed |
| `debrief.ts` | Post-match summary with score, stats, and awards |
| `sessionMenu.ts` | In-game pause / settings / safe-exit menu |
| `fullscreen.ts` | Fullscreen toggle (disabled on iPhone Safari, which blocks non-video fullscreen) |
| `confirmDialog.ts`, `globalCursor.ts`, `designTokens.ts` | UI primitives |

### Networking (`client/src/net`)

| File | Responsibility |
|---|---|
| `client.ts` | Colyseus client wrapper |
| `endpoint.ts` | Resolves `VITE_COLYSEUS_ENDPOINT` (production) vs the Vite proxy (`/matchmake`, `/ws` → `localhost:2567`) in development |
| `messages.ts` | Client-side message types mirroring the server schema |
| `reconciliation.ts` | Server-authoritative state reconciliation |
| `roomDirectory.ts` | Polling + caching for the public room list |
| `wakeBackend.ts` | Hits `/wake` on the Render server before joining, to defrost cold starts |

### Audio + analytics

| File | Responsibility |
|---|---|
| `audio/SoundEngine.ts` | Loads `client/public/audio/*` (theme, hit, laser, countdown) and exposes `play(name)` |
| `analytics/analytics.ts` | Wraps `@vercel/analytics`'s `track()` with typed events; landing visit properties are gathered once on boot |

### Static assets (`client/public/`)

`favicon.*`, `apple-touch-icon.png`, `android-chrome-*.png`, `site.webmanifest`,
`orbital-breach-art.png`, `audio/`, `models/`, and `llms.txt` (a machine-readable
project description served at the production root for LLM crawlers).

---

## Shared (`shared/`)

| File | Responsibility |
|---|---|
| `constants.ts` | Tuning values: `MATCH_POINT_TARGET`, `ROUND_DURATION_SECONDS`, `TICK_RATE`, freeze / launch / arena / breach-room sizes, bot name pool |
| `schema.ts` | Player, game, and damage state types reused by client + server |
| `match.ts` | Solo team-size types and bot-fill helpers |
| `match-flow.ts` | Pure `findMatchWinner(score, target)` |
| `player-logic.ts` | Transport-neutral hit classification, launch-power calculation, breach spawn, `findFullFreezeWinner` |
| `multiplayer.ts` | Wire-format types and helpers for Colyseus messages |
| `arena-gen.ts` | Deterministic arena layout (Mulberry32 RNG) |
| `vec3.ts` | Lightweight vec3 math (no Three.js dependency) |
| `profanity.ts` | Call-sign profanity filter |

`shared/` is included via tsconfig `include` on both client and server, so a
single source of truth ships to both runtimes.

---

## Server (`server/src`)

The production server is a Colyseus + Express app on Render.

| File | Responsibility |
|---|---|
| `index.ts` | Express bootstrap: `helmet`, CORS allowlist (`CLIENT_ORIGIN`), rate limit, mount Colyseus transport, expose `/health`, `/wake`, `/rooms` |
| `colyseus/OrbitalLobbyRoom.ts` | Room lifecycle: lobby → ready check → countdown → playing → round-end → match-end, authoritative actor state, hit validation, scoring, bot fill, both win paths, stale-player cleanup |
| `colyseus/state.ts` | `@colyseus/schema` state classes synced to clients |
| `colyseus/actorDamage.ts` | Authoritative damage application |
| `colyseus/roomDirectory.ts` | Public room listing exposed via `/rooms` |
| `room.ts`, `sim.ts`, `player.ts` | Legacy WS sim code retained for tests; the Colyseus path is the production runtime |
| `net/wsServer.ts`, `net/messageCodec.ts` | Legacy raw-WS transport, no longer hit by production clients |

Environment variables consumed by the server:

| Var | Purpose |
|---|---|
| `PORT` | Render-assigned port |
| `CLIENT_ORIGIN` | Allowed CORS origin (the Vercel domain) |
| `PUBLIC_ADDRESS` | Public host advertised in `/rooms` payloads for invite URLs |
| `NODE_ENV` | `production` on Render |

The client picks up `VITE_COLYSEUS_ENDPOINT` at build time. In local dev, the
Vite server proxies `/matchmake` and `/ws` to `localhost:2567` so the same code
paths run in both environments.

---

## Deployment

- **Frontend** — Vercel project pointed at `client/`. `vercel.json` (if present)
  and Vite handle the static build. `@vercel/analytics` and
  `@vercel/speed-insights` are injected by `client/src/main.ts` so Web Analytics
  and Speed Insights light up automatically.
- **Backend** — Render web service running `npm run start --prefix server`
  (compiled by `npm run build --prefix server` during deploy). Render's free
  tier sleeps the dyno; the client hits `/wake` before a join to mitigate cold
  starts.
- **itch.io page** — `https://dotanv.itch.io` embeds the Vercel build in an
  iframe. `client/src/embed.ts` detects the iframe parent and `fullscreen.ts`
  exposes a fullscreen toggle except on iPhone Safari, where non-video
  fullscreen is unsupported.
- **Vibe Jam portal** — when `?portal=true&ref=<url>` is on the URL, the inbound
  return portal in the breach room targets `ref`; the outbound portal in the
  arena always targets `https://vibej.am/portal/2026`.

---

## Mobile / desktop adaptation

`client/src/platform.ts` detects coarse-pointer touch devices. On touch the
client renders `mobileControls.ts` (joystick + look area + action buttons),
hides the keyboard hint overlays, and routes pointer events through the input
layer. The same Three.js scene runs in both modes.

---

## Stale player cleanup

`OrbitalLobbyRoom` tracks per-client liveness. Clients that disconnect during a
round have their seats reclaimed at round end so a returning human or new
join slots back in instead of overfilling the lobby. The same path retires bots
that fill gaps when a human leaves mid-match.
