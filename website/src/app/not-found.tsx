import type { Metadata } from "next";
import type { ReactNode } from "react";
import { ButtonLink } from "@/components/ui/button";
import { Heading, Marker } from "@/components/ui/heading";
import { SiteShell } from "@/components/layout/site-shell";
import { NOT_FOUND } from "@/modules/site/content";
import { PATHS } from "@/lib/site";

// No canonical and no social card: a missing page must never preview or index as the home page.
export const metadata: Metadata = {
  title: "Page not found",
  robots: { index: false, follow: true },
  alternates: { canonical: null },
  openGraph: null,
  twitter: null,
};

// Lives outside the route groups, so it brings its own shell.
export default function NotFound(): ReactNode {
  return (
    <SiteShell theme="light">
      <div className="flex flex-col items-center justify-center px-5 pt-44 pb-24 text-center">
        <Heading as="h1" size="display">
          {NOT_FOUND.title} <Marker>{NOT_FOUND.marked}</Marker>
        </Heading>
        <p className="text-muted-foreground mt-6 text-lg font-bold">{NOT_FOUND.body}</p>
        <ButtonLink href={PATHS.home} className="mt-9">
          Back home
        </ButtonLink>
      </div>
    </SiteShell>
  );
}
