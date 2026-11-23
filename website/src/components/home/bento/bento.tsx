import type { ReactNode } from "react";
import { Heading } from "@/components/ui/heading";
import {
  AttachMock,
  ContinueMock,
  DataFlowMock,
  MemoryMock,
  MenuMock,
  NotificationMock,
} from "@/components/home/bento/mocks";
import { cn } from "@/lib/utils";

function Cell({ lead, body, className, children }: { lead: string; body: string; className?: string; children: ReactNode }): ReactNode {
  return (
    <div className={cn("reveal bg-panel relative flex flex-col overflow-hidden rounded-tile", className)}>
      <p className="relative z-10 p-6 pb-0 text-[17px] leading-snug font-bold text-pretty sm:p-7 sm:pb-0">
        {lead} <span className="text-muted-foreground">{body}</span>
      </p>
      <div aria-hidden="true" className="relative flex flex-1 items-end">
        {children}
      </div>
    </div>
  );
}

export function Bento(): ReactNode {
  return (
    <section aria-labelledby="bento-title" className="px-5 pt-32 sm:px-8 sm:pt-44">
      <Heading id="bento-title" className="reveal text-center">
        Every corner, covered.
      </Heading>
      <div className="mx-auto mt-14 grid max-w-[61rem] gap-3 sm:grid-cols-2">
        <Cell
          lead="Attach anything."
          body="Photos, screenshots and PDFs. Quock reads a document's text, or runs OCR on your phone when there is none."
          className="sm:col-span-2"
        >
          <AttachMock />
        </Cell>
        <Cell lead="Finishes in the background." body="Leave mid-answer. Quock can tell you when it is ready.">
          <NotificationMock />
        </Cell>
        <Cell lead="Remembers what matters." body="A few facts you share, kept on your phone. Off with one switch.">
          <MemoryMock />
        </Cell>
        <Cell
          lead="Private by design."
          body="No Quock server and no analytics. Your history lives on your iPhone."
          className="sm:col-span-2"
        >
          <DataFlowMock />
        </Cell>
        <Cell lead="Never lose an answer." body="A reply cut short continues where it stopped, without paying twice.">
          <ContinueMock />
        </Cell>
        <Cell lead="Act on any part." body="Long-press a paragraph for a Deep dive or a web search. Fork the chat from any reply.">
          <MenuMock />
        </Cell>
      </div>
    </section>
  );
}
