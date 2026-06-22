# /review

**Triggers**: `/review`, `@review`, "review the code", "check before PR".

**Rules apply categorically.** No "minor", no "matches legacy". Every violation = FAIL.

## The loop (iterative)

`/review` is a loop, not a one-shot. The cycle closes only when a clean self-pass AND a clean adversarial panel produce zero violations on a fresh read of the rules and the diff. Fixing a violation means starting again from Step 0 — never skip ahead from "I just fixed it" to "done". A fix proves the previous pass was non-compliant, so the new state must be re-verified from scratch.

### Step 0 — Read the rules (BLOCKING, every iteration)

Read these end-to-end every time — working memory is not persistent across iterations:

1. [`AGENTS.md`](../../AGENTS.md) end-to-end.
2. The file the diff touches end-to-end (and its immediate consumers via `grep`).

### Step 1 — Inspect the diff

```bash
git fetch origin && git diff origin/develop...HEAD
```

Ignore lockfiles, minified files, `.svg` paths.

### Step 2 — Self-pass against every rule

Walk through every rule in [`AGENTS.md`](../../AGENTS.md) §"Code rules" and §"Design system" against the diff. The 5 non-negotiables and STOP signals also apply. List `file:line — rule violated` for every hit. Be exhaustive — a missed violation now becomes a PR comment later.

### Step 3 — Branch on the self-pass result

- **Violations found** → fix them, then **GOTO Step 0**. Do not announce PASS; the loop restarts.
- **No violations** → continue to Step 4.

### Step 4 — Build gate (BLOCKING)

```bash
pnpm typecheck && pnpm lint && pnpm test
```

Any failure → fix → **GOTO Step 0**.

### Step 5 — Adversarial panel (BLOCKING, never skip)

The agent that wrote the diff cannot reliably catch what it didn't notice writing. Self-review is structurally biased — the same blind spot that produced the violation also produces the "clean" self-pass. Before announcing PASS, spawn an **independent panel of critics** that re-read `AGENTS.md` from scratch and try to *refute* your pass — not validate it.

How to run the panel depends on the tool you're driving (Claude Code → `Workflow` or `Task` agents; Cursor → background agents; Codex → multi-shot calls). The procedure is tool-neutral:

**Stage A — Find (parallel critics, count is the agent's call)**

Spawn independent critic agents in parallel. None of them sees your self-pass or your prior reasoning. How many critics and how to partition the work is the calling agent's call — pick enough lenses to cover the AGENTS.md rule surface without overlap, scaled to the diff size. Avoid re-enumerating rules here; AGENTS.md is the single source of truth.

Each critic receives:

- A path to `AGENTS.md` and a mandate to read it end-to-end before anything else.
- The exact `git diff origin/develop...HEAD` command to inspect the diff.
- A **single rule lens** — a contiguous slice of AGENTS §"Code rules" / §"Design system" / non-negotiables / STOP signals. Be exhaustive within the lens, silent outside it. Sibling critics cover the rest of the surface.

Each critic returns a structured list of findings: `{ file, line, rule (verbatim AGENTS quote), why, severity (critical | major | minor | nit) }`. Critics must flag only **net-new** violations (the line must appear as `+` in the diff). Critics must NOT pad with weak findings — if they have nothing under their lens, they return an empty list.

Dedup findings across lenses by `file:line:rule`.

**Stage B — Verify (3 skeptics per finding, perspective-diverse)**

For every deduped finding, spawn 3 skeptics with distinct verification lenses:

1. **rule-text**: confirm the cited AGENTS rule actually exists (`grep AGENTS.md` for a short keyword). If the rule does not exist → `real=false`.
2. **diff-evidence**: confirm the cited `file:line` actually contains the violation in HEAD AND that the line is a `+` addition in `git diff origin/develop...HEAD` (not pre-existing on develop). If pre-existing or file:line is wrong → `real=false`.
3. **surgical-scope**: confirm the violating line was written on this branch (not bystander to an unrelated edit). Only mark `real=false` if the violation is unambiguously pre-existing tech debt the developer did not write.

Skeptics **default to `real=true` if uncertain** — the panel favours recall over filtering. A finding survives only when ≥2 of 3 skeptics confirm `real=true`.

**Stage C — Branch on the panel result**

- **Any survivor** → fix it, then **GOTO Step 0**. Same restart contract as the self-pass: a correction means the previous pass was non-compliant, so the loop restarts fully.
- **Zero survivors** → continue to Step 6.

Cost is real — multi-agent panels are token-heavy. That's why this runs AFTER the cheap self-loop and build gate have already cleared. The panel is the gate before PASS, not in place of self-review.

### Step 6 — Announce PASS

```
✓ /review PASS
  - <N> self-pass violations + <M> panel survivors, all auto-fixed in <K> iterations
  - typecheck ✓ lint ✓ test ✓
  - adversarial panel: <N> lenses · <X> raw findings · <Y> deduped · <Z> confirmed · 0 surviving
  → Ready for /commit + /pr
```

## When to invoke

- Before `/commit` if you've been writing for > 30 min.
- Before `/pr` — always, blocking (the `/pr` procedure invokes `/review` on your behalf).
- After resolving a merge conflict.
- After `git rebase`.
- After bumping a major dep.

## NEVER

- Skip Step 0 — re-read AGENTS.md and the touched file every iteration, no exceptions.
- Skim the rules. Read them.
- Announce PASS after a fix — every fix means the previous pass was non-compliant, so the cycle restarts at Step 0.
- Skip Step 5 because the self-pass looked clean — clean self-pass is exactly when the adversarial panel is most useful. Self-confirmation bias is the failure mode this step is designed to catch.
- Let the panel critics share context with the self-pass — they must read AGENTS.md and the diff fresh, with no priming.
- "Minor" exceptions.
- Auto-fix away a non-negotiable rule (LICENSE, new dep, Ed25519 only, brand neutrality) — STOP and ask the human.
