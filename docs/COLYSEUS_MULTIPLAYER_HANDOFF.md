# Colyseus Multiplayer Handoff

This document explains what is already implemented on `feature/add-colyseus-multiplayer`, how to run and test it locally, and what Claude should do next to continue the multiplayer rollout.

## Current Branch Status

The branch now includes the full first-milestone Colyseus multiplayer slice **plus a working online match loop**:

- `PLAY ONLINE` exists beside `PLAY SOLO`
- the client joins one Colyseus room named `orbital_lobby`
- the lobby supports: join, roster display, ready/unready, switch team, team-size changes, fill bots, clear bots, countdown
- **when countdown completes, the server transitions to `PLAYING` and the client enters the actual game world**
- **remote players are rendered as SimulatedPlayerAvatar (alien + pistol, same as solo bots)**
- **local player state is sent to server at 20hz**
- **server relays actor snapshots (pos/yaw/phase/damage) to all clients via Colyseus state sync**
- **hit reports: when you shoot a remote actor, `hit_report` is sent; server applies freeze and broadcasts `freeze_event`**
- **breach reports: when you walk through the enemy portal, `breach_report` is sent; server awards the point and sends `round_win_event`**
- **full freeze win: when all actors on one team are frozen, the server detects this and ends the round**
- **round timer: when 120s expires, the server ends the round**
- **round end: HUD shows result, server transitions back to `LOBBY` after 4s, lobby overlay reappears**
- solo offline mode is unchanged and still uses the existing local match path

## Key Files

- Shared contract: [shared/multiplayer.ts](</B:/Code/Github Clones/DotanVG/Zero-G-Arena/shared/multiplayer.ts>)
- Server entry: [server/src/index.ts](</B:/Code/Github Clones/DotanVG/Zero-G-Arena/server/src/index.ts>)
- Colyseus room: [server/src/colyseus/OrbitalLobbyRoom.ts](</B:/Code/Github Clones/DotanVG/Zero-G-Arena/server/src/colyseus/OrbitalLobbyRoom.ts>)
- Colyseus state: [server/src/colyseus/state.ts](</B:/Code/Github Clones/DotanVG/Zero-G-Arena/server/src/colyseus/state.ts>)
- Client network layer: [client/src/net/client.ts](</B:/Code/Github Clones/DotanVG/Zero-G-Arena/client/src/net/client.ts>)
- Online match manager: [client/src/match/onlineMatch.ts](</B:/Code/Github Clones/DotanVG/Zero-G-Arena/client/src/match/onlineMatch.ts>)
- Lobby overlay UI: [client/src/ui/multiplayerLobby.ts](</B:/Code/Github Clones/DotanVG/Zero-G-Arena/client/src/ui/multiplayerLobby.ts>)
- Menu wiring: [client/src/ui/menu.ts](</B:/Code/Github Clones/DotanVG/Zero-G-Arena/client/src/ui/menu.ts>)
- App mode routing: [client/src/game/gameApp.ts](</B:/Code/Github Clones/DotanVG/Zero-G-Arena/client/src/game/gameApp.ts>)
- Regression test: [tests/multiplayer.test.ts](</B:/Code/Github Clones/DotanVG/Zero-G-Arena/tests/multiplayer.test.ts>)

## Architecture Summary

### Server (`OrbitalLobbyRoom`)

When the lobby countdown completes, `startRound()`:
1. Increments `roundNumber` (used as deterministic arena seed on both sides)
2. Calls `spawnActors()`: creates `ActorState` entries for all lobby members at their breach room spawn positions
3. Starts a 20hz bot tick and a 1hz round timer
4. Transitions phase to `PLAYING`

During `PLAYING`:
- Human clients send `player_update` (pos, vel, yaw, phase, damage flags, kills, deaths) — server updates their `ActorState`
- Human clients send `hit_report` (targetId, impulse) — server freezes the target, broadcasts `freeze_event`, checks full-freeze win
- Human clients send `breach_report` (scorerTeam, scorerName) — server awards point, broadcasts `round_win_event`, schedules `finishRound()`
- Bot actors (passive) rotate yaw slowly; respawn after 5s when frozen
- All actor state syncs automatically to all clients via Colyseus delta encoding

When round ends (timer, breach, or full freeze):
- `finishRound()` clears all actors, resets readiness, transitions to `ROUND_END`
- After 4s: transitions back to `LOBBY` and unlocks room

### Client (`gameApp.ts`)

The app tracks `appMode: "menu" | "solo" | "online"` and `onlineGameActive: boolean`.

