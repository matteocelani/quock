import { LATEST_RELEASE } from "@/modules/changelog/content";
import { APP_FEATURES, SEO_KEYWORDS } from "@/modules/home/content";
import { screenSrc, type ScreenName } from "@/modules/home/screens";
import { AUTHOR_JSON_LD, SHARE_IMAGE } from "@/lib/metadata";
import { PATHS, SITE } from "@/lib/site";
import { absoluteUrl } from "@/lib/utils";

const SCHEMA_SCREENS: readonly ScreenName[] = ["home", "open_model", "chat", "compose", "history"];

// The facts search engines and assistants quote about the app. No aggregateRating: the store lists no ratings
// yet, and a rating is only ever quoted from the App Store lookup API, never estimated.
export const APP_JSON_LD = {
  "@context": "https://schema.org",
  "@type": "MobileApplication",
  name: SITE.name,
  description: SITE.description,
  operatingSystem: `iOS ${SITE.minimumIos} or later`,
  applicationCategory: `${SITE.category}Application`,
  softwareVersion: LATEST_RELEASE.version,
  datePublished: SITE.releaseDate,
  dateModified: LATEST_RELEASE.date,
  contentRating: SITE.ageRating,
  fileSize: `${SITE.sizeMb}MB`,
  inLanguage: "en",
  url: absoluteUrl(PATHS.home),
  downloadUrl: SITE.appStoreUrl,
  installUrl: SITE.appStoreUrl,
  image: absoluteUrl(SHARE_IMAGE.url),
  screenshot: SCHEMA_SCREENS.map((screen) => absoluteUrl(screenSrc(screen))),
  offers: { "@type": "Offer", price: String(SITE.price), priceCurrency: SITE.priceCurrency },
  author: AUTHOR_JSON_LD,
  license: SITE.licenseUrl,
  isAccessibleForFree: SITE.price === 0,
  sameAs: [SITE.appStoreUrl, SITE.githubUrl],
  keywords: SEO_KEYWORDS.join(", "),
  featureList: APP_FEATURES,
};
