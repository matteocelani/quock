// Send / regenerate / retry pipeline as a hook. State setup + DB writes for the user turn + cache patching live here; the streaming wire/buffer/flush logic is delegated to `@/modules/chat/lib/streamPipeline.ts` so it can be tested without React.

import { useQueryClient } from "@tanstack/react-query";
import React from "react";
import type { WireChatMessage } from "@/modules/chat/api/chat";
import type { UiAttachment } from "@/modules/chat/types";
import { useApi } from "@/lib/contexts/ApiContext";
import { useDb } from "@/lib/contexts/DbContext";
import { useStreamingStore } from "@/modules/chat/stores/streaming.store";
import { useChatComposerModes } from "@/modules/chat/hooks/useChatComposerModes";
import type { DbAttachment, DbMessage } from "@/lib/db/types";
import type { ChatId, MessageId } from "@/lib/types/ids";
import {
  useHasThinkingCapability,
  useHasToolsCapability,
  useHasVisionCapability,
} from "@/modules/models/hooks/useModelCapabilities";
import { queryKeys } from "@/lib/hooks/queryKeys";
import type { UseChatData } from "@/modules/chat/hooks/useChat";
import { useHaptics } from "@/lib/hooks/useHaptics";
import { useChatModel } from "@/modules/models/hooks/useChatModel";
import {
  runStream,
  type ApiAttachment,
} from "@/modules/chat/lib/streamPipeline";
import {
  bumpSidebar,
  gateVisionAttachments,
  locateAssistantTurn,
  narrowApiAttachments,
  patchChatCache,
  pruneAttachmentMap,
  toWireHistory,
} from "@/modules/chat/lib/sendHelpers";
import { WEB_TOOLS, type ToolDefinition } from "@/modules/chat/lib/tools";
import {
  appendDocumentText,
  isTextDocument,
} from "@/modules/chat/lib/documentText";
import { CHAT_AUTO_TITLE_MAX_CHARS } from "@/modules/chat/constants";

// Full UiAttachment in (carries `uri` for the DB write); API send narrows below.
export interface SendMessageInput {
  text: string;
  attachments?: UiAttachment[];
  // Whether web search is currently on (sticky, persisted per chat). Grants the web tools to the model when the active model supports tools. Thinking is NOT passed here — useSendMessage derives it from the chat's persisted preference and omits it when off so the model decides.
  webSearch?: boolean;
  // Fired once the user turn is persisted + in the cache, so the composer clears only after the draft is safe — a pre-persist throw (no model, DB error) keeps the text instead of losing it.
  onPersisted?: () => void;
}

export interface UseSendMessageResult {
  send: (input: SendMessageInput) => Promise<void>;
  regenerate: (assistantMessageId: MessageId) => Promise<void>;
  retry: (assistantMessageId: MessageId) => Promise<void>;
  // Updates a user message's content, drops every message after it (the now-stale assistant replies), then re-runs the stream from the edited turn. Mirrors ChatGPT / Claude "edit message" semantics.
  editAndResend: (userMessageId: MessageId, newContent: string) => Promise<void>;
  abort: () => void;
  isStreaming: boolean;
}

