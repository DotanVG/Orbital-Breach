---
name: graphify
description: Query and maintain Orbital Breach's optional local Graphify knowledge graph. Use it for unfamiliar architecture, debugging, cross-cutting or likely multi-file work when graphify-out/graph.json exists, and for explicit graph build, update, query, path, explain, status, watch, or clustering requests. Skip it for clearly isolated edits.
---

# Graphify for Orbital Breach

This is the canonical repository Graphify skill. Claude Code discovers it from
`.claude/skills/graphify/SKILL.md`. Codex discovers the small adapter in
`.agents/skills/graphify/SKILL.md`; Codex does not discover this directory
directly.

Graphify is optional, local development tooling. Its distribution is
`graphifyy==0.9.30`, while both its executable and Python module are named
`graphify`. Never add it to the game's runtime dependencies.

## Operating policy

When `graphify-out/graph.json` exists:

1. For unfamiliar, architectural, debugging, cross-cutting or likely multi-file
   tasks, query Graphify before broad repository exploration.
2. Use results to identify likely files, symbols, dependencies and execution
   paths.
3. Open and verify the authoritative source files before editing.
4. Never trust stale graph data over current source.
5. Skip Graphify for a clearly isolated edit.
6. After material structural changes, run an incremental update when practical.
7. After a major refactor, run a full rebuild.
8. Never commit `graphify-out/`.
9. Do not block ordinary work merely because the optional graph is absent.

Graphify preserves extracted relationship confidence and audit classifications.
Do not add or claim relationships that are not supported by the graph and
source.

## Preferred repository commands

Run direct `node scripts/graphify.mjs ...` commands from the repository root.
The wrapper finds that Git root and keeps all output under its
`graphify-out/` directory.

```bash
node scripts/graphify.mjs status
node scripts/graphify.mjs build
node scripts/graphify.mjs update
node scripts/graphify.mjs query "How does client input reach weapon firing and projectile creation?"
node scripts/graphify.mjs query "How do online reconciliation and local-player prediction interact?" --dfs
node scripts/graphify.mjs path "InputManager" "ProjectileSystem"
node scripts/graphify.mjs explain "NetClient"
node scripts/graphify.mjs check
node scripts/graphify.mjs cluster
node scripts/graphify.mjs watch
```

`query` defaults to a 1,600-token budget. Keep queries focused; raise the budget
only when the task truly requires it. `watch` is intentionally long-running and
must never be attached to normal development or every edit.

The full build runs `graphify extract . --force`, then `graphify cluster-only .`.
If an authenticated Claude Code CLI is available, documentation receives
semantic extraction through the verified `claude-cli` backend while code uses
deterministic local AST extraction. If that backend is unavailable, the wrapper
falls back to `--code-only`; it never sends artwork, audio or video for semantic
processing. The update command uses Graphify's manifest gate so unchanged code
and documentation are not re-extracted, then refreshes clustering only when the
graph changed. If that path is unavailable, it falls back to Graphify's safe
native full-code AST update without discarding semantic documentation.

Use `--code-only` explicitly with `build` to forbid semantic processing:

```bash
node scripts/graphify.mjs build --code-only
```

`cluster` only reclusters the existing graph. `check` validates the local
integration and Graphify's pending semantic-update flag; it does not build a
missing graph.

## Project scope

The `.graphifyignore` file keeps extraction source-focused.

Included material is centered on:

- `client/src/`
- `server/src/`
- `shared/`
- `tests/`
- `docs/`
- relevant root/client/server TypeScript, Vite, Vitest and package configuration
- `AGENTS.md`, `CLAUDE.md`, `WORKFLOW.md` and `README.md`

Dependencies, generated output, caches, worktrees, secrets, public assets,
large binaries, images, audio and video are excluded. Source files remain
authoritative.

## Representative questions

- How does client input reach weapon firing and projectile creation?
- How does shared multiplayer state move between server and client?
- Which modules participate in portal breach detection and round victory?
- Which files must change when the shared multiplayer protocol changes?
- How do online reconciliation and local-player prediction interact?

After any query, open the cited files and verify the relevant implementation
before changing code. Graph context narrows exploration; it never replaces
source inspection.

## Installation

Preferred on Windows, macOS and Linux:

```bash
uv tool install "graphifyy==0.9.30"
```

Supported alternatives:

```bash
pipx install "graphifyy==0.9.30"
python -m pip install "graphifyy==0.9.30"
```

The wrapper detects a direct executable, an active virtual environment, a uv
tool, pipx, or a Python environment containing the `graphify` module. As a final
explicit-command fallback it can use pinned `uvx` or `pipx run` execution.

## Local outputs and freshness

A complete graph normally contains:

- `graphify-out/graph.json`
- `graphify-out/graph.html`
- `graphify-out/GRAPH_REPORT.md`
- `graphify-out/manifest.json`
- `graphify-out/project-metadata.json`

`project-metadata.json` records the installed version and interpreter, files
included and skipped, graph counts, duration, extraction mode, measured token
usage, Git commit, dirty-source state and the wrapper's freshness decision.

Run `node scripts/graphify.mjs status` before trusting an older graph. Commit
mismatches, relevant working-tree changes or Graphify's `needs_update` marker
make it potentially stale. Rebuild or update it, then still verify source.
