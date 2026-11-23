// Every model a chat can run on: the cloud catalogue plus the MLX builds already downloaded to this phone. The local
// ones still resolve offline, when the cloud list cannot load at all.

import React from "react";
import type { CloudModel } from "@/modules/models/api/models";
import { useCloudModels } from "@/modules/models/hooks/useCloudModels";
import { useListInstalledOnDeviceModels } from "@/modules/models/hooks/useOnDeviceModels";

export interface UseAvailableModelsResult {
  data: CloudModel[] | undefined;
  isLoading: boolean;
  isError: boolean;
}

export function useAvailableModels(): UseAvailableModelsResult {
  const cloud = useCloudModels();
  const installed = useListInstalledOnDeviceModels();
  return React.useMemo<UseAvailableModelsResult>(() => {
    const local: CloudModel[] = (installed.data ?? []).map((m) => ({
      name: m.model,
      isOnDevice: true,
      bytes: m.bytes,
    }));
    if (!cloud.data && local.length === 0) {
      return {
        data: undefined,
        isLoading: cloud.isLoading,
        isError: cloud.isError,
      };
    }
    return {
      data: [...local, ...(cloud.data ?? [])],
      isLoading: false,
      isError: false,
    };
  }, [cloud.data, cloud.isLoading, cloud.isError, installed.data]);
}
