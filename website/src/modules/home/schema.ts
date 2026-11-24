import { LATEST_RELEASE } from "@/modules/changelog/content";
import { APP_FEATURES } from "@/modules/home/content";
import { screenSrc, type ScreenName } from "@/modules/home/screens";
import { AUTHOR_JSON_LD, SHARE_IMAGE } from "@/lib/metadata";
import { SITE } from "@/lib/site";
import { absoluteUrl } from "@/lib/utils";

const SCHEMA_SCREENS: readonly ScreenName[] = ["home", "open_model", "chat", "compose", "history"];

// The facts search engines and assistants quote about the app.
export const APP_JSON_LD = {
  "@context": "https://schema.org",
  "@type": "MobileApplication",
  name: SITE.name,
  description: SITE.description,
  operatingSystem: `iOS ${SITE.minimumIos} or later`,
  applicationCategory: "ProductivityApplication",
  softwareVersion: LATEST_RELEASE.version,
  datePublished: SITE.releaseDate,
  dateModified: LATEST_RELEASE.date,
  contentRating: SITE.ageRating,
  fileSize: `${SITE.sizeMb}MB`,
  inLanguage: "en",
  url: SITE.url,
  downloadUrl: SITE.appStoreUrl,
  installUrl: SITE.appStoreUrl,
  image: absoluteUrl(SHARE_IMAGE.url),
  screenshot: SCHEMA_SCREENS.map((screen) => absoluteUrl(screenSrc(screen))),
  offers: { "@type": "Offer", price: String(SITE.price), priceCurrency: "USD" },
  author: AUTHOR_JSON_LD,
  license: SITE.licenseUrl,
  isAccessibleForFree: SITE.price === 0,
  sameAs: [SITE.appStoreUrl, SITE.githubUrl],
  keywords: "Ollama Cloud, iPhone, LLM chat, open models, private AI chat",
  featureList: APP_FEATURES,
};
