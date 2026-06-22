// Per-chat sticky composer toggles (think + web search) persisted on the chat row, mirroring the model pin.
// A dedicated modes-only query keeps the composer off the heavy `chat(id)` entry's per-token re-renders.

import React from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useDb } from "@/lib/contexts/DbContext";
import { queryKeys } from "@/lib/hooks/queryKeys";
import type { ChatId } from "@/lib/types/ids";

interface ComposerModes {
  thinkEnabled: boolean;
  webSearchEnabled: boolean;
}

export interface UseChatComposerModesResult extends ComposerModes {
  setThinkEnabled: (enabled: boolean) => void;
  setWebSearchEnabled: (enabled: boolean) => void;
}

const MODES_OFF: ComposerModes = { thinkEnabled: false, webSearchEnabled: false };

export function useChatComposerModes(
  chatId: ChatId,
): UseChatComposerModesResult {
  const { chats } = useDb();
  const queryClient = useQueryClient();
  // staleTime Infinity (same guard as useChatModel): the setters below patch this cache, so a mount refetch
  // must not re-read the DB and revert an optimistic flip before its write commits.
  const { data: modes = MODES_OFF } = useQuery<ComposerModes>({
    queryKey: queryKeys.chatComposerModes(chatId),
    queryFn: async (): Promise<ComposerModes> => {
      const chat = await chats.get(chatId);
      return {
        thinkEnabled: chat?.thinkEnabled ?? false,
        webSearchEnabled: chat?.webSearchEnabled ?? false,
      };
    },
    staleTime: Infinity,
  });

  // Optimistic flip then persist; on failure revert only the field(s) this call changed (functional merges),
  // so a concurrent toggle of the other field is never clobbered by an in-flight rollback.
  const patch = React.useCallback(
    (next: Partial<ComposerModes>, persist: () => Promise<void>): void => {
      const key = queryKeys.chatComposerModes(chatId);
      const before = queryClient.getQueryData<ComposerModes>(key) ?? MODES_OFF;
      const revert: Partial<ComposerModes> = {};
      if (next.thinkEnabled !== undefined) {
        revert.thinkEnabled = before.thinkEnabled;
      }
      if (next.webSearchEnabled !== undefined) {
        revert.webSearchEnabled = before.webSearchEnabled;
      }
      queryClient.setQueryData<ComposerModes>(key, (c) => ({
        ...(c ?? MODES_OFF),
        ...next,
      }));
      void persist().catch((err: unknown) => {
        console.error("useChatComposerModes: failed to persist mode", err);
        queryClient.setQueryData<ComposerModes>(key, (c) => ({
          ...(c ?? MODES_OFF),
          ...revert,
        }));
      });
    },
    [chatId, queryClient],
  );

  const setThinkEnabled = React.useCallback(
    (enabled: boolean): void => {
      patch({ thinkEnabled: enabled }, () =>
        chats.setThinkEnabled(chatId, enabled),
      );
    },
    [chatId, chats, patch],
  );
  const setWebSearchEnabled = React.useCallback(
    (enabled: boolean): void => {
      patch({ webSearchEnabled: enabled }, () =>
        chats.setWebSearchEnabled(chatId, enabled),
      );
    },
    [chatId, chats, patch],
  );

  return React.useMemo<UseChatComposerModesResult>(
    () => ({
      thinkEnabled: modes.thinkEnabled,
      webSearchEnabled: modes.webSearchEnabled,
      setThinkEnabled,
      setWebSearchEnabled,
    }),
    [modes.thinkEnabled, modes.webSearchEnabled, setThinkEnabled, setWebSearchEnabled],
  );
}
