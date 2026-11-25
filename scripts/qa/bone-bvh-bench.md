# DOT-129 animated candidate-filter benchmark

Run `node scripts/qa/bone-bvh-bench.cjs` from the checkout root with:

- `BENCH_STAGING`: immutable staging checkout (this run: commit `ef325795b4c6aac2f3c5eb9c78e740605210507e`).
- `BENCH_REFERENCE`: optional immutable tight-hit reference checkout (third variant, between staging and head).
- `BENCH_HEAD`: candidate checkout, defaults to this repository.
- `BENCH_CANDIDATE_SOURCE`: optional frozen runtime overlay preserving `client/src/player/` paths for `hitSurface.ts`, `bindPoseBvh.ts`, `boneBvhClipPads.ts`, and `playerAnimationController.ts`. Adds a separately hashed `candidate` variant without changing a measured checkout.
- `BENCH_OUT`: output directory outside the checkouts, including Vite caches.
- `BENCH_PLAYWRIGHT`: installed Playwright module or module path.
- `BENCH_CHROME`: headless Chrome executable, optional if Playwright's default is installed.
- `BENCH_REPEATS`: positive repetition count (default 3 for acceptance, 1 for head-only diagnostics).
- `BENCH_HEAD_ONLY=1`: exploratory head-only timing; does not produce an acceptance summary.
- `BENCH_TRACE=1`: head-only CDP CPU/GC trace with frame marks, without stage timers.
- `BENCH_PROFILE=1`: diagnostic head-only repeat, injecting nested exclusive stage
  timers in memory and recording CDP CPU samples and GC/User Timing traces.
  Omit for acceptance measurements; instrumentation adds substantial overhead.

The harness starts and closes its own Vite servers and headless browsers. It does
not write any measured checkout. It records source hashes as well as commit
IDs so uncommitted candidates remain identifiable. Staging gets only an in-memory
triangle and prepared bone-palette-entry counters, matching the head's cumulative work counts; no profiling
timers are injected in acceptance mode. Missing instrumentation anchors fail the run.

Eight body/helmet pairs advance `Alien_Swimming` by 1/60 each frame, followed by
`restoreFloatRightArmPose`, `applyFloatArmTilt` and matrix updates. Positions are
the eight tiny transforms from the original pose capture (identity rotations,
x=-10.5 to 10.5 at 3 m intervals). Origins track the next actor's live Head bone,
offset -0.4 m on Z; misses add 4 m on Y. Directions are +Z. Only
`ProjectileSystem.update` is timed, with CDP 4x CPU throttling. Variant order rotates cyclically each repeat, including optional reference and
archived candidate variants. Each repeat uses 40 warmup and 240 measured frames for each
of hit/miss every 1/10 frames. Aggregated percentiles pool 720 frame samples per
case by default. Summaries retain every repeat's mean/p95/p99 and the median of
per-repeat p95 values. Counts exclude warmup and are amortized per spawned shot, including later
projectile travel. Triangles count unique candidate triangles submitted to exact
tests, rather than three independent vertex skinning operations per triangle.

Regenerate the offline diagnostic displacement samples with:

```sh
BONE_BVH_PADDING_OUT=/tmp/bone-bvh-padding.ts node node_modules/vite-node/vite-node.mjs --config vitest.config.ts scripts/qa/measure-bone-bvh-padding.ts
```

This offline pass covers all 15 clips at 30 Hz and applies the FLOATING arm
overlay. The table takes maximum component displacement in bind geometry space
across both assets and includes 10% plus 1e-5. Asset SHA256s are recorded in the
generated table, which is written outside the repo (or to stdout) and is diagnostic only;
the game does not import it.

Production retains the miss-frame actor envelope and its checked transform
budgets. Near rays lazily prepare current bounds once per frame. Four-triangle
flat BVH leaves use tight, cached per-node weight-interval certificates, including
procedural translations/scales and near-unit weight errors. The loose whole-bone
pad is no longer a hit filter. Each tree keeps its own tight joint-space reject
boxes. Their centres/extents are precomputed at load, and each world axis is
lazily cached per pose until a separating slab rejects. Sorted conservative
root entries are refined only as needed, before preparing palettes; the global
closest contact also seeds every flat-tree traversal. Palettes, inverse matrices
and rays are shared across primitives.
Child events invalidate hierarchy caches; unframed calls retain signature scans.

At load, actual registered asset clips are sampled on a detached clone at 4 Hz
with per-node maximum displacement plus 10% and 1e-5. Shared asset geometries
reuse samples. This bounded trial cannot prove between-sample/crossfade/overlay
conservativeness. Only exactly unit-weight owner-rigid nodes have a separate
analytic proof; they intersect the sampled box with the tighter rigid certificate.
Every blended node keeps runtime certificates, so samples never loosen candidate
selection. Live mixers/poses are unchanged. Sampling happens before measurement.

BVHs store outward-rounded Float32 bounds, Int32 children/leaf ranges and Uint32
triangle IDs. Reusable typed stacks, inverse-direction slabs and near-first
contact pruning retain exact native CPU skinning and mesh/triangle ordering.
Integer root-sort results avoid fractional comparator allocations.
Reusable byte flags and triangle lists deduplicate candidates; callbacks, hit
results and final surface views can still allocate.
Neither an envelope nor a sampled pad awards a hit.

Large repeat/frame JSON belongs only in `BENCH_OUT`. Do not commit it.
