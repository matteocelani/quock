// The two lists behind the picker's on-device section: what is already on this phone, read from disk, and what Ollama
// offers in its MLX category that this phone can hold, read from ollama.com through the native catalogue.

import { useQuery, type UseQueryResult } from "@tanstack/react-query";
import {
  fetchOnDeviceCatalog,
  isOnDeviceSupported,
  listInstalledOnDeviceModels,
  type OnDeviceModelInfo,
} from "@/lib/onDevice/onDeviceLLM";
import { queryKeys } from "@/lib/hooks/queryKeys";
import { ON_DEVICE_CATALOG_STALE_TIME_MS } from "@/modules/models/constants";

export function useListInstalledOnDeviceModels(): UseQueryResult<
  OnDeviceModelInfo[],
  Error
> {
  return useQuery<OnDeviceModelInfo[], Error>({
    queryKey: queryKeys.onDeviceInstalled(),
    queryFn: (): Promise<OnDeviceModelInfo[]> =>
      Promise.resolve(listInstalledOnDeviceModels()),
    enabled: isOnDeviceSupported(),
    // Only a pull or a removal changes it, and both invalidate this key.
    staleTime: Infinity,
  });
}

// Fetched only while the picker is open: it walks ollama.com's MLX category, one request per model and tag.
export function useListOnDeviceCatalog(
  isEnabled: boolean,
): UseQueryResult<OnDeviceModelInfo[], Error> {
  return useQuery<OnDeviceModelInfo[], Error>({
    queryKey: queryKeys.onDeviceCatalog(),
    queryFn: fetchOnDeviceCatalog,
    enabled: isEnabled && isOnDeviceSupported(),
    staleTime: ON_DEVICE_CATALOG_STALE_TIME_MS,
  });
}
