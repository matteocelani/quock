// Overridable via `EXPO_PUBLIC_OLLAMA_CLOUD_URL` to point at staging environments.
const DEFAULT_CLOUD_BASE_URL = "https://ollama.com";

export const CLOUD_BASE_URL: string =
  process.env.EXPO_PUBLIC_OLLAMA_CLOUD_URL ?? DEFAULT_CLOUD_BASE_URL;

// Central registry so Phase 0 endpoint changes are one-line swaps. Chat persistence is local-only (SQLite) — there are deliberately NO chat CRUD routes here; `/api/v1/chat/:id` is the desktop app's proprietary endpoint and is off-limits per the cloud-only rule.
export const API_ROUTES = {
  me: "/api/me",
  signout: "/api/signout",
  // Mirrors the web app's featured-models source. Cloud-only models live in the recommendations payload; the cloud doesn't yet have a dedicated `?cloud=true` filter on `/api/tags`.
  cloudModels: "/api/experimental/model-recommendations",
  modelCapabilities: "/api/show",
} as const;
// GitHub repo URL — used to deep-link to project-owned documents like the Privacy Policy and Terms of Service that live in `docs/`. Hardcoded because it is the canonical home of the codebase regardless of CLOUD_BASE_URL.
const QUOCK_REPO_URL = "https://github.com/matteocelani/quock";

// Public web URLs the app links to. `privacy` and `terms` point at OUR own policies in this repo because the app is Quock's surface — Ollama's privacy/terms apply to Ollama Cloud separately, not to what the Quock client does locally. The Ollama-side URLs (manageSubscription, upgrade, logo) remain on CLOUD_BASE_URL so staging envs flip them in lockstep. The sign-in URL itself is the `${CLOUD_BASE_URL}/connect?...` payload built dynamically from the device keypair (see `@/modules/auth/lib/connect#buildConnectUrl`), so it is not declared here.
export const LEGAL_URLS = {
  privacy: `${QUOCK_REPO_URL}/blob/main/docs/PRIVACY.md`,
  terms: `${QUOCK_REPO_URL}/blob/main/docs/TERMS.md`,
  // Apple + Google submission require a public support URL; GitHub Issues is the canonical channel for an MIT open-source client.
  support: `${QUOCK_REPO_URL}/issues`,
  manageSubscription: `${CLOUD_BASE_URL}/settings`,
  upgrade: `${CLOUD_BASE_URL}/upgrade`,
  logo: `${CLOUD_BASE_URL}/public/ollama.png`,
} as const;

// Official Ollama, Inc. community channels surfaced in the Settings sheet under "Ollama Cloud". These are NOT Quock-affiliated — exposing them inside the app is nominative fair use: it reinforces the non-affiliation message by pointing users to the upstream owner for support, docs, and community. Hardcoded (no CLOUD_BASE_URL substitution) because they are operated by Ollama, Inc. regardless of which API host this build talks to.
export const OLLAMA_LINKS = {
  docs: "https://docs.ollama.com/",
  cloudDocs: "https://docs.ollama.com/cloud",
  github: "https://github.com/ollama/ollama",
  discord: "https://discord.com/invite/ollama",
  twitter: "https://twitter.com/ollama",
  contactEmail: "hello@ollama.com",
} as const;