- When `net.onStateChange` fires with `phase → PLAYING` (and wasn't already PLAYING), `startOnlineGame(snapshot)` is called:
  - Generates the same arena as server using `generateArenaLayout(roundNumber)`
  - Resets local player at their breach room spawn
  - Opens portal doors immediately (countdown already done server-side)
  - Hides lobby overlay, shows game HUD + kill feed
- While `onlineGameActive`: `tickOnlineGame(dt)` runs each frame:
  - Full player physics/input (same as solo)
  - Remote actor avatars ticked and rendered (`OnlineMatch.update`)
  - Projectiles checked against local player + remote actor targets
  - Hits on remote actors → `net.sendHitReport()`
  - Breach detection → `net.sendBreachReport()`
  - Player state → `net.sendPlayerUpdate()` at 20hz
  - HUD driven from latest server snapshot (round time, score, roster)
- When `net.onStateChange` fires with `phase → LOBBY` (after ROUND_END), `endOnlineGame()` is called:
  - Cleans up `OnlineMatch`, clears projectiles
  - Hides game HUD, shows lobby overlay again

### `OnlineMatch` class

Manages `SimulatedPlayerAvatar` instances for all remote actors (excluding the local player by sessionId). On each snapshot: adds new avatars, removes departed ones, ticks animations.

## Dependencies Already Added

Server:
- `@colyseus/core`
- `@colyseus/schema`
- `@colyseus/ws-transport`
- `express`

Client:
- `colyseus.js`

## How To Run Locally

Start the server:

```powershell
cd "B:\Code\Github Clones\DotanVG\Zero-G-Arena\server"
npm run dev
```

Start the client in another terminal:

```powershell
cd "B:\Code\Github Clones\DotanVG\Zero-G-Arena\client"
npm run dev
```

If port `3001` is already occupied, start the server on another port:

```powershell
cd "B:\Code\Github Clones\DotanVG\Zero-G-Arena\server"
$env:PORT="3011"
npm run dev
```

Then start the client with an explicit server URL:

```powershell
cd "B:\Code\Github Clones\DotanVG\Zero-G-Arena\client"
$env:VITE_SERVER_URL="http://localhost:3011"
npm run dev
```

## Quick Server Check

The server exposes a health route:

```powershell
Invoke-RestMethod http://localhost:3001/health
```

Expected response shape:

```json
{"ok":true,"transport":"colyseus","room":"orbital_lobby"}
```

## What Claude Should Test Next (Human Browser Verification)

This implementation needs local browser testing. The best approach is to open **two browser tabs** pointing to `http://localhost:5173`:

1. Tab A: Click `PLAY ONLINE`, enter name "Pilot A" → lobby appears
2. Tab B: Click `PLAY ONLINE`, enter name "Pilot B" → same lobby appears with both players
3. From one tab: click `Fill Bots`, observe rosters fill
4. Both tabs: click `Ready Up`
5. Observe countdown starts, then both clients enter the game world
6. Verify remote players are visible as alien meshes in the arena
7. Fire at remote player → observe freeze in both tabs
8. Walk through enemy portal → round ends in both tabs
9. Observe "CYAN WINS" / "MAGENTA WINS" shown in both tabs
10. After 4 seconds, lobby overlay returns in both tabs

## Known Limitations

- **Bot AI**: online bots are passive (static + slow yaw rotation in their breach rooms). They don't navigate the arena. They exist as freeze targets for players who breach.
- **Remote projectile visuals**: shots from remote players are NOT rendered visually. Hits are still applied via the server's `freeze_event`. Only local player's shots produce visible projectiles.
- **No client-side hit zone logic for remote hits**: server applies a full freeze on any hit report (no arm/leg differentiation for server-side hits).
- **No reconnect support**: disconnecting mid-match sends you back to the main menu.
- **Old raw WebSocket server files** (`server/src/room.ts`, `server/src/sim.ts`, `server/src/player.ts`, `server/src/net/`) still exist in the repo as leftover legacy code. They can be removed once the Colyseus path is verified working.

## Recommended Next Steps After Human Verification

1. **Remote projectile visuals**: when server emits a "shoot" event (not yet implemented), client spawns a visual projectile from the shooter's actor position/yaw.
2. **Bot AI on server**: port simplified bot brain to the server to make online bots navigate and shoot.
3. **Hit zone differentiation**: pass hit zone in `hit_report` so arm/leg hits work online.
4. **Remove legacy WebSocket files**: `server/src/room.ts`, `server/src/sim.ts`, `server/src/player.ts`, `server/src/net/` are all dead code now.
5. **Reconnect support**: Colyseus supports reconnect via `allowReconnection()` in `onLeave`.
6. **Remote deployment**: once local verification passes, see deployment section below.

## Notes For Claude

- Arena layout is deterministic: both client and server call `generateArenaLayout(roundNumber)` with the same seed. The client uses it to generate the arena; the server uses it to compute breach room spawn positions.
- The `Room<{ state: OrbitalLobbyState }>` generic is required by Colyseus 0.17. Do not change to `Room<OrbitalLobbyState>`.
- Mode boundary in `gameApp.ts`: `appMode === "online"` and `onlineGameActive === true` means the 3D game is running. `appMode === "online"` with `onlineGameActive === false` means the lobby overlay is showing.
- `PLAY SOLO` path is entirely untouched by this change. Solo uses `tickSoloGame`, online uses `tickOnlineGame`.
