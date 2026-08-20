// The picker's list: `/api/tags` on ollama.com is the cloud's own catalogue — the models it actually serves — and the
// recommendations endpoint supplies the two things the catalogue omits, which model is featured and what it does.

import { useQuery, type UseQueryResult } from "@tanstack/react-query";
import type { CloudModel } from "@/modules/models/api/models";
import { fetchCloudModelList } from "@/modules/models/lib/cloudModelList";
import { useApi } from "@/lib/contexts/ApiContext";
import { CLOUD_MODELS_STALE_TIME_MS } from "@/modules/models/constants";
import { queryKeys } from "@/lib/hooks/queryKeys";

export function useCloudModels(): UseQueryResult<CloudModel[], Error> {
  const { client } = useApi();
  return useQuery<CloudModel[], Error>({
    queryKey: queryKeys.cloudModels(),
    queryFn: () => fetchCloudModelList(client),
    staleTime: CLOUD_MODELS_STALE_TIME_MS,
  });
}
