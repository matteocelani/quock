import type { Metadata } from "next";
import { SITE } from "@/lib/site";
import { absoluteUrl } from "@/lib/utils";

interface PageMetadataInput {
  title: string;
  description: string;
  path: string;
}

// Next merges openGraph and twitter shallowly, so a page that sets only `url` would drop the
// layout's title and description; every inner page goes through here to stay complete.
const SHARE_IMAGE = {
  url: "/opengraph-image.png",
  width: 1200,
  height: 630,
  alt: "Quock's home screen and a chat on iPhone, beside the headline Open. Type. That's it.",
} as const;

export function pageMetadata({ title, description, path }: PageMetadataInput): Metadata {
  const fullTitle = `${title} · Quock`;
  return {
    title,
    description,
    alternates: { canonical: path },
    openGraph: {
      type: "website",
      siteName: SITE.name,
      locale: "en_US",
      title: fullTitle,
      description,
      url: path,
      images: [SHARE_IMAGE],
    },
    twitter: { card: "summary_large_image", title: fullTitle, description, images: [SHARE_IMAGE] },
  };
}

// BreadcrumbList for an inner page: Home > Page. Search engines show it in place of the bare URL.
export function breadcrumbJsonLd(name: string, path: string): Record<string, unknown> {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: SITE.name, item: absoluteUrl("/") },
      { "@type": "ListItem", position: 2, name, item: absoluteUrl(path) },
    ],
  };
}

// WebSite, rendered once in the root layout for every page.
export const WEBSITE_JSON_LD = {
  "@context": "https://schema.org",
  "@type": "WebSite",
  name: SITE.name,
  url: SITE.url,
  description: SITE.description,
  inLanguage: "en",
  publisher: { "@type": "Person", name: SITE.author, url: SITE.authorUrl, sameAs: [SITE.authorXUrl] },
};
