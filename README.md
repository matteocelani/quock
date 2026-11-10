<div align="center">

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="assets/images/icon-dark.png" />
  <img src="assets/images/icon-light.png" alt="Quock" width="120" height="120" />
</picture>

# Quock

**Ollama Cloud, in your pocket.**

A community-built iPhone client for [Ollama Cloud](https://ollama.com). Chat with cloud-hosted LLMs from your phone — an [`ollama.com`](https://ollama.com) account is required, inference runs in the cloud, and conversations stay on your phone.

<a href="https://apps.apple.com/app/quock/id6785608333?utm_source=github&utm_medium=readme&utm_campaign=quock_free_2026">
  <img src="https://toolbox.marketingtools.apple.com/api/badges/download-on-the-app-store/black/en-us?size=250x83" alt="Download on the App Store" width="120" height="40" />
</a>

</div>

---

## What is Quock?

**Quock is an iPhone client for [Ollama Cloud](https://ollama.com).** Sign in once with your `ollama.com` account, pick any cloud-hosted model — Gemma, Qwen, Llama, GPT-OSS, DeepSeek, and more — and start typing. Answers stream back word by word. Inference runs in the cloud.

It's deliberately small and focused: **open the app, tap a model, type — a streamed reply in under three taps from home.** Your chat history lives in a local database on the device; the only thing that ever leaves your phone is the conversation you are actively sending.

## What it does

- 💬 **Chat in your pocket** — sign in once, pick a model, and start typing. Responses stream back word-by-word.
- 🧠 **Thinking & web search** — turn on reasoning for models that support it, or let the model search the web mid-answer. Both are per-chat toggles you set once.
- ✨ **Act on part of an answer** — long-press any paragraph of a reply to send just that piece to a deeper question or a web search, without retyping it.
- 🔒 **Conversations stay on your phone** — chat history lives in a local database on your device. The only thing that travels to the cloud is the conversation you are actively sending.
- 🖼️ **Add images and screenshots** — drop a photo into the conversation when you're using a vision-capable model.
- 📄 **Ask about a document** — attach a PDF and question it. Quock reads its text layer, or runs OCR on your device when there is none, and keeps the pages in view as the conversation continues.
- 🎨 **Quietly beautiful** — light, dark, and system themes with frosted-glass surfaces, smooth animations, and instant scrolling even on long chats.

## Screenshots

<!-- TODO: demo GIF of streaming chat (5-10 s, <5 MB) -->

<div align="center">
  <img src="docs/screenshots/0.2.png" width="100%" alt="Pick a model, attach a document, and watch the model think" />
</div>

## Quick start

Just want to use the app? Get it on the [App Store](https://apps.apple.com/app/quock/id6785608333). To run it from source:

```bash
pnpm install

# iOS simulator — installs CocoaPods on first run
pnpm ios

# Android emulator
pnpm android
```

You'll need [Node 22+](https://nodejs.org), [pnpm 11+](https://pnpm.io), [Xcode 16+](https://developer.apple.com/xcode/) or [Android Studio](https://developer.android.com/studio), and an [`ollama.com`](https://ollama.com) account. On first launch, follow the prompt in the app to pair it with your account. Running on a physical phone? See [`AGENTS.md`](./AGENTS.md#getting-started).

## Contributing

New here? [`CONTRIBUTING.md`](./CONTRIBUTING.md) is the short human path — clone, run, branch, PR. The full rulebook (non-negotiables, feature-first architecture, the `/commit` · `/pr` · `/review` workflow) lives in [`AGENTS.md`](./AGENTS.md).

Bug reports and PRs welcome. Found a security issue? See [`SECURITY.md`](./SECURITY.md).

## Download

- **iPhone** — [Quock on the App Store](https://apps.apple.com/app/quock/id6785608333)
- **Android** — coming soon on Google Play

## Resources

> [!NOTE]
> These are Ollama, Inc.'s official channels. Quock is unaffiliated. For Quock-specific bugs or feature requests, please open an issue on **this** repository.

- [`ollama.com`](https://ollama.com) — homepage, models, cloud subscription
- [`docs.ollama.com`](https://docs.ollama.com/) — official documentation
- [`github.com/ollama/ollama`](https://github.com/ollama/ollama) — runtime source code
- [`discord.com/invite/ollama`](https://discord.com/invite/ollama) — community Discord
- [`twitter.com/ollama`](https://twitter.com/ollama) — announcements on X
- `hello@ollama.com` — Ollama account / billing support

## Acknowledgments

Thank you to the [**Ollama**](https://github.com/ollama/ollama) team. Quock is an unofficial iPhone client for [Ollama Cloud](https://ollama.com), not affiliated with Ollama, Inc. It requires an [`ollama.com`](https://ollama.com) account, and inference runs in the cloud.

If you're new to Ollama Cloud, start at [**ollama.com**](https://ollama.com) for models and the cloud subscription.

## License

[MIT](./LICENSE) © 2026 [Matteo Celani](https://github.com/matteocelani), with the original `Copyright (c) Ollama` preserved per MIT terms.

---

<div align="center">

Made with ❤️ from around the world

</div>
