// Per-chat sticky composer toggles (think + web search) persisted on the chat row, mirroring the model pin.
// A dedicated modes-only query keeps the composer off the heavy `chat(id)` entry's per-token re-renders.

import React from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useDb } from "@/lib/contexts/DbContext";
import { queryKeys } from "@/lib/hooks/queryKeys";
import { WEB_SEARCH_DEFAULT_ON } from "@/lib/constants/magic-numbers";
import type { ChatId } from "@/lib/types/ids";

interface ComposerModes {
  thinkEnabled: boolean;
  webSearchEnabled: boolean;
  agentEnabled: boolean;
}

export interface UseChatComposerModesResult extends ComposerModes {
  setThinkEnabled: (enabled: boolean) => void;
  setWebSearchEnabled: (enabled: boolean) => void;
  setAgentEnabled: (enabled: boolean) => void;
}

// Mirrors the row default, so the globe reads right before the chat row resolves and for a chat that has no row.
const MODES_DEFAULT: ComposerModes = {
  thinkEnabled: false,
  webSearchEnabled: WEB_SEARCH_DEFAULT_ON,
  agentEnabled: false,
};

export function useChatComposerModes(
  chatId: ChatId,
): UseChatComposerModesResult {
  const { chats } = useDb();
  const queryClient = useQueryClient();
  // staleTime Infinity (same guard as useChatModel): the setters below patch this cache, so a mount refetch
  // must not re-read the DB and revert an optimistic flip before its write commits.
  const { data: modes = MODES_DEFAULT } = useQuery<ComposerModes>({
    queryKey: queryKeys.chatComposerModes(chatId),
    queryFn: async (): Promise<ComposerModes> => {
      const chat = await chats.get(chatId);
      return {
        thinkEnabled: chat?.thinkEnabled ?? false,
        webSearchEnabled: chat?.webSearchEnabled ?? WEB_SEARCH_DEFAULT_ON,
        agentEnabled: chat?.agentEnabled ?? false,
      };
    },
    staleTime: Infinity,
  });

  // Optimistic flip then persist; on failure revert only the field(s) this call changed (functional merges),
  // so a concurrent toggle of the other field is never clobbered by an in-flight rollback.
  const patch = React.useCallback(
    (next: Partial<ComposerModes>, persist: () => Promise<void>): void => {
      const key = queryKeys.chatComposerModes(chatId);
      // staleTime stops refetches, not the first fetch: a read issued at mount can resolve after this write and put
      // the old value back, which with the new default lands on the permissive side.
      queryClient.cancelQueries({ queryKey: key }).catch((err: unknown) => {
        console.warn(
          "useChatComposerModes: failed to cancel in-flight read",
          err,
        );
      });
      const before =
        queryClient.getQueryData<ComposerModes>(key) ?? MODES_DEFAULT;
      const revert: Partial<ComposerModes> = {};
      if (next.thinkEnabled !== undefined) {
        revert.thinkEnabled = before.thinkEnabled;
      }
      if (next.webSearchEnabled !== undefined) {
        revert.webSearchEnabled = before.webSearchEnabled;
      }
      if (next.agentEnabled !== undefined) {
        revert.agentEnabled = before.agentEnabled;
      }
      queryClient.setQueryData<ComposerModes>(key, (c) => ({
        ...(c ?? MODES_DEFAULT),
        ...next,
      }));
      void persist().catch((err: unknown) => {
        console.error("useChatComposerModes: failed to persist mode", err);
        queryClient.setQueryData<ComposerModes>(key, (c) => ({
          ...(c ?? MODES_DEFAULT),
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
  const setAgentEnabled = React.useCallback(
    (enabled: boolean): void => {
      patch({ agentEnabled: enabled }, () =>
        chats.setAgentEnabled(chatId, enabled),
      );
    },
    [chatId, chats, patch],
  );

  return React.useMemo<UseChatComposerModesResult>(
    () => ({
      thinkEnabled: modes.thinkEnabled,
      webSearchEnabled: modes.webSearchEnabled,
      agentEnabled: modes.agentEnabled,
      setThinkEnabled,
      setWebSearchEnabled,
      setAgentEnabled,
    }),
    [
      modes.thinkEnabled,
      modes.webSearchEnabled,
      modes.agentEnabled,
      setThinkEnabled,
      setWebSearchEnabled,
      setAgentEnabled,
    ],
  );
}
