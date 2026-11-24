import type { Metadata } from "next";
import { SITE } from "@/lib/site";

interface SocialInput {
  title: string;
  description: string;
  path: string;
}

// One separator for <title>, og:title and twitter:title, so they can never drift apart.
export const TITLE_TEMPLATE = `%s · ${SITE.name}`;

// The one share card, used by every page. `pnpm assets` draws it from these values and the hero headline.
export const SHARE_IMAGE = {
  url: "/og.png",
  width: 1200,
  height: 630,
  lines: ["Chat with Ollama Cloud on iPhone.", "Independent, free and open source."],
  screens: ["home", "chat"],
  alt: "Quock's home screen and a chat on an iPhone, beside the app's headline.",
} as const;

// Next merges openGraph and twitter shallowly, so each page sends the whole set or loses the image.
export function socialMetadata({ title, description, path }: SocialInput): Metadata {
  return {
    description,
    alternates: { canonical: path },
    openGraph: {
      type: "website",
      siteName: SITE.name,
      locale: "en_US",
      title,
      description,
      url: path,
      images: [SHARE_IMAGE],
    },
    twitter: { card: "summary_large_image", title, description, images: [SHARE_IMAGE] },
  };
}

export function pageMetadata({ title, description, path }: SocialInput): Metadata {
  return { title, ...socialMetadata({ title: TITLE_TEMPLATE.replace("%s", title), description, path }) };
}

export const AUTHOR_JSON_LD = {
  "@type": "Person",
  name: SITE.author,
  url: SITE.authorUrl,
  sameAs: [SITE.authorXUrl],
} as const;
