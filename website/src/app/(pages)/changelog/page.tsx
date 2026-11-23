import type { Metadata } from "next";
import type { ReactNode } from "react";
import { TextLink } from "@/components/ui/text-link";
import { ReleaseLines } from "@/components/changelog/release-lines";
import { PageColumn, PageIntro } from "@/components/layout/page-intro";
import { CHANGELOG_FOOTNOTE, CHANGELOG_UPDATED, LATEST_RELEASE } from "@/modules/changelog/content";
import { pageMetadata } from "@/lib/metadata";
import { PAGE_LABELS, PATHS, SITE } from "@/lib/site";

export const metadata: Metadata = pageMetadata({
  title: PAGE_LABELS.changelog,
  description: `What changed in each Quock release, up to version ${LATEST_RELEASE.version}.`,
  path: PATHS.changelog,
});

export default function ChangelogPage(): ReactNode {
  return (
    <PageColumn>
      <PageIntro title={PAGE_LABELS.changelog} updated={CHANGELOG_UPDATED} path={PATHS.changelog} />
      <ReleaseLines />
      <p className="text-muted-foreground text-body mt-16">
        {CHANGELOG_FOOTNOTE.body} <TextLink href={SITE.releasesUrl}>{CHANGELOG_FOOTNOTE.linkLabel}</TextLink>.
      </p>
    </PageColumn>
  );
}
