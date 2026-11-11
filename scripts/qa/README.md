# Animated mesh-hit benchmark

Run `node scripts/qa/animated-mesh-bench.cjs` from any directory with these
environment variables:

- `BENCH_STAGING`: frozen baseline checkout (required).
- `BENCH_HEAD`: candidate checkout; defaults to this repository.
- `BENCH_OUT`: output directory; defaults to gitignored `out/animated-mesh`.
- `BENCH_PLAYWRIGHT`: Playwright module name or installed module path; defaults to `playwright`.
- `BENCH_CHROME`: optional headless Chrome executable; otherwise Playwright's default.
- `BENCH_TRANSFORMS`: optional tiny transform fixture; defaults to `animated-transforms.json` here.
- `BENCH_PROFILE=1`: instrument **unoptimized staging** in memory and run one diagnostic repeat.

The fixture contains only eight actor world transforms extracted from the prior
DOT-129 pose capture. Models and animations load from each checkout's own assets.
No original ObjectLoader dump or machine paths are needed. No packages are installed
by the script. Vite caches and JSON results go under the output directory.

The timing run uses headless Chrome, CDP CPU throttle 4x, eight body+helmet actors,
40 warmup and 240 measured frames, and three staging/head interleaved repeats.
Every frame advances Alien_Swimming by 1/60, restores the right arm, and applies
float arm tilt. Shots target the next actor's live Head, from 0.4 m on -Z along +Z;
misses raise the origin 4 m. Only ProjectileSystem.update is timed. It retains
normal projectile effects and owner/team filtering. Four cases fire every 1/10
frames, either hitting or missing. Raw frames stay in the output directory.

Diagnostic timers are inclusive and add overhead; they are not acceptance timings.
Skin timing covers each surviving patch's entire skinning loop, not individual
vertices. `prepare` includes actor matrix/envelope updates; `query` includes lazy
patch envelopes and skinning. AABB timers cover slab tests, envelope timers cover
influence-box transforms, and triangle timers cover segment tests. Subtract nested
timers to estimate scan/other cost. Counters include owners, meshes, patches,
influence boxes, newly skinned unique vertices, and tested triangles. Warmup
counters are reset before measured frames. Always use the uninstrumented run for
the acceptance targets. The script closes its own browser and Vite server.
