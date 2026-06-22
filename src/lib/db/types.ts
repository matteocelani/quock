// Repository-layer types, decoupled from `codegen/gotypes.gen.ts` so storage can evolve independently from the wire format.

import type { AttachmentId, ChatId, MessageId } from "@/lib/types/ids";

export type MessageRole = "user" | "assistant" | "tool";
// Assistant lifecycle: pending -> streaming -> complete|error|interrupted. User and tool rows are always `complete`.
export type MessageStatus =
  | "pending"
  | "streaming"
  | "complete"
  | "error"
  | "interrupted";
// Discriminator persisted to `messages.error_code` so AssistantMessage can pick copy and gate Retry.
export type MessageErrorCode =
  | "network"
  | "cloud"
  | "subscription"
  | "unknown";
export interface DbChat {
  id: ChatId;
  title: string;
  createdAt: number;
  updatedAt: number;
  syncedAt: number | null;
  // Model NAME this chat is bound to; NULL means "not started yet" → shows the live global default until the first send locks it in.
  model: string | null;
  // Sticky composer toggles remembered per chat (both default false). Reset to false when the bound model loses the capability.
  thinkEnabled: boolean;
  webSearchEnabled: boolean;
}

export interface DbMessage {
  id: MessageId;
  chatId: ChatId;
  role: MessageRole;
  content: string;
  thinking: string | null;
  model: string | null;
  createdAt: number;
  updatedAt: number;
  thinkingTimeStart: number | null;
  thinkingTimeEnd: number | null;
  status: MessageStatus;
  errorCode: MessageErrorCode | null;
  // True when a web-search tool call failed during this turn; the model still answered, but the bubble shows a non-fatal "Web search unavailable" note.
  webSearchFailed: boolean;
  // Modes active when a USER turn was sent — drives the small read-only indicators on the bubble. Always false on assistant/tool rows.
  sentWithThink: boolean;
  sentWithWebSearch: boolean;
}

export interface DbAttachment {
  id: AttachmentId;
  messageId: MessageId;
  filename: string;
  mimeType: string | null;
  data: Uint8Array;
  // Local picker URI captured at attach time; null for pre-migration rows.
  uri: string | null;
  sizeBytes: number;
}

export interface ChatSummary {
  id: ChatId;
  title: string;
  excerpt: string;
  updatedAt: number;
  /** Approximate on-device bytes used by this chat (message content + thinking + attachment blobs). */
  sizeBytes: number;
}
