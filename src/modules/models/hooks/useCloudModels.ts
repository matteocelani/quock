// The picker's list: `/api/tags` on ollama.com is the cloud's own catalogue — the models it actually serves — and the
// recommendations endpoint supplies the two things the catalogue omits, which model is featured and what it does.

import { useQuery, type UseQueryResult } from "@tanstack/react-query";
import {
  listCloudCatalogue,
  listCloudModels,
  mergeCloudModels,
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
      const recommended = await listCloudModels(client);
      // The catalogue is the better source but not a reason to lose the list: a failure here degrades to the featured
      // few rather than to an empty picker, and `mergeCloudModels` treats an empty catalogue as exactly that case.
      let catalogue: string[] = [];
      try {
        catalogue = await listCloudCatalogue(client);
      } catch (err) {
        console.warn("useCloudModels: cloud catalogue unavailable", err);
      }
      return mergeCloudModels(recommended, catalogue);
    },
    staleTime: CLOUD_MODELS_STALE_TIME_MS,
  });
}
