# /pr

**Triggers**: `/pr`, `@pr`, "open a PR", "open pull request".

**Pre-condition**: `/commit` ran successfully — branch is ahead of `develop`.

**Base branch is `develop`.** `main` is release-only; PRs never target `main` directly.

## The loop (iterative)

The PR procedure is wrapped around a full `/review` cycle. Any violation found before opening the PR resets the loop — the cycle closes only when a clean pass produces zero violations.

### Step 0 — Read the rules (BLOCKING, every iteration)

Read [`AGENTS.md`](../../AGENTS.md) end-to-end.

### Step 1 — Pre-flight

- Not on `develop` or `main`.
- Working tree clean (`/commit` was run).

### Step 2 — Run `/review` (BLOCKING)

Invoke `/review` (see [`code-review.md`](./code-review.md)). It is itself a loop that will not return until it has produced a clean pass. If `/review` reports any violation, it fixes + restarts on its own — by the time it returns, the branch is compliant.

### Step 3 — Rebase

```bash
git fetch origin && git rebase origin/develop
```

STOP on conflict, ask the human.

### Step 4 — Push

`--force-with-lease` if rebased, plain push if not. Never `--force` without `-with-lease`.

### Step 5 — Build gate

```bash
pnpm typecheck && pnpm lint && pnpm test
```

Any failure → fix → **GOTO Step 0**.

### Step 6 — Build the PR title + body

Read `git log origin/develop..HEAD --oneline` to enumerate the work.

- **Title**: Conventional Commit format. Single-commit branches mirror that commit; multi-commit branches synthesize an umbrella title.
- **Body sections**: **What** / **Why** / **How** (grouped by area) / **Testing** / **Screenshots** / **Out of scope** / **Open questions**.
- AI-made PR → end the body with the assisting tool's attribution footer (e.g. `🤖 Generated with [Claude Code](https://claude.com/claude-code)`), so AI-authored work stays traceable.

### Step 7 — Open the PR

```bash
gh pr create --base develop --head "$(git branch --show-current)" --title "..." --body "..."
```

### Step 8 — Announce the URL and STOP

Do not merge own PR.

## `/cleanup` (post-merge)

```bash
git checkout develop && git pull --rebase origin develop
git branch -d <feature-branch>
git remote prune origin
```

## NEVER

- Skip Step 0 or Step 2 — re-read AGENTS.md and run `/review` to a clean pass every time.
- Open PR on red CI.
- Force-push without `--force-with-lease`.
- Merge own PR.
- Title-only PRs (body required).
- Use any language other than English in the PR body.
- Mix scopes (one PR = one logical concern).
- Target `main` directly — PRs go into `develop`.
