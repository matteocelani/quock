# /commit

**Triggers**: `/commit`, `@commit`, "make a commit", "save changes", "push changes".

**Pre-condition**: NOT on `main` or `develop`. Check `git branch --show-current`; if it returns one of those, STOP — require a feature branch first.

## The loop (iterative)

Re-enter this loop after every fix. The cycle closes only when a clean pass produces zero violations — fixing a violation means starting again from Step 0, not skipping ahead.

### Step 0 — Read the rules (BLOCKING, every iteration)

Read [`AGENTS.md`](../../AGENTS.md) end-to-end. Working memory is not persistent across iterations.

### Step 1 — Inspect the diff

```bash
git add -A
git diff --staged
```

STOP if empty. Ignore lockfiles, minified files, `.svg` paths.

### Step 2 — Check every rule

Walk through every rule in [`AGENTS.md`](../../AGENTS.md) §"Code rules" and §"Design system intent" against the diff. List `file:line — rule violated` for every hit. The 5 non-negotiables and STOP signals also apply.

### Step 3 — Branch on the result

- **Violations found** → fix them, then **GOTO Step 0**. Do not proceed to commit; the loop restarts. A correction means the pre-fix state was non-compliant, so the post-fix state must be re-verified from scratch.
- **No violations** → continue.

### Step 4 — Run the build gate

```bash
pnpm typecheck && pnpm lint && pnpm test
```

Any failure → fix → **GOTO Step 0**.

### Step 5 — Write the commit

- Title: `<type>(<scope>): <description>` — Conventional Commits, ≤ 72 chars.
- Body: bulleted **WHY** (not WHAT), grouped by area, ≤ 10 lines.
- AI-made commit → append the assisting tool's `Co-Authored-By` trailer (e.g. `Co-Authored-By: Claude <noreply@anthropic.com>`) as a final `-m`, so AI-authored work stays traceable.
- `git commit -m "<title>" -m "<body>"` (+ `-m "Co-Authored-By: …"` when AI-made).

### Step 6 — Push

```bash
git push origin "$(git branch --show-current)"
```

STOP on rejection. Never force-push to recover.

### Step 7 — Announce

```
✓ <hash> <type>(<scope>): <description> → pushed to origin/<branch>
```

## Conventional Commits

**Types**: `feat`, `fix`, `refactor`, `chore`, `style`, `docs`, `test`, `perf`.

**Scopes**: `auth`, `chat`, `models`, `settings`, `sheets`, `ui`, `db`, `api`, `design`, `hooks`, `lib`, `structure`, `dev`, `deps`, `infra`, `docs`, `agents`, `assets`, `i18n`.

**Examples**:
- `feat(chat): add thinking dots while assistant is pending`
- `fix(api): use expo/fetch so response.body streams on iOS`
- `refactor(ui): unify all four sheets behind SheetHeader primitive`

## NEVER

- Skip Step 0 — re-read AGENTS.md every iteration, no exceptions.
- Skip the restart after a fix — every fix means the previous pass was non-compliant; the new pass must start at Step 0.
- Push to `main` or `develop` directly.
- Force-push without `--force-with-lease`.
- Amend already-pushed commits.
- Use any language other than English in commit messages.
- Mix unrelated changes in one commit — split into multiple commits.
- Bump `version` / `buildNumber` / `versionCode` on a feature branch — version bumps are release-only (`release/X.Y.Z` or `hotfix/X.Y.Z`); see `.agent/commands/release.md`.
