import type { ComponentType, ReactNode, SVGProps } from "react";
import {
  CodeIcon,
  DocumentIcon,
  GlobeIcon,
  HandIcon,
  ModelsIcon,
  MoonIcon,
  NotesIcon,
  PinIcon,
  SearchIcon,
  StreamIcon,
  ThinkIcon,
} from "@/components/ui/icons";
import type { ScreenName } from "@/modules/home/screens";
import { SITE } from "@/lib/site";

// The icon is already rendered: a server page cannot hand a component function to a client one.
interface ShowcaseTab {
  icon: ReactNode;
  lead: string;
  body: string;
  screen: ScreenName;
}

export interface Showcase {
  id: string;
  eyebrow: string;
  title: string;
  // A word that gets the thinking sheen after the title, as the app's thinking label does.
  shimmerWord?: string;
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
    title: "Watch it",
    shimmerWord: "think.",
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

export const HERO = {
  // Two lines; the second carries the headline's one highlighter stroke.
  headline: ["Open. Type.", "That’s it."],
  aside: "Psst… it’s interactive!",
  facts: [
    { label: "Every model on", value: "Ollama Cloud" },
    { label: "Sign in with your", value: "ollama.com account" },
  ],
} as const;

export const HOW_IT_WORKS = { eyebrow: "How it works", title: "Ready in minutes." } as const;

export const FINAL_CTA = { signIn: "Sign in with ollama.com" } as const;

export type BentoMock = "attach" | "notification" | "memory" | "dataFlow" | "continue" | "menu";

interface BentoCell {
  mock: BentoMock;
  lead: string;
  body: string;
  isWide?: boolean;
}

export const BENTO_TITLE = "Every corner, covered.";

export const BENTO_CELLS: readonly BentoCell[] = [
  {
    mock: "attach",
    lead: "Attach anything.",
    body: "Photos, screenshots and PDFs. Quock reads a document's text, or runs OCR on your phone when there is none.",
    isWide: true,
  },
  { mock: "notification", lead: "Finishes in the background.", body: "Leave mid-answer. Quock can tell you when it is ready." },
  {
    mock: "memory",
    lead: "Remembers what matters.",
    body: "A few facts you share, stored on your phone and sent with your messages while memory is on.",
  },
  {
    mock: "dataFlow",
    lead: "Private by design.",
    body: "Your history lives on your iPhone, and your messages go only to Ollama Cloud.",
    isWide: true,
  },
  { mock: "continue", lead: "Never lose an answer.", body: "A reply cut short continues where it stopped, without paying twice." },
  {
    mock: "menu",
    lead: "Act on any part.",
    body: "Long-press a paragraph for a Deep dive or a web search. Fork the chat from any reply.",
  },
];

interface Feature {
  icon: ComponentType<SVGProps<SVGSVGElement>>;
  title: readonly [string, string];
}

// The app's headline capabilities: the icon grid shows them, the JSON-LD and llms.txt list them.
export const FEATURES: readonly Feature[] = [
  { icon: StreamIcon, title: ["Streamed", "replies"] },
  { icon: ModelsIcon, title: ["Every cloud", "model"] },
  { icon: ThinkIcon, title: ["Thinking", "on demand"] },
  { icon: GlobeIcon, title: ["Live web", "search"] },
  { icon: DocumentIcon, title: ["On-device", "PDF reading"] },
  { icon: PinIcon, title: ["Pinned chats", "and forks"] },
  { icon: MoonIcon, title: ["Light and", "dark themes"] },
  { icon: CodeIcon, title: [`${SITE.priceLabel} and`, "open source"] },
];

// The grid's capabilities plus the ones too long for a two-line title.
export const APP_FEATURES: readonly string[] = [
  ...FEATURES.map((feature) => feature.title.join(" ")),
  "Images and screenshots for vision models",
  "Memory stored on the iPhone, sent with your messages only while it is on",
  "Answers that finish in the background",
  "Chats stored on the iPhone, no analytics",
];

// The search phrases people use for this app; the keywords meta tag and the JSON-LD both read them.
export const SEO_KEYWORDS = [
  "Ollama Cloud client",
  "Ollama Cloud iPhone app",
  "how to use Ollama Cloud on iPhone",
  "iPhone LLM client",
  "LLM chat app",
  "open models",
  "AI chat iPhone",
  "private AI chat",
  "Quock",
] as const;

// Sample content inside the bento mocks: what each mock shows, kept beside the tiles that hold them.
export const MOCK_COPY = {
  pdfName: "lease-agreement.pdf",
  pdfNote: "Text read on this iPhone",
  notification: "Your answer is ready.",
  memoryFacts: ["Goes by Sam", "Prefers short answers", "Is learning Japanese"],
  dataFlowTitle: "Where your data goes",
  continueDone: "The quickest route is the coastal road, then the ferry from Anacortes. Leave before nine and you",
  continuePending: " will avoid the queue at",
  continueStatus: "Interrupted",
  excerptMarked: "Setting it up algebraically, where x is the ball\u2019s price",
  excerptRest: ", the bat costs x + $1.00 and together they cost $1.10.",
} as const;

// The phone itself, then the recipients of docs/PRIVACY.md section 4, drawn as the bento's data table.
export const DATA_FLOW = [
  { where: "Your iPhone", what: "Chats, memory, settings", when: "Always" },
  { where: "Ollama Cloud", what: "The chat you send, with memory while it is on", when: "On send" },
  { where: "Apple", what: "The telemetry iOS collects for every app", when: "Per your settings" },
  { where: "Quock's author", what: "Nothing", when: "Never" },
] as const;
