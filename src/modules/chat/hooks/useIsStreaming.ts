// Boolean accessor over the streaming store for a single chat. Subscribes only to membership of `chatId` so an unrelated chat's stream cycle never re-renders this consumer.

import { useStreamingStore } from "@/modules/chat/stores/streaming.store";
import type { ChatId } from "@/lib/types/ids";

export function useIsStreaming(chatId: ChatId): boolean {
  return useStreamingStore((s) => s.streamingChatIds.has(chatId));
}
