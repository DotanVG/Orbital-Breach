# Orbital Breach

**Vibe Jam 2026 submission.** A zero-gravity team shooter about freezing the enemy squad, slingshotting through a debris arena, and physically breaching the opposing portal before they recover their formation.

[Play Orbital Breach](https://orbital-breach.vercel.app) | [Itch.io](https://dotanv.itch.io) | [Source](https://github.com/DotanVG/Orbital-Breach)

Orbital Breach runs in the browser with no account or install. The game supports solo bot matches, online multiplayer rooms, mobile touch controls, Vibe Jam portal handoff, debrief stats, credits, Vercel Analytics, and Vercel Speed Insights.

## The Match

Two teams, **Team Cyan** and **Team Magenta**, spawn in opposite breach rooms around a zero-G arena. Each round begins from gravity, then players jump, grab rails, charge a launch, and drift through the arena.

The freeze pistol disables enemies for the rest of the round. Limb hits matter: a damaged right arm blocks firing, damaged legs reduce launch power, and a full freeze strands the pilot. A round is won in one of two independent ways:

- **Breach** — a non-frozen player crosses into the enemy breach room through the open portal volume.
- **Full freeze** — every member of the enemy team is frozen at the same time.

Portal doors open at the start of every round, so the breach path is live from the first second — freezing the enemy team is not a prerequisite for breaching, it is its own win condition. Matches are first team to 5 round wins. Rounds have a 120-second hard cap and the online server runs authoritative match state at 20 Hz.

## Playlists

Solo and online share the same team sizes, with mode-specific labels in the UI:

| Team size | Online playlist | Solo menu label | Players |
| --- | --- | --- | --- |
| 1v1 | 1v1 Duel | 1v1 Skirmish | 2 |
| 2v2 | 2v2 Duos | 2v2 Duos | 4 |
| 5v5 | 5v5 Squads | 5v5 Squad Clash | 10 |
| 10v10 | 10v10 Rush | 10v10 Arena Rush | 20 |
| 20v20 | 20v20 War | 20v20 Zero-G War | 40 |

Solo fills every empty seat with AI pilots. Online rooms can be played human-only or filled with bots from the lobby.

## Multiplayer

The main menu has two online entry points:

- **Join Online** starts quick matchmaking with a standard `orbital_lobby` room.
- **Rooms & Invites** opens the server browser for public custom rooms, private/public room creation, invite detection, and direct joins.

Room creation supports:

- Public or private visibility.
- Custom room names up to 24 characters.
- Max player caps derived from the playlist sizes: 2, 4, 10, 20, or 40.
- Shareable invite URLs using the `roomId` query parameter.
- Copy/share buttons and a QR code for joining the exact room.

The online lobby shows:

- Current phase: `Lobby Open`, `Ready Check`, `Round Live`, or `Round Complete`.
- Room name, room id, playlist, round number, and score.
- Team Cyan and Team Magenta rosters with friendly/hostile labels.
- Human and bot seats, ready state, disconnected state, and your own pilot highlight.
- Controls for **Ready Check**, **Move To Cyan/Magenta**, **Fill Lobby**, **Humans Only**, **Settings**, and **Main Menu**.

The countdown starts when each connected human is ready and both teams are filled. Bots can fill open seats immediately, and a later human join reclaims a bot seat instead of overfilling the lobby.

## Controls

| Input | Action |
| --- | --- |
| Mouse | Look around |
| WASD | Walk inside breach rooms |
| E | Grab or release a rail |
| Space | Jump in breach rooms |
| Hold Space while grabbing | Charge launch |
| Mouse movement while charging | Aim launch power |
| Left mouse button | Fire freeze pistol |
| V | Toggle first-person / third-person view |
| B | Hold selfie / look-back view |
| Tab | Hold combat roster / scoreboard |
| Esc | Session menu / release cursor |
| H | Help overlay |

On touch devices, Orbital Breach swaps in mobile controls: a movement joystick in gravity, a look area in zero-G, GRAB, JUMP/LAUNCH, FIRE, and a 1ST/3RD camera toggle.

## Player-Facing Features

- Tutorial mode: an empty arena, bots off, and first-flight guidance.
- Main menu call signs with profanity filtering and local persistence.
- Zero-G rail launch movement with power meter and hit-zone penalties.
- Third-person camera with wall clipping protection.
- Tab scoreboard with team rosters, bot badges, frozen status, and ping columns online.
- Session menu with settings, credits, and safe online exit flows.
- Post-match debrief with final score, pilot stats, and awards.
- Winning-team victory dance animation at match end.
- Credits screen and external project links.
- Vibe Jam portal integration at `https://vibej.am/portal/2026`, including return portals for portal arrivals.
- Landing attribution via Vercel Web Analytics and performance collection via Vercel Speed Insights.

Debrief awards are generated from match stats:

- **Portal Ace** for the top breach scorer.
- **Deep Freeze** for the top freeze scorer.
- **Iron Pilot** for a human pilot who avoids being frozen.
- **Moon Walker** for the most travel distance.

## Current Status

| Feature | Status |
| --- | --- |
| Browser game deployment | Done |
| Solo and online multiplayer | Done |
| Mobile touch controls | Done |
| In-game instructions page | Done |
| Itch.io landing page | Done |
| Fullscreen mode with settings toggle | Done; iPhone Safari disables the toggle because non-video fullscreen is unsupported |

## Tech Stack

| Layer | Technology |
| --- | --- |
| Renderer | Three.js 0.179 |
| Client | TypeScript 5.9, Vite 7 |
| Multiplayer | Colyseus 0.17 |
| Server | Node.js, Express 5, TypeScript |
| Testing | Vitest, 33 test files |
| Frontend hosting | Vercel |
| Backend hosting | Render |
| Analytics | Vercel Web Analytics and Speed Insights |

## Local Development

Prerequisites: Node.js 18+ and npm.

Install dependencies:

```bash
npm install
npm install --prefix client
npm install --prefix server
```

Run the full local stack:

```bash
npm run dev
```

Or run each service separately:

```bash
# terminal 1
npm run dev --prefix server

# terminal 2
npm run dev --prefix client
```

Open [http://localhost:5173](http://localhost:5173). In development, the Vite server proxies `/matchmake` and `/ws` to the Colyseus server on `localhost:2567`.

Useful commands:

```bash
# tests
npm test

# production builds
npm run build --prefix client
npm run build --prefix server
```

Production online multiplayer requires `VITE_COLYSEUS_ENDPOINT` on the client. The server accepts `PORT`, `CLIENT_ORIGIN`, `PUBLIC_ADDRESS`, and `NODE_ENV`.

## Development Tooling

This repo uses an AI-assisted workflow driven by [Symphony](https://github.com/openai/symphony) and [Claude Code](https://docs.anthropic.com/claude-code).

| File / Dir | Purpose |
| --- | --- |
| `WORKFLOW.md` | Symphony orchestration config — defines agents, task routing, and branching rules for [symphony-orchestrator](https://github.com/DotanVG/symphony-orchestrator) |
| `.codex/` | Codex CLI agent skills for automated code tasks |
| `.claude/` | Claude Code config: settings, hooks, shared skills, and worktree setup |

The combination of Linear (issue tracking) + Symphony (orchestration) + Claude Code (implementation) lets you assign tasks from any machine and have agents pick them up, branch, implement, and open PRs without a local dev environment.

## Repository Map

- `client/src/game/gameApp.ts` owns app mode transitions, the render loop, portal flow, solo/online match orchestration, HUD updates, and end-of-match debrief routing.
- `client/src/ui/roomBrowser.ts` implements public room browsing, private/public room creation, invite detection, and direct joins.
- `client/src/ui/multiplayerLobby.ts` implements the online lobby, rosters, ready flow, bot fill controls, invite URL, native share, and QR code.
- `client/src/match/localMatch.ts` runs solo matches with local bots.
- `client/src/match/onlineMatch.ts` reconciles server-authoritative online snapshots.
- `server/src/colyseus/OrbitalLobbyRoom.ts` runs the multiplayer room lifecycle, hit validation, scoring, bot fill, and authoritative actor state.
- `server/src/index.ts` exposes Colyseus rooms plus `/health`, `/wake`, and `/rooms`.
- `shared/` contains match constants, multiplayer messages, arena generation, spawn logic, player hit logic, and shared schemas.
- `tests/` covers physics, arena generation, player logic, multiplayer room behavior, online reconciliation, UI helpers, analytics, portal placement, debrief stats, and regression cases.

## Credits

Audio by **Noam Ouzana**: main theme, hit SFX, laser shots, and countdown audio.
[soundcloud.com/ouzana](https://soundcloud.com/ouzana)

3D assets by **Quaternius**:

- Animated Alien: `Alien.glb` and `Alien_Helmet.glb` for player and bot character rigs.
  [quaternius.com/packs/animatedalien.html](https://quaternius.com/packs/animatedalien.html)
- Sci-Fi Gun Pack: `Ray Gun.glb` for the first-person and third-person freeze pistol.
  [quaternius.com/packs/scifigun.html](https://quaternius.com/packs/scifigun.html)

## More Docs

- [Architecture](docs/ARCHITECTURE.md)
- [Testing](docs/TESTING.md)
