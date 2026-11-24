interface Release {
  version: string;
  date: string;
  title: string;
  changes: readonly string[];
}

// One sentence per minor line. A new minor shows up on its own; its summary is optional.
const LINE_SUMMARIES: Readonly<Record<string, string>> = {
  "0.2":
    "An iOS 27 design system, PDF reading with on-device OCR, excerpt actions, and answers that survive the background, with memory, pins and forks.",
  "0.1":
    "The first line: sign in with ollama.com, chat with every cloud model, select and copy replies, and keep every chat on your phone.",
};

// Written for people, from the GitHub release notes and the release branch history.
const RELEASES: readonly Release[] = [
  {
    version: "0.2.1",
    date: "2026-11-06",
    title: "Answers that survive the background.",
    changes: [
      "Answers keep streaming for a while after you leave the app.",
      "Optional notification when an answer finishes in the background.",
      "Continue an interrupted answer instead of paying for it twice.",
      "Memory: the model can remember a few facts about you, stored on your phone.",
      "Pin chats with a swipe and keep them above today.",
      "Fork a conversation from any reply into a new chat.",
      "Streams that go silent now end with a clear error instead of hanging.",
    ],
  },
  {
    version: "0.2.0",
    date: "2026-08-31",
    title: "A new design, documents and excerpt actions.",
    changes: [
      "New design system with floating glass controls and sheet cards.",
      "Long-press any paragraph of a reply to send it to Deep dive or Web search.",
      "Attach a PDF: Quock reads its text layer, or runs OCR on your phone when there is none.",
      "The chat list opens as a page, and you can watch the model think.",
      "A lighter app that no longer ships unused icons.",
    ],
  },
  {
    version: "0.1.3",
    date: "2026-08-18",
    title: "Every model in the picker.",
    changes: ["The model picker lists every cloud model, with better capability detection."],
  },
  {
    version: "0.1.2",
    date: "2026-07-30",
    title: "Select, copy and tap.",
    changes: [
      "Select and copy any part of a reply.",
      "Tappable links and readable tables in replies.",
      "Edit a message while a reply is still streaming.",
      "Settings and About now live in separate pages.",
    ],
  },
  {
    version: "0.1.1",
    date: "2026-06-27",
    title: "Consent and quicker photos.",
    changes: [
      "Ask for consent before any chat is sent to the cloud, with review and revoke.",
      "Chats are scoped to the signed-in account.",
      "Instant photo attach and a reliable remove button.",
    ],
  },
  {
    version: "0.1.0",
    date: "2026-06-22",
    title: "Hello, Quock.",
    changes: [
      "Sign in with your ollama.com account.",
      "Pick any Ollama Cloud model and chat with streamed replies.",
      "Conversations stored on your phone.",
    ],
  },
] as const;

// The newest entry is the live release: its version and date are the site's version and "Updated" date.
export const LATEST_RELEASE = RELEASES[0];
export const CHANGELOG_UPDATED = LATEST_RELEASE.date;
export const CHANGELOG_DESCRIPTION = `What changed in each Quock release, up to version ${LATEST_RELEASE.version}.`;

const minorOf = (version: string): string => version.split(".").slice(0, 2).join(".");

// Releases grouped by minor line, newest first, derived from RELEASES so no release can go missing.
export const RELEASE_LINES = [...new Set(RELEASES.map((release) => minorOf(release.version)))].map((minor) => ({
  minor,
  summary: LINE_SUMMARIES[minor] as string | undefined,
  releases: RELEASES.filter((release) => minorOf(release.version) === minor),
}));

export const CHANGELOG_FOOTNOTE = {
  body: "Pull requests and commits behind each tagged release are on",
  linkLabel: "GitHub",
} as const;
