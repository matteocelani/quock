import Link from "next/link";
import type { ReactNode } from "react";
import { ButtonLink } from "@/components/ui/button";
import { ChatBubbleIcon, DownloadIcon, NotesIcon } from "@/components/ui/icons";
import { Wordmark } from "@/components/global/logo";
import { SITE } from "@/lib/site";

const NAV = [
  { href: "/faq", label: "FAQs", icon: ChatBubbleIcon },
  { href: "/changelog", label: "Changelog", icon: NotesIcon },
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
              className="hover:bg-panel hidden items-center gap-2 rounded-xl px-3.5 py-2.5 text-[17px] font-bold transition-colors md:inline-flex"
            >
              <Icon className="size-5" />
              {label}
            </Link>
          ))}
          <ButtonLink href={SITE.appStoreUrl} variant="secondary" size="md" className="ml-2 hidden md:inline-flex">
            <DownloadIcon />
            Download for iPhone
          </ButtonLink>
          <ButtonLink href="/faq" variant="secondary" size="icon" aria-label="FAQs" className="md:hidden">
            <ChatBubbleIcon />
          </ButtonLink>
        </nav>
      </div>
    </header>
  );
}
