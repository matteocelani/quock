// Resolves the user's persisted default-model preference against the live cloud-models catalogue. The chosen model NAME lives in `useSettingsStore`; this hook turns that name into a `CloudModel` object on each render. With nothing persisted, see `pickDefault`: the cloud's own top recommendation wins, and `DEFAULT_MODEL_PRIORITY` only decides when the recommendations carry nothing cloud-side.

import React from "react";
import {
  normalizeModelName,
  type CloudModel,
} from "@/modules/models/api/models";
import { useCloudModels } from "@/modules/models/hooks/useCloudModels";
import { DEFAULT_MODEL_PRIORITY } from "@/modules/models/constants";
import { useSettingsStore } from "@/lib/stores/settings.store";

export interface UseSelectedModelResult {
  model: CloudModel | null;
  setModel: (model: CloudModel) => void;
}
// A first launch takes the cloud's own top recommendation, which is the one ranking anyone publishes. Only when the
// recommendations carry nothing usable does our own priority list decide, and the last resort is whatever came first.
function pickDefault(models: readonly CloudModel[]): CloudModel | null {
  if (models.length === 0) return null;
  const recommended = models.find((m) => m.isRecommended === true);
  if (recommended) return recommended;
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
      // Matched on the bare name: a default saved before the catalogue became the source is stored as `glm-5.2:cloud`
      // while the catalogue offers `glm-5.2`, and an exact match would quietly reset the user's choice to the priority.
      const storedKey = normalizeModelName(storedName);
      const match = cloudModels.find(
        (m) => normalizeModelName(m.name) === storedKey,
      );
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
