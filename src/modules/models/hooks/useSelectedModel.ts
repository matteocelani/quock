// Resolves the user's persisted default-model preference against the live cloud-models catalogue. The chosen model NAME lives in `useSettingsStore`; this hook turns that name into a `CloudModel` object on each render. When nothing is persisted, we apply `DEFAULT_MODEL_PRIORITY` so first-time users land on Gemma → GPT-OSS → Qwen → Llama rather than whichever model the API returns first.

import React from "react";
import type { CloudModel } from "@/modules/models/api/models";
import { useCloudModels } from "@/modules/models/hooks/useCloudModels";
import { DEFAULT_MODEL_PRIORITY } from "@/modules/models/constants";
import { useSettingsStore } from "@/lib/stores/settings.store";

export interface UseSelectedModelResult {
  model: CloudModel | null;
  setModel: (model: CloudModel) => void;
}
// Walks the priority list in order and returns the first cloud-model whose name contains the priority key (case-insensitive substring match). Falls back to the first available model when nothing matches so an unknown catalogue still gives us a usable default.
function pickDefault(models: readonly CloudModel[]): CloudModel | null {
  if (models.length === 0) return null;
  for (const key of DEFAULT_MODEL_PRIORITY) {
    const lowered = key.toLowerCase();
    const match = models.find((m) => m.name.toLowerCase().includes(lowered));
    if (match) return match;
  }
  return models[0] ?? null;
}

export function useSelectedModel(): UseSelectedModelResult {
  const { data: cloudModels } = useCloudModels();
  const storedName = useSettingsStore((s) => s.selectedModelName);
  const setSelectedModelName = useSettingsStore(
    (s) => s.setSelectedModelName,
  );
  const setModel = React.useCallback(
    (model: CloudModel): void => {
      setSelectedModelName(model.name);
    },
    [setSelectedModelName],
  );
  const resolved = React.useMemo<CloudModel | null>(() => {
    if (!cloudModels || cloudModels.length === 0) {
      return null;
    }
    if (storedName) {
      const match = cloudModels.find((m) => m.name === storedName);
      if (match) return match;
      // Stored model is no longer offered; fall through to the priority default.
    }
    return pickDefault(cloudModels);
  }, [cloudModels, storedName]);
  return React.useMemo<UseSelectedModelResult>(
    () => ({ model: resolved, setModel }),
    [resolved, setModel],
  );
}
