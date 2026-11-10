# Animated projectile benchmark

Run `node scripts/qa/frame-compare-animated.cjs` from any directory. Node 22,
the existing client dependencies in each checkout, Playwright and its headless
Chromium are required. No dependencies are added by this harness.

All paths are resolved from the script location or explicit environment values:

| Variable | Default |
| --- | --- |
| `OB_HARNESS_HEAD_ROOT` | This repository |
| `OB_HARNESS_SPHERE_ROOT` | Sibling `ob-tickbench-base`, frozen at `36f81cc` |
| `OB_HARNESS_STAGING_ROOT` | Sibling `ob-dot129-staging-5826a03`, frozen at `8e14f19` |
| `OB_HARNESS_OUT_DIR` | This repository's gitignored `dist/qa-animated` |
| `OB_HARNESS_POSES` | Adjacent `actor-placements.json` |
| `OB_HARNESS_PLAYWRIGHT` | Resolve `playwright` from head's client dependencies; override with a module directory or entry file |
| `OB_HARNESS_CHROME` | Playwright's bundled Chromium; override with an executable |
| `PLAYWRIGHT_BROWSERS_PATH` | Playwright's standard environment variable, inherited unchanged |

The fixture contains only eight world positions/quaternions extracted from the
earlier browser pose capture. Models come from each variant's own public assets.
The sphere adapter calls that checkout's `projectileBodyTarget` with FLOATING
and supplies `pos`/`radius` to its original ProjectileSystem; it never imports
the mesh query. Sphere callbacks have no zones and are counted as unclassified.

One invocation measures sphere, staging mesh, head in that order, repeated three
times. Each variant uses a fresh headless browser and Vite server. Every case
advances Alien_Swimming by 1/60 plus restoreFloatRightArmPose/applyFloatArmTilt,
aims from the next actor's live Head (-0.4 Z; misses +4 Y), and fires +Z.
The original reference's continuous animation between cases and warmup hit
counting boundary are preserved. CPU throttle is 4x; setup is outside the timer.

Outputs: aggregate `FRAME_COMPARE_ANIMATED.json`, Markdown timing/zone tables
in `ANIMATED_SUMMARY.md`, and per-repeat frame samples. Do not commit outputs.
Frozen SHAs/clean trees, eight placements, sample counts and browser errors are
checked. Acceptance is reported without retries or relaxed thresholds. Browser
and server cleanup runs even on measurement failures. This measures CPU collision
work; visual, device, iOS and audio QA are separate.
