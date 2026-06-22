# Release lifecycle

App Store review is slow (weeks). The release model lets work on the next version continue on `develop` while a submitted version stays frozen on its own `release/X.Y.Z` branch. Tags land on `main` only after Apple has approved and the version is live.

## Branch map

```
main                          protected, reflects the version PUBLISHED on the App Store.
  ↑ PR (release approved by Apple) → tag vX.Y.Z
develop                       protected, "next" — integration branch for all feature work.
  ↑ PR (feat/fix/chore/docs/refactor)
release/X.Y.Z                 release candidate frozen for App Store submission.
                              Bug fixes during Apple review land here, then cherry-picked to develop.
hotfix/X.Y.Z                  emergency fix on the live App Store version. Branched from main.
                              PR back to main, then cherry-pick to develop.
```

## Version numbers

SemVer (`MAJOR.MINOR.PATCH`). Pre-1.0: MINOR is feature, PATCH is fix.

| File | Field | When to bump |
| --- | --- | --- |
| `package.json` | `version` | Bumped on the `release/X.Y.Z` branch only — never on `develop`. |
| `app.json` | `expo.version` | Same as above, kept in sync with `package.json`. |
| `app.json` | `ios.buildNumber` | **Every** App Store submission, including resubmissions of the same `version` (Apple requires monotonic build numbers). |
| `app.json` | `android.versionCode` | Same as `buildNumber`, integer that strictly increases. |

Tags use the `vX.Y.Z` form (e.g. `v0.1.0`). One tag per published release, on the `main` commit.

---

## `/release-start X.Y.Z`

**Triggers**: `/release-start`, `@release-start`, "start release X.Y.Z", "freeze for App Store".

**Pre-conditions**:

1. On `develop`, working tree clean, in sync with `origin/develop`.
2. No other `release/*` branch currently open (one release in flight at a time).
3. `/review` has just passed clean.

### Procedure

1. **Read** [`AGENTS.md`](../../AGENTS.md) end-to-end (loop discipline applies here too).
2. **Validate the version argument** matches SemVer and bumps strictly above the last published tag.
3. **Branch**: `git checkout -b release/X.Y.Z`.
4. **Bump versions**:
   - `package.json` → `"version": "X.Y.Z"`.
   - `app.json` → `expo.version` = `"X.Y.Z"`; `expo.ios.buildNumber` and `expo.android.versionCode` to next monotonic value (read the previous and increment by 1).
5. **Single commit**: `chore(release): bump version to X.Y.Z (build N)`.
6. **Build gate**: `pnpm typecheck && pnpm lint && pnpm test` — STOP on red.
7. **Push**: `git push -u origin release/X.Y.Z`.
8. **Open draft PR** to `main`:
   ```bash
   gh pr create --base main --head release/X.Y.Z --draft \
     --title "Release X.Y.Z" --body "Frozen for App Store submission. Mark ready when Apple approves."
   ```
9. **Announce** the PR URL and STOP. The human takes over from here: `eas build --profile production` + `eas submit`.

### Both stores (iOS + Android)

`eas submit` ships to the App Store and Google Play from one `eas build --profile production`. Keep `ios.buildNumber` and `android.versionCode` bumped together (step 4) so the stores stay in lockstep. Google Play runs its OWN review — independent of, and usually faster than, Apple's — so the app can be live on Play while still in App Store review. Treat the SLOWER of the two as the gate for tagging `main`: a version is "published" once both stores have it.

### During Apple review

- Fixes requested by App Review go to `release/X.Y.Z` as normal commits, then `eas build` + resubmit (bump only `buildNumber` / `versionCode`, not `version`).
- Every fix that lands on `release/X.Y.Z` MUST be cherry-picked to `develop` in the same session — otherwise the next release will re-introduce the bug.
- `develop` keeps moving forward in parallel: feature branches branch from `develop`, PR to `develop` as usual.

### When Apple approves

1. Mark the draft PR ready: `gh pr ready <number>`.
2. Human merges `release/X.Y.Z` → `main`.
3. Tag the merge commit on `main`: `git tag vX.Y.Z && git push origin vX.Y.Z`.
4. Open a GitHub Release on that tag with the changelog (Conventional Commits make this easy).
5. Sync `develop` from `main` (PR `main → develop` if any release fixes were never cherry-picked).
6. Delete the local + remote `release/X.Y.Z` branch.

### If a review fails or the release is abandoned

If a store rejects the build late (incompatible binary, bad provisioning) and the release can't be salvaged: first cherry-pick any fixes that landed on `release/X.Y.Z` back to `develop`, then delete the branch (`git branch -D release/X.Y.Z && git push origin --delete release/X.Y.Z`), and start the next attempt fresh with `/release-start` at a bumped version. Never leave a dead `release/*` branch open — one release in flight at a time.

---

## `/hotfix X.Y.Z`

**Triggers**: `/hotfix`, "emergency fix on App Store version", "hotfix live".

Use when a critical bug is discovered in the version currently live on the App Store and it cannot wait for the next planned release.

### Procedure

1. **Branch from `main`**: `git checkout main && git pull && git checkout -b hotfix/X.Y.Z`.
2. **Fix** the bug. Keep the scope tight — one bug per hotfix.
3. **Bump**: PATCH only (`0.1.0` → `0.1.1`) in `package.json` and `app.json`; bump `buildNumber` / `versionCode`.
4. **Build gate**: `pnpm typecheck && pnpm lint && pnpm test`.
5. **PR**: `gh pr create --base main --head hotfix/X.Y.Z --title "hotfix: <description>" --body "..."`.
6. **Cherry-pick** the same commits to `develop` in the same session: `git checkout develop && git cherry-pick <sha>...`.
7. **Submit** via `eas build` + `eas submit` once the PR is merged and tagged.

A hotfix is the only path that touches `main` outside of a planned release.

---

## NEVER

- Bump `version` on `develop` — only on `release/X.Y.Z` or `hotfix/X.Y.Z`.
- Forget to cherry-pick a release/hotfix commit to `develop` — the bug will resurface next release.
- Skip the `buildNumber` increment on resubmission — Apple rejects builds with a non-monotonic build number.
- Open more than one `release/*` branch at a time.
- Tag a commit on `main` before the version is published — gated on the slower of App Store / Google Play approval.
- Push to `main` directly. Hotfix and release land via PR.
- Merge own PR (sub-task, release, or hotfix).
