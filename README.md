# ORBITAL BREACH

**Zero-gravity arena shooter — Vibe Game Jam 2026.**

Two teams fight in a floating debris field. Freeze your enemies with a cryo-pistol. If an entire team is frozen, their breach portal opens. Be the first player to physically float through it to score. First team to five round wins takes the match.

No install. No login. [**Play now →**](https://orbital-breach.vercel.app) · [**itch.io →**](https://dotanv.itch.io)

---

## How To Play

### Objective

Float through the enemy team's open breach portal to score a round win. A portal only opens when **all enemies on that team are frozen**. Freeze them with your pistol, then breach.

### Controls

| Input | Action |
|---|---|
| `Mouse` | Look around (zero-G free-look / breach-room yaw+pitch) |
| `WASD` | Walk inside breach rooms |
| `E` | Grab a bar / release |
| `Space` | Jump in breach room · Hold while grabbing to charge launch |
| `LMB` | Fire freeze pistol |
| `V` | Toggle third-person view |
| `B` | Hold for selfie view |
| `Tab` | Hold to show combat roster / scoreboard |
| `Esc` | Open session menu / release cursor |

Touch controls are available on mobile — a virtual joystick, grab button, jump/launch button, and fire button appear automatically when a touch device is detected.

### Match Modes

Choose a size from the main menu then pick **Solo** (bots fill all slots) or **Online** (real players + bot fill):

| Mode | Team size |
|---|---|
| 1v1 Skirmish | 1 vs 1 |
| 2v2 Clash | 2 vs 2 |
| 5v5 Squad | 5 vs 5 |
| 10v10 Arena Rush | 10 vs 10 |
| 20v20 Zero-G War | 20 vs 20 |

You always play for Team Cyan. The match ends when one team wins 5 rounds.

---

## Running Locally

**Prerequisites:** Node.js 18+

```bash
# Server (terminal 1)
cd server && npm install && npm run dev

# Client (terminal 2)
cd client && npm install && npm run dev
```

Open [http://localhost:5173](http://localhost:5173). The Vite dev server proxies `/ws` → `ws://localhost:3001` automatically.

```bash
# Tests (from repo root)
npx vitest run

# TypeScript checks
cd client && node_modules/.bin/tsc --noEmit
cd server && node_modules/.bin/tsc --noEmit
```

### Build

```bash
cd client && npm run build
cd server && npm run build
```

---

## Architecture

### Client (`client/`)

Vite + Three.js + TypeScript. The top-level `App` in `client/src/game/gameApp.ts` owns the render loop and switches between **menu**, **solo**, and **online** app modes. Match coordination is split into `localMatch` (solo bots, fully client-authoritative) and `onlineMatch` (server-authoritative via Colyseus). The bot brain in `client/src/match/botBrain.ts` runs five AI archetypes with bar routing, enemy targeting, and breach-room navigation. HUD, kill feed, lobby, debrief, and tutorial are all DOM layers injected over the Three.js canvas.

### Server (`server/`)

Express + Colyseus 0.17 + TypeScript. `OrbitalLobbyRoom` manages the full match lifecycle (LOBBY → COUNTDOWN → PLAYING → ROUND_END), authoritative actor sync at 20 Hz, hit validation, breach scoring, and server-side bot AI. Cold-start wake logic is handled client-side via `wakeBackend()`.

### Shared (`shared/`)

Imported by both sides. `schema.ts` is the wire contract. `constants.ts` holds all tuning values. `arena-gen.ts` generates a deterministic obstacle layout from a seed (Mulberry32 RNG). `player-logic.ts` holds transport-neutral hit classification and spawn helpers.

---

## Current Status

| Feature | Status |
|---|---|
| Zero-G movement — grab bars, charge launch, float | ✅ Done |
| Breach rooms with gravity + portal doors | ✅ Done |
| Freeze pistol — hit zones (torso/arms/legs), damage state | ✅ Done |
| Solo mode with intelligent AI bots (5 archetypes) | ✅ Done |
| Match sizes — 1v1 / 2v2 / 5v5 / 10v10 / 20v20 | ✅ Done |
| Best-of-5-rounds match format | ✅ Done |
| Online multiplayer — Colyseus lobby + live match | ✅ Done |
| Online bot fill for partial lobbies | ✅ Done |
| Team-based lobby with ready status | ✅ Done |
| HUD — kill feed, damage indicators, round timer, launch bar | ✅ Done |
| Tab scoreboard (friendly frozen status / enemy roster) | ✅ Done |
| Sound system — music, SFX, 3D positional audio | ✅ Done |
| Tutorial (first-time guidance prompts) | ✅ Done |
| Mobile controls — virtual joystick, touch buttons | ✅ Done |
| Vibe Jam portal integration | ✅ Done |
| Vercel (frontend) + Render (backend) deployment | ✅ Done |
| Post-match debrief with stats & awards | 🔄 In staging |
| Room browser, private lobbies, invite links | 🔄 In staging |
| Credits page + GitHub/itch.io links | 🔄 In staging |
| Victory dance animation for winning team | 🔄 In staging |
| Vercel Web Analytics + landing attribution | 🔄 In staging |

---

## Coming Soon — Open PRs

These are actively in review and will land on `staging` / `main` shortly:

| PR | Title |
|---|---|
| [#72](https://github.com/DotanVG/Orbital-Breach/pull/72) | Fix desktop scoreboard cursor handling (Tab releases pointer lock, shows cursor) |
| [#71](https://github.com/DotanVG/Orbital-Breach/pull/71) | Hide desktop debrief scrollbar while preserving mouse-wheel scrolling |
| [#70](https://github.com/DotanVG/Orbital-Breach/pull/70) | Tune Vite client chunk size warning threshold for Three.js bundle |
| [#69](https://github.com/DotanVG/Orbital-Breach/pull/69) | Debrief stats tracking and awards (breaches, freezes, travel, Iron/Moon Walker) |
| [#68](https://github.com/DotanVG/Orbital-Breach/pull/68) | Show crosshair cursor on ESC session menu and Tab combat roster |
| [#67](https://github.com/DotanVG/Orbital-Breach/pull/67) | Vercel Web Analytics + landing source attribution (`/?ref=vibejam` etc.) |
| [#66](https://github.com/DotanVG/Orbital-Breach/pull/66) | Room browser, private lobbies, and invite sharing (URL + QR) |
| [#65](https://github.com/DotanVG/Orbital-Breach/pull/65) | Credits page + GitHub and itch.io external links in main menu |
| [#64](https://github.com/DotanVG/Orbital-Breach/pull/64) | AI-facing `llms.txt` site context for judges and crawlers |
| [#63](https://github.com/DotanVG/Orbital-Breach/pull/63) | Place tutorial Vibe Jam return portal on breach-room back wall |
| [#62](https://github.com/DotanVG/Orbital-Breach/pull/62) | Fix portal tab behavior — open in new tab, fix return portal placement |
| [#61](https://github.com/DotanVG/Orbital-Breach/pull/61) | Victory dance animation for unfrozen winners at match end |
| [#60](https://github.com/DotanVG/Orbital-Breach/pull/60) | Fix stale online player cleanup when leaving rooms |

---

## Tech Stack

| Layer | Technology |
|---|---|
| Renderer | [Three.js](https://threejs.org) 0.179 |
| Client | TypeScript 5.9, Vite 7 |
| Multiplayer | [Colyseus](https://colyseus.io) 0.17 |
| Server | Node.js, Express 5, TypeScript |
| Testing | Vitest (23 test files) |
| Frontend hosting | Vercel |
| Backend hosting | Render |

---

## Audio Credits

Music and sound effects by **Noam Ouzana** — [soundcloud.com/ouzana](https://soundcloud.com/ouzana)

- Orbital Breach — Main Theme (Sketch #1)
- Laser #1, Laser #2
- Countdown

---

## Docs

- [Architecture](docs/ARCHITECTURE.md) — module map and responsibilities
- [Testing](docs/TESTING.md) — Vitest setup, patterns, and test conventions
