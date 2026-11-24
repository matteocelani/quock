// Store facts were read from the App Store lookup API on 2026-11-23. The version and its date live in
// modules/changelog, whose newest entry is the current release.
const VERCEL_HOST = process.env.VERCEL_PROJECT_PRODUCTION_URL;
const GITHUB = "https://github.com/matteocelani/quock";
// main lags the live release until release/0.2.1 is merged, so the legal docs are read from develop.
const DOCS = `${GITHUB}/blob/develop/docs`;

export const SITE = {
  name: "Quock",
  // "Chat with" and "independent" say Quock is an app for the service, never the service itself.
  title: "Quock — Chat with Ollama Cloud on your iPhone",
  description:
    "An independent, open-source iPhone app for Ollama Cloud: streamed replies, thinking, web search, PDFs and images. Your chats stay on your phone. Free.",
  url:
    process.env.NEXT_PUBLIC_SITE_URL ??
    (VERCEL_HOST ? `https://${VERCEL_HOST}` : "http://localhost:3000"),
  appStoreUrl: "https://apps.apple.com/app/quock/id6785608333",
  appStoreId: "6785608333",
  githubUrl: GITHUB,
  releasesUrl: `${GITHUB}/releases`,
  licenseUrl: `${GITHUB}/blob/develop/LICENSE`,
  issuesUrl: `${GITHUB}/issues`,
  privacyUrl: `${DOCS}/PRIVACY.md`,
  termsUrl: `${DOCS}/TERMS.md`,
  ollamaPrivacyUrl: "https://ollama.com/privacy",
  author: "Matteo Celani",
  authorUrl: "https://github.com/matteocelani",
  authorXUrl: "https://x.com/0xMashu",
  releaseDate: "2026-07-23",
  price: 0,
  priceLabel: "Free",
  minimumIos: "15.1",
  sizeMb: 37,
  ageRating: "12+",
  disclaimer: "Quock is not affiliated with, endorsed by, or sponsored by Ollama, Inc.",
} as const;

// Every internal path, with the trailing slash the static export serves.
export const PATHS = {
  home: "/",
  guide: "/ollama-cloud-on-iphone/",
  faq: "/faq/",
  changelog: "/changelog/",
  privacy: "/privacy/",
} as const;

// The short name of each page for lists that name pages: nav, footer, llms.txt, and the inner pages' titles
// (the guide keeps its longer GUIDE_TITLE and GUIDE_HEADLINE).
export const PAGE_LABELS = {
  home: "Home",
  guide: "Guide",
  faq: "FAQs",
  changelog: "Changelog",
  privacy: "Privacy",
} as const;

// Browser-chrome colours mirror the --background tokens in globals.css; metadata cannot read CSS.
export const THEME_COLOR = { light: "#f7fbff", dark: "#1d1d1f" } as const;

// A build without a real domain must never be indexed, or its localhost canonicals would stick.
export const IS_INDEXABLE = !SITE.url.startsWith("http://localhost");
