// Downloads an Ollama MLX build to the phone. Progress lives in a volatile store so the picker row can show it, and
// the installed list is refreshed once the files are verified, which is what makes the model selectable.

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { pullOnDeviceModel } from "@/lib/onDevice/onDeviceLLM";
import { queryKeys } from "@/lib/hooks/queryKeys";
import { useOnDeviceDownloadsStore } from "@/modules/models/stores/onDeviceDownloads.store";

export interface UsePullOnDeviceModelResult {
  pull: (model: string) => void;
}

export function usePullOnDeviceModel(): UsePullOnDeviceModelResult {
  const queryClient = useQueryClient();
  const setProgress = useOnDeviceDownloadsStore((s) => s.setProgress);
  const setFailed = useOnDeviceDownloadsStore((s) => s.setFailed);
  const clear = useOnDeviceDownloadsStore((s) => s.clear);
  const mutation = useMutation<void, Error, string>({
    mutationFn: (model: string) =>
      pullOnDeviceModel(model, (progress) =>
        setProgress(model, progress.completed, progress.total),
      ),
    onMutate: (model) => setProgress(model, 0, 0),
    onSuccess: async (_data, model) => {
      await queryClient.invalidateQueries({
        queryKey: queryKeys.onDeviceInstalled(),
      });
      clear(model);
    },
    onError: (err, model) => {
      console.warn("usePullOnDeviceModel: pull failed", err);
      setFailed(model);
    },
  });
  return { pull: mutation.mutate };
}
