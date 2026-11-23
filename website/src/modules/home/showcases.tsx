import type { CSSProperties, ReactNode } from "react";
import { GlobeIcon, HandIcon, NotesIcon, PinIcon, SearchIcon, ThinkIcon } from "@/components/ui/icons";
import type { ScreenName } from "@/lib/screens";

// The icon arrives already rendered: a server page cannot hand a component function to a client one.
export interface ShowcaseTab {
  icon: ReactNode;
  lead: string;
  body: string;
  screen: ScreenName;
}

export const MODEL_TABS: readonly ShowcaseTab[] = [
  {
    icon: <SearchIcon />,
    lead: "The whole catalogue.",
    body: "Every model Ollama Cloud hosts, with badges for vision and thinking.",
    screen: "open_model",
  },
  {
    icon: <HandIcon />,
    lead: "Three taps.",
    body: "Open the app, tap a model, type. The reply streams in word by word.",
    screen: "home",
  },
  {
    icon: <NotesIcon />,
    lead: "Make it yours.",
    body: "Pick a default model, a theme, and whether Quock gives haptic feedback.",
    screen: "settings",
  },
];

export const THINKING_TABS: readonly ShowcaseTab[] = [
  {
    icon: <ThinkIcon />,
    lead: "Open the reasoning.",
    body: "Thinking models show their work in a fold you can open or ignore.",
    screen: "chat",
  },
  {
    icon: <GlobeIcon />,
    lead: "Fresh from the web.",
    body: "Let the model search mid-answer. Web search and thinking are per-chat toggles.",
    screen: "compose",
  },
  {
    icon: <PinIcon />,
    lead: "Pick up later.",
    body: "Every chat stays on your phone, searchable, with pins for the ones you keep.",
    screen: "history",
  },
];

// A dusk variant of the stage wallpaper, so the two showcases do not read as one.
export const DUSK = {
  "--w1": "oklch(0.78 0.1 300)",
  "--w2": "oklch(0.84 0.08 20)",
  "--w3": "oklch(0.7 0.13 275)",
  "--w4": "oklch(0.86 0.07 330)",
  "--w5": "oklch(0.9 0.04 300)",
  "--w6": "oklch(0.76 0.09 280)",
} as CSSProperties;
