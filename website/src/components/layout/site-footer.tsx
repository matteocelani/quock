import Link from "next/link";
import type { ComponentType, ReactNode, SVGProps } from "react";
import { ButtonLink } from "@/components/ui/button";
import { DownloadIcon, GithubIcon, ShieldIcon, XIcon } from "@/components/ui/icons";
import { LEGAL_NOTE } from "@/modules/site/content";
import { LINK_LABELS, PAGE_LABELS, PATHS, SITE } from "@/lib/site";
import { externalLinkProps } from "@/lib/utils";

interface IconLink {
  href: string;
  label: string;
  icon: ComponentType<SVGProps<SVGSVGElement>>;
}

const ICON_LINKS: readonly IconLink[] = [
  { href: SITE.githubUrl, label: `${SITE.name} on GitHub`, icon: GithubIcon },
  { href: SITE.authorXUrl, label: `${SITE.author} on X`, icon: XIcon },
  { href: SITE.appStoreUrl, label: `${SITE.name} on the App Store`, icon: DownloadIcon },
  { href: PATHS.privacy, label: PAGE_LABELS.privacy, icon: ShieldIcon },
];

const TEXT_LINKS = [
  { href: PATHS.guide, label: PAGE_LABELS.guide },
  { href: PATHS.faq, label: PAGE_LABELS.faq },
  { href: PATHS.changelog, label: PAGE_LABELS.changelog },
  { href: PATHS.privacy, label: PAGE_LABELS.privacy },
  { href: SITE.termsUrl, label: LINK_LABELS.terms },
  { href: SITE.githubUrl, label: LINK_LABELS.source },
] as const;

// Static export: the year is the build's, so a deploy keeps it current.
const BUILD_YEAR = new Date().getFullYear();

// The footer whispers: the legal line lives here in small type, so headlines never have to carry it.
export function SiteFooter(): ReactNode {
  return (
    <footer className="mt-24 pt-10 pb-14 sm:mt-28">
      <div className="flex flex-col items-center gap-6 px-5 text-center">
        <ul className="flex gap-2.5">
          {ICON_LINKS.map(({ href, label, icon: Icon }) => (
            <li key={label}>
              <ButtonLink href={href} variant="secondary" size="icon" aria-label={label}>
                <Icon />
              </ButtonLink>
            </li>
          ))}
        </ul>
        <nav aria-label="Footer" className="flex flex-wrap justify-center gap-x-5 gap-y-2">
          {TEXT_LINKS.map(({ href, label }) => (
            <Link
              key={label}
              href={href}
              className="text-faint-foreground hover:text-foreground text-ui font-bold transition-colors"
              {...externalLinkProps(href)}
            >
              {label}
            </Link>
          ))}
        </nav>
        <p className="text-faint-foreground max-w-xl text-mock leading-relaxed font-medium">
          {SITE.disclaimer} {LEGAL_NOTE} © {BUILD_YEAR} {SITE.author}.
        </p>
      </div>
    </footer>
  );
}
