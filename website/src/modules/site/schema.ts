import { AUTHOR_JSON_LD } from "@/lib/metadata";
import { PATHS, SITE } from "@/lib/site";
import { absoluteUrl } from "@/lib/utils";

// Rendered once in the root layout, so every page carries it.
export const WEBSITE_JSON_LD = {
  "@context": "https://schema.org",
  "@type": "WebSite",
  name: SITE.name,
  url: absoluteUrl(PATHS.home),
  description: SITE.description,
  inLanguage: "en",
  publisher: AUTHOR_JSON_LD,
};
