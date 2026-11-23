export interface FaqItem {
  question: string;
  answer: string;
  isPrivacy?: boolean;
}

export const FAQ_UPDATED = "2026-11-23";

// Plain text on purpose: the same strings feed the page and the FAQPage JSON-LD.
export const FAQ: readonly FaqItem[] = [
  {
    question: "What is Quock?",
    answer:
      "Quock is a native iPhone app for chatting with the AI models hosted on Ollama Cloud. You sign in once with your ollama.com account, pick a model, and type. Replies stream back word by word.",
  },
  {
    question: "Who makes Quock?",
    answer:
      "Quock is an independent, open-source app by Matteo Celani. It connects to Ollama Cloud with your own ollama.com account, and is not affiliated with, endorsed by, or sponsored by Ollama, Inc.",
  },
  {
    question: "What do I need to use it?",
    answer:
      "An iPhone on iOS 15.1 or later and an ollama.com account. Quock itself is free. Usage limits and any paid plan are set by Ollama Cloud, not by Quock.",
  },
  {
    question: "How much does Quock cost?",
    answer:
      "Quock is free on the App Store and shows no ads. Your Ollama Cloud plan and its limits are managed by Ollama on ollama.com.",
  },
  {
    question: "Which models can I use?",
    answer:
      "Every model in the Ollama Cloud catalogue, including families such as Gemma, Qwen, Llama, GPT-OSS, DeepSeek, Kimi and GLM. The picker shows which ones can see images and which ones can think before they answer.",
  },
  {
    question: "Where are my conversations stored?",
    isPrivacy: true,
    answer:
      "On your phone, in a local database. There is no Quock server. When you send a message, it goes straight to Ollama Cloud over HTTPS with the earlier turns of that chat and, while memory is on, the few facts Quock remembers about you.",
  },
  {
    question: "Does Quock track me?",
    isPrivacy: true,
    answer:
      "No. There are no analytics, no advertising identifiers, no crash reporters and no profiling. Apart from your chats going to Ollama Cloud, the app only checks for its own updates. This website does not use cookies or trackers either.",
  },
  {
    question: "How does sign-in work?",
    isPrivacy: true,
    answer:
      "Quock creates a cryptographic key pair on your phone and you approve it once on ollama.com. Every request is signed with that key, so there is no password stored in the app, and the secret never leaves the iOS Keychain.",
  },
  {
    question: "Can I ask about a PDF or a photo?",
    answer:
      "Yes. Attach a photo, a screenshot or a PDF. Quock reads a document's text layer, or runs text recognition on your phone when there is none, and keeps the pages in view as the conversation continues. Images need a vision-capable model.",
  },
  {
    question: "What does memory do?",
    isPrivacy: true,
    answer:
      "Quock can remember a few lasting facts you share, such as your name or how you like answers, so new chats do not start from zero. Memory is on by default. The facts are stored on your phone and travel to Ollama Cloud with your messages while memory is on. Turn it off in Settings at any time, and revoke consent to delete every fact.",
  },
  {
    question: "What happens if I leave the app mid-answer?",
    answer:
      "The answer keeps streaming for a while in the background, and Quock can notify you when it is ready. If it is cut short, you can continue the same answer instead of paying for it twice.",
  },
  {
    question: "Is there an Android version?",
    answer:
      "Quock is built for both platforms and the Android version is coming to Google Play. Today it is available on iPhone.",
  },
  {
    question: "Is Quock open source?",
    answer:
      "Yes. The full source is on GitHub under the MIT licence. Bug reports, ideas and pull requests are welcome there.",
  },
] as const;
