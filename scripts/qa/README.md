# DOT-129 frame harness notes

Machine-local follow-up scripts for mesh hit cost. Paths are hard-coded for Nova (`C:\Users\dotan\...`).

- `frame-compare-animated.cjs` — FLOATING (`Alien_Swimming`) mixer ticked every frame, 8 actors, headless Chrome 4x CPU throttle, `ProjectileSystem.update` only. Compares pre-merge staging `86012ba` (`C:\Users\dotan\src\ob-dot129-staging-mesh`) against PR 238 head `2c961b7` (`C:\Users\dotan\src\ob-dot129-hit-perf`).
- `ANIMATED_SUMMARY.md` — results from the 2026-11-10 20:57 IST Nova run (3 interleaved repeats, 40 warmup + 240 measured frames).

The original static-pose harness remains in `C:\Users\dotan\terminals\local-agents\nova-ob-dot129\frame-compare.cjs` and was not copied here.
