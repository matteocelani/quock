# Contributing to Quock

Thanks for helping out. Quock is an unofficial, MIT-licensed mobile client for [Ollama Cloud](https://ollama.com). This is the short human path; the full rulebook is [`AGENTS.md`](./AGENTS.md).

## Setup

```bash
pnpm install
pnpm ios        # or: pnpm android
```

You'll need [Node 22+](https://nodejs.org), [pnpm 11+](https://pnpm.io), [Xcode 16+](https://developer.apple.com/xcode/) (iOS) or [Android Studio](https://developer.android.com/studio) (Android), and a free [`ollama.com`](https://ollama.com) account. On first launch, follow the on-device prompt to pair the app.

## The flow

1. **Branch from `develop`** (never from `main`, never target `main`):
   `git checkout develop && git pull && git checkout -b fix/<short-name>` — prefixes: `feat/`, `fix/`, `chore/`, `docs/`, `refactor/`.
2. **Make focused changes.** Commit in [Conventional Commits](https://www.conventionalcommits.org) style (`fix(chat): …`). Don't bump the app version — that's release-only.
3. **Before you open the PR**, the build gate must pass (CI enforces it on every PR):
   ```bash
   pnpm typecheck && pnpm lint && pnpm test
   ```
   If you work with an AI agent, run `/review` (see [`.agent/commands/`](./.agent/commands/)).
4. **Open one PR into `develop`.** Keep it to a single concern. Describe what and why.

## Ground rules

Read [`AGENTS.md`](./AGENTS.md) — it's the source of truth for architecture, code rules, the design system, and the release workflow. A few non-negotiables that will get a PR sent back: Quock stays **brand-neutral** (not affiliated with Ollama, Inc.); the `LICENSE` dual copyright is preserved; the backend is **cloud-only** (`ollama.com`, no localhost); auth is the **Ed25519 device keypair**; and the **design system is owned in-repo** (no external UI libraries — new npm packages need explicit approval in the PR).

Be respectful and assume good faith. Found a security issue? Don't open a public issue — see [`SECURITY.md`](./SECURITY.md).
