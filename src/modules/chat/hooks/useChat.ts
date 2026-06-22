// Returns one chat with its messages, preserving the optimistic in-flight snapshot set by `useSendMessage` when SQLite has fewer rows than the cache.

import {
  useQuery,
  useQueryClient,
  type UseQueryResult,
} from "@tanstack/react-query";
import { useDb } from "@/lib/contexts/DbContext";
import type { DbAttachment, DbChat, DbMessage } from "@/lib/db/types";
import type { ChatId, MessageId } from "@/lib/types/ids";
import { queryKeys } from "@/lib/hooks/queryKeys";
import { useStreamingStore } from "@/modules/chat/stores/streaming.store";

export interface UseChatData {
  chat: DbChat;
  messages: DbMessage[];
  // Indexed by message id so UserMessage can look up its chips in O(1) without re-querying per row.
  attachmentsByMessage: ReadonlyMap<MessageId, DbAttachment[]>;
}

// Sentinel so the screen can tell "this chat was deleted" (clear-all, or the current chat removed) apart from a
// transient DB read error, and route to a fresh chat instead of dead-ending on an error message.
const CHAT_NOT_FOUND_PREFIX = "Chat not found";
export function isChatNotFoundError(error: unknown): boolean {
  return (
    error instanceof Error && error.message.startsWith(CHAT_NOT_FOUND_PREFIX)
  );
}

export function useChat(chatId: ChatId): UseQueryResult<UseChatData, Error> {
  const { chats, messages, attachments } = useDb();
  const queryClient = useQueryClient();
  // The queryFn closure captures the store snapshot at call time via `getState`; subscribing to the streaming Set here would re-fetch on every unrelated stream tick.
  return useQuery<UseChatData, Error>({
    queryKey: queryKeys.chat(chatId),
    queryFn: async (): Promise<UseChatData> => {
      const chat = await chats.get(chatId);
      if (!chat) {
        throw new Error(`${CHAT_NOT_FOUND_PREFIX}: ${chatId}`);
      }

      const dbMessages = await messages.listByChat(chatId);
      // Hydrate attachments per user message so chips render without a per-row async hop.
      const attachmentsByMessage = new Map<MessageId, DbAttachment[]>();
      for (const m of dbMessages) {
        if (m.role !== "user") continue;
        const list = await attachments.listByMessage(m.id);
        if (list.length > 0) attachmentsByMessage.set(m.id, list);
      }
      // Re-read live state AFTER the awaits: a slow DB read must not clobber an optimistic turn the send/stream
      // path patched while we read. Return the live cache while streaming, or when it holds more turns than the DB.
      const live = queryClient.getQueryData<UseChatData>(
        queryKeys.chat(chatId),
      );
      const isStreaming = useStreamingStore
        .getState()
        .streamingChatIds.has(chatId);
      if (live && (isStreaming || live.messages.length > dbMessages.length)) {
        return live;
      }
      return { chat, messages: dbMessages, attachmentsByMessage };
    },
    // The send/stream/mutation paths patch this cache imperatively, so an auto-refetch is never needed — and a
    // mount/focus refetch mid-send could revert the optimistic turn before its DB commit. Matches the sibling hooks.
    staleTime: Infinity,
  });
}
