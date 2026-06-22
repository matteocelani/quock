import type { ApiClient } from "@/lib/api/client";
import { API_ROUTES } from "@/lib/api/config";

export interface CloudModel {
  name: string;
  description?: string;
  capabilities?: string[];
}
// Mirrors `getModelRecommendations` in `app/ui/app/src/api.ts:421`. Returns featured cloud models with description and inference-time metadata.
interface ModelRecommendationsResponse {
  recommendations?: {
    model?: string;
    description?: string;
    context_length?: number;
    max_output_tokens?: number;
    vram_bytes?: number;
  }[];
}

interface ShowResponse {
  capabilities?: string[];
}

export async function listCloudModels(
  client: ApiClient,
): Promise<CloudModel[]> {
  const data = await client.json<ModelRecommendationsResponse>(
    API_ROUTES.cloudModels,
  );
  const raw = data.recommendations ?? [];
  return raw
    .map((m): CloudModel | null => {
      if (!m.model) return null;
      const result: CloudModel = { name: m.model };
      if (m.description !== undefined) result.description = m.description;
      return result;
    })
    .filter((m): m is CloudModel => m !== null);
}

export async function fetchModelCapabilities(
  client: ApiClient,
  name: string,
): Promise<string[]> {
  const data = await client.json<ShowResponse>(API_ROUTES.modelCapabilities, {
    method: "POST",
    body: JSON.stringify({ model: name }),
  });
  return Array.isArray(data.capabilities) ? data.capabilities : [];
}
// Free function so utilities/selectors without an ApiClient can still classify a model name.
export function isCloudModelName(name: string): boolean {
  // Matches the web app's `endsWith("cloud")` (covers both `-cloud` and bare `cloud`).
  return name.endsWith("cloud");
}
