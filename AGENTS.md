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
