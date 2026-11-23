// The two lists behind the picker's on-device section: what is already on this phone, read from disk, and the curated
// Ollama MLX builds this phone can hold, verified against the registry through the native catalogue.

import { useQuery, type UseQueryResult } from "@tanstack/react-query";
import {
  fetchOnDeviceCatalog,
  isOnDeviceSupported,
  listInstalledOnDeviceModels,
  type OnDeviceModelInfo,
} from "@/lib/onDevice/onDeviceLLM";
import { queryKeys } from "@/lib/hooks/queryKeys";
import {
  ON_DEVICE_CATALOG,
  ON_DEVICE_CATALOG_STALE_TIME_MS,
} from "@/modules/models/constants";

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

// Fetched only while the picker is open: a few registry requests per curated model.
export function useListOnDeviceCatalog(
  isEnabled: boolean,
): UseQueryResult<OnDeviceModelInfo[], Error> {
  return useQuery<OnDeviceModelInfo[], Error>({
    queryKey: queryKeys.onDeviceCatalog(),
    queryFn: () => fetchOnDeviceCatalog(ON_DEVICE_CATALOG),
    enabled: isEnabled && isOnDeviceSupported(),
    staleTime: ON_DEVICE_CATALOG_STALE_TIME_MS,
  });
}
