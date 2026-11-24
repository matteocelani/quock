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
import { ScreenStack } from "@/components/home/screen-stack";
import { handleRovingKeys } from "@/components/home/roving-keys";
import { Caption } from "@/components/home/typography";
import { LATEST_RELEASE } from "@/modules/changelog/content";
import { MODELS, type ScreenName } from "@/modules/home/screens";
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
const PANEL_ID = "hero-screen";
const tabId = (index: number): string => `hero-tab-${index}`;

type ModelName = (typeof MODELS)[number]["name"];
// The capture shows glm-5.2 as the picked model, so the panel starts there too.
const INITIAL_MODEL: ModelName = MODELS[1].name;

// The app's per-chat tools, as the attach sheet shows them; memory is a global setting, not one of them.
const TOOLS = [
  { id: "search", label: "Web search", screen: "compose" },
  { id: "thinking", label: "Thinking", screen: "chat" },
] as const;

type ToolId = (typeof TOOLS)[number]["id"];

interface SwitchProps {
  isOn: boolean;
  label: string;
  onToggle: () => void;
}

function Switch({ isOn, label, onToggle }: SwitchProps): ReactNode {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={isOn}
      aria-label={label}
      onClick={onToggle}
      className={cn(
        "relative h-6 w-10 shrink-0 rounded-full transition-colors duration-300",
        isOn ? "bg-system-green" : "bg-foreground/45",
      )}
    >
      <span
        className={cn(
          "bg-surface shadow-card absolute top-0.5 left-0.5 size-5 rounded-full transition-transform duration-300 ease-spring",
          isOn && "translate-x-4",
        )}
      />
    </button>
  );
}

// Every control on the stage changes what the phone shows, so the hero proves the app instead of describing it.
export function HeroStage(): ReactNode {
  const [screen, setScreen] = useState<ScreenName>("home");
  const [model, setModel] = useState<ModelName>(INITIAL_MODEL);
  const [tools, setTools] = useState<Record<ToolId, boolean>>({ search: true, thinking: false });
  const activeIndex = SCREENS.indexOf(screen);

  const pickModel = (name: ModelName): void => {
    setModel(name);
    setScreen("open_model");
  };

  const toggleTool = (id: ToolId, toolScreen: ScreenName): void => {
    setTools((current) => ({ ...current, [id]: !current[id] }));
    setScreen(toolScreen);
  };

  return (
    <div className="relative mx-auto max-w-stage px-4 sm:px-8">
      <div className="relative">
        <div className="rounded-stage relative isolate h-[30rem] overflow-hidden sm:h-[36rem] lg:h-[38rem]">
          <div aria-hidden="true" className="wallpaper -z-10" />
          <div className="absolute inset-x-0 top-6 flex justify-center sm:top-10">
            <ScreenStack
              id={PANEL_ID}
              labelledBy={tabId(activeIndex)}
              screens={SCREENS}
              active={screen}
              className="w-[15.5rem] sm:w-[19rem] lg:w-[20.5rem]"
              sizes="(min-width: 1024px) 328px, (min-width: 640px) 304px, 248px"
              isPriority
            />
          </div>
        </div>

        {/* Picking a model opens the picker capture, so the list reads as the app's own. */}
        <div className="glass text-foreground absolute top-12 -left-2 hidden w-80 rounded-2xl p-2 lg:block xl:-left-6">
          <p id="hero-models" className="text-muted-foreground px-3 pt-2 pb-1 text-xs font-bold">
            Choose a model
          </p>
          <ul role="radiogroup" aria-labelledby="hero-models">
            {MODELS.map((item, index) => {
              const isSelected = item.name === model;
              return (
                <li key={item.name} role="none">
                  <button
                    type="button"
                    role="radio"
                    aria-checked={isSelected}
                    tabIndex={isSelected ? 0 : -1}
                    onClick={() => pickModel(item.name)}
                    onKeyDown={(event) => handleRovingKeys(event, index, MODELS.length, (next) => pickModel(MODELS[next].name))}
                    className="hover:bg-foreground/5 flex w-full items-center gap-3 rounded-xl px-3 py-2 text-left transition-colors"
                  >
                    <span
                      className={cn(
                        "flex size-5 shrink-0 items-center justify-center rounded-full border-[1.5px] transition-colors",
                        isSelected ? "border-primary bg-primary text-primary-foreground" : "border-foreground/45",
                      )}
                    >
                      {isSelected && <CheckIcon className="size-3" strokeWidth={3} />}
                    </span>
                    <span className="flex-1 font-mono text-mock font-semibold">{item.name}</span>
                    <span className="flex gap-1">
                      {item.tags.map((tag) => (
                        <span key={tag} className="bg-foreground/5 text-muted-foreground rounded-md px-1.5 py-0.5 text-tag font-bold">
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

        {/* Each switch jumps to the capture it affects, the way the attach sheet sets tools per chat. */}
        <div className="glass text-foreground absolute top-24 -right-2 hidden w-64 rounded-2xl p-4 lg:block xl:-right-6">
          <div className="flex items-center justify-between">
            <span className="text-ui font-bold">{SITE.name}</span>
            <span className="bg-foreground/5 text-muted-foreground rounded-md px-1.5 py-0.5 font-mono text-chip font-semibold">
              {model}
            </span>
          </div>
          <div className="bg-foreground/10 my-3 h-px" />
          <p className="text-muted-foreground mb-1 text-xs font-bold">Tools</p>
          <ul className="space-y-2.5">
            {TOOLS.map((tool) => (
              <li key={tool.id} className="flex items-center justify-between gap-3">
                <span className="text-ui font-semibold">{tool.label}</span>
                <Switch isOn={tools[tool.id]} label={tool.label} onToggle={() => toggleTool(tool.id, tool.screen)} />
              </li>
            ))}
          </ul>
          <div className="bg-foreground/10 my-3 h-px" />
          <p className="text-muted-foreground text-xs font-bold">Version {LATEST_RELEASE.version}</p>
        </div>
      </div>

      <div className="mt-6 flex flex-col items-center gap-4">
        <div role="tablist" aria-label="App screens" className="bg-panel flex rounded-full p-1">
          {TABS.map(({ screen: tabScreen, label, icon: Icon }, index) => {
            const isActive = index === activeIndex;
            return (
              <button
                key={tabScreen}
                id={tabId(index)}
                type="button"
                role="tab"
                aria-selected={isActive}
                aria-controls={PANEL_ID}
                tabIndex={isActive ? 0 : -1}
                onClick={() => setScreen(tabScreen)}
                onKeyDown={(event) => handleRovingKeys(event, index, TABS.length, (next) => setScreen(TABS[next].screen))}
                className={cn(
                  "flex items-center gap-1.5 rounded-full px-3 py-1.5 text-mock font-bold transition-colors duration-200 sm:px-3.5 sm:text-sm",
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