export function useSendMessage(chatId: ChatId): UseSendMessageResult {
  const { client } = useApi();
  const { chats, messages, attachments } = useDb();
  const { model } = useChatModel(chatId);
  const hasVision = useHasVisionCapability(model?.name);
  const hasTools = useHasToolsCapability(model?.name);
  const hasThinking = useHasThinkingCapability(model?.name);
  // Sticky modes persisted per chat. Thinking is OPTIONAL: only an explicit on (and a thinking-capable model)
  // forces `think: true`; otherwise the flag is omitted so the model decides. Applied uniformly to every path.
  const { thinkEnabled, webSearchEnabled } = useChatComposerModes(chatId);
  const forceThink = thinkEnabled && hasThinking;
  // Action references from the store are stable across renders (created once by `create`), so we read them via selectors without churning effect deps.
  const startStream = useStreamingStore((s) => s.startStream);
  const endStream = useStreamingStore((s) => s.endStream);
  const updateProgress = useStreamingStore((s) => s.updateProgress);
  const setToolActivity = useStreamingStore((s) => s.setToolActivity);
  const ctxAbort = useStreamingStore((s) => s.abort);
  const isStreaming = useStreamingStore((s) =>
    s.streamingChatIds.has(chatId),
  );
  const queryClient = useQueryClient();
  const haptics = useHaptics();
  // Tracking the active controller keeps `abort` working even if the streaming map updates after capture.
  const controllerRef = React.useRef<AbortController | null>(null);
  // Auto-abort on unmount or chatId change so an in-flight stream cannot leak its reader. Reading `controllerRef.current` in the cleanup is intentional (we want the LATEST controller at unmount, not the one captured when the effect first mounted) — the linter cannot see the cross-file mutation in `runStream` now that the pipeline is a separate module.
  React.useEffect(() => {
    return () => {
      // eslint-disable-next-line react-hooks/exhaustive-deps
      const ctrl = controllerRef.current;
      if (ctrl && !ctrl.signal.aborted) {
        ctrl.abort();
      }
    };
  }, []);
  const abort = React.useCallback((): void => {
    ctxAbort(chatId);
  }, [ctxAbort, chatId]);
  // Thin wrapper: builds the RunStreamContext once per call and delegates to the pipeline module.
  const runStreamWithContext = React.useCallback(
    async (
      modelName: string,
      assistantId: MessageId,
      wireMessages: WireChatMessage[],
      apiAttachments: ApiAttachment[],
      think: boolean | undefined,
      tools: readonly ToolDefinition[] | undefined,
    ): Promise<void> => {
      await runStream(
        {
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
        },
        modelName,
        assistantId,
        wireMessages,
        apiAttachments,
        think,
        tools,
      );
    },
    [
      chatId,
      client,
      endStream,
      haptics,
      messages,
      queryClient,
      setToolActivity,
      startStream,
      updateProgress,
    ],
  );
  const send = React.useCallback(
    async (input: SendMessageInput): Promise<void> => {
      if (!model) {
        throw new Error("No model selected");
      }
      // Lock the chat to the model the conversation STARTS on. Until now an unpinned chat (chats.model NULL) tracks the live global default, so changing the default in Settings would retroactively switch this conversation's model. setModelIfUnset is a no-op once the chat already has a model (explicit pick or a prior send's lock); the cache patch makes useChatModel stop falling back to the live default within this session too.
      await chats.setModelIfUnset(chatId, model.name);
      queryClient.setQueryData<string | null>(
        queryKeys.chatModel(chatId),
        (prev) => prev ?? model.name,
      );

      const text = input.text;
      // Strip image attachments when the active model lacks vision so the wire payload (and the optimistic DB write below) never carries unsupported blobs.
      const inputAttachments = gateVisionAttachments(
        input.attachments ?? [],
        hasVision,
      );
      // Phase 1: optimistic persistence of the user message and any attachments.
      // Stamp the modes active for this send so the bubble can show small read-only indicators.
      const userMessage = await messages.append({
        chatId,
        role: "user",
        content: text,
        thinking: null,
        model: null,
        thinkingTimeStart: null,
        thinkingTimeEnd: null,
        sentWithThink: forceThink,
        sentWithWebSearch: input.webSearch === true,
      });
      const insertedAttachments: DbAttachment[] = [];
      for (const att of inputAttachments) {
        try {
          const row = await attachments.add({
            messageId: userMessage.id,
            filename: att.filename,
            mimeType: att.mimeType ?? null,
            data: att.data,
            uri: att.uri,
            sizeBytes: att.sizeBytes ?? att.data.byteLength,
          });
          insertedAttachments.push(row);
        } catch (err) {
          // Attachment writes are best-effort so one bad blob cannot block the rest of the turn.
          console.error("useSendMessage: attachment write failed:", err);
        }
      }

      const placeholderAssistant = await messages.append({
        chatId,
        role: "assistant",
        content: "",
        thinking: null,
        model: model.name,
        thinkingTimeStart: null,
        thinkingTimeEnd: null,
        status: "pending",
      });
      // Auto-title the chat from the first user message so the sidebar isn't a wall of blank rows. We only set it when title is still empty so future server-side titling can override without us clobbering it.
      try {
        const current = await chats.get(chatId);
        if (current && current.title.trim().length === 0) {
          const trimmed = text.trim().split("\n")[0]?.slice(0, CHAT_AUTO_TITLE_MAX_CHARS) ?? "";
          if (trimmed.length > 0) {
            await chats.rename(chatId, trimmed);
          }
        }
      } catch (err) {
        // Title is cosmetic; never fail the send because of it.
        console.warn("useSendMessage: auto-title failed", err);
      }
      // Float the chat to the top of the sidebar and refresh the list query.
      await bumpSidebar(chats, queryClient, chatId);
      // Phase 2: patch the in-memory cache so the UI sees the new turn before the stream lands.
      const existing = queryClient.getQueryData<UseChatData>(
        queryKeys.chat(chatId),
      );
      const existingMessages = existing?.messages ?? [];
      const updatedMessages: DbMessage[] = [
        ...existingMessages,
        userMessage,
        placeholderAssistant,
      ];
      const updatedAttachments = new Map<MessageId, DbAttachment[]>(
        existing?.attachmentsByMessage ?? new Map(),
      );
      if (insertedAttachments.length > 0) {
        updatedAttachments.set(userMessage.id, insertedAttachments);
      }
      // Patch the in-memory cache so the UI shows the new turn before the stream lands.
      await patchChatCache(
        queryClient,
        chats,
        chatId,
        existing,
        updatedMessages,
        updatedAttachments,
      );
      // The user message is persisted above, so clear the draft regardless of the cache-patch outcome — gating it
      // on a found chat row would strand an already-sent draft; useChat re-reads from SQLite anyway.
      input.onPersisted?.();
      // Narrow to the wire shape from the SUCCESSFULLY-PERSISTED set (not the raw picks) so the API never
      // receives an attachment the DB/cache lacks if an insert failed.
      const apiAttachments = narrowApiAttachments(insertedAttachments);
      // Replay the full history each send (`/api/chat` is stateless). Read from SQLite, not the cache: a cold cache
      // (sending in a just-opened chat) would replay EMPTY history. Exclude the two rows just appended; user turn re-added below.
      const dbForWire = await messages.listByChat(chatId);
      const wireHistory = toWireHistory(
        dbForWire.filter(
          (m) => m.id !== userMessage.id && m.id !== placeholderAssistant.id,
        ),
      );
      // Fold text-document attachments into THIS turn's wire content (the cloud /api/chat has no
      // document slot; images ride images[]). The persisted bubble keeps the user's typed text.
      const textDocs = insertedAttachments.filter((a) =>
        isTextDocument(a.mimeType, a.filename),
      );
      const wireMessages: WireChatMessage[] = [
        ...wireHistory,
        { role: "user", content: appendDocumentText(text, textDocs) },
      ];
      await runStreamWithContext(
        model.name,
        placeholderAssistant.id,
        wireMessages,
        apiAttachments,
        // Thinking is optional: force it on only when the chat's preference is on AND the model supports it; otherwise omit the flag so the model decides for itself.
        forceThink || undefined,
        // Grant the web tools when web search is on and the model supports tools.
        input.webSearch === true && hasTools ? WEB_TOOLS : undefined,
      );
    },
    [
      attachments,
      chatId,
      chats,
      forceThink,
      hasTools,
      hasVision,
      messages,
      model,
      queryClient,
      runStreamWithContext,
    ],
  );
  const regenerate = React.useCallback(
    async (assistantMessageId: MessageId): Promise<void> => {
      if (!model) {
        throw new Error("No model selected");
      }
      // Source of truth for current order. The cache reflects optimistic state; SQLite would lag a streaming flush. We rebuild from SQLite to keep DB and cache consistent post-regenerate.
      const dbMessages = await messages.listByChat(chatId);
      const { assistantIndex, priorUser } = locateAssistantTurn(
        dbMessages,
        assistantMessageId,
        "Regenerate",
      );
      // Drop the assistant turn from disk; the replacement placeholder is appended below so streaming throttles can patch a stable tail row.
      await messages.delete(assistantMessageId);
      // Reload the user message's attachments so the regenerated turn carries the same wire payload as the original send.
      const persistedAttachments = await attachments.listByMessage(
        priorUser.id,
      );
      const placeholderAssistant = await messages.append({
        chatId,
        role: "assistant",
        content: "",
        thinking: null,
        model: model.name,
        thinkingTimeStart: null,
        thinkingTimeEnd: null,
        status: "pending",
      });
      await bumpSidebar(chats, queryClient, chatId);
      // Patch the cache: keep messages up to and including the prior user message, then append the new placeholder so the streaming reducer can patch the same tail it expects.
      const headSlice = dbMessages.slice(0, assistantIndex);
      const updatedMessages: DbMessage[] = [...headSlice, placeholderAssistant];
      const existing = queryClient.getQueryData<UseChatData>(
        queryKeys.chat(chatId),
      );
      // Regenerate drops every message after the prior user turn; prune their orphaned attachment entries and
      // re-assert the prior user turn's attachments from the DB so its chips survive even on a cold cache.
      const preservedAttachments = pruneAttachmentMap(existing, updatedMessages, {
        messageId: priorUser.id,
        rows: persistedAttachments,
      });
      await patchChatCache(
        queryClient,
        chats,
        chatId,
        existing,
        updatedMessages,
        preservedAttachments,
      );

      const apiAttachments = narrowApiAttachments(
        gateVisionAttachments(persistedAttachments, hasVision),
      );
      // Wire history for regenerate: every turn UP TO AND INCLUDING the user message we're re-asking. `headSlice` already excludes the assistant turn being replaced.
      const wireMessages = toWireHistory(headSlice);
      await runStreamWithContext(
        model.name,
        placeholderAssistant.id,
        wireMessages,
        apiAttachments,
        // Thinking: force on only if the chat's preference is on and supported; otherwise omit so the model decides.
        forceThink || undefined,
        // Web search is sticky: regenerate with it when it's currently on (and supported), so retrying for a better answer keeps searching.
        webSearchEnabled && hasTools ? WEB_TOOLS : undefined,
      );
    },
    [
      attachments,
      chatId,
      chats,
      forceThink,
      hasTools,
      hasVision,
      messages,
      model,
      queryClient,
      runStreamWithContext,
      webSearchEnabled,
    ],
  );
  // Retry mutates the failed row in place so FlashList keys and FKs survive; the bubble animates from error chip back to dots.
  const retry = React.useCallback(
    async (assistantMessageId: MessageId): Promise<void> => {
      if (!model) {
        throw new Error("No model selected");
      }
      const dbMessages = await messages.listByChat(chatId);
      const { assistantIndex, priorUser } = locateAssistantTurn(
        dbMessages,
        assistantMessageId,
        "Retry",
      );
      // Reset to a fresh pending placeholder, keeping the row id stable.
      await messages.update(assistantMessageId, {
        content: "",
        thinking: null,
        status: "pending",
        errorCode: null,
        webSearchFailed: false,
      });
      const persistedAttachments = await attachments.listByMessage(
        priorUser.id,
      );
      await bumpSidebar(chats, queryClient, chatId);
      // Cache patch so the bubble shows pending while the stream warms up.
      const headSlice = dbMessages.slice(0, assistantIndex);
      const resetAssistant: DbMessage = {
        ...dbMessages[assistantIndex],
        content: "",
        thinking: null,
        status: "pending",
        errorCode: null,
        webSearchFailed: false,
        updatedAt: Date.now(),
      };
      const updatedMessages: DbMessage[] = [...headSlice, resetAssistant];
      const existing = queryClient.getQueryData<UseChatData>(
        queryKeys.chat(chatId),
      );
      // The cache keeps head + the reset row; prune orphaned attachment entries for any dropped tail and
      // re-assert the prior user turn's attachments from the DB so its chips survive even on a cold cache.
      const preservedAttachments = pruneAttachmentMap(existing, updatedMessages, {
        messageId: priorUser.id,
        rows: persistedAttachments,
      });
      await patchChatCache(
        queryClient,
        chats,
        chatId,
        existing,
        updatedMessages,
        preservedAttachments,
      );

      const apiAttachments = narrowApiAttachments(
        gateVisionAttachments(persistedAttachments, hasVision),
      );
      const wireMessages = toWireHistory(headSlice);
      await runStreamWithContext(
        model.name,
        assistantMessageId,
        wireMessages,
        apiAttachments,
        // Thinking: force on only if the chat's preference is on and supported; otherwise omit so the model decides.
        forceThink || undefined,
        // Web search is sticky: retry with it when it's currently on (and supported).
        webSearchEnabled && hasTools ? WEB_TOOLS : undefined,
      );
    },
    [
      attachments,
      chatId,
      chats,
      forceThink,
      hasTools,
      hasVision,
      messages,
      model,
      queryClient,
      runStreamWithContext,
      webSearchEnabled,
    ],
  );
  // Edit a user turn in place, drop everything after it (now stale), then re-stream from the edited turn. Honors the chat's think preference like a fresh send.
  const editAndResend = React.useCallback(
    async (userMessageId: MessageId, newContent: string): Promise<void> => {
      if (!model) {
        throw new Error("No model selected");
      }
      const dbMessages = await messages.listByChat(chatId);
      const userIndex = dbMessages.findIndex(
        (m) => m.id === userMessageId && m.role === "user",
      );
      if (userIndex < 0) {
        throw new Error("Edit: user message not found");
      }
      const userMessage = dbMessages[userIndex];
      // Re-sending an edited prompt: refresh the mode indicators to the modes active now.
      const sentWithWebSearch = webSearchEnabled && hasTools;
      await messages.update(userMessageId, {
        content: newContent,
        sentWithThink: forceThink,
        sentWithWebSearch,
      });
      await messages.deleteAfter(chatId, userMessageId);
      // Attachments stay bound to the user message; vision-gating mirrors `send`.
      const persistedAttachments = await attachments.listByMessage(userMessageId);
      const placeholderAssistant = await messages.append({
        chatId,
        role: "assistant",
        content: "",
        thinking: null,
        model: model.name,
        thinkingTimeStart: null,
        thinkingTimeEnd: null,
        status: "pending",
      });
      await bumpSidebar(chats, queryClient, chatId);
      // Patch the cache: head (unchanged) + edited user + new placeholder. The streaming reducer expects a stable tail row.
      const headSlice = dbMessages.slice(0, userIndex);
      const editedUser: DbMessage = {
        ...userMessage,
        content: newContent,
        sentWithThink: forceThink,
        sentWithWebSearch,
        updatedAt: Date.now(),
      };
      const updatedMessages: DbMessage[] = [
        ...headSlice,
        editedUser,
        placeholderAssistant,
      ];
      const existing = queryClient.getQueryData<UseChatData>(
        queryKeys.chat(chatId),
      );
      // deleteAfter dropped every message past the edited turn; prune their now-orphaned attachment entries and
      // re-assert the edited turn's own attachments from the DB so they survive even on a cold cache.
      const preservedAttachments = pruneAttachmentMap(existing, updatedMessages, {
        messageId: userMessageId,
        rows: persistedAttachments,
      });
      await patchChatCache(
        queryClient,
        chats,
        chatId,
        existing,
        updatedMessages,
        preservedAttachments,
      );
      const apiAttachments = narrowApiAttachments(
        gateVisionAttachments(persistedAttachments, hasVision),
      );
      // Wire history: every prior turn + the freshly-edited user content as the last entry.
      const wireMessages: WireChatMessage[] = [
        ...toWireHistory(headSlice),
        { role: "user", content: newContent },
      ];
      await runStreamWithContext(
        model.name,
        placeholderAssistant.id,
        wireMessages,
        apiAttachments,
        // Edit re-runs honoring the chat's sticky modes (matches a fresh send): force think only if on+supported, web search when on+supported.
        forceThink || undefined,
        webSearchEnabled && hasTools ? WEB_TOOLS : undefined,
      );
    },
    [
      attachments,
      chatId,
      chats,
      forceThink,
      hasTools,
      hasVision,
      messages,
      model,
      queryClient,
      runStreamWithContext,
      webSearchEnabled,
    ],
  );
  return React.useMemo<UseSendMessageResult>(
    () => ({ send, regenerate, retry, editAndResend, abort, isStreaming }),
    [send, regenerate, retry, editAndResend, abort, isStreaming],
  );
}
