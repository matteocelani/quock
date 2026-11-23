export interface GuideStep {
  title: string;
  body: string;
}

export const GUIDE_TITLE = "How to use Ollama Cloud on iPhone";
export const GUIDE_PATH = "/ollama-cloud-on-iphone/";
export const GUIDE_UPDATED = "2026-11-23";

// One source for the home page's "How it works" and the guide's HowTo JSON-LD, so they never disagree.
export const GUIDE_STEPS: readonly GuideStep[] = [
  {
    title: "Get an ollama.com account.",
    body: "Ollama Cloud runs open models on Ollama's servers. Create your account at ollama.com, where Ollama also sets the plans and usage limits.",
  },
  {
    title: "Download Quock.",
    body: "Quock is free on the App Store for any iPhone on iOS 15.1 or later.",
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

export interface GuideTip {
  title: string;
  body: string;
}

export const GUIDE_TIPS: readonly GuideTip[] = [
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
    body: "Memory keeps a few facts you share, on your phone, so new chats start warm. Turn it off in Settings at any time.",
  },
];
