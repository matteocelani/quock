// Centralised TanStack Query keys. Use these accessors instead of literal arrays so renames and typos are caught at compile time.

import type { ChatId } from "@/lib/types/ids";

export const queryKeys = {
  user: () => ["user"] as const,
  chats: () => ["chats"] as const,
  chat: (id: ChatId) => ["chat", id] as const,
  // Pinned model NAME for a chat, kept separate from the heavy `chat(id)` entry so the
  // model badge + composer subscribe to it without re-rendering on every streamed token.
  chatModel: (id: ChatId) => ["chat", id, "model"] as const,
  // Per-chat sticky composer toggles (think + web search), kept off the heavy `chat(id)` entry
  // so the composer subscribes without re-rendering on every streamed token.
  chatComposerModes: (id: ChatId) => ["chat", id, "modes"] as const,
  // Prefix key for matching every per-chat cache entry at once (e.g. bulk removeQueries).
  chatRoot: () => ["chat"] as const,
  cloudModels: () => ["models", "cloud"] as const,
  modelCapabilities: (name: string | null) =>
    ["modelCapabilities", name] as const,
} as const;
