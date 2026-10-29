# /council

**Triggers**: `/council <question>`, `@council`, "convene the council", "ask the experts".

**Purpose**: a structured deliberation for a **decision** that deserves more than one reasoning path: a product trade-off, an architecture fork, a platform risk, a dependency to take on. It returns a verdict that keeps dissent, unknowns and kill criteria visible instead of flattening them into prose consensus.

**Not for**: factual lookups (read the code or the docs), cheap reversible choices (try it), or code review (`/review` owns that). Never convene it to manufacture support for an answer already chosen.

**Authority**: the council advises and the human decides. A verdict never approves a STOP signal (AGENTS.md §STOP signals), a new dependency, or a visual choice. It is the recommendation the human reads before deciding, never the decision itself.

Adapted from the protocol in [0xNyk/council-of-high-intelligence](https://github.com/0xNyk/council-of-high-intelligence) (MIT): blind first round, anonymized cross-examination, confidence-weighted tally, separate chairman. The seats are rebuilt for a mobile product team.

## Usage

```text
/council <question>                        standard mode, auto-selected triad
/council --triad <name> <question>         standard mode, a named triad (table below)
/council --members ios,cto,privacy <q>     standard mode, an explicit panel (3-8 seats; 2 seats run as --duo)
/council --all <question>                  standard mode, all 8 seats; expensive, one-way doors only
/council --quick <question>                quick mode: 2 rounds, no cross-examination
/council --duo <a>,<b> <question>          duo mode: two seats, one tension, 3 short rounds
```

Cost is real. A triad in standard mode is about 10 agent calls, `--quick` about 7, and `--all` about 25 (seats × rounds + 1 chairman, before enforcement prompts). Default to a triad.

## Step 0 — Read the rules (BLOCKING)

Read [`AGENTS.md`](../../AGENTS.md) end-to-end. Seats cite it, and the coordinator enforces it.

## Step 1 — Frame the decision (BLOCKING)

Write the **decision brief** before choosing anyone. A council fed a vague question returns a confident answer to the wrong one.

```
Decision:      <the choice, as a question with at least two real options>
Options:       <A: … / B: … / … — short IDs the votes will use; include "do nothing" when it is real>
Constraints:   <AGENTS.md rules, non-negotiables, deadlines, budget>
Evidence:      <what is known, each item cited: file:line, issue #, URL, measured number>
Reversibility: <two-way door (cheap to undo) | one-way door (migration, store review, public promise)>
Deadline:      <when the decision is needed, and what waiting costs>
```

Gate: if the decision is a two-way door with a cheap experiment available, **stop and say so**. Propose the experiment instead of a council. If the brief needs repo facts, gather them now with `grep`/`Read` and cite them. Seats should reason on evidence, not rediscover the repo.

## Step 2 — Select the panel

### The seats

Every seat is an analytical **lens with its own reasoning method**, not an impersonation. Two seats never share a method. Each seat may **abstain** when the question is outside its lens. That is how this panel avoids the padding that `/issue-work` warns about ("a persona cannot return an empty list"): an abstention is a valid, counted answer.

| Seat | Lens | Reasoning method | Sees what others miss | Tends to miss |
| --- | --- | --- | --- | --- |
| `ios` | iOS platform engineer: UIKit/SwiftUI lifecycle, background execution limits, entitlements, App Store Review Guidelines, HIG, TestFlight | **Platform-constraint tracing**: follow the decision through what iOS allows, at which OS version, and what review will reject | Suspension, entitlements, review rejections, privacy manifests | Android parity and cross-platform cost |
| `android` | Android platform engineer: process lifecycle, OEM battery killers, runtime permissions (API 33+), Play policies, ABI/APK size, R8 | **Device-matrix reasoning**: walk the decision across API levels, OEM skins and form factors (foldables, tablets) | Fragmentation, process death, Play policy, size budget | iOS-specific review risk |
| `rn` | React Native / Expo engineer: New Architecture, Expo SDK upgrades, config plugins, local modules, EAS Build/Update, Hermes, JS bundle | **Dependency and upgrade-path analysis**: what this adds to the native surface and the next SDK upgrade | Native-module cost, prebuild drift, OTA limits, lockfile risk | Product value of the feature |
| `cto` | Technical lead: architecture, maintainability, sequencing, total cost of ownership | **Reversibility and total-cost analysis**: classify one-way and two-way doors, then cost the 12-month maintenance | Lock-in, irreversible migrations, team capacity, what to defer | Short-term user delight |
| `design` | Design lead with **Jony Ive's design philosophy** as its lens (AGENTS.md §Design system, "Who decides a visual question"): restraint, clarity, iOS-native feel, grounded first in the in-repo design system and existing surfaces | **Reduction**: what can be removed until only the essential remains | Surface bloat, inconsistency with the in-repo design system | Engineering cost and platform limits |
| `privacy` | Privacy and security engineer: data flows, permissions, on-device storage, Apple privacy labels, GDPR, threat model | **Data-flow and threat tracing**: follow every byte the decision creates, from where it is born to where it is seen | Lock-screen exposure, permission cost, what leaves the device, docs/PRIVACY.md promises | Feature value that justifies a permission |
| `product` | Product strategist: user value, scope, adoption, conversion cost of prompts | **Opportunity cost and jobs-to-be-done**: which job this does, for whom, and what it displaces | Whether anyone needs it, what to measure, the cheaper 80% version | Implementation risk |
| `qa` | QA and release engineer: device verification, rollback, store timing, what CI cannot see | **Pre-mortem and failure-mode enumeration**: assume it shipped and broke, then list how | Blind spots of the build gate, rollback paths, review delays, migrations on old installs | Upside of moving fast |

### Triads

| Triad | Seats | Use it for |
| --- | --- | --- |
| `platform` | ios · android · rn | Native capability, OS behaviour, a new native dependency |
| `architecture` | cto · rn · qa | Data model, migrations, module boundaries, refactors |
| `product` | product · design · privacy | Whether and how a user-facing feature should exist |
| `release` | qa · ios · android | Ship or hold, store review risk, rollout |
| `privacy` | privacy · product · ios | Permissions, what leaves the device, lock-screen content |
| `design` | design · ios · android | Interaction patterns and platform-native feel, with options drawn from existing surfaces (`/issue-work` L5, file:line) |
| `ship` | cto · product · qa | Scope cuts, sequencing, "is this worth doing now" |

**Auto-selection** (no flag): match the brief against the "Use it for" column, pick one triad, and state the choice and its reason in one line.

**Domain-weight seat**: before any analysis, lock the one seat whose lens most directly owns the decision. Its vote weighs **1.5×** in the tally. Choose it now and never after seeing positions, or the coordinator steers the outcome. If two seats are equally central, choose none and say so.

`[ANNOUNCE]` State the panel, the mode, the domain-weight seat (or "none — ambiguous") and the estimated agent-call count, then continue. (An `[ANNOUNCE]` tag informs. A `[BLOCKING]` tag ends the turn and waits for the human. A step heading marked (BLOCKING) here, as in Step 0 of `/commit`, `/pr` and `/review`, means mandatory before continuing; `/issue-work` uses (BLOCKING) on its checkpoints to end the turn.)

## Step 3 — Run the rounds

Run seats as independent agents with no shared context: the `Workflow` tool, or parallel `Agent` calls, in Claude Code. Other tools use their own subagents. Every seat prompt carries the same preamble:

```
You are the `{seat}` seat of the Quock council: {lens}. Reason by {method}.
Read AGENTS.md first. You are READ-ONLY: never edit files, install packages, or touch git or GitHub.
Every claim about this repo cites file:line; every claim about a platform cites a URL you fetched
or names the OS/SDK version it holds for. Label each claim FACT | INFERENCE | ASSUMPTION | UNKNOWN.
If the question is outside your lens, abstain in one sentence instead of padding.
Decision brief:
{brief}
```

### Round 1 — Independent analysis (parallel, blind)

Each seat sees only the brief, not its peers. ≤300 words, with these sections: **Restatement** (one sentence through your lens), **Analysis**, **Recommendation**, **Kill criterion** (the observation that would make you wrong), **Confidence** (high | med | low). The last line is `OPTION: <option ID from the brief, or abstain>`, which is what the agreement check counts.

`[BLOCKING]` If any restatement reframes the question materially, show it to the human and end the turn. A wrong question costs more than a round. Otherwise continue. When the human replies: if they amend the brief, rerun Round 1 on it with the **same panel and domain-weight seat** (a new panel only if the human picks it), once per session, and record the restart in the Session line; if they keep the original framing, continue to Round 2. After that one rerun, a further material reframe is not re-blocked: record it under Unresolved questions and continue.

A seat that **abstained** in Round 1 sits out Round 2 and is recorded in Round 3 as `STANCE: abstain` without another call. If fewer than two seats remain active, skip Round 2 and the peer-based enforcement prompts and go to Round 3; the tally will usually read insufficient conviction or out of scope, so suggest a better panel.

### Round 2 — Cross-examination (anonymized)

Relabel the Round 1 outputs as Seat A, Seat B, … and strip self-references that reveal the lens. Tell each seat its own label so it never answers itself, and keep the rest of the mapping private until Round 3. With 4 seats or fewer run sequentially, each seat seeing earlier Round 2 replies. With more, run in parallel.

Prompt adds the **anti-conformity directive**: "Defend a correct position. Do not update because others disagree, because consensus is forming, or because a claim is repeated. Update only on a specific flaw you can name. If you cannot name the flaw, do not update."

Each seat, ≤250 words, engaging at least two other seats by label (every other seat when there are two or fewer): **Disagree with** (Seat X, which claim, why), **Strengthened by** (Seat Y, how), **Position update** (what changed and the named flaw, or "unchanged").

**Enforcement scan** (coordinator, after Round 2). Count every extra prompt sent for the verdict metadata.
- **Dissent quota**: fewer than 2 non-overlapping objections means two seats each get the prompt below, chosen mechanically before reading Round 2 content: seats whose Round 1 `OPTION:` differs from the majority first, then lowest Round 1 confidence, then Seats-table order: "State your strongest objection to the majority in 150 words, or reply `no substantive objection` if you have none."
- **Novelty gate**: a seat that only restated Round 1 gets: "Answer Seat X's challenge to you directly. What changes?"
- **Agreement check**: when over 70% of the non-abstaining seats named the same `OPTION:` in Round 1, the two of them with the lowest Round 1 confidence (ties broken by Seats-table order) get: "Assume the consensus is wrong. What is the strongest alternative, and what evidence would flip the decision? Reply `no credible alternative` if there is none."
- **Prompted objections are labelled as prompted** in the transcript. They reach the Minority report only if the seat then changes its Round 3 stance or declares a dealbreaker; "no substantive objection" is recorded as such, never as dissent.
- **Evidence check**: a claim about the repo without file:line, or about a platform with neither a fetched URL nor a named OS/SDK version, is struck from the record and noted.

### Round 3 — Final stance (parallel)

Identities restored. Each seat states its position in ≤100 words, with no new arguments, and ends with exactly one line:

```
STANCE: <option ID from the brief, or abstain> | CONFIDENCE: high|med|low|- | DEALBREAKER: <option ID>|no
```

The Round 3 prompt lists the brief's option IDs. Any label outside that list, other than `abstain` (with `CONFIDENCE: -`), is unparseable, and that is what keeps the tally countable without reading prose. `DEALBREAKER: <option ID>` names an option the seat holds actively harmful, not merely worse. A missing or unparseable line gets one re-prompt for the line only; never infer a stance from prose. Still unparseable after that, the seat is recorded as `abstain`: its base weight stays in `W_total`, and the Session line notes it.

### `--quick` and `--duo`

- `--quick`: Round 1, then Round 3 with peers' Round 1 visible. No cross-examination, and of the enforcement scan only the evidence check runs (after Round 1).
- `--duo a,b`: both seats open blind, then each answers the other directly (≤200 words, with the anti-conformity directive; no anonymization, since two seats know each other), then both give a Round 3 stance. The evidence check runs after the exchange. Use it when one tension defines the decision, for example `ios,android` or `product,privacy`.

## Step 4 — Tally

- **Weights**: base weight 1.0 per seat, 1.5 for the domain-weight seat. The vote weight is the base weight times confidence (high 1.0, med 0.75, low 0.5).
- **Totals**: `W_total` is the sum of **base** weights, abstentions included, so a hesitant panel cannot shrink its way to consensus. `W_option` is the sum of the vote weights backing that option.
- **Consensus** means `W_option ≥ ⅔ × W_total`. The highest option that clears the bar is the verdict.
- **No option clears ⅔**: do not run another round. Report which case it is:
  - **Split**: two or more options carry weight. Hand it to the human with each option's weight and its strongest argument.
  - **Insufficient conviction**: every non-abstaining vote backs one option, but low confidence or abstentions keep it under the bar. Report that option, its weight and the abstentions. Never call it a split, because nobody disagreed.
  - **Out of scope**: every seat abstained. Report it and suggest a better triad or `--members`.
- **Record the tally** (option → weight, who carried 1.5×, each confidence) so the verdict can be audited without the transcript.

## Step 5 — Verdict (chairman)

A **separate agent that did not deliberate** writes the verdict, in the maintainer's language, from the named transcript, the decision brief, the Step 4 tally record and the coordinator's session counters (agent calls, enforcement prompts, struck claims). It copies the tally and the counters as given, never recomputes them, so synthesis never rewrites the votes it is judging. A faithful English translation for an issue post is not a rewrite. It weighs arguments by validity, not by repetition, invents no position no seat held, and fills every section, or writes `N/A — <reason>`:

```
## Council verdict — <decision in one line>
Panel: <seats> · Mode: <standard|quick|duo> (+ all seats: yes|no) · Domain-weight seat: <seat|none> · Chairman: <agent/model>

### Unresolved questions        ← first, always: what the council does not know and how to find out
### Recommendation              ← the consensus option, or "No consensus: split" / "No consensus: insufficient conviction" / "Out of scope"
### Vote tally                  ← option → weight, confidences, 1.5× seat
### Why                         ← the 3-5 arguments that carried it, each labelled FACT/INFERENCE/ASSUMPTION
### Acceptable compromises
### Kill criteria               ← observations that should reverse this decision, and who watches for them
### Minority report             ← every DEALBREAKER and the option it vetoes, even when outvoted
### Concrete next step          ← one action, and the command that does it (e.g. `/issue`, `/issue-work 61`)
### Human decisions required    ← STOP signals, new dependencies, visual choices: listed for the maintainer, never decided here
---
Session: seats=<n> rounds=<n> agent_calls=<n> enforcement=<n: which> struck_claims=<n>
```

## Step 6 — Hand over and STOP

Present the verdict in the conversation, in the maintainer's language. Post it to an issue only when the human asks, and write that copy in English (English on the tracker, as `/issue` requires). A verdict is advice. Implementation goes through `/issue-work`, and its checkpoints still apply.

## NEVER

- Convene a council for a fact or for a cheap reversible choice. Answer it, or run the experiment.
- Choose the domain-weight seat after positions exist, or change the panel mid-session to change the outcome.
- Let seats see each other in Round 1, or see names in Round 2.
- Turn a split into consensus prose. A split goes to the human as a split.
- Let the chairman be a seat, or let the coordinator rewrite the chairman's verdict.
- Let a verdict approve a STOP signal, a new dependency or a visual choice. Those belong to the human.
- Keep a repo claim without file:line, or a platform claim with neither a URL nor an OS/SDK version, in the record.
- Run another round to "resolve" a split. The round budget is the forcing function.
