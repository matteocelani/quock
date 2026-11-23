import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import "@/app/globals.css";
import { JsonLd } from "@/components/global/json-ld";
import { SHARE_IMAGE, WEBSITE_JSON_LD } from "@/lib/metadata";
import { IS_INDEXABLE, PATHS, SITE, THEME_COLOR } from "@/lib/site";

export const metadata: Metadata = {
  metadataBase: new URL(SITE.url),
  title: { default: SITE.title, template: `%s · ${SITE.name}` },
  description: SITE.description,
  applicationName: SITE.name,
  authors: [{ name: SITE.author, url: SITE.authorUrl }],
  creator: SITE.author,
  keywords: [
    "Ollama Cloud client",
    "Ollama Cloud iPhone app",
    "how to use Ollama Cloud on iPhone",
    "iPhone LLM client",
    "LLM chat app",
    "open models",
    "AI chat iPhone",
    "private AI chat",
    "Quock",
  ],
  category: "productivity",
  alternates: { canonical: PATHS.home },
  openGraph: {
    type: "website",
    siteName: SITE.name,
    title: SITE.title,
    description: SITE.description,
    url: PATHS.home,
    locale: "en_US",
    images: [SHARE_IMAGE],
  },
  twitter: {
    card: "summary_large_image",
    title: SITE.title,
    description: SITE.description,
    images: [SHARE_IMAGE],
  },
  robots: { index: IS_INDEXABLE, follow: IS_INDEXABLE },
  itunes: { appId: SITE.appStoreId },
  formatDetection: { telephone: false },
};

export const viewport: Viewport = {
  themeColor: THEME_COLOR.light,
  colorScheme: "light",
};

// Header, footer and theme live in the route-group layouts: (home) is light, (pages) is dark.
export default function RootLayout({ children }: Readonly<{ children: ReactNode }>): ReactNode {
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
