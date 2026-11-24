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
import { HERO } from "@/modules/home/content";
import { MODELS, PICKED_MODEL, type ScreenName } from "@/modules/home/screens";
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

// The app's per-chat tools, as the attach sheet shows them; memory is a global setting, not one of them.
const TOOLS = [
  { id: "search", label: "Web search", screen: "compose" },
  { id: "thinking", label: "Thinking", screen: "chat" },
] as const;

type ToolId = (typeof TOOLS)[number]["id"];

interface ToolCheckProps {
  isOn: boolean;
  label: string;
  onToggle: () => void;
}

// The attach sheet marks a tool with a check circle (filled when on), so the stage does the same.
function ToolCheck({ isOn, label, onToggle }: ToolCheckProps): ReactNode {
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={isOn}
      onClick={onToggle}
      className="flex w-full items-center justify-between gap-3 py-1 text-left"
    >
      <span className="text-ui font-semibold">{label}</span>
      <span
        className={cn(
          "flex size-5 shrink-0 items-center justify-center rounded-full border-2 transition-colors",
          isOn ? "border-primary bg-primary text-primary-foreground" : "border-foreground/60",
        )}
      >
        {isOn && <CheckIcon className="size-3" strokeWidth={3} />}
      </span>
    </button>
  );
}

// Every control on the stage changes what the phone shows, so the hero proves the app instead of describing it.
export function HeroStage(): ReactNode {
  const [screen, setScreen] = useState<ScreenName>("home");
  const [model, setModel] = useState<ModelName>(PICKED_MODEL);
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
        <div className="rounded-stage relative isolate h-120 overflow-hidden sm:h-144 lg:h-152">
          <div aria-hidden="true" className="wallpaper -z-10" />
          <div className="absolute inset-x-0 top-6 flex justify-center sm:top-10">
            <ScreenStack
              id={PANEL_ID}
              labelledBy={tabId(activeIndex)}
              screens={SCREENS}
              active={screen}
              className="w-62 sm:w-76 lg:w-82"
              // Mirrors w-62 / w-76 / w-82 at 16px per rem.
              sizes="(min-width: 1024px) 328px, (min-width: 640px) 304px, 248px"
              isPriority
            />
          </div>
        </div>

        {/* Picking a model opens the picker capture, so the list reads as the app's own. */}
        <div className="glass text-foreground absolute top-12 -left-2 hidden w-80 rounded-2xl p-2 lg:block xl:-left-6">
          <p id="hero-models" className="text-muted-foreground px-3 pt-2 pb-1 text-mock font-bold">
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
                        "flex size-5 shrink-0 items-center justify-center rounded-full border-2 transition-colors",
                        isSelected ? "border-primary bg-primary text-primary-foreground" : "border-foreground/60",
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

        {/* Each check jumps to the capture it affects, the way the attach sheet sets tools per chat. */}
        <div className="glass text-foreground absolute top-24 -right-2 hidden w-64 rounded-2xl p-4 lg:block xl:-right-6">
          <div className="flex items-center justify-between">
            <span className="text-ui font-bold">{SITE.name}</span>
            <span className="bg-foreground/5 text-muted-foreground rounded-md px-1.5 py-0.5 font-mono text-chip font-semibold">
              {model}
            </span>
          </div>
          <div className="bg-foreground/10 my-3 h-px" />
          <p className="text-muted-foreground mb-1 text-mock font-bold">Tools</p>
          <ul className="space-y-1">
            {TOOLS.map((tool) => (
              <li key={tool.id}>
                <ToolCheck isOn={tools[tool.id]} label={tool.label} onToggle={() => toggleTool(tool.id, tool.screen)} />
              </li>
            ))}
          </ul>
          <div className="bg-foreground/10 my-3 h-px" />
          <p className="text-muted-foreground text-mock font-bold">Version {LATEST_RELEASE.version}</p>
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
                  "flex items-center gap-1.5 rounded-full px-3 py-1.5 text-mock font-bold transition-colors duration-200 sm:px-3.5 sm:text-ui",
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
          {HERO.aside}
        </Caption>
      </div>
    </div>
  );
}
