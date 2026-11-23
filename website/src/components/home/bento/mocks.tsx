import type { ReactNode } from "react";
import {
  CameraIcon,
  DocumentIcon,
  ForkIcon,
  GlobeIcon,
  ImageIcon,
  CopyIcon,
  RegenerateIcon,
  ResumeIcon,
  SelectIcon,
  SparkIcon,
} from "@/components/ui/icons";
import { AppIcon } from "@/components/global/logo";
import { cn } from "@/lib/utils";

// Mock surfaces are drawn in HTML on purpose: crisp at any size, and they describe real app behaviour.
export function AttachMock(): ReactNode {
  const actions = [
    { label: "Camera", icon: CameraIcon },
    { label: "Photo", icon: ImageIcon },
    { label: "File", icon: DocumentIcon },
  ];
  return (
    <div className="flex w-full flex-col items-center gap-6 px-6 pt-8 pb-8 sm:flex-row sm:justify-center sm:gap-10">
      <div className="flex gap-5">
        {actions.map(({ label, icon: Icon }) => (
          <div key={label} className="flex flex-col items-center gap-2">
            <span className="flex size-16 items-center justify-center rounded-full bg-white text-[#1d1d1f] shadow-[0_6px_20px_rgb(29_35_52/0.12)]">
              <Icon className="size-6" />
            </span>
            <span className="text-muted-foreground text-xs font-bold">{label}</span>
          </div>
        ))}
      </div>
      <div className="w-56 rotate-2 rounded-xl bg-white p-4 shadow-[0_12px_30px_rgb(29_35_52/0.14)]">
        <div className="flex items-center gap-2">
          <span className="rounded bg-[#ff3b30] px-1.5 py-0.5 text-[10px] font-bold text-white">PDF</span>
          <span className="text-xs font-bold text-[#1d1d1f]">lease-agreement.pdf</span>
        </div>
        <div className="mt-3 space-y-1.5">
          {["w-full", "w-11/12", "w-4/5", "w-full", "w-2/3"].map((width, index) => (
            <span key={index} className={cn("block h-1.5 rounded-full", width, index === 2 ? "bg-marker" : "bg-black/10")} />
          ))}
        </div>
        <p className="mt-3 text-[10px] font-bold text-black/40">Text read on this iPhone</p>
      </div>
    </div>
  );
}

export function NotificationMock(): ReactNode {
  return (
    <div className="relative isolate h-44 w-full overflow-hidden">
      <div aria-hidden="true" className="wallpaper -z-10 opacity-80" />
      <div className="glass absolute inset-x-5 top-8 flex items-center gap-3 rounded-[1.4rem] p-3 sm:inset-x-7">
        <AppIcon className="size-10 rounded-[0.6rem]" />
        <div className="min-w-0 flex-1 text-[#1d1d1f]">
          <div className="flex justify-between text-[13px]">
            <span className="font-bold">Quock</span>
            <span className="text-black/40">now</span>
          </div>
          <p className="text-[13px]">Your answer is ready.</p>
        </div>
      </div>
    </div>
  );
}

export function MemoryMock(): ReactNode {
  const facts = ["Goes by Sam", "Prefers short answers", "Is learning Japanese"];
  return (
    <ul className="w-full space-y-2 p-6 pt-6 sm:p-7">
      {facts.map((fact, index) => (
        <li
          key={fact}
          className="flex items-center gap-2.5 rounded-xl bg-white px-3.5 py-2.5 text-sm font-semibold text-[#1d1d1f] shadow-[0_4px_14px_rgb(29_35_52/0.06)]"
          style={{ marginLeft: `${index * 12}px` }}
        >
          <SparkIcon className="text-accent size-4" />
          {fact}
        </li>
      ))}
    </ul>
  );
}

