# /issue-work

**Triggers**: `/issue-work <n>`, `@issue-work <n>`, "work on issue N", "pick up issue N".

**Pre-condition**: an open issue nobody has branched for. `/issue` files the work; this command performs it, and ends at a PR URL or at a blocking question — never at a merge.

**Autonomous between checkpoints, never end to end.** Three checkpoints below are BLOCKING: the turn ENDS there. Silence is not consent, and re-invoking without an answer re-asks rather than proceeds.

## Step 0 — Read the rules (BLOCKING)

Read [`AGENTS.md`](../../AGENTS.md) end-to-end.

## Step 1 — Pre-flight (mechanical, fails closed)

```bash
gh issue view <n> --json state,title,body,labels
gh pr list --state merged --search "#<n>" --limit 5
```

- Issue open **and no merged PR references it**. GitHub only auto-closes on a merge into the default branch; this repo merges into `develop`, so "open" does not mean "unworked" — #44 shipped in #49 and stayed open. Re-implementing a shipped issue is the cheapest possible waste.
- Working tree clean, no other branch in flight (§Workflow principles: sequential, never parallel).
- One `grep -rn` for the symbols the issue names. That file list is handed to every lens below, so four agents do not rediscover the repo four times.

## Step 2 — Size the panel

The panel is the escalation, not the default: it runs at the START of every issue, where most verdicts are "not workable" and a fixed cost buys a no-op. Pick the tier mechanically, before spawning anything.

| Tier | Lenses | When |
| --- | --- | --- |
| 0 | none — run the lenses yourself, sequentially, in one context | one file, nothing a user sees, a test file already sits beside it |
| 1 | L2 + L4 | more than one file, or a canonical file from §Where to find what, or anything a user sees |
| 2 | L1-L4 | a new module, or streaming / parsing / auth / db, or the label is `feature` |
| 3 | L1-L4 + L6 | the change handles model output or any untrusted input |

Escalate up mid-flight when an unforeseen constraint appears; never downgrade. L5 rides alongside any tier when the surface is visible.

## Step 3 — Constraints and decisions first (L2, L3)

Cheap reads, and most issues die here. Run them before anything expensive.

- **L2 constraint** — which AGENTS rules, non-negotiables, STOP signals and platform notes govern this. Every constraint carries a verbatim AGENTS quote.
- **L3 decision inventory** — what must be *decided* rather than discovered. Tag each `decidable-from-repo` (cite a precedent `file:line`), `decidable-from-issue` (quote it), or `human-only`. No citation available means `human-only`, always.

## Step 4 — Disqualifier test

A judgement call always resolves to "workable", because the agent wants to work. This is a test, not a judgement. **Any single hit means not autonomous.**

1. Implementation needs a STOP signal — name and quote which.
2. Any DB migration that reaches installed devices, destructive or not. #27 proves a merely additive one already bit this repo: irreversible for the user, invisible to CI.
3. An unmade product decision — the issue body still offers alternatives, or L3 holds an unanswered `human-only` item. #46 says "placement is open" in its own text; #51 states the endpoint returns no job id. An issue still thinking out loud is not the agent's thought to finish.
4. Proving correctness needs hardware the agent cannot reach — the `needs-device` label is the marker.
5. AGENTS.md is silent or contradictory on the governing rule (§When the docs and the code disagree).
6. A purely visual change. This one routes rather than terminates: it goes to CP-2 and returns workable once the human has decided.

**Not workable** → produce, in this order, and STOP: one analysis comment on the issue (L1 facts with `file:line`, the blocking constraint quoted, the decision needed) · a split proposal when the issue bundles a workable part with a blocked one, since a split changes the tracker and needs assent · exactly one question, the highest-leverage one. Never a partial PR, never a draft parking unfinished work, never "the easy part" of a blocked issue.

## Step 5 — Ground truth and verification (L1, L4, and the conditionals)

