// Clears every chat from local SQLite by iterating the list; drops every per-chat cache on success.

import { useMutation, useQueryClient } from "@tanstack/react-query";
import React from "react";
import { useDb } from "@/lib/contexts/DbContext";
import { queryKeys } from "@/lib/hooks/queryKeys";

export interface UseClearAllChatsResult {
  clearAll: () => Promise<void>;
  isPending: boolean;
}

export function useClearAllChats(): UseClearAllChatsResult {
  const queryClient = useQueryClient();
  const db = useDb();
  const mutation = useMutation({
    mutationFn: async (): Promise<void> => {
      const all = await db.chats.list();
      for (const chat of all) {
        await db.chats.delete(chat.id);
      }
      // Once, after the loop — never per chat: VACUUM rebuilds the whole file, so N of them would be N rewrites.
      await db.chats.reclaimSpace();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.chats() });
      queryClient.removeQueries({ queryKey: queryKeys.chatRoot() });
      // Clearing this account's chats shrinks the device-wide total shown on the "clear all data" row.
      queryClient.invalidateQueries({ queryKey: queryKeys.deviceStorage() });
    },
  });

  const clearAll = React.useCallback(
    (): Promise<void> => mutation.mutateAsync(),
    [mutation],
  );
  return React.useMemo<UseClearAllChatsResult>(
    () => ({ clearAll, isPending: mutation.isPending }),
    [clearAll, mutation.isPending],
  );
}
