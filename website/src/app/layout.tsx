import type { Metadata, Viewport } from "next";
import type { PropsWithChildren, ReactNode } from "react";
import "@/app/globals.css";
import { JsonLd } from "@/components/global/json-ld";
import { SEO_KEYWORDS } from "@/modules/home/content";
import { WEBSITE_JSON_LD } from "@/modules/site/schema";
import { TITLE_TEMPLATE, socialMetadata } from "@/lib/metadata";
import { IS_INDEXABLE, PATHS, SITE, THEME_COLOR } from "@/lib/site";

export const metadata: Metadata = {
  metadataBase: new URL(SITE.url),
  title: { default: SITE.title, template: TITLE_TEMPLATE },
  ...socialMetadata({ title: SITE.title, description: SITE.description, path: PATHS.home }),
  applicationName: SITE.name,
  authors: [{ name: SITE.author, url: SITE.authorUrl }],
  creator: SITE.author,
  keywords: [...SEO_KEYWORDS],
  category: SITE.category.toLowerCase(),
  robots: { index: IS_INDEXABLE, follow: IS_INDEXABLE },
  itunes: { appId: SITE.appStoreId },
  formatDetection: { telephone: false },
};

export const viewport: Viewport = {
  themeColor: THEME_COLOR.light,
  colorScheme: "light",
};

// Header, footer and theme live in the route-group layouts: (home) is light, (pages) is dark.
export default function RootLayout({ children }: PropsWithChildren): ReactNode {
  return (
    <html lang="en">
      <body className="min-h-dvh">
        <a
          href="#main"
          className="bg-primary text-primary-foreground sr-only z-50 rounded-xl px-4 py-2 focus:not-sr-only focus:fixed focus:top-4 focus:left-4"
        >
          Skip to content
        </a>
        <JsonLd data={WEBSITE_JSON_LD} />
        {children}
      </body>
    </html>
  );
}
