---
tracker:
  kind: linear
  project_slug: orbital-breach-fbd2031f549e
  active_states:
    - Todo
    - "In Progress"
  terminal_states:
    - Done
    - Cancelled
polling:
  interval_ms: 30000
workspace:
  root: ~/code/orbital-breach-workspaces
hooks:
  after_create: |
    git clone --depth 1 --branch staging https://github.com/DotanVG/Orbital-Breach.git .
    CLAUDE_CODE_REMOTE=true CLAUDE_PROJECT_DIR="$PWD" node .claude/hooks/session-start.mjs
  before_run: |
    git fetch origin
    git merge --ff-only origin/staging
agent:
  max_concurrent_agents: 3
  max_turns: 20
codex:
  command: >-
    codex
    --config 'model="gpt-5.6-sol"'
    --config 'model_reasoning_effort="high"'
    --config 'agents.default_subagent_model="gpt-5.6-terra"'
    --config 'agents.default_subagent_reasoning_effort="medium"'
    --config 'agents.max_concurrent_threads_per_session=2'
    app-server
  approval_policy: never
  thread_sandbox: danger-full-access
  stall_timeout_ms: 1800000
---

You are working on Linear ticket `{{ issue.identifier }}` for the **Orbital Breach** project.

{% if attempt %}
Continuation context:

- This is retry attempt #{{ attempt }} — ticket is still in an active state.
- Resume from current workspace state; do not restart from scratch.
- Do not repeat already-completed investigation unless needed for new changes.
{% endif %}

Issue context:
Identifier: {{ issue.identifier }}
Title: {{ issue.title }}
Current status: {{ issue.state }}
Labels: {{ issue.labels }}
URL: {{ issue.url }}

Description:
{% if issue.description %}
{{ issue.description }}
{% else %}
No description provided.
{% endif %}

## Project context

**Orbital Breach** — browser-based zero-gravity FPS for Vibe Game Jam 2026.
Stack: Three.js + TypeScript client (Vite), Node.js + WebSocket/Colyseus server (ts-node-dev), shared/ types.

Repo layout:
- `client/src/` — Vite + TypeScript browser game (Three.js)
- `server/src/` — Node.js multiplayer server (Colyseus/WebSocket)
- `shared/` — shared types between client and server

Key commands:
- `npm run dev` — start both client and server concurrently
- `npm run dev --prefix client` — client only (Vite, port 5173)
- `npm run dev --prefix server` — server only
- `npm run build --prefix client` — production build
- `npm test` — run vitest tests

## Instructions

1. Unattended orchestration session — never ask a human to perform follow-up actions.
2. Stop early only for true blockers (missing required auth/permissions/secrets). Record blocker in workpad and move issue to `In Review`.
3. Final message: completed actions and blockers only. No "next steps for user".
4. Work only inside the provided repository copy.

## Related skills

- `linear`: interact with Linear via `linear_graphql` tool.
- `commit`: produce clean, logical commits.
- `push`: keep remote branch current.
- `pull`: sync with latest `origin/staging` before handoff.
- `land`: when ticket is approved, land the PR.

## Status map

- `Todo` → move to `In Progress` immediately before active work.
- `In Progress` → implementation actively underway.
- `In Review` → PR attached and validated; waiting on human approval.
- `Done` → terminal; do nothing.

## Step 0: Determine current ticket state and route

1. Fetch the issue by ticket ID.
2. Read current state.
3. Route: `Todo` → move to `In Progress`, create workpad, start work. `In Progress` → continue from workpad. `In Review` → wait and poll. `Done` → shut down.

## Step 1: Kickoff

1. Find or create a single persistent workpad comment (`## Codex Workpad`) for the issue.
2. Immediately reconcile the workpad: check off done items, expand plan.
3. Run `pull` skill to sync with `origin/staging`. Record result.
4. Reproduce the bug/verify current behavior before changing code.
5. Write hierarchical plan in workpad with acceptance criteria and TODOs.

## Agent orchestration

The primary Sol agent owns the ticket, workpad, implementation, integration,
validation decisions, Git operations, PR, and final report. It is the only
agent allowed to edit source files.

Use the project agents under `.codex/agents/` deliberately:

- `code_explorer` maps unfamiliar client, server, shared-protocol, and network paths before edits.
- `visual_qa` reproduces and verifies first-person controls, HUD, camera, multiplayer, reconnect, and responsive behavior.
- `reviewer` performs the final correctness, protocol, lifecycle, security, performance, and regression review.
- `verifier` runs the required client, server, and test command suite once the working tree is stable.

Delegation rules:

1. Delegate only bounded, independent work with a concrete evidence-based output.
2. Run at most two subagents concurrently.
3. Parallelize independent reads or final review plus verification; keep dependent work sequential.
4. Do not spawn multiple implementation agents or allow agents to edit overlapping files.
5. For gameplay or visual changes, run `visual_qa` before editing to establish a baseline and after editing; multiplayer behavior must be checked with the minimum number of clients needed to exercise the change.
6. For medium/high-risk changes, run `reviewer` after implementation and resolve every material finding before handoff.
7. Treat subagent completion as evidence, not completion of the ticket; the primary agent must synthesize results and verify every acceptance criterion.

## Page freshness metadata

Before the final commit for any change intended to ship, update `meta[name="date"]` in `client/index.html` to the current ISO 8601 timestamp, including its timezone offset. Confirm the date again before opening the PR or promoting to production. Skip only local investigations that will not be deployed.

## Step 2: Execution

1. Implement against workpad TODOs.
2. For client changes: run `npm run build --prefix client` to verify no build errors.
3. For server changes: verify TypeScript compiles with no errors.
4. Run `npm test` to confirm no test regressions.
5. Before pushing: run all required validation, confirm passing.
6. Push branch, open PR. PR body MUST include `Closes #<N>` where N is the linked GitHub issue number (find it in the issue description or URL field — it is the numeric ID of the corresponding Orbital-Breach GitHub issue). Attach PR URL to the issue as a comment via `linear_graphql`.
7. Move issue to `In Review`.

## Step 3: Rework

1. Re-read full issue + all PR comments.
2. Close existing PR, create fresh branch from `origin/staging`.
3. Start fresh workpad, execute end-to-end.

## Workpad template

```md
## Codex Workpad

<hostname>:<abs-path>@<short-sha>

### Plan

- [ ] 1. Parent task
  - [ ] 1.1 Child task

### Acceptance Criteria

- [ ] Criterion 1

### Validation

- [ ] targeted tests: `<command>`

### Notes

- <short progress note with timestamp>
```

## Knowledge graph policy

When `graphify-out/graph.json` exists:

1. For unfamiliar, architectural, debugging, cross-cutting or likely multi-file tasks, query Graphify before performing broad repository exploration.
2. Use the graph to identify likely files, symbols, dependencies and execution paths.
3. Open and verify the authoritative source files before editing.
4. Never trust stale graph data over current source.
5. For a clearly isolated edit, skip Graphify.
6. After material structural changes, perform an incremental graph update when practical.
7. After a major refactor, perform a full rebuild.
8. Never commit `graphify-out/`.
9. Do not block ordinary work only because the optional local graph is absent.

Symphony receives this policy directly from `WORKFLOW.md`. In a worktree where
the optional graph exists, use `node scripts/graphify.mjs status` before relying
on it and `node scripts/graphify.mjs query "<question>"` for a bounded query.
Do not build or update the graph in `after_create`, `before_run`, normal
development, tests or packaging. Fresh temporary worktrees normally have no
graph, and that must not interrupt the ticket.
