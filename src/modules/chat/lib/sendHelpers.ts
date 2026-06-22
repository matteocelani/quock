// Shared turn-building steps for the send / regenerate / retry / editAndResend paths in `useSendMessage`, kept
// React-free and module-level so the four paths share one implementation each and can be unit-tested without the hook.

import type { QueryClient } from "@tanstack/react-query";
import type { ChatRepository } from "@/lib/db/chatRepository";
import type { DbAttachment, DbMessage } from "@/lib/db/types";
import { queryKeys } from "@/lib/hooks/queryKeys";
import type { ChatId, MessageId } from "@/lib/types/ids";
import type { WireChatMessage } from "@/modules/chat/api/chat";
import type { UseChatData } from "@/modules/chat/hooks/useChat";
import type { ApiAttachment } from "@/modules/chat/lib/streamPipeline";

// Drops image attachments when the active model lacks vision so unsupported blobs never reach the DB write
// or the wire payload. Generic over Ui/Db attachment rows — both carry a `mimeType`.
export function gateVisionAttachments<T extends { mimeType?: string | null }>(
  rows: T[],
  hasVision: boolean,
): T[] {
  if (hasVision) return rows;
  return rows.filter((a) => a.mimeType?.startsWith("image/") !== true);
}

// Narrows persisted attachment rows to the wire shape: bytes only (the API serializes them), the local-only
// `uri` is dropped, and `mimeType` is omitted entirely when absent rather than sent as null.
export function narrowApiAttachments(rows: DbAttachment[]): ApiAttachment[] {
  return rows.map((a) => {
    const out: ApiAttachment = { filename: a.filename, data: a.data };
    if (a.mimeType !== null) out.mimeType = a.mimeType;
    return out;
  });
}

// Maps persisted rows to the stateless `/api/chat` wire history, keeping only user + assistant turns.
export function toWireHistory(messages: DbMessage[]): WireChatMessage[] {
  return messages
    .filter((m) => m.role === "user" || m.role === "assistant")
    .map((m) => ({ role: m.role as "user" | "assistant", content: m.content }));
}

// Locates an assistant turn and its preceding user turn, validating both. Shared by regenerate + retry;
// `context` prefixes the thrown messages so a failure still says which path raised it.
export function locateAssistantTurn(
  dbMessages: DbMessage[],
  assistantMessageId: MessageId,
  context: string,
): { assistantIndex: number; priorUser: DbMessage } {
  const assistantIndex = dbMessages.findIndex(
    (m) => m.id === assistantMessageId && m.role === "assistant",
  );
  if (assistantIndex <= 0) {
    throw new Error(`${context}: assistant message not found`);
  }
  const priorUser = dbMessages[assistantIndex - 1];
  if (priorUser.role !== "user") {
    throw new Error(`${context}: no preceding user message`);
  }
  return { assistantIndex, priorUser };
}

// Rebuilds the cache's per-message attachment map after a tail drop: keep only entries whose message survives,
// then re-assert one turn's attachments from the DB (skipped when empty) so its chips survive a cold cache.
export function pruneAttachmentMap(
  existing: UseChatData | undefined,
  keptMessages: DbMessage[],
  reassert: { messageId: MessageId; rows: DbAttachment[] },
): Map<MessageId, DbAttachment[]> {
  const keptIds = new Set(keptMessages.map((m) => m.id));
  const pruned = new Map<MessageId, DbAttachment[]>(
    [...(existing?.attachmentsByMessage ?? [])].filter(([id]) =>
      keptIds.has(id),
    ),
  );
  if (reassert.rows.length > 0) {
    pruned.set(reassert.messageId, reassert.rows);
  }
  return pruned;
}

// Writes the optimistic per-chat cache for a turn: reuse the already-loaded chat metadata, or hydrate it from
// the DB row on a cold cache. One coherence point shared by send / regenerate / retry / editAndResend.
export async function patchChatCache(
  queryClient: QueryClient,
  chats: ChatRepository,
  chatId: ChatId,
  existing: UseChatData | undefined,
  updatedMessages: DbMessage[],
  attachmentsByMessage: Map<MessageId, DbAttachment[]>,
): Promise<void> {
  const chat = existing?.chat ?? (await chats.get(chatId));
  if (!chat) return;
  queryClient.setQueryData<UseChatData>(queryKeys.chat(chatId), {
    chat,
    messages: updatedMessages,
    attachmentsByMessage,
  });
}

// After a turn mutation: float the chat to the top of the sidebar (touch its updatedAt) and refresh the list
// query so the new order/title shows without waiting for staleTime.
export async function bumpSidebar(
  chats: ChatRepository,
  queryClient: QueryClient,
  chatId: ChatId,
): Promise<void> {
  await chats.touchUpdated(chatId);
  void queryClient.invalidateQueries({ queryKey: queryKeys.chats() });
}
