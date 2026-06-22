// Optimistic chat rename. Patches both `["chats"]` and `["chat", id]` ahead of the SQLite write and rolls back on error.

import {
  useMutation,
  useQueryClient,
  type UseMutationResult,
} from "@tanstack/react-query";
import { useDb } from "@/lib/contexts/DbContext";
import type { ChatSummary } from "@/lib/db/types";
import type { ChatId } from "@/lib/types/ids";
import { queryKeys } from "@/lib/hooks/queryKeys";
import type { UseChatData } from "@/modules/chat/hooks/useChat";

export interface RenameChatInput {
  id: ChatId;
  title: string;
}

interface RenameChatContext {
  previousList: ChatSummary[] | undefined;
  previousChat: UseChatData | undefined;
}

export function useRenameChat(): UseMutationResult<
  void,
  Error,
  RenameChatInput
> {
  const { chats } = useDb();
  const queryClient = useQueryClient();
  return useMutation<void, Error, RenameChatInput, RenameChatContext>({
    mutationFn: async ({ id, title }) => {
      await chats.rename(id, title);
    },
    onMutate: async ({ id, title }): Promise<RenameChatContext> => {
      await queryClient.cancelQueries({ queryKey: queryKeys.chats() });
      // exact: a rename only touches the heavy chat entry; without it, prefix matching also hits the child chatModel(id) = ["chat", id, "model"] query and wastes a SQLite re-read of a pin that never changed.
      await queryClient.cancelQueries({
        queryKey: queryKeys.chat(id),
        exact: true,
      });

      const previousList = queryClient.getQueryData<ChatSummary[]>(
        queryKeys.chats(),
      );
      const previousChat = queryClient.getQueryData<UseChatData>(
        queryKeys.chat(id),
      );
      if (previousList) {
        queryClient.setQueryData<ChatSummary[]>(
          queryKeys.chats(),
          previousList.map((c) => (c.id === id ? { ...c, title } : c)),
        );
      }
      if (previousChat) {
        queryClient.setQueryData<UseChatData>(queryKeys.chat(id), {
          ...previousChat,
          chat: { ...previousChat.chat, title },
        });
      }
      return { previousList, previousChat };
    },
    onError: (_error, { id }, context) => {
      if (context?.previousList) {
        queryClient.setQueryData(queryKeys.chats(), context.previousList);
      }
      if (context?.previousChat) {
        queryClient.setQueryData(queryKeys.chat(id), context.previousChat);
      }
    },
    onSettled: (_data, _err, { id }) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.chats() });
      // exact: keep the refetch on the heavy chat entry only, leaving the dedicated chatModel(id) cache warm.
      queryClient.invalidateQueries({
        queryKey: queryKeys.chat(id),
        exact: true,
      });
    },
  });
}
