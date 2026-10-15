// Forks a chat at one reply into a new chat and returns its ChatId for navigation; the source chat is left untouched.

import {
  useMutation,
  useQueryClient,
  type UseMutationResult,
} from "@tanstack/react-query";
import { useDb } from "@/lib/contexts/DbContext";
import type { ChatId, MessageId } from "@/lib/types/ids";
import { queryKeys } from "@/lib/hooks/queryKeys";
import { forkTitle } from "@/modules/chat/lib/forkTitle";

export interface CreateForkInput {
  sourceId: ChatId;
  upToMessageId: MessageId;
}

export function useCreateFork(): UseMutationResult<
  ChatId,
  Error,
  CreateForkInput
> {
  const { chats } = useDb();
  const queryClient = useQueryClient();
  return useMutation<ChatId, Error, CreateForkInput>({
    mutationFn: async ({ sourceId, upToMessageId }): Promise<ChatId> => {
      const source = await chats.get(sourceId);
      if (source === null) {
        throw new Error("useCreateFork: source chat not found");
      }
      return chats.fork(sourceId, upToMessageId, forkTitle(source.title));
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.chats() });
    },
  });
}
