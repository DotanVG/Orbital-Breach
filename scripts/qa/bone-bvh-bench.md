# DOT-129 animated candidate-filter benchmark

Run `node scripts/qa/bone-bvh-bench.cjs` from the checkout root with:

- `BENCH_STAGING`: immutable staging checkout (this run: commit `ef325795b4c6aac2f3c5eb9c78e740605210507e`).
- `BENCH_HEAD`: candidate checkout, defaults to this repository.
- `BENCH_OUT`: output directory outside the checkouts, including Vite caches.
- `BENCH_PLAYWRIGHT`: installed Playwright module or module path.
- `BENCH_CHROME`: headless Chrome executable, optional if Playwright's default is installed.
- `BENCH_PROFILE=1`: diagnostic head-only repeat, injecting nested exclusive stage
  timers in memory and recording CDP CPU samples and GC/User Timing traces.
  Omit for acceptance measurements; instrumentation adds substantial overhead.

The harness starts and closes its own Vite servers and headless browsers. It does
not write either measured checkout. It records source hashes as well as commit
IDs so uncommitted candidates remain identifiable. Staging gets only an in-memory
triangle counter, matching the head's cumulative candidate count; no profiling
timers are injected in acceptance mode. Missing instrumentation anchors fail the run.

Eight body/helmet pairs advance `Alien_Swimming` by 1/60 each frame, followed by
`restoreFloatRightArmPose`, `applyFloatArmTilt` and matrix updates. Positions are
the eight tiny transforms from the original pose capture (identity rotations,
x=-10.5 to 10.5 at 3 m intervals). Origins track the next actor's live Head bone,
offset -0.4 m on Z; misses add 4 m on Y. Directions are +Z. Only
`ProjectileSystem.update` is timed, with CDP 4x CPU throttling. Each of three
interleaved staging/head repeats uses 40 warmup and 240 measured frames for each
of hit/miss every 1/10 frames. Aggregated percentiles pool 720 frame samples per
case. Counts exclude warmup and are amortized per spawned shot, including later
projectile travel. Triangles count unique candidate triangles submitted to exact
tests, rather than three independent vertex skinning operations per triangle.

Regenerate the offline diagnostic displacement samples with:

```sh
node node_modules/vite-node/vite-node.mjs --config vitest.config.ts scripts/qa/measure-bone-bvh-padding.ts
```

This offline pass covers all 15 clips at 30 Hz and applies the FLOATING arm
overlay. The table takes maximum component displacement in bind geometry space
across both assets and includes 10% plus 1e-5. Asset SHA256s are recorded in the
generated module. Sampling is diagnostic only. Production computes conservative
per-bone pads at load from skin weights, joint-space vertex distances and bone
chain translation/scale budgets. The triangle inequality covers every rotation,
including between-sample and procedural poses. A once-per-frame budget check
allows far misses to skip hierarchy signatures and live pose bounds. Near rays
prepare the current AABB lazily. Translation/scale outside the load-time budget
uses a conservative root weight bound once per bone and pose; there is no
per-node certificate walk. Child events invalidate hierarchy caches, and
unframed/debug calls retain full signature invalidation.

BVHs store outward-rounded Float32 bounds, Int32 children/leaf ranges and
Uint32 triangle IDs. Leaves hold up to 16 triangles (8-16 after median splits),
with reusable typed stacks, inverse-direction slabs and near-first contact
pruning. Traversal itself allocates no objects or leaf views; exact hit results,
candidate Sets and final surface views can still allocate. Neither envelope
awards a hit. Exact tests retain native CPU skinning and mesh/triangle ordering.

Large repeat/frame JSON belongs only in `BENCH_OUT`. Do not commit it.
