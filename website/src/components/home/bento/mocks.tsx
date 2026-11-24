import type { ReactNode } from "react";
import {
  CameraIcon,
  CopyIcon,
  DocumentIcon,
  ForkIcon,
  GlobeIcon,
  ImageIcon,
  RegenerateIcon,
  ResumeIcon,
  SelectIcon,
  SparkIcon,
} from "@/components/ui/icons";
import { AppIcon } from "@/components/global/logo";
import { DATA_FLOW, MOCK_COPY } from "@/modules/home/content";
import { SITE } from "@/lib/site";
import { cn } from "@/lib/utils";

const ATTACH_ACTIONS = [
  { label: "Camera", icon: CameraIcon },
  { label: "Photo", icon: ImageIcon },
  { label: "File", icon: DocumentIcon },
] as const;

const EXCERPT_ACTIONS = [
  { label: "Deep dive", icon: SparkIcon },
  { label: "Web search", icon: GlobeIcon },
] as const;

const REPLY_ACTIONS = [
  { label: "Copy message", icon: CopyIcon },
  { label: "Select text", icon: SelectIcon },
  { label: "Regenerate response", icon: RegenerateIcon },
  { label: "Fork conversation from here", icon: ForkIcon },
] as const;

// Drawn in HTML rather than captured: crisp at any size, and each one mirrors behaviour the app really has.
export function AttachMock(): ReactNode {
  return (
    <div className="flex w-full flex-col items-center gap-6 px-6 pt-8 pb-8 sm:flex-row sm:justify-center sm:gap-10">
      <div className="flex gap-5">
        {ATTACH_ACTIONS.map(({ label, icon: Icon }) => (
          <div key={label} className="flex flex-col items-center gap-2">
            <span className="bg-surface text-foreground shadow-card flex size-16 items-center justify-center rounded-full">
              <Icon className="size-6" />
            </span>
            <span className="text-muted-foreground text-xs font-bold">{label}</span>
          </div>
        ))}
      </div>
      <div className="bg-surface shadow-card w-56 rotate-2 rounded-xl p-4">
        <div className="flex items-center gap-2">
          <span className="bg-system-red text-surface rounded px-1.5 py-0.5 text-tag font-bold">PDF</span>
          <span className="text-foreground text-xs font-bold">{MOCK_COPY.pdfName}</span>
        </div>
        <div className="mt-3 space-y-1.5">
          {["w-full", "w-11/12", "w-4/5", "w-full", "w-2/3"].map((width, index) => (
            <span key={index} className={cn("block h-1.5 rounded-full", width, index === 2 ? "bg-marker" : "bg-foreground/10")} />
          ))}
        </div>
        <p className="text-faint-foreground mt-3 text-tag font-bold">{MOCK_COPY.pdfNote}</p>
      </div>
    </div>
  );
}

export function NotificationMock(): ReactNode {
  return (
    <div className="relative isolate h-44 w-full overflow-hidden">
      <div aria-hidden="true" className="wallpaper -z-10 opacity-80" />
      <div className="glass text-foreground absolute inset-x-5 top-8 flex items-center gap-3 rounded-3xl p-3 sm:inset-x-7">
        <AppIcon className="size-10" />
        <div className="min-w-0 flex-1">
          <div className="flex justify-between text-mock">
            <span className="font-bold">{SITE.name}</span>
            <span className="text-faint-foreground">now</span>
          </div>
          <p className="text-mock">{MOCK_COPY.notification}</p>
        </div>
      </div>
    </div>
  );
}

