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
import { BENTO_CELLS, BENTO_TITLE, type BentoMock } from "@/modules/home/content";
import { cn } from "@/lib/utils";

interface CellProps {
  lead: string;
  body: string;
  className?: string;
  children: ReactNode;
}

// The copy carries the meaning, so the mock under it is hidden from assistive tech.
function Cell({ lead, body, className, children }: CellProps): ReactNode {
  return (
    <div className={cn("reveal bg-panel rounded-tile relative flex flex-col overflow-hidden", className)}>
      <p className="relative z-10 p-6 pb-0 text-body leading-snug font-bold text-pretty sm:p-7 sm:pb-0">
        {lead} <span className="text-muted-foreground">{body}</span>
      </p>
      <div aria-hidden="true" className="relative flex flex-1 items-end">
        {children}
      </div>
    </div>
  );
}

// Each tile is one capability from the module; the mock under it shows it.
const MOCKS: Record<BentoMock, ReactNode> = {
  attach: <AttachMock />,
  notification: <NotificationMock />,
  memory: <MemoryMock />,
  dataFlow: <DataFlowMock />,
  continue: <ContinueMock />,
  menu: <MenuMock />,
};

export function Bento(): ReactNode {
  return (
    <section aria-labelledby="bento-title" className="px-5 pt-32 sm:px-8 sm:pt-44">
      <Heading id="bento-title" className="reveal text-center">
        {BENTO_TITLE}
      </Heading>
      <div className="max-w-content mx-auto mt-14 grid gap-3 sm:grid-cols-2">
        {BENTO_CELLS.map((cell) => (
          <Cell key={cell.lead} lead={cell.lead} body={cell.body} className={cell.isWide ? "sm:col-span-2" : undefined}>
            {MOCKS[cell.mock]}
          </Cell>
        ))}
      </div>
    </section>
  );
}
