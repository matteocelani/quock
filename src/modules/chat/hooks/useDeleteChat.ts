// Optimistic chat deletion mirroring the web app: snapshot in onMutate, rollback on error, invalidate after.

import {
  useMutation,
  useQueryClient,
  type UseMutationResult,
} from "@tanstack/react-query";
import { useDb } from "@/lib/contexts/DbContext";
import type { ChatSummary } from "@/lib/db/types";
import type { ChatId } from "@/lib/types/ids";
import { queryKeys } from "@/lib/hooks/queryKeys";

interface DeleteChatContext {
  previous: ChatSummary[] | undefined;
}

export function useDeleteChat(): UseMutationResult<void, Error, ChatId> {
  const { chats } = useDb();
  const queryClient = useQueryClient();
  return useMutation<void, Error, ChatId, DeleteChatContext>({
    mutationFn: async (id) => {
      await chats.delete(id);
    },
    onMutate: async (id): Promise<DeleteChatContext> => {
      await queryClient.cancelQueries({ queryKey: queryKeys.chats() });

      const previous = queryClient.getQueryData<ChatSummary[]>(
        queryKeys.chats(),
      );
      if (previous) {
        queryClient.setQueryData<ChatSummary[]>(
          queryKeys.chats(),
          previous.filter((c) => c.id !== id),
        );
      }
      // Drops the per-chat cache so navigations don't render a stale entry.
      queryClient.removeQueries({ queryKey: queryKeys.chat(id) });
      return { previous };
    },
    onError: (_error, _id, context) => {
      if (context?.previous) {
        queryClient.setQueryData(queryKeys.chats(), context.previous);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.chats() });
    },
  });
}
