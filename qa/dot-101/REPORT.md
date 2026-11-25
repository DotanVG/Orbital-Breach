# DOT-101 — bar-hold animation

Agent: Mario  
QA: pending Sherlock  
PR: https://github.com/DotanVG/Orbital-Breach/pull/218 (draft; base `staging`)

## Result and confirmed cause

The shared hold pose no longer accumulates rotation. Each loaded rig captures its frame-zero `Alien_Standing` quaternions once; `applyBarHoldPose` restores the 14 affected bones before applying the existing tuned offsets. The right-arm bones are excluded. No gameplay, damage, input, protocol, or server code changed.

The confirmed mechanism was additive quaternion accumulation, not an angle-wrap or bar-attachment error. `applyBarHoldPose` used `bone.quaternion.multiply(offsetQuat)` without restoring a base. `SimulatedPlayerAvatar.update` calls it every held frame after the animation mixer. In installed Three.js 0.179, `PropertyMixer.apply` only writes a bound property when consecutive accumulated animation values differ. Constant tracks therefore leave the previous procedural offset in place; the next multiplication adds another rotation.

Before fixing, a headless browser loaded the actual Alien GLB and traced 600 mixer/hold frames. The shoulder advanced **1.087 radians (about 62.3 degrees) per frame** after settling. The unmodified avatar path reproduced this in both desktop and mobile browser contexts. After fixing, the affected left-arm quaternion components remain identical across samples, including consecutive frames. The tiny angle calculated from normalized identical floating-point quaternions is below `6e-8` radians; component equality is asserted directly.

**Reproduction boundary:** the baseline local player's steady hold already skips mixer/pose updates once locked, and continuous spinning was not reproduced in that specific path. The confirmed propeller occurs in the shared avatar presentation path. Both paths use the fixed helper. Local hold, aim, launch and re-grab pass after the fix, but Sherlock must check the exact originally reported local-view scenario. This report does not claim that every detail of the ticket's original local symptom was reproduced.

## Required working method and evidence

1. **Systematic debugging:** reproduced and measured before editing production code; traced local and avatar call sites, their mixer ownership, and installed Three.js `src/animation/PropertyMixer.js`. Hypothesis: unchanged animation tracks skip resetting additive offsets. The actual-asset trace and consecutive avatar shoulder quaternions verified it before the fix. Evidence: `diagnosis-before.json`, `diagnosis-summary-before.txt`, and `before/results.json`.
2. **Test-driven development:** added `tests/playerGrabPose.test.ts` first. With original production code, three tests failed and one passed (`tdd-red.txt`). After the fix, all four passed (`tdd-green.txt`). The tests use quaternion-only input objects, with no scene graph, renderer, DOM or network.
3. **Verification before completion:** ran the full suite, both required typechecks, both production builds, browser transition/damage checks, and the golden path through the real solo game tick. Results and limitations follow below.

Applied skill: [investigate-first](C:/Users/dotan/.codex/plugins/cache/caveman/caveman/4.1.0/skills/investigate-first/SKILL.md). Read the repository [Graphify adapter](../../.agents/skills/graphify/SKILL.md) and its canonical runbook; `node scripts/graphify.mjs status` reported the optional graph absent, so no graph was built or committed. No structural refactor or new feature was introduced.

## Files changed

- `client/src/player/playerAnimationController.ts`: capture a stable standing reference at rig registration, before procedural poses/crossfades.
- `client/src/player/playerTypes.ts`: store the reference on each rig.
- `client/src/player/playerGrabPose.ts`: restore only hold bones before applying the existing offsets and tuning.
- `tests/playerGrabPose.test.ts`: four regressions covering 600 repeated applications, return from another pose, right-arm/reference preservation, and nonzero tuning applied once.
- `tests/playerVictoryDance.test.ts`: satisfy the new rig field in its existing fixture.
- `README.md`: update Current Codebase Coverage.
- `qa/dot-101/REPORT.md`: this handoff. Large evidence files remain outside Git.

## Checks

| Check | Result | Evidence under the evidence root |
|---|---|---|
| `npm test` | PASS — 76 files, 570 tests | `full-tests.txt` |
| `client/node_modules/.bin/tsc --noEmit -p client/tsconfig.json` | PASS | `client-typecheck.txt` |
| `server/node_modules/.bin/tsc --noEmit -p server/tsconfig.json` | PASS | `server-typecheck.txt` |
| `npm run build --prefix client` | PASS | `client-build.txt` |
| `npm run build --prefix server` | PASS | `server-build.txt` |
| `git diff --check` | PASS | checked before commits |
| Lint | N/A — no lint script/config in this repo | package scripts and PROVENANCE reviewed |
| Extra `tsconfig.test.json` typecheck | FAIL, pre-existing — 9 diagnostics in unchanged rate-limit tests | `test-typecheck.txt` |
| Baseline vs current test typecheck | PASS — exactly identical 9 diagnostics | `test-typecheck-baseline-comparison.json` |
| Headless desktop Chromium | PASS | `after/results.json` |
| Headless Chromium with mobile viewport/touch | PASS | `after-mobile/results.json` |

The extra baseline comparison substituted original Git blobs in a TypeScript compiler host and omitted the new test; it did not revert or rewrite working files. Required client/server typechecks are clean. No unrelated rate-limit tests were edited.

## Browser acceptance coverage

Desktop used real E/Space keyboard events and pointer-locked mouse input. Mobile used an 844×390 Chromium context with `hasTouch`/`isMobile`, taps on the existing GRAB control, and CDP touch down/move/up on LAUNCH and FIRE. No Android emulator or physical device was started.

