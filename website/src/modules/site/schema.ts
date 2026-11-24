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

// Search engines show Home > Page in place of the bare URL.
export function breadcrumbJsonLd(name: string, path: string): Record<string, unknown> {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: SITE.name, item: absoluteUrl(PATHS.home) },
      { "@type": "ListItem", position: 2, name, item: absoluteUrl(path) },
    ],
  };
}
