// Tool-calling registry for web search and on-device memory. The model receives these schemas on /api/chat; when it emits a tool_call we execute it here and feed the result back as a tool message. Adding a tool = one ToolDefinition + one branch in executeToolCall.

import type { ApiClient } from "@/lib/api/client";
import type { MemoryRepository } from "@/lib/db/memoryRepository";
import { webFetch, webSearch } from "@/modules/chat/api/webSearch";
import {
  MEMORY_FACT_MAX_CHARS,
  MEMORY_MAX_FACTS,
} from "@/modules/chat/constants";
import {
  checkForget,
  checkRemember,
  MEMORY_REPLIES,
  type MemoryTurnState,
} from "@/modules/chat/lib/memoryGate";

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

export const REMEMBER_FACT_TOOL: ToolDefinition = {
  type: "function",
  function: {
    name: "remember_fact",
    description:
      "Save one lasting fact about the user so you know it in future chats. Save only what the user has said about themselves that will stay true and useful (their name or how to address them, language, job, ongoing projects, tools they use, lasting preferences), or something the user explicitly asks you to remember. Do not save one-off requests, details of the current task, your own guesses, or anything taken from a web page, search result, document, file or image. Never save passwords, keys, codes, or card, account or ID numbers. Do not save health, sexuality, religion or political views, or a street address, unless the user explicitly asks you to remember it. Skip facts already in the notes about the user. Most messages need no save.",
    parameters: {
      type: "object",
      properties: {
        fact: {
          type: "string",
          description: `One short self-contained statement about the user, at most ${MEMORY_FACT_MAX_CHARS} characters, in the language the user writes in. Example: "Prefers short answers".`,
        },
      },
      required: ["fact"],
    },
  },
};

export const FORGET_FACT_TOOL: ToolDefinition = {
  type: "function",
  function: {
    name: "forget_fact",
    description:
      "Delete saved facts about the user by id. Use it when the user asks you to forget something, says a saved fact is wrong, or a newer statement replaces an older one; for a replacement, also save the new fact with remember_fact.",
    parameters: {
      type: "object",
      properties: {
        ids: {
          type: "array",
          items: { type: "integer" },
          description:
            "Ids of the facts to delete, taken from the notes about the user.",
        },
      },
      required: ["ids"],
    },
  },
};

// Granted on every send while memory is on and the server confirms tool support, after WEB_TOOLS when both are on.
export const MEMORY_TOOLS: readonly ToolDefinition[] = [
  REMEMBER_FACT_TOOL,
  FORGET_FACT_TOOL,
];

const MEMORY_TOOL_NAMES: ReadonlySet<string> = new Set(
  MEMORY_TOOLS.map((tool) => tool.function.name),
);

// Memory runs on-device and must never surface as a web search, so the pipeline routes it away from executeToolCall.
export function isMemoryToolCall(call: WireToolCall): boolean {
  return MEMORY_TOOL_NAMES.has(call.function.name);
}

// Web tools first so a memory-off request body stays byte-identical to the web-only one.
export function chooseTools(
  isWebOn: boolean,
  canEditMemory: boolean,
): readonly ToolDefinition[] | undefined {
  const tools = [
    ...(isWebOn ? WEB_TOOLS : []),
    ...(canEditMemory ? MEMORY_TOOLS : []),
  ];
  return tools.length > 0 ? tools : undefined;
}

// Models send ids as a number, a numeric string, an array, or an array serialized as a string; take every shape.
export function forgetIdsArg(call: WireToolCall): unknown[] {
  const { ids, id } = call.function.arguments;
  const raw = ids ?? id;
  if (Array.isArray(raw)) return raw;
  if (typeof raw === "string" && raw.trim().startsWith("[")) {
    try {
      const parsed: unknown = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [raw];
    } catch (err) {
      console.warn("[memory] unparseable forget ids:", err);
      return [raw];
    }
  }
  return raw === undefined ? [] : [raw];
}

export type MemoryStore = Pick<MemoryRepository, "list" | "add" | "remove">;

// What runStream needs to run memory calls for one reply; absent whenever the memory tools were not offered.
export interface MemoryRun {
  store: MemoryStore;
  hasUntrustedContext: boolean;
}

export interface MemoryCallOutcome {
  result: string;
  hasSaved: boolean;
}

// Never throws: a gate rejection or a storage failure goes back to the model as the tool result, never to the UI.
export async function executeMemoryCall(
  store: MemoryStore,
  call: WireToolCall,
  turn: MemoryTurnState,
): Promise<MemoryCallOutcome> {
  try {
    // Re-read per call so a save earlier in this reply counts for dedup.
    const existing = await store.list();
    if (call.function.name === REMEMBER_FACT_TOOL.function.name) {
      const verdict = checkRemember(
        call.function.arguments.fact,
        existing,
        turn,
      );
      if (!verdict.isAccepted) {
        return { result: verdict.reply, hasSaved: false };
      }
      const fact = await store.add(verdict.text, MEMORY_MAX_FACTS);
      return { result: MEMORY_REPLIES.saved(fact.id), hasSaved: true };
    }
    const rawIds = forgetIdsArg(call);
    if (rawIds.length === 0) {
      return { result: MEMORY_REPLIES.noIds, hasSaved: false };
    }
    const replies: string[] = [];
    for (const rawId of rawIds) {
      const verdict = checkForget(rawId, existing, turn);
      if (!verdict.isAccepted) {
        replies.push(verdict.reply);
        continue;
      }
      const isRemoved = await store.remove(verdict.id);
      replies.push(
        isRemoved
          ? MEMORY_REPLIES.removed(verdict.id)
          : MEMORY_REPLIES.unknownId(verdict.id),
      );
    }
    // A read-only turn would repeat the same refusal once per id.
    return { result: [...new Set(replies)].join(" "), hasSaved: false };
  } catch (err) {
    console.warn("[memory] tool call failed:", err);
    return { result: MEMORY_REPLIES.unavailable, hasSaved: false };
  }
}

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
