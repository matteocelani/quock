// Streaming send pipeline — module-level so it can be tested without mounting `useSendMessage`. The hook owns the React lifecycle; everything inside this file is the wire/buffer/flush logic for a single stream attempt. Throttles React-cache patches (~60Hz via rAF) and SQLite writes (`DB_FLUSH_MS`) independently to keep both render rate and disk write rate bounded.

import type { QueryClient } from "@tanstack/react-query";
import type React from "react";
import type { ApiClient } from "@/lib/api/client";
import {
  deriveMessageErrorCode,
  StreamInterruptedError,
} from "@/lib/api/errors";
import type { MessageRepository } from "@/lib/db/messageRepository";
import type {
  MessageErrorCode,
  MessageStatus,
} from "@/lib/db/types";
import { queryKeys } from "@/lib/hooks/queryKeys";
import type { UseHapticsResult } from "@/lib/hooks/useHaptics";
import type { ChatId, MessageId } from "@/lib/types/ids";
import {
  type ChatEventUnion,
  sendChatMessage,
  type WireChatMessage,
} from "@/modules/chat/api/chat";
import {
  executeToolCall,
  type ToolDefinition,
  type WireToolCall,
} from "@/modules/chat/lib/tools";
import {
  DB_FLUSH_MS,
  REACT_FLUSH_MS,
  WEB_SEARCH_MAX_TOOL_ROUNDS,
} from "@/modules/chat/constants";
import type { UseChatData } from "@/modules/chat/hooks/useChat";
import type {
  DownloadProgress,
  ToolActivity,
} from "@/modules/chat/stores/streaming.store";

// API-side narrowed attachment shape (no `uri`). Used by both `send` and `regenerate` paths.
export interface ApiAttachment {
  filename: string;
  data: Uint8Array;
  mimeType?: string;
}

// Per-call mutable buffer held in a closure so it survives every flush micro-task.
interface StreamBuffers {
  // Visible answer (inline <think> stripped out); derived from `rawContent` on each chat event.
  content: string;
  // Raw content bytes as streamed, including any inline <think> tags — re-parsed each flush.
  rawContent: string;
  // Reasoning from the dedicated `thinking` stream channel.
  thinking: string;
  // Reasoning parsed out of inline <think> tags in the content stream (kimi-style models).
  inlineThinking: string;
  assistantId: MessageId | null;
  pendingReactFlush: boolean;
  lastDbFlushAt: number;
  pendingDbTimer: ReturnType<typeof setTimeout> | null;
  lastReactFlushAt: number;
  pendingRaf: number | null;
  // Deferred React-flush setTimeout (the pre-rAF wait, or the no-rAF test path); tracked so cancelPending can clear it and no stale flush lands post-abort.
  pendingReactTimer: ReturnType<typeof setTimeout> | null;
  // True once at least one `chat` event has landed, so we can flip the row from pending -> streaming exactly once.
  hasStreamedToken: boolean;
  // Set when a web tool call throws (auth/network) so the completed bubble can show a non-fatal "Web search unavailable" note. The model still answers from what it has.
  webSearchFailed: boolean;
}

// Everything the pipeline needs from the React side. Threading these as a context object (instead of a 9-arg signature) keeps `useSendMessage` readable when wiring the call.
export interface RunStreamContext {
  client: ApiClient;
  chatId: ChatId;
  messages: MessageRepository;
  queryClient: QueryClient;
  startStream: (chatId: ChatId, controller: AbortController) => void;
  endStream: (chatId: ChatId) => void;
  updateProgress: (chatId: ChatId, progress: DownloadProgress) => void;
  setToolActivity: (chatId: ChatId, activity: ToolActivity | null) => void;
  haptics: UseHapticsResult;
  // Ref is shared with the hook so `abort()` on the hook still cancels the active controller; we set + clear it from inside the pipeline.
  controllerRef: React.MutableRefObject<AbortController | null>;
}

// AbortController surfaces a DOMException-shaped error on RN; match by name to avoid depending on the platform class.
export function isAbortError(err: unknown): boolean {
  if (!err || typeof err !== "object") return false;
  const e = err as { name?: unknown };
  return e.name === "AbortError";
}
// The term shown in "Searching for {term}…": the search query, or the fetched URL for web_fetch.
function toolActivityTerm(call: WireToolCall): string {
  const args = call.function.arguments;
  const term = args.query ?? args.url;
  return typeof term === "string" ? term : "";
}

