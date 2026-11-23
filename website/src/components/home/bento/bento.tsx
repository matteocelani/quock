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
      <p className="relative z-10 p-6 pb-0 text-[17px] leading-snug font-bold text-pretty sm:p-7 sm:pb-0">
        {lead} <span className="text-muted-foreground">{body}</span>
      </p>
      <div aria-hidden="true" className="relative flex flex-1 items-end">
        {children}
      </div>
    </div>
  );
}

// This section's own copy: each tile is one capability, and the mock under it shows it.
const TITLE = "Every corner, covered.";
const CELLS = [
  {
    lead: "Attach anything.",
    body: "Photos, screenshots and PDFs. Quock reads a document's text, or runs OCR on your phone when there is none.",
    mock: <AttachMock />,
    isWide: true,
  },
  { lead: "Finishes in the background.", body: "Leave mid-answer. Quock can tell you when it is ready.", mock: <NotificationMock /> },
  {
    lead: "Remembers what matters.",
    body: "A few facts you share, stored on your phone and sent with your messages while memory is on.",
    mock: <MemoryMock />,
  },
  {
    lead: "Private by design.",
    body: "Your history lives on your iPhone, and your messages go only to Ollama Cloud.",
    mock: <DataFlowMock />,
    isWide: true,
  },
  {
    lead: "Never lose an answer.",
    body: "A reply cut short continues where it stopped, without paying twice.",
    mock: <ContinueMock />,
  },
  {
    lead: "Act on any part.",
    body: "Long-press a paragraph for a Deep dive or a web search. Fork the chat from any reply.",
    mock: <MenuMock />,
  },
] as const;

export function Bento(): ReactNode {
  return (
    <section aria-labelledby="bento-title" className="px-5 pt-32 sm:px-8 sm:pt-44">
      <Heading id="bento-title" className="reveal text-center">
        {TITLE}
      </Heading>
      <div className="mx-auto mt-14 grid max-w-[61rem] gap-3 sm:grid-cols-2">
        {CELLS.map((cell) => (
          <Cell key={cell.lead} lead={cell.lead} body={cell.body} className={"isWide" in cell ? "sm:col-span-2" : undefined}>
            {cell.mock}
          </Cell>
        ))}
      </div>
    </section>
  );
}