// Memory has no screen of its own in the app: it is one switch in Settings, so that is what the mock shows.
export function MemoryMock(): ReactNode {
  return (
    <div className="w-full p-6 sm:p-7">
      <p className="text-muted-foreground px-1 text-mock font-bold">{MOCK_COPY.memorySection}</p>
      <div className="bg-surface text-foreground shadow-card mt-2 flex items-center justify-between gap-4 rounded-2xl px-4 py-3">
        <div className="flex items-center gap-3">
          <SparkIcon className="text-muted-foreground size-5" />
          <div>
            <p className="text-ui font-semibold">{MOCK_COPY.memoryLabel}</p>
            <p className="text-muted-foreground text-mock">{MOCK_COPY.memoryNote}</p>
          </div>
        </div>
        <span className="bg-system-green relative h-6 w-10 shrink-0 rounded-full">
          <span className="bg-surface shadow-card absolute top-0.5 left-4.5 size-5 rounded-full" />
        </span>
      </div>
    </div>
  );
}

// The phone itself, then the three recipients of docs/PRIVACY.md section 4, drawn as a small system window.
export function DataFlowMock(): ReactNode {
  return (
    <div className="bg-surface text-foreground shadow-card mx-6 mt-6 w-full overflow-hidden rounded-t-xl sm:mx-7">
      <div className="flex items-center gap-1.5 border-b px-4 py-3">
        <span className="bg-system-red size-3 rounded-full" />
        <span className="bg-system-yellow size-3 rounded-full" />
        <span className="bg-system-green size-3 rounded-full" />
        <span className="ml-3 text-mock font-bold">{MOCK_COPY.dataFlowTitle}</span>
      </div>
      <table className="w-full text-left text-mock">
        <thead className="text-faint-foreground">
          <tr className="border-b">
            <th scope="col" className="px-4 py-2 font-semibold">Place</th>
            <th scope="col" className="px-4 py-2 font-semibold">What</th>
            <th scope="col" className="hidden px-4 py-2 font-semibold sm:table-cell">When</th>
          </tr>
        </thead>
        <tbody>
          {DATA_FLOW.map((row, index) => (
            <tr key={row.where} className={cn(index % 2 === 1 && "bg-foreground/3", index > 2 && "text-faint-foreground")}>
              <td className="px-4 py-2 font-semibold">{row.where}</td>
              <td className="px-4 py-2">{row.what}</td>
              <td className="hidden px-4 py-2 sm:table-cell">{row.when}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function ContinueMock(): ReactNode {
  return (
    <div className="w-full p-6 sm:p-7">
      <div className="bg-surface text-foreground shadow-card rounded-2xl p-4 text-mock leading-relaxed">
        <p>
          {MOCK_COPY.continueDone}
          <span className="text-foreground/25">{MOCK_COPY.continuePending}</span>
        </p>
        <div className="mt-3 flex items-center gap-2">
          <span className="bg-primary text-primary-foreground inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-bold">
            <ResumeIcon className="size-3" />
            Continue
          </span>
          <span className="text-faint-foreground text-xs font-semibold">{MOCK_COPY.continueStatus}</span>
        </div>
      </div>
    </div>
  );
}

// The excerpt menu under a long-pressed paragraph, and the reply's own action row beneath it.
export function MenuMock(): ReactNode {
  return (
    <div className="w-full px-6 pt-6 sm:px-7">
      <div className="bg-surface text-muted-foreground shadow-card rounded-t-2xl p-4 text-mock leading-relaxed">
        <p>
          <span className="bg-marker text-foreground rounded px-0.5">{MOCK_COPY.excerptMarked}</span>
          {MOCK_COPY.excerptRest}
        </p>
        <ul className="bg-panel text-foreground mt-3 w-40 rounded-xl p-1.5 text-mock font-semibold">
          {EXCERPT_ACTIONS.map(({ label, icon: Icon }, index) => (
            <li key={label} className={cn("flex items-center gap-2.5 rounded-lg px-2.5 py-1.5", index === 0 && "bg-foreground/5")}>
              <Icon className="text-faint-foreground size-4" />
              {label}
            </li>
          ))}
        </ul>
        <ul className="text-faint-foreground mt-4 flex gap-3 border-t pt-3">
          {REPLY_ACTIONS.map(({ label, icon: Icon }) => (
            <li key={label}>
              <Icon className="size-4" />
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
