---
name: pr-review-cycle
description: "Interactive PR review and merge workflow. Use this skill whenever the user wants to review PRs, merge pull requests one by one, test branches, do a PR review cycle, or says things like 'review PRs', 'merge PRs', 'check open PRs', 'go through pull requests', 'test and merge', or 'PR review'. Also trigger when the user references reviewing, testing, or merging multiple PRs in sequence on any GitHub repo."
---

# PR Review Cycle

An interactive workflow for reviewing, testing, and merging open PRs one at a time. The user tests each PR locally or via Vercel preview, then approves or rejects before moving to the next.

## Workflow

### 1. Audit

Fetch the latest state and build the review queue:

```bash
git fetch --all --prune
gh pr list --state open --json number,title,headRefName,baseRefName,additions,deletions,commits --limit 50
```

For each PR, also check related issues (look for "Closes #N" in PR body) and merge conflict status.

### 2. Plan Review Order

Sort PRs into a numbered queue:
1. Group by base branch - staging/dev PRs before main PRs
2. Within each group, smallest first by lines changed
3. Dependencies last - if PR B depends on PR A, review A first
4. Batch merges last

Present as numbered table: PR number, title, branch, base, size, related issue.

### 3. Interactive Review Loop

For each PR:

**Load for testing:**
- Check out branch: `gh pr checkout NUMBER`
- If web project, confirm Vercel preview URL or start local dev server
- Brief diff summary and where to test

**Wait for verdict:**
- **Approve**: `gh pr merge NUMBER --merge --delete-branch`, move to next
- **Reject/Skip**: note reason, skip, circle back later
- **Fix needed**: help fix on branch, push, re-present

**After each merge:**
- Confirm success and branch deleted
- Show remaining count
- Check if later PRs now have conflicts

### 4. Final Batch Merge

If staging-to-main PR exists at end:
- Confirm all staging PRs merged
- Show full staging vs main diff
- On approval, merge

### 5. Wrap Up

Report merged, skipped, and remaining PRs/issues.

## Notes

- Use `--merge` (not squash/rebase) unless user says otherwise
- On conflicts, show files and ask how to proceed
- Provide Vercel preview URLs when available
- Keep responses concise - user wants to move fast
