## Ponytail / Minimal Senior Dev Mode

- Prefer deletion over addition.
- Prefer existing code, stdlib, browser/native APIs, and installed dependencies before adding new code or dependencies.
- Avoid new abstractions unless there are at least two real implementations or a clear current need.
- Keep diffs small.
- Do not add scaffolding "for later".
- Never simplify away security, trust-boundary validation, accessibility basics, or data-loss prevention.
- For deliberate shortcuts, add a comment with the format:
  // ponytail: [shortcut], upgrade when [specific condition]
- For non-trivial logic, add the smallest runnable check or test that would fail if the logic breaks.

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

Codex discovers the repository skill at `.agents/skills/graphify/SKILL.md`.
Use `node scripts/graphify.mjs status` to check freshness and
`node scripts/graphify.mjs query "<question>"` for intentional bounded queries.
