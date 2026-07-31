// Shared turn-building steps for the send / regenerate / retry / editAndResend paths in `useSendMessage`, kept
// React-free and module-level so the four paths share one implementation each and can be unit-tested without the hook.

import type { QueryClient } from "@tanstack/react-query";
import type { ChatRepository } from "@/lib/db/chatRepository";
import type { DbAttachment, DbMessage } from "@/lib/db/types";
import { queryKeys } from "@/lib/hooks/queryKeys";
import type { ChatId, MessageId } from "@/lib/types/ids";
import type { WireChatMessage } from "@/modules/chat/api/chat";
import type { UseChatData } from "@/modules/chat/hooks/useChat";
import { attachmentTextBlocks } from "@/modules/chat/lib/attachmentText";
import { bytesToBase64 } from "@/lib/encoding/base64";
import { ATTACHMENT_MAX_TOTAL_BYTES } from "@/modules/chat/constants";
import { allocateBlocks, foldBlocks } from "@/modules/chat/lib/documentText";

// Drops image attachments when the active model lacks vision so unsupported blobs never reach the DB write
// or the wire payload. Generic over Ui/Db attachment rows — both carry a `mimeType`.
export function gateVisionAttachments<T extends { mimeType?: string | null }>(
  rows: T[],
  hasVision: boolean,
): T[] {
  if (hasVision) return rows;
  return rows.filter((a) => a.mimeType?.startsWith("image/") !== true);
}

// Maps persisted rows to the stateless `/api/chat` wire conversation, keeping only user + assistant turns, and re-folds
// each user turn's documents from their rows. Folding only the turn being sent left a document invisible from the second
// question on: the model saw the question about a PDF with no PDF attached, and disowned its own correct answer.
export interface WireHistory {
  messages: WireChatMessage[];
  // True when the character budget forced a document to be cut, so the caller can say so instead of shipping a silent gap.
  truncated: boolean;
}

export function toWireHistory(
  messages: readonly DbMessage[],
  attachmentRows: readonly DbAttachment[] = [],
  hasVision = false,
): WireHistory {
  const turns = messages.filter(
    (m) => m.role === "user" || m.role === "assistant",
  );
  const rowsOf = (m: DbMessage): DbAttachment[] =>
    m.role === "user" ? attachmentRows.filter((a) => a.messageId === m.id) : [];
  const groups = turns.map((m) =>
    rowsOf(m).flatMap((a) => attachmentTextBlocks(a, hasVision)),
  );
  const allocated = allocateBlocks(groups);
  // Images ride each user turn, not only the last one: /api/chat is stateless, so a picture attached three questions ago
  // is gone from the model's view unless it is replayed. Newest first, since the byte budget bounds the whole payload.
  let imageBudget = ATTACHMENT_MAX_TOTAL_BYTES;
  const imagesPerTurn = new Array<string[]>(turns.length).fill([]);
  for (let i = turns.length - 1; i >= 0; i -= 1) {
    const images: string[] = [];
    for (const row of rowsOf(turns[i])) {
      if (row.mimeType?.startsWith("image/") !== true) continue;
      if (!hasVision || row.data.byteLength > imageBudget) continue;
      imageBudget -= row.data.byteLength;
      images.push(bytesToBase64(row.data));
    }
    imagesPerTurn[i] = images;
  }
  return {
    messages: turns.map((m, i) => {
      const wire: WireChatMessage = {
        role: m.role as "user" | "assistant",
        content: foldBlocks(m.content, allocated.groups[i] ?? []),
      };
      const images = imagesPerTurn[i];
      return images.length > 0 ? { ...wire, images } : wire;
    }),
    truncated: allocated.truncated,
  };
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
