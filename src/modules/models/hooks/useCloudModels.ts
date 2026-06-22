// Catalogue mirrors `/api/experimental/model-recommendations` so a server-side addition lights up without an App Store build. Non-featured cloud models are intentionally hidden until Ollama ships a complete public catalogue endpoint.

import { useQuery, type UseQueryResult } from "@tanstack/react-query";
import {
  isCloudModelName,
  listCloudModels,
  type CloudModel,
} from "@/modules/models/api/models";
import { useApi } from "@/lib/contexts/ApiContext";
import { CLOUD_MODELS_STALE_TIME_MS } from "@/modules/models/constants";
import { queryKeys } from "@/lib/hooks/queryKeys";

export function useCloudModels(): UseQueryResult<CloudModel[], Error> {
  const { client } = useApi();
  return useQuery<CloudModel[], Error>({
    queryKey: queryKeys.cloudModels(),
    queryFn: async () => {
      const real = await listCloudModels(client);
      // The recommendations endpoint mixes cloud variants (`*:cloud` / `*-cloud`) with local-only entries that carry `vram_bytes` instead of a `:cloud` tag. Mobile Quock can't run anything locally — the wire path is /api/chat against ollama.com — so we drop non-cloud entries before they reach the picker. Otherwise the default-model picker could land on a local stub and /api/chat would 404.
      const cloudOnly = real.filter((m) => isCloudModelName(m.name));
      return cloudOnly;
    },
    staleTime: CLOUD_MODELS_STALE_TIME_MS,
  });
}
