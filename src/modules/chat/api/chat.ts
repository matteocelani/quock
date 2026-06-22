import { ChatEvent, DownloadEvent, ErrorEvent } from "@/gotypes";
import type { ApiClient } from "@/lib/api/client";
import { CloudAPIError } from "@/lib/api/errors";
import { bytesToBase64 } from "@/lib/encoding/base64";
import { parseJsonlFromResponse } from "@/modules/chat/api/jsonl";
import type { ToolDefinition, WireToolCall } from "@/modules/chat/lib/tools";

// Mirrors the constant in `@/lib/api/client`; declared locally to avoid a circular import.
const HTTP_STATUS_FORBIDDEN = 403;

// Emitted when a chunk carries tool calls (the model wants to run a tool). The pipeline executes them and re-streams. Not a `@/gotypes` class since tool calling is client-orchestrated here, not part of the cloud event contract.
export interface ToolCallEvent {
  eventName: "tool_calls";
  toolCalls: WireToolCall[];
}
// Discriminated by `eventName`.
export type ChatEventUnion =
  | ChatEvent
  | DownloadEvent
  | ErrorEvent
  | ToolCallEvent;
// Wire-bound narrowing of `UiAttachment` (src/components/chat/types.ts): the API serializes bytes and does not carry the local `uri` preview field.
export interface ChatAttachment {
  filename: string;
  data: Uint8Array;
  mimeType?: string;
}
// One turn in the conversation history sent to `/api/chat`. Mirrors the standard Ollama API request shape. `tool_calls` rides on an assistant turn that invoked tools; the `tool` role carries a tool result back with its `tool_name`.
export interface WireChatMessage {
  role: "user" | "assistant" | "system" | "tool";
  content: string;
  // Base64-encoded image bytes (vision-capable models only).
  images?: string[];
  tool_calls?: WireToolCall[];
  tool_name?: string;
}

export interface SendMessageOptions {
  chatId: string;
  // Full conversation history — the caller pre-builds this from local SQLite. The new user turn must already be the last entry. The cloud is stateless about chats; we replay the history each turn.
  messages: WireChatMessage[];
  model: string;
  // Non-image attachments are dropped (the cloud `/api/chat` only accepts `images`). Image attachments are encoded onto the last user message.
  attachments?: ChatAttachment[];
  // Forwarded verbatim to the request body. `think: false` is the explicit opt-out (Ollama defaults thinking ON when omitted); `think: true` must only be set on thinking-capable models or the server 400s.
  think?: boolean;
  // Tool schemas the model may call this turn (web search). Sent only when the user enabled web search; the pipeline runs the calls and re-streams.
  tools?: readonly ToolDefinition[];
  signal?: AbortSignal;
}

export async function* sendChatMessage(
  client: ApiClient,
  opts: SendMessageOptions,
): AsyncGenerator<ChatEventUnion> {
  // Image attachments ride on the last user message's `images` field per the Ollama API. Non-image attachments are silently dropped: `/api/chat` does not have a wire slot for arbitrary file blobs.
  const imagesB64: string[] = [];
  if (opts.attachments) {
    for (const a of opts.attachments) {
      if (a.mimeType?.startsWith("image/") === true) {
        imagesB64.push(bytesToBase64(a.data));
      }
    }
  }

  const messages: WireChatMessage[] = opts.messages.map((m, idx) => {
    const isLastUser =
      idx === opts.messages.length - 1 &&
      m.role === "user" &&
      imagesB64.length > 0;
    return isLastUser ? { ...m, images: imagesB64 } : m;
  });

  // Forward `think` verbatim when specified — thinking-capable models treat a missing flag as ON, so the opt-out must be explicit.
  const body: {
    model: string;
    messages: WireChatMessage[];
    stream: true;
    think?: boolean;
    tools?: readonly ToolDefinition[];
  } = {
    model: opts.model,
    messages,
    stream: true,
  };
  if (opts.think !== undefined) {
    body.think = opts.think;
  }
  if (opts.tools !== undefined && opts.tools.length > 0) {
    body.tools = opts.tools;
  }
  // Standard Ollama API path. `ollama.com` exposes this directly for cloud inference; the chatId / persistence story is local-only on mobile.
  const response = await client.stream(
    "/api/chat",
    {
      method: "POST",
      body: JSON.stringify(body),
    },
    opts.signal,
  );
  for await (const raw of parseJsonlFromResponse<RawOllamaChunk>(response)) {
    for (const event of reviveOllamaChunk(raw)) {
      yield event;
    }
  }
}
// Standard Ollama `/api/chat` JSONL line. The interesting fields are `message.content` for streamed tokens, `message.thinking` for reasoning streams (when `think: true`), and `done`/`error` for stream control.
interface RawOllamaChunk {
  model?: string;
  created_at?: string;
  message?: {
    role?: string;
    content?: string;
    thinking?: string;
    tool_calls?: WireToolCall[];
  };
  done?: boolean;
  error?: string;
  // Final-chunk metadata (eval_count, total_duration, etc.) is ignored here; we don't surface inference metrics in the mobile UI yet.
  [k: string]: unknown;
}

// Heuristic match against the cloud's free-tier exhaustion / upgrade-required error strings so the UI can route to the upgrade modal instead of the inline error badge.
function isSubscriptionError(message: string): boolean {
  const lower = message.toLowerCase();
  return (
    lower.includes("subscription") ||
    lower.includes("upgrade") ||
    lower.includes("usage limit") ||
    lower.includes("free tier")
  );
}

// One JSONL chunk can carry several signals — the thinking→content transition chunk bundles the last reasoning
// delta with the first answer token. Returning only the first dropped that token, so we surface every signal.
function reviveOllamaChunk(raw: RawOllamaChunk): ChatEventUnion[] {
  if (raw.error) {
    if (isSubscriptionError(raw.error)) {
      // Throw mid-stream so `useSendMessage`'s catch surfaces the typed error and Composer can open the upgrade modal.
      throw new CloudAPIError(
        HTTP_STATUS_FORBIDDEN,
        "subscription_required",
        undefined,
        raw.error,
      );
    }
    return [new ErrorEvent({ eventName: "error", error: raw.error })];
  }
  const events: ChatEventUnion[] = [];
  // Thinking chunks arrive on the same JSONL stream as content tokens, in their own `message.thinking` field. The pipeline routes the "thinking" event into a separate buffer that lands in `messages.thinking` and renders as a collapsible block.
  const thinking = raw.message?.thinking;
  if (thinking && thinking.length > 0) {
    events.push(new ChatEvent({ eventName: "thinking", thinking }));
  }
  const content = raw.message?.content;
  if (content && content.length > 0) {
    // Map to the existing `chat` event so useSendMessage's switch keeps working without a broader refactor.
    events.push(new ChatEvent({ eventName: "chat", content }));
  }
  const toolCalls = raw.message?.tool_calls;
  if (toolCalls && toolCalls.length > 0) {
    events.push({ eventName: "tool_calls", toolCalls });
  }
  // `done: true` with empty fields is the EOS sentinel — no events; the generator closes naturally on the next read.
  return events;
}
