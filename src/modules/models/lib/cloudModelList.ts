// Composes the picker's list out of the two endpoints that describe it. Lives here rather than in `api/`, where every
// other function is a single-call wire adapter, because this one orchestrates two.

import type { ApiClient } from "@/lib/api/client";
import {
  listCloudCatalogue,
  listCloudModels,
  mergeCloudModels,
  type CloudModel,
} from "@/modules/models/api/models";

export async function fetchCloudModelList(
  client: ApiClient,
): Promise<CloudModel[]> {
  // Both in flight at once: they are independent, and awaiting one before starting the other put a whole round-trip
  // between launch and the composer having a model to send with. On an expired key both now 401 instead of one.
  const [recommended, catalogue] = await Promise.all([
    listCloudModels(client),
    // A catalogue failure degrades to the featured few rather than to an empty picker, and `mergeCloudModels` treats
    // an empty catalogue as exactly that case. A recommendations failure still fails the whole read.
    listCloudCatalogue(client).catch((err: unknown): string[] => {
      console.warn("useCloudModels: cloud catalogue unavailable", err);
      return [];
    }),
  ]);
  return mergeCloudModels(recommended, catalogue);
}
