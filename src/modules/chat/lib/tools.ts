// Tool-calling registry for the agentic web + on-device agent flows: the model gets these schemas on /api/chat and
// we execute each tool_call here, feeding results back as tool messages. Adding a tool = one ToolDefinition + one branch.

import * as Application from "expo-application";
import * as Clipboard from "expo-clipboard";
import Constants from "expo-constants";
import { Directory, File, Paths } from "expo-file-system";
import * as Haptics from "expo-haptics";
import * as WebBrowser from "expo-web-browser";
import { Platform, Share } from "react-native";
import type { ApiClient } from "@/lib/api/client";
import type { MemoryRepository } from "@/lib/db/memoryRepository";
import { filterMemoriesByQuery } from "@/lib/db/memoryRepository";
import { asMemoryId } from "@/lib/types/ids";
import { webFetch, webSearch } from "@/modules/chat/api/webSearch";
import { AGENT_MEMORY_INJECT_MAX } from "@/modules/chat/constants";

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

// Everything a tool needs at execution time: Ollama-hosted tools use the signed client; local tools use the
// repositories and device APIs. `memories` is null when the database is not ready (defensive; tools then degrade).
export interface ToolContext {
  client: ApiClient;
  memories: MemoryRepository | null;
}

const WEB_SEARCH_TOOL: ToolDefinition = {
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

const WEB_FETCH_TOOL: ToolDefinition = {
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

const MEMORY_SAVE_TOOL: ToolDefinition = {
  type: "function",
  function: {
    name: "memory_save",
    description:
      "Save one durable fact, preference, or request to memory for future turns. Use whenever the user states something they want remembered across sessions (name, preferences, devices, goals), not for one-off chat content.",
    parameters: {
      type: "object",
      properties: {
        content: {
          type: "string",
          description: "A single self-contained fact to remember.",
        },
      },
      required: ["content"],
    },
  },
};

const MEMORY_READ_TOOL: ToolDefinition = {
  type: "function",
  function: {
    name: "memory_read",
    description:
      "Read recently saved memories for this account, optionally filtered by a query. Use before answering questions about the user's preferences, devices, or anything they may have asked to remember.",
    parameters: {
      type: "object",
      properties: {
        query: {
          type: "string",
          description:
            "Optional: only return memories matching any word in this query.",
        },
        limit: {
          type: "number",
          description: "Optional: maximum number of memories to return.",
        },
      },
      required: [],
    },
  },
};

const MEMORY_FORGET_TOOL: ToolDefinition = {
  type: "function",
  function: {
    name: "memory_forget",
    description:
      "Delete one memory by its id (as returned by memory_read). Use when the user asks to forget something, or when a remembered fact is no longer true.",
    parameters: {
      type: "object",
      properties: {
        id: {
          type: "number",
          description: "The id of the memory to delete.",
        },
      },
      required: ["id"],
    },
  },
};

export const MEMORY_TOOLS: readonly ToolDefinition[] = [
  MEMORY_SAVE_TOOL,
  MEMORY_READ_TOOL,
  MEMORY_FORGET_TOOL,
];

// Timezone + weekday ride along so the model can reason about "tomorrow" / day-specific wording without a follow-up.
const GET_CURRENT_TIME_TOOL: ToolDefinition = {
  type: "function",
  function: {
    name: "get_current_time",
    description:
      'Get the device\'s current date and time. Use when the question depends on "now", today\'s date, or relative times ("in two hours").',
    parameters: { type: "object", properties: {}, required: [] },
  },
};

const COPY_TO_CLIPBOARD_TOOL: ToolDefinition = {
  type: "function",
  function: {
    name: "copy_to_clipboard",
    description:
      "Copy text to the device clipboard. Use when the user asks to copy something so they can paste it elsewhere.",
    parameters: {
      type: "object",
      properties: {
        text: { type: "string", description: "The text to copy." },
      },
      required: ["text"],
    },
  },
};

const VIBRATE_TOOL: ToolDefinition = {
  type: "function",
  function: {
    name: "vibrate",
    description:
      "Trigger a short haptic feedback on the device. Use only when the user explicitly asks for a vibration or a physical confirmation.",
    parameters: {
      type: "object",
      properties: {
        pattern: {
          type: "string",
          enum: ["light", "medium", "heavy"],
          description: "Strength of the vibration. Defaults to light.",
        },
      },
      required: [],
    },
  },
};

const GET_DEVICE_INFO_TOOL: ToolDefinition = {
  type: "function",
  function: {
    name: "get_device_info",
    description:
      "Get information about the device (platform, OS version, device name, app version). Use when the user asks about their device or when troubleshooting.",
    parameters: { type: "object", properties: {}, required: [] },
  },
};

const OPEN_URL_TOOL: ToolDefinition = {
  type: "function",
  function: {
    name: "open_url",
    description:
      "Open a URL in the in-app browser. Use when the user explicitly asks to open a link, or when an answer's natural next step is a specific web page. http/https only.",
    parameters: {
      type: "object",
      properties: {
        url: { type: "string", description: "The http(s) URL to open." },
      },
      required: ["url"],
    },
  },
};

const SHARE_TEXT_TOOL: ToolDefinition = {
  type: "function",
  function: {
    name: "share_text",
    description:
      "Open the system share sheet with a text payload. Use when the user asks to share or export text to another app.",
    parameters: {
      type: "object",
      properties: {
        text: { type: "string", description: "The text to share." },
        title: { type: "string", description: "Optional dialog title." },
      },
      required: ["text"],
    },
  },
};

const SAVE_FILE_TOOL: ToolDefinition = {
  type: "function",
  function: {
    name: "save_file",
    description:
      "Save a long piece of text as a named file in the app's private storage. Use for content that is too long or structured to live in a chat reply — summaries, notes, lists the user may want back later. Files are never re-injected automatically; read_saved_file pulls them on demand.",
    parameters: {
      type: "object",
      properties: {
        name: {
          type: "string",
          description: "Short file name (path separators stripped).",
        },
        text: { type: "string", description: "The full text to write." },
      },
      required: ["name", "text"],
    },
  },
};

const READ_SAVED_FILE_TOOL: ToolDefinition = {
  type: "function",
  function: {
    name: "read_saved_file",
    description:
      "Read back a file previously written with save_file. Use when the user references a saved file, or when earlier you told them you saved something and now need the contents.",
    parameters: {
      type: "object",
      properties: {
        name: {
          type: "string",
          description: "The file name used at save time.",
        },
      },
      required: ["name"],
    },
  },
};

const LIST_SAVED_FILES_TOOL: ToolDefinition = {
  type: "function",
  function: {
    name: "list_saved_files",
    description:
      "List every file currently saved in the app's private storage with its size. Use when the user asks what was saved, or when you need to find a file name before read_saved_file.",
    parameters: { type: "object", properties: {}, required: [] },
  },
};

export const UTILITY_TOOLS: readonly ToolDefinition[] = [
  GET_CURRENT_TIME_TOOL,
  COPY_TO_CLIPBOARD_TOOL,
  VIBRATE_TOOL,
  GET_DEVICE_INFO_TOOL,
  OPEN_URL_TOOL,
  SHARE_TEXT_TOOL,
  SAVE_FILE_TOOL,
  READ_SAVED_FILE_TOOL,
  LIST_SAVED_FILES_TOOL,
];

// Full set granted in agent mode (memory + utilities) layered over the web tools so web_search/web_fetch keep working.
export const AGENT_TOOLS: readonly ToolDefinition[] = [
  ...WEB_TOOLS,
  ...MEMORY_TOOLS,
  ...UTILITY_TOOLS,
];

// Reads a string argument off a tool call, tolerating a missing/mistyped value.
function stringArg(call: WireToolCall, key: string): string {
  const value = call.function.arguments[key];
  return typeof value === "string" ? value : "";
}

// Numeric argument, same tolerance: anything but a finite number falls back to the default.
function numberArg(call: WireToolCall, key: string, fallback: number): number {
  const value = call.function.arguments[key];
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

// Default and hard ceiling for memory_read: the model's limit arg is clamped to this so one call can never
// materialize the whole table into the context — the same budget the injector enforces.
export const MEMORY_READ_MAX = AGENT_MEMORY_INJECT_MAX;
// Subdirectory inside Paths.document so model saves never collide with other app files; created lazily on first use.
const SAVED_FILES_DIR_NAME = "agent-files";
const SAVED_FILE_NAME_MAX_CHARS = 80;
const SAVED_FILE_COLLISION_MAX = 1000;

function savedFilesDir(): Directory {
  const dir = new Directory(Paths.document, SAVED_FILES_DIR_NAME);
  if (!dir.exists) {
    dir.create({ intermediates: true, idempotent: true });
  }
  return dir;
}

// Strips path separators, ".." segments and trims length — the name is user/model-controlled, the FS must not be.
export function sanitizeFilename(name: string): string {
  const stripped = name.replace(/[\\/]/g, "").replace(/\.\.+/g, ".");
  const trimmed = stripped.trim();
  return trimmed.slice(0, SAVED_FILE_NAME_MAX_CHARS) || "file.txt";
}

// Collision rule: notes.txt -> notes-2.txt (suffix before the extension) so repeat saves never clobber prior ones.
function resolveCollision(dir: Directory, name: string): string {
  if (!new File(dir, name).exists) return name;
  const dot = name.lastIndexOf(".");
  const base = dot === -1 ? name : name.slice(0, dot);
  const ext = dot === -1 ? "" : name.slice(dot);
  for (let i = 2; i < SAVED_FILE_COLLISION_MAX; i += 1) {
    const candidate = `${base}-${i}${ext}`;
    if (!new File(dir, candidate).exists) return candidate;
  }
  return `${base}-${Date.now()}${ext}`;
}

async function handleMemorySave(
  ctx: ToolContext,
  call: WireToolCall,
): Promise<string> {
  if (!ctx.memories) {
    return JSON.stringify({ saved: false, error: "storage" });
  }
  const content = stringArg(call, "content").trim();
  if (content.length === 0) {
    return JSON.stringify({ saved: false, error: "empty" });
  }
  try {
    const saved = await ctx.memories.save(content, "model");
    return JSON.stringify({ saved: true, id: saved.id });
  } catch (err) {
    // Never throw out of a memory tool: a failing save must not crash the turn — the model can apologize and move on.
    console.warn("memory_save failed:", err);
    return JSON.stringify({ saved: false, error: "storage" });
  }
}

async function handleMemoryRead(
  ctx: ToolContext,
  call: WireToolCall,
): Promise<string> {
  if (!ctx.memories) return "No memories stored yet.";
  try {
    // Clamp the model-provided limit so one call can never materialize the whole table into the context.
    const limit = Math.min(
      numberArg(call, "limit", MEMORY_READ_MAX),
      MEMORY_READ_MAX,
    );
    const all = await ctx.memories.listRecent(limit);
    const query = stringArg(call, "query");
    const matched = query.length > 0 ? filterMemoriesByQuery(all, query) : all;
    if (matched.length === 0) {
      return "No memories stored yet.";
    }
    // Keep hot facts hot: touch is fire-and-forget so a failing write never blocks the read result.
    for (const m of matched) {
      ctx.memories.touch(m.id).catch((err: unknown) => {
        console.warn("memory touch failed:", err);
      });
    }
    return JSON.stringify(
      matched.map((m) => ({
        id: m.id,
        content: m.content,
        createdAt: m.createdAt,
      })),
    );
  } catch (err) {
    console.warn("memory_read failed:", err);
    return "No memories stored yet.";
  }
}

async function handleMemoryForget(
  ctx: ToolContext,
  call: WireToolCall,
): Promise<string> {
  if (!ctx.memories) return "Memory not found.";
  const id = numberArg(call, "id", -1);
  if (id < 0) return `Memory ${id} not found.`;
  try {
    // The repo enforces user scoping: a foreign id returns 0 instead of deleting another account's row.
    const deleted = await ctx.memories.forget(asMemoryId(id));
    return deleted > 0 ? "Deleted." : `Memory ${id} not found.`;
  } catch (err) {
    console.warn("memory_forget failed:", err);
    return `Memory ${id} not found.`;
  }
}

function handleGetCurrentTime(): string {
  const now = new Date();
  const formatter = new Intl.DateTimeFormat(undefined, {
    dateStyle: "full",
    timeStyle: "long",
  });
  return JSON.stringify({
    iso: now.toISOString(),
    local: formatter.format(now),
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    weekday: new Intl.DateTimeFormat(undefined, { weekday: "long" }).format(
      now,
    ),
  });
}

async function handleCopyToClipboard(call: WireToolCall): Promise<string> {
  const text = stringArg(call, "text");
  try {
    await Clipboard.setStringAsync(text);
    return JSON.stringify({ copied: true });
  } catch (err) {
    // Android can reject clipboard access from the background or without focus — the model should retry later, not crash.
    console.warn("copy_to_clipboard failed:", err);
    return JSON.stringify({ copied: false, reason: "foreground required" });
  }
}

async function handleVibrate(call: WireToolCall): Promise<string> {
  const pattern = stringArg(call, "pattern") || "light";
  const style =
    pattern === "heavy"
      ? Haptics.ImpactFeedbackStyle.Heavy
      : pattern === "medium"
        ? Haptics.ImpactFeedbackStyle.Medium
        : Haptics.ImpactFeedbackStyle.Light;
  try {
    await Haptics.impactAsync(style);
    return JSON.stringify({ vibrated: true });
  } catch (err) {
    console.warn("vibrate failed:", err);
    return JSON.stringify({ vibrated: false });
  }
}

function handleGetDeviceInfo(): string {
  return JSON.stringify({
    platform: Platform.OS,
    osVersion: Platform.Version,
    deviceName: Constants.deviceName ?? null,
    appVersion: Application.nativeApplicationVersion ?? null,
    buildVersion: Application.nativeBuildVersion ?? null,
  });
}

async function handleOpenUrl(call: WireToolCall): Promise<string> {
  const url = stringArg(call, "url");
  // Strict http/https allowlist blocks intent://, file://, javascript: — the in-app browser runs on the user's own
  // device, nothing headless. A domain allowlist was rejected: fragile, and the user sees and dismisses every open.
  if (!/^https?:\/\//i.test(url)) {
    return JSON.stringify({ opened: false, reason: "scheme blocked" });
  }
  try {
    await WebBrowser.openBrowserAsync(url);
    return JSON.stringify({ opened: true });
  } catch (err) {
    // User dismissal of the in-app browser must not surface as a tool failure to the model.
    console.warn("open_url failed:", err);
    return JSON.stringify({ opened: false, reason: "dismissed" });
  }
}

async function handleShareText(call: WireToolCall): Promise<string> {
  const text = stringArg(call, "text");
  const title = stringArg(call, "title");
  try {
    const result = await Share.share(
      title.length > 0 ? { message: text, title } : { message: text },
    );
    if (result.action === Share.dismissedAction) {
      return JSON.stringify({ shared: false, dismissed: true });
    }
    return JSON.stringify({ shared: true });
  } catch (err) {
    console.warn("share_text failed:", err);
    return JSON.stringify({ shared: false });
  }
}

function handleSaveFile(call: WireToolCall): string {
  const name = sanitizeFilename(stringArg(call, "name"));
  const text = stringArg(call, "text");
  try {
    const dir = savedFilesDir();
    const finalName = resolveCollision(dir, name);
    const file = new File(dir, finalName);
    file.write(text);
    return JSON.stringify({
      saved: true,
      filename: finalName,
      chars: text.length,
    });
  } catch (err) {
    console.warn("save_file failed:", err);
    return JSON.stringify({ saved: false });
  }
}

function handleReadSavedFile(call: WireToolCall): string {
  const name = sanitizeFilename(stringArg(call, "name"));
  try {
    const file = new File(savedFilesDir(), name);
    if (!file.exists) return "File not found.";
    return file.textSync();
  } catch (err) {
    console.warn("read_saved_file failed:", err);
    return "File not found.";
  }
}

function handleListSavedFiles(): string {
  try {
    const dir = savedFilesDir();
    const files = dir
      .list()
      .filter((entry): entry is File => entry instanceof File)
      .map((f) => ({ name: f.name, chars: f.size ?? 0 }));
    return JSON.stringify({ files });
  } catch (err) {
    console.warn("list_saved_files failed:", err);
    return JSON.stringify({ files: [] });
  }
}

// Executes a model-requested tool and returns its result serialized for the tool message.
export async function executeToolCall(
  ctx: ToolContext,
  call: WireToolCall,
): Promise<string> {
  switch (call.function.name) {
    case "web_search": {
      const results = await webSearch(ctx.client, stringArg(call, "query"));
      return JSON.stringify(results);
    }
    case "web_fetch": {
      const result = await webFetch(ctx.client, stringArg(call, "url"));
      return JSON.stringify(result);
    }
    case "memory_save":
      return handleMemorySave(ctx, call);
    case "memory_read":
      return handleMemoryRead(ctx, call);
    case "memory_forget":
      return handleMemoryForget(ctx, call);
    case "get_current_time":
      return handleGetCurrentTime();
    case "copy_to_clipboard":
      return handleCopyToClipboard(call);
    case "vibrate":
      return handleVibrate(call);
    case "get_device_info":
      return handleGetDeviceInfo();
    case "open_url":
      return handleOpenUrl(call);
    case "share_text":
      return handleShareText(call);
    case "save_file":
      return handleSaveFile(call);
    case "read_saved_file":
      return handleReadSavedFile(call);
    case "list_saved_files":
      return handleListSavedFiles();
    default:
      return `Tool ${call.function.name} is not available.`;
  }
}
