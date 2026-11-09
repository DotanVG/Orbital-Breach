# Provenance (internal engineering record)

## Origin and evidence

- `1edfe941a7d89302c36f1029605cb4171f00d630` (2026-04-07): "Initial commit:
  fork toonshooter template from Vibe Jam starter pack". Its README calls this
  the Vibe Jam Toon Shooter starter template. The history does not identify an
  exact upstream URL/revision; those remain unknown.
- `7b37a3580785e3b939433501ac04c997d52ae272` (2026-04-07): "Remove toonshooter
  template — starting fresh with Orbital Breach" removes the template tree.
- `26776f709be9d8dc25b7f9ee7084b13cc5229975` later that day introduces the
  Orbital Breach POC. This is a separate Three.js/Colyseus lineage, not a claim
  that the current game was copied from either Phaser sibling.
- For sibling context, Count-Dawn was seeded from BeatEmPie-Phaser on 2026-07-24
  per Dotan's supplied phase-0 research. Its initial scaffold is
  `6d995a6d7801ab7376e6facc1b16acab06393b1a`; the exact BeatEmPie seed revision
  is not recorded. BeatEmPie's initial scaffold is
  `4653f639600e61f8c7b13de4eb6125c90367c654` (2026-06-13).
- Audit baseline: `staging` at `5718ae1515d1fb7adae464a585fca4a0611c0c63`.
  Reproduce with `git log --reverse` and `git show <sha>`.

## Shared/copied configuration inventory

| Local file | Sibling equivalents | Intentional differences / drift to review |
| --- | --- | --- |
| `vercel.json` | BeatEmPie-Phaser and Count-Dawn: `vercel.json` | Related security-header patterns. Orbital has enforced/report-only CSP, multiplayer/jam origins, model/audio caches and client-specific build settings. Do not overwrite the file. |
| `client/public/analytics.js` | Both Phaser siblings: `public/analytics.js` | Same GA bootstrap pattern, different production hostname and measurement ID. |
| No ESLint config | Both Phaser siblings: `eslint.config.js` | No local equivalent or lint command; the drift tool reports an explicit skip. |

GA bootstrap introduction here: `9fd17710b822d11e5155c9ff3db4c6ec03da0353`
(2026-10-22); BeatEmPie: `6b5e1df1ac1a8f8e1e449206480e5832261d03c3`;
Count-Dawn: `e7dd6ee0dbddcfab8c338e6f54892a746a7b9a01` that day. These establish
introduction, not copy direction. Exact original copy commits for shared config
variants remain unknown. `client/src/analytics/analytics.ts` is game-specific
instrumentation; Vercel analytics/speed-insights setup is also related but outside
the listed file comparison. Source files are not synchronized by this tool.

## Comparison and synchronization rule

```sh
node tools/drift-check.mjs ../BeatEmPie-Phaser
node tools/drift-check.mjs https://github.com/DotanVG/Count-Dawn
node tools/drift-check.mjs https://raw.githubusercontent.com/DotanVG/Count-Dawn/<commit>/ --strict
```

Pass a sibling checkout or root HTTP(S) URL. GitHub repo URLs use `staging`;
raw URLs can pin a commit. Other root URLs require `--repo Count-Dawn` (or another
listed sibling). Local package names identify renamed checkouts. The tool reads
only the inventory, normalizes CRLF to LF, and prints SHA256 values and bounded
positional line previews. Intentional parameters remain visible; output is not a patch.
Differences, missing files, network and usage errors exit 0 by default; `--strict`
exits 1 for findings. The absent ESLint equivalent is a skip, not an error.
This tool is not connected to CI, build, deployment or package scripts.

Compare before changing a variant. Review CSP/origins, cache policy, analytics
parameters and deploy commands separately; never copy whole configs for equality.
For approved synchronization, record source repo/path/full SHA, date, reason and
intentional differences here and in each PR body. Use separate PRs to each current
`staging` and run its checks and relevant runtime QA. Prefer existing packages;
propose extraction only for two real consumers. The multiplayer layer is a possible
future engine-agnostic package only when a second consumer exists; no extraction,
package publication or automatic synchronization happens in phase 0.

`tools/drift-check.mjs` is an explicitly authorized phase-0 bootstrap copy
introduced together in all three games on 2026-10-30. The corresponding
`shraga/reuse-phase0` PRs record initial SHAs; no earlier source commit exists.
Keep the tool copies equivalent through reviewed sibling PRs and hash comparisons.
