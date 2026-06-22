// Tool-calling registry for the agentic web flow. The model receives these schemas on /api/chat; when it emits a tool_call we execute it here and feed the result back as a tool message. Adding a tool = one ToolDefinition + one branch in executeToolCall.

import type { ApiClient } from "@/lib/api/client";
import { webFetch, webSearch } from "@/modules/chat/api/webSearch";

// JSON-schema tool definition sent in ChatRequest.tools (mirrors Ollama's Tool shape).
export interface ToolDefinition {
  type: "function";
  function: {
    name: string;
    description: string;
    parameters: Record<string, unknown>;
  };
}

// A tool call streamed back on /api/chat. Standard Ollama returns arguments as an object (the desktop's proprietary endpoint returns a JSON string instead).
export interface WireToolCall {
  function: {
    name: string;
    arguments: Record<string, unknown>;
  };
}

export const WEB_SEARCH_TOOL: ToolDefinition = {
  type: "function",
  function: {
    name: "web_search",
    description:
      "Search the web for current, real-world information when the answer may be recent, factual, or beyond the model's training data.",
    parameters: {
      type: "object",
      properties: {
        query: { type: "string", description: "The search query." },
      },
      required: ["query"],
    },
  },
};

export const WEB_FETCH_TOOL: ToolDefinition = {
  type: "function",
  function: {
    name: "web_fetch",
    description: "Fetch the readable contents of a single web page by its URL.",
    parameters: {
      type: "object",
      properties: {
        url: { type: "string", description: "The absolute URL to fetch." },
      },
      required: ["url"],
    },
  },
};

// The tool set granted when the user enables web search for a message.
export const WEB_TOOLS: readonly ToolDefinition[] = [
  WEB_SEARCH_TOOL,
  WEB_FETCH_TOOL,
];

// Reads a string argument off a tool call, tolerating a missing/mistyped value.
function stringArg(call: WireToolCall, key: string): string {
  const value = call.function.arguments[key];
  return typeof value === "string" ? value : "";
}

// Executes a model-requested tool against the public API and returns its result serialized for the tool message.
export async function executeToolCall(
  client: ApiClient,
  call: WireToolCall,
): Promise<string> {
  switch (call.function.name) {
    case "web_search": {
      const results = await webSearch(client, stringArg(call, "query"));
      return JSON.stringify(results);
    }
    case "web_fetch": {
      const result = await webFetch(client, stringArg(call, "url"));
      return JSON.stringify(result);
    }
    default:
      return `Tool ${call.function.name} is not available.`;
  }
}