// A small window with a table of where data goes, in the style of a system utility.
export function DataFlowMock(): ReactNode {
  const rows = [
    { where: "Your iPhone", what: "Chats, memory, settings", when: "Always" },
    { where: "Ollama Cloud", what: "The chat you are sending", when: "On send" },
    { where: "Expo updates", what: "Update check", when: "At launch" },
    { where: "Quock servers", what: "—", when: "None exist" },
    { where: "Analytics", what: "—", when: "Never" },
  ];
  return (
    <div className="mx-6 mt-6 mb-0 w-full overflow-hidden rounded-t-xl bg-white shadow-[0_12px_30px_rgb(29_35_52/0.12)] sm:mx-7">
      <div className="flex items-center gap-1.5 border-b border-black/8 px-4 py-3">
        <span className="size-3 rounded-full bg-[#ff5f57]" />
        <span className="size-3 rounded-full bg-[#febc2e]" />
        <span className="size-3 rounded-full bg-[#28c840]" />
        <span className="ml-3 text-[13px] font-bold text-[#1d1d1f]">Where your data goes</span>
      </div>
      <table className="w-full text-left text-[13px] text-[#1d1d1f]">
        <thead className="text-black/45">
          <tr className="border-b border-black/8">
            <th scope="col" className="px-4 py-2 font-semibold">Place</th>
            <th scope="col" className="px-4 py-2 font-semibold">What</th>
            <th scope="col" className="hidden px-4 py-2 font-semibold sm:table-cell">When</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row, index) => (
            <tr key={row.where} className={cn(index % 2 === 1 && "bg-black/[0.025]", index > 2 && "text-black/35")}>
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
      <div className="rounded-2xl bg-white p-4 text-[13px] leading-relaxed text-[#1d1d1f] shadow-[0_4px_14px_rgb(29_35_52/0.06)]">
        <p>
          The quickest route is the coastal road, then the ferry from Anacortes. Leave before nine and you
          <span className="text-black/25"> will avoid the queue at</span>
        </p>
        <div className="mt-3 flex items-center gap-2">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-[#1d1d1f] px-3 py-1.5 text-xs font-bold text-white">
            <ResumeIcon className="size-3" />
            Continue
          </span>
          <span className="text-xs font-semibold text-black/40">Interrupted</span>
        </div>
      </div>
    </div>
  );
}

// The excerpt menu over a long-pressed paragraph, and the reply's own action row beneath it.
export function MenuMock(): ReactNode {
  const excerptActions = [
    { label: "Deep dive", icon: SparkIcon },
    { label: "Web search", icon: GlobeIcon },
  ];
  const replyActions = [
    { label: "Copy message", icon: CopyIcon },
    { label: "Select text", icon: SelectIcon },
    { label: "Regenerate response", icon: RegenerateIcon },
    { label: "Fork conversation from here", icon: ForkIcon },
  ];
  return (
    <div className="w-full px-6 pt-6 sm:px-7">
      <div className="rounded-t-2xl bg-white p-4 text-[13px] leading-relaxed text-black/50 shadow-[0_4px_14px_rgb(29_35_52/0.06)]">
        <p>
          <span className="bg-marker rounded px-0.5 text-[#1d1d1f]">Setting it up algebraically, where x is the ball&rsquo;s price</span>
          , the bat costs x + $1.00 and together they cost $1.10.
        </p>
        <ul className="glass mt-3 w-40 rounded-xl p-1.5 text-[13px] font-semibold text-[#1d1d1f]">
          {excerptActions.map(({ label, icon: Icon }, index) => (
            <li key={label} className={cn("flex items-center gap-2.5 rounded-lg px-2.5 py-1.5", index === 0 && "bg-black/5")}>
              <Icon className="size-4 text-black/50" />
              {label}
            </li>
          ))}
        </ul>
        <ul className="mt-4 flex gap-3 border-t border-black/5 pt-3 text-black/40">
          {replyActions.map(({ label, icon: Icon }) => (
            <li key={label} className={cn(label.startsWith("Fork") && "text-accent")}>
              <Icon className="size-4" />
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