- **L1 ground truth** — what the code does today, one `file:line` per fact. Not what it should do.
- **L4 verification** — for each behaviour this change alters, name the gate that can actually SEE it: `jest`, `typecheck`, `lint`, `maestro`, a simulator screenshot, a real build, a physical device, or **none**. The list of "none" answers is the blind-spot list and it drives CP-3.
- **L5 prior art** (visible surfaces) — find, never invent: the closest existing surface in Quock and how it already solves this, with `file:line`. Non-negotiable #5 owns the design system in-repo, so the design input is what Quock already does, not what a designer would do. L5 feeds options to CP-2; it decides nothing.
- **L6 adversarial input** (model output, untrusted input) — enumerate what the input space really contains and predict the output for each. All four defects that escaped the LaTeX work were adversarial-input defects and none were architectural.

Each lens returns at most seven items, every item cited. **An uncited item is dropped by the caller, silently.** Uncited output is the spend with negative value.

## Step 6 — CP-1, workability (BLOCKING)

Present: the verdict · STOP signals hit, quoted · L3's `human-only` decisions · the blind-spot list from L4 · what is out of scope. State confidence as **a named observation that would change it**, never a number.

Front-load every visual decision you can foresee here, so CP-1 and CP-2 resolve in one round trip. A command that pings four times is worse than one that asks once.

**The turn ends.**

## Step 7 — Branch

From `develop`. Prefix from the issue label (`bug` → `fix/`, `feature` → `feat/`, else `chore/`). Kebab-case, descriptive, and the issue number stays OUT of the name — the closing PR carries it.

## Step 8 — Implement to the next logical seam

Repeat until done, 3-7 commits. Each commit is a logical step a reviewer can follow, never one per file: `/commit` re-reads AGENTS.md and runs the whole build gate every iteration, so that price has to buy a reviewable step.

An unforeseen visual decision surfacing here → **CP-2, UI authority (BLOCKING)**. Offer two or three concrete options, each with a repo precedent `file:line` and its tradeoff. State a preference if you have one. The human picks. No default, no timeout, no proceeding with option A. **The turn ends.**

Then `/commit` ([`commit.md`](./commit.md)), which owns its own loop and gate.

## Step 9 — CP-3, verification (BLOCKING when the blind-spot list is non-empty)

A green build gate is not evidence of correctness. 343 passing tests said nothing about whether `\checkmark` reached the screen; a clean local config review said nothing about whether the cloud build linked.

So when the change alters rendered output, native build config, or on-device behaviour, `/review` PASS plus the build gate is **not** sufficient to open a PR. Either **produce the artefact showing real behaviour** — a screenshot from the simulator, the output of the real build command — or **STOP and hand over a numbered observation list**: exactly what to look at, exactly what correct looks like. Generate every observation you can; enumerate the ones you cannot.

## Step 10 — Source-check, then `/pr`

Re-read every factual claim bound for the PR body and **delete, not soften**, each one no command produced. A claim about what happened in this repo must come from a command that was actually run.

Then `/pr` ([`pr.md`](./pr.md)), which runs `/review` to a clean pass. The body carries `Fixes #<n>` plus a mandatory pair:

```
Verified by: <gate or artefact, per behaviour changed>
Not verified: <what no gate can see, and why>
```

Announce the URL and STOP. Do not merge.

## NEVER

- Continue past a blocking checkpoint in the same turn — silence is not consent.
- Decide a visual question. The human is the authority on what a UI should be; AI supplies options, not the answer.
- Implement part of a blocked issue, or park unfinished work in a draft PR.
- Loop the analysis. `/review` loops because a fix invalidates the prior pass and there is a diff to re-verify; analysis has no diff, so a second pass only restates the first more confidently.
- Partition a panel by job title. "Frontend" and "mobile expert" are one person in this repo, and a persona cannot return an empty list — it pads by construction.
- Score anything out of ten, or estimate effort in hours.
- Cite a test count as evidence of coverage.
- State a fact about this repo that no command produced.
- Re-implement `/review`, `/commit` or `/pr` inline — each file is canonical for its own procedure.
- Post running commentary on the issue. One analysis comment when it is not workable is value; the rest is noise on the tracker.
