import Link from "next/link";
import type { ReactNode } from "react";
import { ButtonLink } from "@/components/ui/button";
import { ChatBubbleIcon, NotesIcon } from "@/components/ui/icons";
import { DownloadButton } from "@/components/global/download-button";
import { Wordmark } from "@/components/global/logo";
import { PAGE_LABELS, PATHS } from "@/lib/site";

const NAV = [
  { href: PATHS.faq, label: PAGE_LABELS.faq, icon: ChatBubbleIcon },
  { href: PATHS.changelog, label: PAGE_LABELS.changelog, icon: NotesIcon },
] as const;

export function SiteHeader(): ReactNode {
  return (
    <header className="header-glass fixed inset-x-0 top-0 z-40">
      <div className="flex items-center justify-between gap-4 px-5 py-4 sm:px-8 sm:py-7">
        <Wordmark />
        <nav aria-label="Main" className="flex items-center gap-1">
          {NAV.map(({ href, label, icon: Icon }) => (
            <Link
              key={href}
              href={href}
              className="hover:bg-panel hidden items-center gap-2 rounded-xl px-3.5 py-2.5 text-body font-bold transition-colors md:inline-flex"
            >
              <Icon className="size-5" />
              {label}
            </Link>
          ))}
          <DownloadButton variant="secondary" size="md" className="ml-2 hidden md:inline-flex" />
          <ButtonLink href={PATHS.faq} variant="secondary" size="icon" aria-label={PAGE_LABELS.faq} className="md:hidden">
            <ChatBubbleIcon />
          </ButtonLink>
        </nav>
      </div>
    </header>
  );
}
