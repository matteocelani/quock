// Per-chat model: the NAME pinned to a chat (persisted in `chats.model`), falling back to the global default (useSelectedModel) when the chat has none. A dedicated model-only query keeps the composer + badge from re-rendering on every streamed token of the heavy `chat(id)` entry.

import React from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import type { CloudModel } from "@/modules/models/api/models";
import { useCloudModels } from "@/modules/models/hooks/useCloudModels";
import { useSelectedModel } from "@/modules/models/hooks/useSelectedModel";
import { useDb } from "@/lib/contexts/DbContext";
import { queryKeys } from "@/lib/hooks/queryKeys";
import type { ChatId } from "@/lib/types/ids";

export interface UseChatModelResult {
  model: CloudModel | null;
  setForCurrentChat: (model: CloudModel) => void;
}

export function useChatModel(chatId: ChatId): UseChatModelResult {
  const { chats } = useDb();
  const queryClient = useQueryClient();
  const { data: cloudModels } = useCloudModels();
  const { model: defaultModel } = useSelectedModel();
  // Model-only read: the payload is the pinned NAME (or null), so this subscription
  // only re-renders when the pin itself changes, never on the chat's streaming traffic.
  const { data: pinnedName } = useQuery<string | null>({
    queryKey: queryKeys.chatModel(chatId),
    queryFn: async (): Promise<string | null> => {
      const chat = await chats.get(chatId);
      return chat?.model ?? null;
    },
    // The pin only changes through setForCurrentChat / the first-send lock, which both patch this cache, so staleTime Infinity stops a mount refetch from re-reading the DB and reverting an optimistic pick before its write commits.
    staleTime: Infinity,
  });
  const pinnedModel = React.useMemo<CloudModel | null>(() => {
    if (!pinnedName || !cloudModels) return null;
    return cloudModels.find((m) => m.name === pinnedName) ?? null;
  }, [cloudModels, pinnedName]);
  const setForCurrentChat = React.useCallback(
    (model: CloudModel): void => {
      // Flip the cache first so the badge + composer update instantly, then persist so the
      // pin survives restarts. The optimistic value hides latency; the DB is the source of truth.
      const previous = queryClient.getQueryData<string | null>(
        queryKeys.chatModel(chatId),
      );
      queryClient.setQueryData(queryKeys.chatModel(chatId), model.name);
      void chats.setModel(chatId, model.name).catch((err: unknown) => {
        // Roll the cache back so it never disagrees with the DB when the write fails.
        console.error("useChatModel: failed to persist chat model", err);
        queryClient.setQueryData(queryKeys.chatModel(chatId), previous ?? null);
      });
    },
    [chatId, chats, queryClient],
  );
  return React.useMemo<UseChatModelResult>(
    () => ({ model: pinnedModel ?? defaultModel, setForCurrentChat }),
    [pinnedModel, defaultModel, setForCurrentChat],
  );
}