- **PASS:** grab → held samples after 60, 300 and 600 additional updates → aim while attached → charged launch → release/re-grab → eight more release/re-grab cycles. Left-arm quaternion components match the original held snapshot exactly after the fix.
- **PASS:** 240 turning frames while attached. Measured hand/bar world-position error stayed below **8e-9 world units**, on desktop and emulated touch. Actual local-rig/bar close-ups were visually inspected.
- **PASS:** left-arm hits in both GRABBING and AIMING release the bar, prevent re-grab, and leave firing available when the right arm is healthy. Mobile hides GRAB while impaired; an additional programmatic grab request verifies the underlying rule still rejects it.
- **PASS:** right-arm hits leave the current grab/aim attached and grabbing available while disabling fire. Existing shared damage/online-grab tests also pass in the full suite.
- **PASS:** real `tickSoloGame` golden path: held fire spawned 11 local shots in 120 fixed 1/60-second updates; aim power reached 6; releasing launched at speed 6; crossing the enemy's open portal produced player phase BREACH, round phase ROUND_END, score 1–0, and a `roundWin` event with reason `breach`, while an enemy remained unfrozen. Desktop and emulated touch both passed.
- **PASS:** no console errors or page exceptions in the successful before/after runs.

The fixture pauses automatic simulation for repeatable frame measurements and stages the player near an existing arena bar. Close-ups hide unrelated obstacle meshes and use an inspection lens so the grip is visible. Golden-path checks restore the game scene and use the real solo tick, input, collision, scoring and camera code. Before screenshots use baseline Git blobs through an in-memory Vite loader; production files were not temporarily reverted.

Test-harness issues resolved during verification: concurrent Vite instances initially shared an optimization cache (504); isolated cache directories removed that interference. Mobile damage checks initially tried tapping an intentionally hidden GRAB button; the driver now checks visibility and refreshes controls after staged state changes. A first breach attempt ran before the existing door animation crossed its open threshold; advancing `Arena.update` before crossing fixed the fixture. These were not product changes.

## Evidence and reproduction

Evidence root: **`B:\Code\OB-DOT101-run\qa\dot-101\evidence\`**.

- `before/` and `after/`: `local-grab.png`, `local-hold-60.png`, `local-hold-300.png`, `local-hold-600.png`, `local-aim.png`, `local-launch.png`, `local-regrab.png`, `local-regrab-9.png`, six avatar frame samples, and `results.json`.
- `before-mobile/` and `after-mobile/`: equivalent touch-context evidence.
- `after/` and `after-mobile/`: `golden-hold.png`, `golden-aim.png`, `golden-launch.png`, `golden-breach-win.png`.
- `metrics.json`: compact measured before/after comparison, damage results, golden-path state/events and cleanup flags.
- TDD, full-check, diagnostic and cleanup logs are in the evidence root; `SHA256SUMS.json` inventories the artifacts.

Drivers stay in the authorized run folder: `bar-hold-qa.mjs`, `diagnose.mjs`, `summarize.mjs`, and `baseline-test-typecheck.mjs`. Playwright and its headless browser were installed only there, without changing project dependencies. Example:

```powershell
$env:PLAYWRIGHT_BROWSERS_PATH='B:\Code\OB-DOT101-run\browsers'
node B:\Code\OB-DOT101-run\bar-hold-qa.mjs before
node B:\Code\OB-DOT101-run\bar-hold-qa.mjs after
node B:\Code\OB-DOT101-run\bar-hold-qa.mjs before-mobile --mobile
node B:\Code\OB-DOT101-run\bar-hold-qa.mjs after-mobile --mobile
```

## Reuse decision and limits

Reviewed installed Three.js README/MIT license and animation source, the repository's existing canonical right-arm/victory-pose patterns, `PROVENANCE.md`, and [official animation documentation](https://threejs.org/manual/pages/animation-system.html). Reused native quaternion copy/multiply operations. Restoring selected bone bases avoids cancelling/resetting entire mixers every frame. No new runtime library, vendored source, asset, shared package or shared config was added. Sibling checkouts were not inspected because this task explicitly restricted work to the named worktree/run folder.

**NOT TESTED:** physical Android/iPhone, Safari/WebKit/Firefox, live remote multiplayer view, live-server latency/reconciliation of the visual change, and Node 22. Atlas's available runtime was Node 25.9.0 / npm 11.12.1; npm warned that the manifests target 22.x. Successful builds and tests here do not replace Sherlock's browser/device review. The asset-level avatar check does not claim remote hand/bar attachment accuracy.

## Branch, publication and cleanup

- Worktree: `B:\Code\OB-DOT101`, exclusively.
- Branch: `dotanvg/dot-101-fix-broken-bar-hold-animation-hand-spins`.
- Baseline: `origin/staging` at `92afc450be17298b9104e04203bf8b3203aac3be`; remote staging remained at that SHA during the run.
- Implementation commit: `d64cf80`.
- Pushed using the explicitly requested `git push -u origin dotanvg/dot-101-fix-broken-bar-hold-animation-hand-spins`; upstream is now this feature branch.
- Draft PR #218 targets `staging`; no merge or deployment was performed.
- Every owned Vite server and headless Chromium instance was closed in driver `finally` blocks. Follow-up checks found no listeners on used ports 5173/5174 and no headless-shell process from the run folder. No backend development server was needed. Full-suite transient test servers also completed and exited.
- No existing user changes were present at entry; no reset, stash, history rewrite, other worktree changes or unrelated process termination occurred.

Run-folder copy: `B:\Code\OB-DOT101-run\REPORT.md`.
