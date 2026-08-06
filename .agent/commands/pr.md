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

**Title**: Conventional Commit format. Single-commit branches mirror that commit; multi-commit branches synthesize an umbrella title.

**Body — keep it lean.** The diff already shows the *how*; the body explains what the diff can't: the intent and anything non-obvious. Default to short. A section exists only when it carries real content — never write an empty, "N/A", or "to add" section; omit it. Do NOT re-narrate the code file by file — that is what the diff is for.

- **Summary** (required): 1-3 sentences — what changed and why.
- **Changes** (required): 3-6 bullets of the substantive changes. Skip the obvious; name a file or area only when it helps a reviewer.
- **Notes** (optional): one place for anything worth flagging — how it was tested, a risk, out-of-scope, a follow-up, an open question. Omit entirely if there is nothing.

AI-made PR → end the body with the assisting tool's attribution footer (e.g. `Co-Authored-By: Cursor <cursoragent@cursor.com>`), so AI-authored work stays traceable.

### Step 7 — Open the PR

A maintainer-opened PR carries an **assignee** and exactly **one type label**, both set here and not remembered later. The assignee is the human accountable for the work; the tool that helped is credited in the body footer instead.

First match wins:

| Branch | Label |
| --- | --- |
| `chore/release-*` | `release` |
| `feat/` | `feature` |
| `fix/` | `bug` |
| `chore/` · `refactor/` · `docs/` | `chore` |
| anything else | from the title's type: `feat` → `feature`, `fix` → `bug`, otherwise `chore` |

Shipping a release line is not this procedure's job — `release/X.Y.Z` targets `main` and belongs to [`release.md`](./release.md).

Add `needs-device` **alongside** the type label when the change is one CI cannot judge — anything native, anything only a device or simulator can exercise. CI here runs lint, typecheck and Jest; it never builds the app, so green says nothing about whether the thing runs.

```bash
gh pr create --base develop --head "$(git branch --show-current)" \
  --title "..." --body "..." \
  --assignee @me \
  --label "<type-label>"            # --label "<type-label>,needs-device" when it applies
```

`@me` is whoever owns the token, which on a CI or agent token is not the human — check it, and pass the maintainer's login instead when it is not. A label missing from the repo is not invented on the spot: **STOP** and ask for it. From a fork GitHub allows neither flag, so a contributor PR is exempt and gets labelled on arrival.

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
- Open a maintainer PR with no assignee, or without its type label.
- Use any language other than English in the PR body.
- Mix scopes (one PR = one logical concern).
- Target `main` directly — PRs go into `develop`.
