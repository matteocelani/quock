// Optimistic pin toggle: the row moves between Pinned and its date bucket at once, rolled back if the write fails.

import {
  useMutation,
  useQueryClient,
  type UseMutationResult,
} from "@tanstack/react-query";
import { useDb } from "@/lib/contexts/DbContext";
import type { ChatSummary } from "@/lib/db/types";
import type { ChatId } from "@/lib/types/ids";
import { queryKeys } from "@/lib/hooks/queryKeys";

export interface UpdateChatPinnedInput {
  id: ChatId;
  isPinned: boolean;
}

interface UpdateChatPinnedContext {
  previous: ChatSummary[] | undefined;
}

export function useUpdateChatPinned(): UseMutationResult<
  void,
  Error,
  UpdateChatPinnedInput
> {
  const { chats } = useDb();
  const queryClient = useQueryClient();
  return useMutation<
    void,
    Error,
    UpdateChatPinnedInput,
    UpdateChatPinnedContext
  >({
    mutationFn: async ({ id, isPinned }) => {
      await chats.setPinned(id, isPinned);
    },
    onMutate: async ({ id, isPinned }): Promise<UpdateChatPinnedContext> => {
      await queryClient.cancelQueries({ queryKey: queryKeys.chats() });
      const previous = queryClient.getQueryData<ChatSummary[]>(
        queryKeys.chats(),
      );
      if (previous) {
        queryClient.setQueryData<ChatSummary[]>(
          queryKeys.chats(),
          previous.map((c) => (c.id === id ? { ...c, isPinned } : c)),
        );
      }
      return { previous };
    },
    onError: (_error, _input, context) => {
      if (context?.previous) {
        queryClient.setQueryData(queryKeys.chats(), context.previous);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.chats() });
    },
  });
}
