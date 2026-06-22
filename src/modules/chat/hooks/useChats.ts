// Chats list read straight from local SQLite; staleTime keeps the sidebar warm across focus cycles.

import { useQuery, type UseQueryResult } from "@tanstack/react-query";
import { useDb } from "@/lib/contexts/DbContext";
import type { ChatSummary } from "@/lib/db/types";
import { CHATS_STALE_TIME_MS } from "@/modules/chat/constants";
import { queryKeys } from "@/lib/hooks/queryKeys";

export function useChats(): UseQueryResult<ChatSummary[], Error> {
  const { chats } = useDb();
  return useQuery<ChatSummary[], Error>({
    queryKey: queryKeys.chats(),
    queryFn: () => chats.list(),
    staleTime: CHATS_STALE_TIME_MS,
  });
}
