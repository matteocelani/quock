export const NOT_FOUND = {
  metaTitle: "Page not found",
  title: "Not",
  marked: "here.",
  body: "That page doesn\u2019t exist, but the app does.",
} as const;

// The search phrases people use for this app; the keywords meta tag and the JSON-LD both read them.
export const SEO_KEYWORDS = [
  "Ollama Cloud client",
  "Ollama Cloud iPhone app",
  "how to use Ollama Cloud on iPhone",
  "iPhone LLM client",
  "LLM chat app",
  "open models",
  "AI chat iPhone",
  "private AI chat",
  "Quock",
] as const;

// The two lines under the headline on the share card (public/og.png); `pnpm assets` reads them from here.
export const SHARE_CARD_LINES = ["Chat with Ollama Cloud on iPhone.", "Independent, free and open source."] as const;

// Trademark notes that sit beside the disclaimer in the footer.
export const LEGAL_NOTE =
  "Ollama is a trademark of its respective owner. App Store and iPhone are trademarks of Apple Inc.";
