import type { Metadata } from "next";
import { PATHS, SITE } from "@/lib/site";
import { absoluteUrl } from "@/lib/utils";

interface PageMetadataInput {
  title: string;
  description: string;
  path: string;
}

// The one share card (public/og.png, made by `pnpm assets`), used by every page.
export const SHARE_IMAGE = {
  url: "/og.png",
  width: 1200,
  height: 630,
  alt: "Quock's home screen and a chat on iPhone, beside the headline Open. Type. That's it.",
} as const;

// Next merges openGraph and twitter shallowly, so a page that set only `url` would drop the
// layout's title, description and image; every inner page builds its metadata here instead.
export function pageMetadata({ title, description, path }: PageMetadataInput): Metadata {
  const fullTitle = `${title} · ${SITE.name}`;
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

export const AUTHOR_JSON_LD = {
  "@type": "Person",
  name: SITE.author,
  url: SITE.authorUrl,
  sameAs: [SITE.authorXUrl],
} as const;

// Rendered once in the root layout, so every page carries it.
export const WEBSITE_JSON_LD = {
  "@context": "https://schema.org",
  "@type": "WebSite",
  name: SITE.name,
  url: SITE.url,
  description: SITE.description,
  inLanguage: "en",
  publisher: AUTHOR_JSON_LD,
};
