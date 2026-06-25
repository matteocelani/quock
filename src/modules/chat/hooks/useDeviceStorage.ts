// Device-wide chat storage (ALL accounts on this device): the total bytes shown on the "clear all data" confirm,
// plus the nuke that frees it. Distinct from useClearAllChats, which is scoped to the signed-in account.

import {
  useMutation,
  useQuery,
  useQueryClient,
  type UseQueryResult,
} from "@tanstack/react-query";
import React from "react";
import { useDb } from "@/lib/contexts/DbContext";
import { queryKeys } from "@/lib/hooks/queryKeys";

export function useGetDeviceStorageBytes(): UseQueryResult<number, Error> {
  const { chats } = useDb();
  return useQuery<number, Error>({
    queryKey: queryKeys.deviceStorage(),
    queryFn: () => chats.getDeviceTotalSize(),
  });
}

export interface UseDeleteDeviceDataResult {
  clearDeviceData: () => Promise<void>;
  isPending: boolean;
}

export function useDeleteDeviceData(): UseDeleteDeviceDataResult {
  const queryClient = useQueryClient();
  const { chats } = useDb();
  const mutation = useMutation({
    mutationFn: (): Promise<void> => chats.clearAllDevice(),
    onSuccess: () => {
      // Every account's chats are gone, so drop every chat cache + the storage figure.
      queryClient.removeQueries({ queryKey: queryKeys.chats() });
      queryClient.removeQueries({ queryKey: queryKeys.chatRoot() });
      queryClient.removeQueries({ queryKey: queryKeys.deviceStorage() });
    },
  });
  const clearDeviceData = React.useCallback(
    (): Promise<void> => mutation.mutateAsync(),
    [mutation],
  );
  return React.useMemo<UseDeleteDeviceDataResult>(
    () => ({ clearDeviceData, isPending: mutation.isPending }),
    [clearDeviceData, mutation.isPending],
  );
}
