import { SITE } from "@/lib/site";

interface GuideItem {
  title: string;
  body: string;
}

export const GUIDE_TITLE = "How to use Ollama Cloud on iPhone";
export const GUIDE_HEADLINE = "Ollama Cloud on iPhone";
export const GUIDE_UPDATED = "2026-11-23";
// How long setup takes; the intro says it and the HowTo JSON-LD declares it.
export const GUIDE_MINUTES = 3;

// The page's step ids and the HowTo step URLs share this, so the links can never break.
export function stepAnchor(index: number): string {
  return `step-${index + 1}`;
}

export const GUIDE_INTRO = `Quock brings the open models on Ollama Cloud, from Gemma and Qwen to GPT-OSS, DeepSeek and Kimi, to your iPhone in about ${GUIDE_MINUTES} minutes.`;

// One source for the home page's "How it works", this guide, its HowTo JSON-LD and llms.txt.
export const GUIDE_STEPS: readonly GuideItem[] = [
  {
    title: "Get an ollama.com account.",
    body: "Ollama Cloud runs open models on Ollama's servers. Create your account at ollama.com, where Ollama also sets the plans and usage limits.",
  },
  {
    title: "Download Quock.",
    body: `Quock is ${SITE.priceLabel.toLowerCase()} on the App Store for any iPhone on iOS ${SITE.minimumIos} or later.`,
  },
  {
    title: "Sign in once.",
    body: "Tap Continue with Ollama and approve Quock on ollama.com. You never type a password into the app; Quock signs every request with a key kept in the iOS Keychain.",
  },
  {
    title: "Pick a model and type.",
    body: "Choose any cloud model and start typing. The reply streams in word by word, and every chat stays on your phone.",
  },
];

export const GUIDE_TIPS_TITLE = "Make the most of it.";

export const GUIDE_TIPS: readonly GuideItem[] = [
  {
    title: "Let it think.",
    body: "Turn on thinking in the + menu of a chat. Models that reason show their work in a fold above the answer.",
  },
  {
    title: "Search the web mid-answer.",
    body: "Web search is a per-chat toggle in the same menu, for questions that need fresh facts.",
  },
  {
    title: "Ask about a PDF or a photo.",
    body: "Attach a document and Quock reads its text, or runs OCR on your phone when there is none. Photos need a vision model.",
  },
  {
    title: "Dig into one paragraph.",
    body: "Long-press any paragraph of a reply to send just that piece to a Deep dive or a web search.",
  },
  {
    title: "Set a default model.",
    body: "Pick the model every new chat starts with in Settings, along with the theme and haptics.",
  },
  {
    title: "Let it remember you.",
    body: "Memory keeps a few facts you share on your phone and sends them with your messages while it is on, so new chats start warm. Turn it off in Settings at any time.",
  },
];

export const GUIDE_CHATS: GuideItem = {
  title: "Where your chats live.",
  body: "On your iPhone, in a local database, with no Quock server and no analytics. When you send a message, it goes straight to Ollama Cloud with the earlier turns of that chat and, while memory is on, the facts Quock remembers about you.",
};

const STEP_SUMMARY = GUIDE_STEPS.map((step) => {
  const title = step.title.replace(/\.$/, "");
  return title.charAt(0).toLowerCase() + title.slice(1);
}).join(", ");

// Built from the steps, so adding or renaming one keeps the search snippet true.
export const GUIDE_DESCRIPTION = `Use Ollama Cloud models on your iPhone in ${GUIDE_STEPS.length} steps: ${STEP_SUMMARY}.`;
