// Ollama public web tools (web_search / web_fetch). Signed with the device key like every other /api/* call — the same scheme the Ollama CLI uses for these endpoints, so no separate API key is needed. Docs: capabilities/web-search.

import type { ApiClient } from "@/lib/api/client";
import { WEB_SEARCH_MAX_RESULTS } from "@/modules/chat/constants";

export interface WebSearchResult {
  title: string;
  url: string;
  content: string;
}

export interface WebFetchResult {
  title: string;
  content: string;
  links: string[];
}

interface WebSearchResponse {
  results?: WebSearchResult[];
}

// Runs one web search and returns the result list (empty when the server omits it).
export async function webSearch(
  client: ApiClient,
  query: string,
  maxResults: number = WEB_SEARCH_MAX_RESULTS,
): Promise<WebSearchResult[]> {
  const body = await client.json<WebSearchResponse>("/api/web_search", {
    method: "POST",
    body: JSON.stringify({ query, max_results: maxResults }),
  });
  return body.results ?? [];
}

// Fetches a single page's readable content by URL.
export async function webFetch(
  client: ApiClient,
  url: string,
): Promise<WebFetchResult> {
  return client.json<WebFetchResult>("/api/web_fetch", {
    method: "POST",
    body: JSON.stringify({ url }),
  });
}
