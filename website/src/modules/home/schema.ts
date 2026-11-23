import { SITE } from "@/lib/site";
import { absoluteUrl } from "@/lib/utils";

// MobileApplication for the home page: the facts search engines and assistants quote about the app.
export const APP_JSON_LD = {
  "@context": "https://schema.org",
  "@type": "MobileApplication",
  name: SITE.name,
  description: SITE.description,
  operatingSystem: `iOS ${SITE.minimumIos} or later`,
  applicationCategory: "ProductivityApplication",
  softwareVersion: SITE.version,
  datePublished: "2026-07-23",
  dateModified: SITE.versionDate,
  contentRating: SITE.ageRating,
  fileSize: `${SITE.sizeMb}MB`,
  inLanguage: "en",
  url: SITE.url,
  downloadUrl: SITE.appStoreUrl,
  installUrl: SITE.appStoreUrl,
  image: absoluteUrl("/opengraph-image.png"),
  screenshot: ["home", "open_model", "chat", "compose", "history"].map((name) =>
    absoluteUrl(`/screens/${name}-840.webp`),
  ),
  offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
  author: { "@type": "Person", name: SITE.author, url: SITE.authorUrl, sameAs: [SITE.authorXUrl] },
  license: `${SITE.githubUrl}/blob/main/LICENSE`,
  isAccessibleForFree: true,
  sameAs: [SITE.appStoreUrl, SITE.githubUrl],
  keywords: "Ollama Cloud, iPhone, LLM chat, open models, private AI chat",
  featureList: [
    "Chat with every Ollama Cloud model",
    "Streamed replies",
    "Thinking mode for reasoning models",
    "Live web search",
    "PDF reading with on-device OCR",
    "Images and screenshots for vision models",
    "Memory kept on the device",
    "Answers that finish in the background",
    "Pinned chats and forks",
    "Light and dark themes",
    "No analytics, chats stored on the iPhone",
  ],
};
