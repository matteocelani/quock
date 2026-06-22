// Two-tier capability detection: hit `/api/show` first via TanStack Query and trust the server's `capabilities[]` when it answers, fall back to the name-based heuristic in `inferCapabilities` when the endpoint 404s, errors, or hasn't landed yet. The name fallback keeps the chip working in offline / stale-build / pre-auth states.

import { useQuery } from "@tanstack/react-query";
import React from "react";
import { useApi } from "@/lib/contexts/ApiContext";
import { useAuth } from "@/modules/auth/hooks/useAuth";
import { fetchModelCapabilities } from "@/modules/models/api/models";
import { inferCapabilities } from "@/modules/models/lib/inferCapabilities";
import { queryKeys } from "@/lib/hooks/queryKeys";
import {
  MODEL_CAPABILITIES_RETRY,
  MODEL_CAPABILITIES_STALE_TIME_MS,
  THINKING_CAPABILITY,
  TOOLS_CAPABILITY,
  VISION_CAPABILITY,
} from "@/modules/models/constants";
// Tries `/api/show`; returns null when the cloud doesn't expose the endpoint so the consumer can fall through to the heuristic without treating it as an error.
function useApiCapabilities(modelName: string | undefined): string[] | null {
  const { client } = useApi();
  const { user } = useAuth();
  const isAuthenticated = user !== null;
  const query = useQuery<string[], Error>({
    queryKey: queryKeys.modelCapabilities(modelName ?? null),
    queryFn: () => {
      if (!modelName) return Promise.resolve<string[]>([]);
      return fetchModelCapabilities(client, modelName);
    },
    // Only run when both the model is set and the user is signed in (the endpoint requires auth).
    enabled: Boolean(modelName) && isAuthenticated,
    staleTime: MODEL_CAPABILITIES_STALE_TIME_MS,
    retry: MODEL_CAPABILITIES_RETRY,
  });
  if (query.isError) return null;
  if (!query.data) return null;
  return query.data;
}
// Returns the unified capability list for a model: server's array when `/api/show` answers, name-heuristic otherwise. Stable identity per modelName so callers can pass it to `useMemo`/Effect deps.
export function useModelCapabilities(
  modelName: string | undefined,
): readonly string[] {
  const apiCapabilities = useApiCapabilities(modelName);
  return React.useMemo<readonly string[]>(() => {
    if (!modelName) return [];
    if (apiCapabilities !== null) return apiCapabilities;
    return inferCapabilities(modelName);
  }, [apiCapabilities, modelName]);
}

export function useHasVisionCapability(
  modelName: string | undefined,
): boolean {
  const capabilities = useModelCapabilities(modelName);
  return capabilities.includes(VISION_CAPABILITY);
}

// Surfaced in Composer to decide whether to show the brain toggle, and in `useSendMessage` to gate whether `think: true` rides on the wire body.
export function useHasThinkingCapability(
  modelName: string | undefined,
): boolean {
  const capabilities = useModelCapabilities(modelName);
  if (capabilities.includes(THINKING_CAPABILITY)) return true;
  // /api/show sometimes omits thinking for a model that actually reasons (e.g. minimax-m3), and the server then defaults think ON with no toggle to turn it off. Trust the curated name heuristic too for this gate, so the toggle shows and the opt-out is wired.
  return (
    modelName !== undefined &&
    inferCapabilities(modelName).includes(THINKING_CAPABILITY)
  );
}

// Surfaced in Composer to decide whether to show the web-search toggle: web search runs as tool-calling, so it needs the model's tools capability.
export function useHasToolsCapability(
  modelName: string | undefined,
): boolean {
  const capabilities = useModelCapabilities(modelName);
  return capabilities.includes(TOOLS_CAPABILITY);
}
