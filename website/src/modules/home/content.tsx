import type { ReactNode } from "react";
import { GlobeIcon, HandIcon, NotesIcon, PinIcon, SearchIcon, ThinkIcon } from "@/components/ui/icons";
import type { ScreenName } from "@/modules/home/screens";

// The icon is already rendered: a server page cannot hand a component function to a client one.
export interface ShowcaseTab {
  icon: ReactNode;
  lead: string;
  body: string;
  screen: ScreenName;
}

export interface Showcase {
  id: string;
  eyebrow: string;
  title: ReactNode;
  lead: string;
  tabs: readonly ShowcaseTab[];
  wallpaper: "sky" | "dusk";
  footnote?: string;
}

export const SHOWCASES: readonly Showcase[] = [
  {
    id: "models",
    eyebrow: "Open models",
    title: "Every model. One tap.",
    lead: "Pick any model on Ollama Cloud and start typing.",
    wallpaper: "sky",
    tabs: [
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
    ],
  },
  {
    id: "thinking",
    eyebrow: "Reasoning",
    title: (
      <>
        Watch it <span className="thinking-text">think.</span>
      </>
    ),
    lead: "Follow the reasoning as it streams, right above the answer.",
    wallpaper: "dusk",
    footnote: "Thinking needs a thinking-capable model.",
    tabs: [
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
    ],
  },
];

// What the app does, in one list: it feeds the MobileApplication JSON-LD and llms.txt.
export const APP_FEATURES = [
  "Chat with every Ollama Cloud model",
  "Streamed replies",
  "Thinking mode for reasoning models",
  "Live web search",
  "PDF reading with on-device OCR",
  "Images and screenshots for vision models",
  "Memory kept on the device",
  "Answers that finish in the background",
  "Pinned chats and forks",
  "Light and dark themes",
  "No analytics, chats stored on the iPhone",
] as const;
