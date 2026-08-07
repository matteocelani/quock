// Whether this chat's model is producing REASONING right now rather than answer tokens. Subscribes to membership only,
// so an unrelated chat flipping between thinking and writing never re-renders this consumer.

import { useStreamingStore } from "@/modules/chat/stores/streaming.store";
import type { ChatId } from "@/lib/types/ids";

export function useIsReasoning(chatId: ChatId): boolean {
  return useStreamingStore((s) => s.reasoningChatIds.has(chatId));
}
