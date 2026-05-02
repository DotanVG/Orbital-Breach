---
tracker:
  kind: github
  repo: DotanVG/Orbital-Breach
polling:
  interval_ms: 30000
workspace:
  root: ~/code/orbital-breach-workspaces
hooks:
  after_create: |
    git clone --depth 1 --branch staging https://github.com/DotanVG/Orbital-Breach.git .
    npm install
    npm install --prefix client
    npm install --prefix server
  before_run: |
    set -euo pipefail
    git fetch origin
    git merge --ff-only origin/staging
agent:
  max_concurrent_agents: 3
  max_turns: 20
codex:
  command: codex app-server
  approval_policy: never
  thread_sandbox: workspace-write
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

## Step 2: Execution

1. Implement against workpad TODOs.
2. For client changes: run `npm run build --prefix client` to verify no build errors.
3. For server changes: verify TypeScript compiles with no errors.
4. Run `npm test` to confirm no test regressions.
5. Before pushing: run all required validation, confirm passing.
6. Push branch, open PR. PR body MUST include `Closes #{{ issue.id }}` so GitHub auto-closes the issue on merge. Attach PR URL to the issue as a comment.
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