const THINK_OPEN = "<think>";
const THINK_CLOSE = "</think>";
// Some models (e.g. kimi-k2.x) stream reasoning INLINE as <think>…</think> in the content field (sometimes a
// closing tag with no opener); this routes it to the thinking block. Re-parsing the full buffer survives split tags.
export function splitInlineThink(raw: string): {
  content: string;
  thinking: string;
} {
  if (!raw.includes(THINK_OPEN) && !raw.includes(THINK_CLOSE)) {
    return { content: raw, thinking: "" };
  }
  let content = "";
  let thinking = "";
  let i = 0;
  let inThink = false;
  while (i < raw.length) {
    if (inThink) {
      const close = raw.indexOf(THINK_CLOSE, i);
      if (close === -1) {
        thinking += raw.slice(i);
        break;
      }
      thinking += raw.slice(i, close);
      i = close + THINK_CLOSE.length;
      inThink = false;
      continue;
    }
    const open = raw.indexOf(THINK_OPEN, i);
    const close = raw.indexOf(THINK_CLOSE, i);
    if (open === -1 && close === -1) {
      content += raw.slice(i);
      break;
    }
    // A closing tag before any opener: the text up to it was unmarked reasoning (kimi's pattern).
    if (close !== -1 && (open === -1 || close < open)) {
      thinking += raw.slice(i, close);
      i = close + THINK_CLOSE.length;
      continue;
    }
    // Opener first: text before it is visible content; switch into reasoning.
    content += raw.slice(i, open);
    i = open + THINK_OPEN.length;
    inThink = true;
  }
  // Hide a half-arrived tag (e.g. "<thi") at the streaming tail so it never flashes in the answer.
  const partial = content.match(/<\/?t(?:h(?:i(?:n(?:k>?)?)?)?)?$/);
  if (partial) {
    content = content.slice(0, content.length - partial[0].length);
  }
  return { content, thinking };
}

