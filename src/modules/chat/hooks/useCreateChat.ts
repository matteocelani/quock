// Creates a chat in the local repository and returns its ChatId for navigation.

import {
  useMutation,
  useQueryClient,
  type UseMutationResult,
} from "@tanstack/react-query";
import { useDb } from "@/lib/contexts/DbContext";
import type { ChatId } from "@/lib/types/ids";
import { queryKeys } from "@/lib/hooks/queryKeys";

export interface CreateChatInput {
  title?: string;
}

export function useCreateChat(): UseMutationResult<
  ChatId,
  Error,
  CreateChatInput | void
> {
  const { chats } = useDb();
  const queryClient = useQueryClient();
  return useMutation<ChatId, Error, CreateChatInput | void>({
    mutationFn: async (input): Promise<ChatId> => {
      // `void` in the union lets `mutate()` be called with no arguments; at runtime it is undefined.
      const title = input ? input.title : undefined;
      const created = await chats.create(title);
      return created.id;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.chats() });
    },
  });
}
