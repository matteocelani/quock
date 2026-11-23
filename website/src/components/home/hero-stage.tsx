"use client";

import { useState, type ComponentType, type ReactNode, type SVGProps } from "react";
import {
  ChatBubbleIcon,
  CheckIcon,
  CursorIcon,
  DocumentIcon,
  ModelsIcon,
  NotesIcon,
  PhoneIcon,
} from "@/components/ui/icons";
import { ScreenStack } from "@/components/ui/screen-stack";
import { Caption } from "@/components/ui/heading";
import { MODELS, type ScreenName } from "@/lib/screens";
import { SITE } from "@/lib/site";
import { cn } from "@/lib/utils";

interface Tab {
  screen: ScreenName;
  label: string;
  icon: ComponentType<SVGProps<SVGSVGElement>>;
}

const TABS: readonly Tab[] = [
  { screen: "home", label: "Home", icon: PhoneIcon },
  { screen: "open_model", label: "Models", icon: ModelsIcon },
  { screen: "compose", label: "Attach", icon: DocumentIcon },
  { screen: "chat", label: "Chat", icon: ChatBubbleIcon },
  { screen: "history", label: "Chats", icon: NotesIcon },
];

const SCREENS = TABS.map((tab) => tab.screen);

const TOOLS = [
  { id: "search", label: "Web search" },
  { id: "thinking", label: "Thinking" },
  { id: "memory", label: "Memory" },
] as const;

type ToolId = (typeof TOOLS)[number]["id"];

function Switch({ isOn, label, onToggle }: { isOn: boolean; label: string; onToggle: () => void }): ReactNode {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={isOn}
      aria-label={label}
      onClick={onToggle}
      className={cn(
        "relative h-6 w-10 shrink-0 rounded-full transition-colors duration-300",
        isOn ? "bg-[#34c759]" : "bg-black/12",
      )}
    >
      <span
        className={cn(
          "absolute top-0.5 left-0.5 size-5 rounded-full bg-white shadow-[0_2px_6px_rgb(0_0_0/0.2)] transition-transform duration-300 ease-spring",
          isOn && "translate-x-4",
        )}
      />
    </button>
  );
}

// The hero's playground: every control on it works and changes what the phone shows.
export function HeroStage(): ReactNode {
  const [screen, setScreen] = useState<ScreenName>("home");
  const [model, setModel] = useState<string>("glm-5.2");
  const [tools, setTools] = useState<Record<ToolId, boolean>>({ search: true, thinking: false, memory: true });

  const pickModel = (name: string): void => {
    setModel(name);
    setScreen("open_model");
  };

  const toggleTool = (id: ToolId): void => {
    setTools((current) => ({ ...current, [id]: !current[id] }));
    setScreen(id === "thinking" ? "chat" : "compose");
  };

  return (
    <div className="relative mx-auto max-w-[75rem] px-4 sm:px-8">
      <div className="relative">
        <div className="relative isolate h-[30rem] overflow-hidden rounded-[2rem] sm:h-[36rem] sm:rounded-stage lg:h-[38rem]">
          <div aria-hidden="true" className="wallpaper -z-10" />
          <div className="absolute inset-x-0 top-6 flex justify-center sm:top-10">
            <ScreenStack
              screens={SCREENS}
              active={screen}
              className="w-[15.5rem] sm:w-[19rem] lg:w-[20.5rem]"
              sizes="(min-width: 1024px) 328px, (min-width: 640px) 304px, 248px"
              isPriority
            />
          </div>
        </div>

        {/* Left panel: the model list. Picking one opens the picker screen. */}
        <div className="glass absolute top-12 -left-2 hidden w-80 rounded-2xl p-2 lg:block xl:-left-6">
          <p className="px-3 pt-2 pb-1 text-xs font-bold text-black/40">Choose a model</p>
          <ul>
            {MODELS.map((item) => {
              const isSelected = item.name === model;
              return (
                <li key={item.name}>
                  <button
                    type="button"
                    onClick={() => pickModel(item.name)}
                    aria-pressed={isSelected}
                    className="flex w-full items-center gap-3 rounded-xl px-3 py-2 text-left transition-colors hover:bg-black/5"
                  >
                    <span
                      className={cn(
                        "flex size-5 shrink-0 items-center justify-center rounded-full border-[1.5px] transition-colors",
                        isSelected ? "border-[#1d1d1f] bg-[#1d1d1f] text-white" : "border-black/20",
                      )}
                    >
                      {isSelected && <CheckIcon className="size-3" strokeWidth={3} />}
                    </span>
                    <span className="flex-1 font-mono text-[13px] font-semibold text-[#1d1d1f]">{item.name}</span>
                    <span className="flex gap-1">
                      {item.tags.map((tag) => (
                        <span key={tag} className="rounded-md bg-black/5 px-1.5 py-0.5 text-[10px] font-bold text-black/45">
                          {tag}
                        </span>
                      ))}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        </div>

        {/* Right panel: the per-chat tools. Each switch shows the screen it affects. */}
        <div className="glass absolute top-24 -right-2 hidden w-64 rounded-2xl p-4 text-[#1d1d1f] lg:block xl:-right-6">
          <div className="flex items-center justify-between">
            <span className="text-[15px] font-bold">Quock</span>
            <span className="rounded-md bg-black/5 px-1.5 py-0.5 font-mono text-[11px] font-semibold text-black/50">
              {model}
            </span>
          </div>
          <div className="my-3 h-px bg-black/10" />
          <p className="mb-1 text-xs font-bold text-black/40">Tools</p>
          <ul className="space-y-2.5">
            {TOOLS.map((tool) => (
              <li key={tool.id} className="flex items-center justify-between gap-3">
                <span className="text-[15px] font-semibold">{tool.label}</span>
                <Switch isOn={tools[tool.id]} label={tool.label} onToggle={() => toggleTool(tool.id)} />
              </li>
            ))}
          </ul>
          <div className="my-3 h-px bg-black/10" />
          <p className="text-xs font-bold text-black/40">Version {SITE.version}</p>
          <p className="mt-1 text-[15px] font-semibold">Settings…</p>
        </div>
      </div>

      <div className="mt-6 flex flex-col items-center gap-4">
        <div role="tablist" aria-label="App screens" className="bg-panel flex rounded-full p-1">
          {TABS.map(({ screen: tabScreen, label, icon: Icon }) => {
            const isActive = tabScreen === screen;
            return (
              <button
                key={tabScreen}
                type="button"
                role="tab"
                aria-selected={isActive}
                onClick={() => setScreen(tabScreen)}
                className={cn(
                  "flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[13px] font-bold transition-colors duration-200 sm:px-3.5 sm:text-sm",
                  isActive ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground",
                )}
              >
                <Icon className="hidden size-4 sm:block" />
                {label}
              </button>
            );
          })}
        </div>
        <Caption>
          <CursorIcon className="size-3.5" />
          Psst… it&rsquo;s interactive!
        </Caption>
      </div>
    </div>
  );
}
