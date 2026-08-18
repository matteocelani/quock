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

interface TagsResponse {
  models?: { name?: string }[];
}

// The models ollama.com actually serves. `details` comes back empty, `size` is 0, and there is no description or
// capability field, so the name is the only usable value — capabilities still come from `/api/show`, per model.
export async function listCloudCatalogue(client: ApiClient): Promise<string[]> {
  const data = await client.json<TagsResponse>(API_ROUTES.cloudCatalogue);
  return (data.models ?? [])
    .map((m) => m.name)
    .filter((n): n is string => typeof n === "string" && n.length > 0);
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

// One model, several spellings: the catalogue says `glm-5.2`, the recommendations `glm-5.2:cloud`, and pins saved
// earlier hold `-cloud`. Identity has to ignore the tag, or a stored choice resolves to nothing and resets itself.
export function normalizeModelName(name: string): string {
  return name.replace(/:cloud$/, "").replace(/-cloud$/, "");
}

// The catalogue decides WHAT exists; the recommendations decide what comes first and what carries a description. A
// merge rather than a swap, because with 19 names an arbitrary order is worse than a short list.
export function mergeCloudModels(
  recommended: readonly CloudModel[],
  catalogue: readonly string[],
): CloudModel[] {
  // No catalogue (network hiccup, endpoint gone): fall back to the featured cloud subset, which is what shipped before.
  if (catalogue.length === 0) {
    return recommended.filter((m) => isCloudModelName(m.name));
  }
  const described = new Map<string, string>();
  const featuredOrder: string[] = [];
  for (const rec of recommended) {
    // A local recommendation (no cloud tag, VRAM instead) can never run here, so it must not reach the picker.
    if (!isCloudModelName(rec.name)) continue;
    const key = normalizeModelName(rec.name);
    featuredOrder.push(key);
    if (rec.description !== undefined) described.set(key, rec.description);
  }
  const byKey = new Map<string, string>();
  for (const name of catalogue) byKey.set(normalizeModelName(name), name);
  const ordered = [
    ...featuredOrder.filter((k) => byKey.has(k)),
    ...[...byKey.keys()].filter((k) => !featuredOrder.includes(k)),
  ];
  return ordered.map((key): CloudModel => {
    const name = byKey.get(key) ?? key;
    const description = described.get(key);
    return description === undefined ? { name } : { name, description };
  });
}
