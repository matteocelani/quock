// main lags the live release until release/0.2.1 is merged, so legal links follow develop.
// Facts below were read from the App Store lookup API and the repo on 2026-11-23; update them with each release.
const VERCEL_HOST = process.env.VERCEL_PROJECT_PRODUCTION_URL;

export const SITE = {
  name: "Quock",
  // Positive framing (maintainer, 2026-11-23): "Chat with" and "independent" say it is an app for the service, not the service.
  title: "Quock — Chat with Ollama Cloud on your iPhone",
  description:
    "An independent, open-source iPhone app for Ollama Cloud: streamed replies, thinking, web search, PDFs and images. Your chats stay on your phone. Free.",
  url:
    process.env.NEXT_PUBLIC_SITE_URL ??
    (VERCEL_HOST ? `https://${VERCEL_HOST}` : "http://localhost:3000"),
  appStoreUrl: "https://apps.apple.com/app/quock/id6785608333",
  appStoreId: "6785608333",
  githubUrl: "https://github.com/matteocelani/quock",
  privacyUrl: "https://github.com/matteocelani/quock/blob/develop/docs/PRIVACY.md",
  termsUrl: "https://github.com/matteocelani/quock/blob/develop/docs/TERMS.md",
  issuesUrl: "https://github.com/matteocelani/quock/issues",
  author: "Matteo Celani",
  authorUrl: "https://github.com/matteocelani",
  authorXUrl: "https://x.com/0xMashu",
  version: "0.2.1",
  versionDate: "2026-11-06",
  minimumIos: "15.1",
  category: "Productivity",
  sizeMb: 37,
  ageRating: "12+",
  disclaimer:
    "Quock is an independent app and is not affiliated with, endorsed by, or sponsored by Ollama, Inc.",
} as const;

// A build without a real domain must never be indexed, or its localhost canonicals would stick.
export const IS_INDEXABLE = !SITE.url.startsWith("http://localhost");

