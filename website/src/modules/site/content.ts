import { GUIDE_TITLE } from "@/modules/guide/content";
import { SITE } from "@/lib/site";

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
  GUIDE_TITLE,
  "iPhone LLM client",
  "LLM chat app",
  "open models",
  "AI chat iPhone",
  "private AI chat",
  SITE.name,
] as const;

// Trademark notes that sit beside the disclaimer in the footer.
export const LEGAL_NOTE =
  "Ollama is a trademark of its respective owner. App Store and iPhone are trademarks of Apple Inc.";
