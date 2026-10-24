# Film Mode (development only)

Run `npm run dev --prefix client`, then open `http://localhost:5173/?film=1`.
All pilots are the existing solo bots; the local pilot is parked, hidden and excluded
from targeting, collisions, rosters and win conditions. No multiplayer server is needed.
Production builds ignore film parameters and exclude the dynamically imported director.

| Parameter | Values / default |
| --- | --- |
| `film` | `1` enables only in Vite development |
| `film_camera` | `bot-pov`, `chase` (default), `side-track`, `orbit`, `portal-cam`, `free-fly` |
| `film_target` | `auto` (default), or actor ID such as `bot-cyan-0` |
| `film_director` | `1` enables event direction with a 2.5 second minimum shot |
| `film_hud` | `0` (default) hides UI, `min` shows score/crosshair, `1` retains UI |
| `film_scenario` | `launch` (default), `freeze`, `breach`, `fullfreeze`, `war`, `victory`, `lobby`, `menu` |
| `film_seed` | Safe integer arena/bot seed, default `15` |
| `film_timescale` | `0.1`–`1`, default `1`; `0.5` runs simulation at half speed |
| `film_hold` | `1` holds the simulation while assets and shaders warm up |
| `film_reel` | `1` runs the 47-take capture list; exact take names separated by commas select retakes (e.g. `war_orbit_01,war_orbit_02`) |
| `film_from` | Zero-based reel index for resuming a capture, default `0` |

Keys **1–6** select the cameras in table order. **F** toggles director, **P** holds /
resumes simulation, **R** restarts the preset. Free fly: **WASD**, **Space/Ctrl** up/down,
**Shift** fast, hold **right mouse** to look. These controls never pilot a bot.

Camera position uses exponential follow and orientation uses quaternion slerp.
Chase/side/orbit constrain both the desired mount and final follow segment against
arena collision boxes. POV hides the followed avatar and shows the existing gun.
Simulation uses fixed 120 Hz steps (60 Hz in war) independent of rendering; camera smoothing uses
wall time. Round-end restart/debrief timers retain the game's wall-clock scheduling.

Presets use normal authority, projectile collisions and round scoring. Combat presets
place opposing bots in a combat volume and tune their existing personalities; fullfreeze
starts with all but one enemy frozen. Breach/victory stage a rail anchor by the enemy
portal; victory starts at match point and requires a real bot breach. War uses 20v20.
Lobby stages the real lobby view and QR locally; its room is a visual prop, not joinable.
Menu/lobby are intentionally static UI takes and retain UI regardless of HUD setting.

For capture, use `film_hold=1`, wait for `window.__film.ready`, then call
`window.__film.play()` from local capture tooling. `#film-telemetry` contains JSON
events, actor positions, camera pose and recent render-frame p50/p95 milliseconds.
These are CPU frame intervals, not GPU timings. `window.__film.events` and `frames`
can be saved with the take for event timestamps and pacing review.

Starting capture via **P** or the reel abbreviates the opening countdown to 0.75
simulation seconds. The reel warms each take for at least 180 rendered frames,
then starts automatically. `#film-reel` accumulates a JSON manifest with take names,
UTC start/end milliseconds, seeds, event timestamps and pacing statistics. Record
the headed canvas continuously, then split using this manifest. Director takes
restart after debrief to keep the 90 second capture running. The reel is local
capture tooling and never connects to a server or posts footage anywhere.

Film Mode disables dynamic impact point lights to avoid shader compilation pauses
as the number of active lights changes. Projectile trails, sparks and limb/freeze
glows stay enabled. Normal gameplay retains its original impact lighting.
The director alternates launch/combat viewpoints, queues round/match-end cuts until
the minimum shot length, and uses an orbit/chase fallback after 6.5 seconds without
a cut. War orbits follow the fight centroid; victory cameras move closer for the dance.

Example: `/?film=1&film_scenario=breach&film_camera=side-track&film_timescale=0.5&film_hold=1`.
