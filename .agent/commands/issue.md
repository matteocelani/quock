# /issue

**Triggers**: `/issue`, `@issue`, "open an issue", "file this bug".

**Pre-condition**: nothing has been branched or coded for this concern **in this repo** yet — a contributor's fork does not count. The command ends at an issue URL, never at a branch, a commit, or a fix.

## Step 1 — Classify and dedup

Security, seed, key, or token → do NOT open a public issue: point at [`SECURITY.md`](../../SECURITY.md) and STOP.

Otherwise it is a `bug` (broken against what shipped) or a `feature` (something Quock does not do today). One issue = one concern = one later PR, so a report carrying separable concerns becomes separate issues — a foldable layout bug and an agent mode are not one ticket.

```bash
gh issue list --state all --search "<2-4 distinctive words>" --limit 20
```

Already filed → comment there, give the human that URL, STOP.

## Step 2 — Point at the code

Find where the concern lives — `grep -rn "SymbolName"` — and name one or two `file:line`. No patch, no diff. Say "likely" when it is a guess, and drop the pointer rather than guess wildly.

## Step 3 — Write it short

**Title**: what is wrong or wanted, specific — `AttachSheet tool rows stretch full width on foldable`, not `UI bug`.

**Body**: the sections of the matching form ([`bug_report.md`](../../.github/ISSUE_TEMPLATE/bug_report.md) / [`feature_request.md`](../../.github/ISSUE_TEMPLATE/feature_request.md)), a line or two each, plus a **Where it likely lives** section carrying the Step 2 pointers. Omit a section rather than writing "N/A".

**One line per paragraph.** GitHub renders every newline in an issue body as a `<br>`, so prose hard-wrapped at 80 columns the way source files are arrives as a broken ladder. Leave a blank line after each bold heading, and let the browser wrap.

**Only what the reporter gave.** Never invent a device, a version, or a repro step — write `not stated` or ask. A report too thin to say what is broken gets a question, not a guess.

**Screenshots.** Ask for them: a UI report without a capture is worth one question before filing, and the human usually has the files. `gh` cannot upload images — no REST endpoint exists — so describe what each one shows and tell the human to drag them onto the issue once it exists.

Example — a whole body, not an excerpt:

```markdown
**What happened?**

On an unfolded foldable the AttachSheet tool rows run the full sheet width, so the toggles read as one stretched bar. Expected: a phone-width column.

**Steps to reproduce**

1. Open Quock on an unfolded foldable.
2. Tap + in the composer.
3. Look at the Tools rows.

**Environment**

- Platform: Android (Honor Magic V2, unfolded)
- Quock version: not stated by reporter

**Where it likely lives**

- `src/components/ui/Sheet.tsx:197` — the card is pinned `left`/`right` to `sheetPrimitive.insetMargin` with no max width, so it takes the whole display.
- `src/components/chat/AttachSheetRows.tsx:75` — `ToolRow` is a `flex-row` with a `flex-1` label, so the indicator sits at the far edge of whatever width it gets.

**Screenshots / logs**

Reporter's screenshot to attach: sheet open, tool rows full-bleed.
```

## Step 4 — Open it, announce, STOP

```bash
gh issue create --title "..." --body-file <path> --label "bug"
```

`--body-file` over an inline heredoc: a body with backticks, `$`, and blank lines survives a file untouched.

Labels are the repo's own — `gh label list` when unsure, never invent one. For issues that means `bug` or `feature`, plus `needs-device` when only a device can confirm it, since CI never builds the app.

```
✓ #<n> <title> → <url>
```

The later PR closes it with `Fixes #<n>`.

## NEVER

- Cut a branch or write the fix in the same turn.
- Bundle two separable concerns into one issue.
- Open a public issue for a security report.
- Invent a label, a device, a version, or a repro step.
- Any language other than English in the title or body.
- Paste a diff or a full file into the body — `file:line` is the pointer.