export async function runStream(
  ctx: RunStreamContext,
  modelName: string,
  assistantId: MessageId,
  wireMessages: WireChatMessage[],
  apiAttachments: ApiAttachment[],
  think: boolean | undefined,
  tools: readonly ToolDefinition[] | undefined,
): Promise<void> {
  const {
    client,
    chatId,
    messages,
    queryClient,
    startStream,
    endStream,
    updateProgress,
    setToolActivity,
    haptics,
    controllerRef,
  } = ctx;
  const controller = new AbortController();
  controllerRef.current = controller;
  startStream(chatId, controller);
  const buffers: StreamBuffers = {
    content: "",
    rawContent: "",
    thinking: "",
    inlineThinking: "",
    assistantId,
    pendingReactFlush: false,
    lastDbFlushAt: 0,
    pendingDbTimer: null,
    lastReactFlushAt: 0,
    pendingRaf: null,
    pendingReactTimer: null,
    hasStreamedToken: false,
    webSearchFailed: false,
  };
  // Reasoning shown to the UI = dedicated `thinking` channel + any inline <think> parsed from content. Models use one or the other, so this is just whichever is non-empty.
  const effectiveThinking = (): string | null => {
    const merged = buffers.thinking + buffers.inlineThinking;
    return merged.length > 0 ? merged : null;
  };
  // Patches DB + cache atomically so AssistantMessage always reads a coherent status/content/errorCode triplet.
  const writeStatus = async (
    status: MessageStatus,
    errorCode: MessageErrorCode | null,
  ): Promise<void> => {
    if (!buffers.assistantId) return;
    try {
      await messages.update(buffers.assistantId, {
        content: buffers.content,
        thinking: effectiveThinking(),
        status,
        errorCode,
        webSearchFailed: buffers.webSearchFailed,
      });
    } catch (err) {
      console.error("runStream: status write failed:", err);
    }
    queryClient.setQueryData<UseChatData>(queryKeys.chat(chatId), (prev) => {
      if (!prev) return prev;
      const list = [...prev.messages];
      const tail = list[list.length - 1];
      if (!tail || tail.id !== buffers.assistantId) return prev;
      list[list.length - 1] = {
        ...tail,
        content: buffers.content,
        thinking: effectiveThinking() ?? tail.thinking,
        status,
        errorCode,
        webSearchFailed: buffers.webSearchFailed,
        updatedAt: Date.now(),
      };
      return { ...prev, messages: list };
    });
  };
  // The React (~60Hz) and SQLite (~5Hz) flush axes throttle independently; cancelPending must clear BOTH on
  // abort/error/complete so no stale flush lands after the terminal writeStatus and clobbers the final content.
  // Coalesces React-cache patches to ~60Hz via rAF, falling back to setTimeout in test envs.
  const flushReact = (): void => {
    buffers.pendingReactFlush = false;
    buffers.pendingRaf = null;
    buffers.lastReactFlushAt = Date.now();
    queryClient.setQueryData<UseChatData>(queryKeys.chat(chatId), (prev) => {
      if (!prev) return prev;
      const list = [...prev.messages];
      const tail = list[list.length - 1];
      if (!tail || tail.id !== buffers.assistantId) return prev;
      list[list.length - 1] = {
        ...tail,
        content: buffers.content,
        thinking: effectiveThinking() ?? tail.thinking,
        updatedAt: Date.now(),
      };
      return { ...prev, messages: list };
    });
  };

  const scheduleReactFlush = (): void => {
    if (buffers.pendingReactFlush) return;
    buffers.pendingReactFlush = true;
    if (typeof requestAnimationFrame === "function") {
      // Skip the rAF when the last flush is fresher than one frame; the next rAF will batch it for free.
      const elapsed = Date.now() - buffers.lastReactFlushAt;
      if (elapsed < REACT_FLUSH_MS) {
        // Defer until enough time has passed.
        buffers.pendingReactTimer = setTimeout(() => {
          buffers.pendingReactTimer = null;
          if (buffers.pendingReactFlush) {
            buffers.pendingRaf = requestAnimationFrame(flushReact);
          }
        }, REACT_FLUSH_MS - elapsed);
      } else {
        buffers.pendingRaf = requestAnimationFrame(flushReact);
      }
    } else {
      buffers.pendingReactTimer = setTimeout(flushReact, REACT_FLUSH_MS);
    }
  };

  const flushDb = async (): Promise<void> => {
    if (buffers.pendingDbTimer) {
      clearTimeout(buffers.pendingDbTimer);
      buffers.pendingDbTimer = null;
    }
    buffers.lastDbFlushAt = Date.now();
    if (!buffers.assistantId) return;
    try {
      await messages.update(buffers.assistantId, {
        content: buffers.content,
        thinking: effectiveThinking(),
      });
    } catch (err) {
      console.error("runStream: DB flush failed:", err);
    }
  };

  const scheduleDbFlush = (): void => {
    if (buffers.pendingDbTimer) return;
    const elapsed = Date.now() - buffers.lastDbFlushAt;
    const delay = Math.max(0, DB_FLUSH_MS - elapsed);
    buffers.pendingDbTimer = setTimeout(() => {
      buffers.pendingDbTimer = null;
      // Fire-and-forget: errors are logged inside `flushDb`.
      void flushDb();
    }, delay);
  };

  const cancelPending = (): void => {
    if (
      buffers.pendingRaf !== null &&
      typeof cancelAnimationFrame === "function"
    ) {
      cancelAnimationFrame(buffers.pendingRaf);
      buffers.pendingRaf = null;
    }
    buffers.pendingReactFlush = false;
    if (buffers.pendingReactTimer) {
      clearTimeout(buffers.pendingReactTimer);
      buffers.pendingReactTimer = null;
    }
    if (buffers.pendingDbTimer) {
      clearTimeout(buffers.pendingDbTimer);
      buffers.pendingDbTimer = null;
    }
  };
  // Multi-turn agentic loop: each pass streams one /api/chat response. When a turn ends with tool calls we run them, append the results, and re-stream — until the model answers with no tool calls (or the round cap trips). Without tools this runs exactly once, identical to the old single-shot path.
  let tokenCount = 0;
  let turnMessages = wireMessages;
  let round = 0;
  try {
    while (true) {
      const pendingToolCalls: WireToolCall[] = [];
      const events: AsyncGenerator<ChatEventUnion> = sendChatMessage(client, {
        chatId,
        messages: turnMessages,
        model: modelName,
        // Images ride only on the first turn's user message; later turns end in tool results.
        attachments: round === 0 ? apiAttachments : undefined,
        think,
        tools,
        signal: controller.signal,
      });
      for await (const event of events) {
        if (controller.signal.aborted) {
          // Drain quietly — the abort handler below owns the final write.
          continue;
        }
        switch (event.eventName) {
          case "chat": {
            if (event.content) {
              buffers.rawContent += event.content;
              // Re-derive the visible answer + inline reasoning from the full raw buffer (tolerant of tags split across chunks).
              const split = splitInlineThink(buffers.rawContent);
              buffers.content = split.content;
              buffers.inlineThinking = split.thinking;
              tokenCount += 1;
              if (!buffers.hasStreamedToken) {
                buffers.hasStreamedToken = true;
                // First token: flip pending -> streaming so the thinking dots dismiss.
                await writeStatus("streaming", null);
              } else {
                scheduleReactFlush();
                scheduleDbFlush();
              }
            }
            break;
          }
          case "thinking": {
            if (event.thinking) {
              buffers.thinking += event.thinking;
              scheduleReactFlush();
              scheduleDbFlush();
            }
            break;
          }
          case "download": {
            const progress: DownloadProgress = {
              total: event.total,
              completed: event.completed,
              done: event.done,
            };
            updateProgress(chatId, progress);
            break;
          }
          case "tool_calls": {
            // Collected now; executed once the turn's stream closes.
            pendingToolCalls.push(...event.toolCalls);
            break;
          }
          case "error": {
            const errMsg =
              (event as { error?: string; message?: string }).error ??
              (event as { error?: string; message?: string }).message ??
              "Unknown error";
            cancelPending();
            setToolActivity(chatId, null);
            // The UI shows a friendly code-keyed message; keep the server's raw text in the log so a report can say what Ollama actually returned (e.g. a model that rejects images).
            console.warn("[chat] Ollama returned a stream error:", errMsg);
            await writeStatus("error", deriveMessageErrorCode(errMsg));
            endStream(chatId);
            controllerRef.current = null;
            // Status + cleanup already written with the server-derived code; return so the outer catch doesn't re-derive a generic code over it.
            return;
          }
          default: {
            // `done` closes the turn naturally; other reserved events are ignored.
            break;
          }
        }
      }
      // An abort during the drain above can let the generator end cleanly; don't fall through to "complete".
      if (controller.signal.aborted) {
        throw new StreamInterruptedError(tokenCount);
      }
      // Turn finished. No tool calls -> the model produced its final answer.
      if (pendingToolCalls.length === 0) break;
      // Safety cap so a model that keeps requesting tools can't loop forever.
      if (round >= WEB_SEARCH_MAX_TOOL_ROUNDS) break;
      // Record the assistant turn that asked for the tools, then run each and append its result for the next turn.
      turnMessages = [
        ...turnMessages,
        {
          role: "assistant",
          content: buffers.content,
          tool_calls: pendingToolCalls,
        },
      ];
      // Reset per round so the note reflects only the latest round: a recovered failure clears, while a failure
      // the model gives up on (no later round) survives to show the note.
      buffers.webSearchFailed = false;
      for (const call of pendingToolCalls) {
        if (controller.signal.aborted) break;
        setToolActivity(chatId, {
          name: call.function.name,
          query: toolActivityTerm(call),
        });
        let result: string;
        try {
          result = await executeToolCall(client, call);
        } catch (err) {
          console.warn("[chat] tool call failed:", err);
          // Surface a non-fatal note on the finished bubble; the model still answers from the failed tool result.
          buffers.webSearchFailed = true;
          result = `Tool ${call.function.name} failed.`;
        }
        turnMessages = [
          ...turnMessages,
          { role: "tool", content: result, tool_name: call.function.name },
        ];
      }
      setToolActivity(chatId, null);
      round += 1;
    }
    cancelPending();
    setToolActivity(chatId, null);
    await writeStatus("complete", null);
    endStream(chatId);
    controllerRef.current = null;
    haptics.light();
  } catch (err) {
    cancelPending();
    setToolActivity(chatId, null);
    if (isAbortError(err) || controller.signal.aborted) {
      // User stop: bubble shows the interrupted label + Retry.
      await writeStatus("interrupted", null);
      endStream(chatId);
      controllerRef.current = null;
      return;
    }
    // Anything else: typed terminal state so the bubble renders the inline error chip + Retry.
    await writeStatus("error", deriveMessageErrorCode(err));
    endStream(chatId);
    controllerRef.current = null;
    throw err;
  }
}
