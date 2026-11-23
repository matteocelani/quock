// Removes a downloaded model from the phone. Both lists are refreshed: the model leaves the installed list and, if it
// still fits, returns to the ones offered for download.

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { removeOnDeviceModel } from "@/lib/onDevice/onDeviceLLM";
import { queryKeys } from "@/lib/hooks/queryKeys";

export interface UseDeleteOnDeviceModelResult {
  remove: (model: string) => void;
}

export function useDeleteOnDeviceModel(): UseDeleteOnDeviceModelResult {
  const queryClient = useQueryClient();
  const mutation = useMutation<void, Error, string>({
    mutationFn: removeOnDeviceModel,
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: queryKeys.onDeviceInstalled(),
        }),
        queryClient.invalidateQueries({
          queryKey: queryKeys.onDeviceCatalog(),
        }),
      ]);
    },
    onError: (err) => {
      console.warn("useDeleteOnDeviceModel: remove failed", err);
    },
  });
  return { remove: mutation.mutate };
}
