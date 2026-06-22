# Security Policy

Quock is a solo-maintained, unofficial mobile client for [Ollama Cloud](https://ollama.com). It ships to the App Store and Google Play, so security reports are taken seriously.

## Scope

In scope: the **Quock app** and how it talks to Ollama Cloud — the request-signing path, the device keypair, local data handling.

The security boundary is the **Ed25519 device keypair**: it's generated on first launch, lives only in `expo-secure-store`, and signs every API request (no passwords, tokens, OAuth, or cookies). Conversations are stored locally on the device; only the message in flight reaches the cloud.

Out of scope: Ollama, Inc.'s servers, accounts, or the upstream Ollama runtime (report those to [ollama/ollama](https://github.com/ollama/ollama)); third-party dependencies (report upstream); cosmetic UI issues and documentation typos.

## Reporting a vulnerability

**Please report privately — do not open a public issue.**

- Preferred: GitHub's **"Report a vulnerability"** (the repository's *Security* tab → *Advisories*).
- Or email the maintainer (address is in the git history / GitHub profile).

Include what you can: affected version, platform (iOS/Android), steps to reproduce, and impact.

As a one-person project, triage is best-effort — expect an acknowledgement within a few days. Once a fix ships, credit is given in the release notes unless you prefer otherwise.
