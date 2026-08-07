// Top-level chat screen — stitches header, MessageList, empty state, and Composer.

import { useRouter } from "expo-router";
import React, { useCallback, useEffect, useRef, useState } from "react";
import { Text, View } from "react-native";
import { useKeyboardState } from "react-native-keyboard-controller";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { AttachSheet } from "@/components/chat/AttachSheet";
import { Spinner } from "@/components/ui/Spinner";
import { componentLayout } from "@/lib/design/tokens";
import {
  ATTACHMENT_SELECTION_LIMIT,
  DEFAULT_BOTTOM_INSET,
} from "@/modules/chat/constants";
import { isChatNotFoundError, useChat } from "@/modules/chat/hooks/useChat";
import { useIsStreaming } from "@/modules/chat/hooks/useIsStreaming";
import { useSendMessage } from "@/modules/chat/hooks/useSendMessage";
import { useToast } from "@/lib/hooks/useToast";
import { useUIStore } from "@/lib/stores/ui.store";
import type { ChatId, MessageId } from "@/lib/types/ids";
import { Composer } from "@/components/chat/Composer";
import { EmptyState } from "@/components/chat/EmptyState";
import {
  MessageList,
  type MessageListHandle,
} from "@/components/chat/MessageList";
import type { UiAttachment } from "@/modules/chat/types";
import { SelectTextSheet } from "@/components/chat/SelectTextSheet";
import { ExcerptMenu } from "@/components/chat/ExcerptMenu";
import { useChatComposerModes } from "@/modules/chat/hooks/useChatComposerModes";
import { useChatModel } from "@/modules/models/hooks/useChatModel";
import { useHasToolsCapability } from "@/modules/models/hooks/useModelCapabilities";
import {
  DEFAULT_DEEP_DIVE_INSTRUCTION,
  DEFAULT_WEB_SEARCH_INSTRUCTION,
  excerptPrompt,
} from "@/modules/chat/lib/selectionPrompts";
import { resolveExcerpt } from "@/modules/chat/lib/excerptSelection";
import { useSettingsStore } from "@/lib/stores/settings.store";

export interface ChatHomeProps {
  chatId: ChatId;
}

export function ChatHome({ chatId }: ChatHomeProps): React.ReactElement {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  // MessageList topInset = safe-area + floating header height; content scrolls UNDER the orbs.
  const listTopInset = insets.top + componentLayout.floatingHeader.height;
  // Reserve list bottom space for the composer plus, when open, the keyboard — as real content padding so FlashList's scrollToEnd lands the tail above both (its v2 scrollToEnd ignores the native keyboard inset).
  const isKeyboardVisible = useKeyboardState((s) => s.isVisible);
  const keyboardHeight = useKeyboardState((s) => s.height);
  // Measured composer height so the list inset tracks the bar as it grows (attachment/chip rows); seeded with
  // the static default for the first paint before onLayout reports the real size.
  const [composerHeight, setComposerHeight] =
    useState<number>(DEFAULT_BOTTOM_INSET);
  const listBottomInset = isKeyboardVisible
    ? composerHeight + keyboardHeight
    : composerHeight;
  // Sheet visibility comes from the UI store; individual selectors so each sheet only re-renders when its own flag flips.
  const attachOpen = useUIStore((s) => s.attachOpen);
  const closeAttach = useUIStore((s) => s.closeAttach);
  const openAttach = useUIStore((s) => s.openAttach);
  const selectTextOpen = useUIStore((s) => s.selectTextOpen);
  const selectTextMessageId = useUIStore((s) => s.selectTextMessageId);
  const closeSelectText = useUIStore((s) => s.closeSelectText);
  const closeExcerptMenu = useUIStore((s) => s.closeExcerptMenu);
  // Attachment draft lives here because it is composer-scoped, not navigation state.
  const [attachments, setAttachments] = useState<UiAttachment[]>([]);
  // Scroll-to-latest button lives in the composer (rides its keyboard lift); the list reports visibility here and is driven via ref.
  const [isScrolledUp, setIsScrolledUp] = useState(false);
  const messageListRef = useRef<MessageListHandle>(null);
  const { data, isLoading, isError, error } = useChat(chatId);
  // A deleted chat (clear-all wipes the cache, or the current chat is removed from history) makes useChat throw
  // "not found"; route to a fresh chat instead of dead-ending on the error screen. Genuine DB errors still show.
  const chatGone = isError && isChatNotFoundError(error);
  useEffect(() => {
    if (chatGone) router.replace("/c");
  }, [chatGone, router]);
  const isStreaming = useIsStreaming(chatId);
  const { regenerate, retry, editAndResend, abort, send } =
    useSendMessage(chatId);
  const { model } = useChatModel(chatId);
  const canWebSearch = useHasToolsCapability(model?.name);
  const { webSearchEnabled } = useChatComposerModes(chatId);
  // Null means the user never reworded it, so the shipped default applies.
  const deepDiveInstruction = useSettingsStore((s) => s.deepDiveInstruction);
  const webSearchInstruction = useSettingsStore((s) => s.webSearchInstruction);
  const toast = useToast();
  const handleRegenerate = useCallback(
    (assistantMessageId: MessageId): void => {
      if (isStreaming) {
        toast({
          title: "Already streaming",
          description: "Stop the current response before regenerating.",
        });
        return;
      }
      void regenerate(assistantMessageId).catch((err: unknown) => {
        console.error("ChatHome: regenerate failed", err);
        toast({ title: "Regenerate failed", tone: "error" });
      });
    },
    [isStreaming, regenerate, toast],
  );
  const handleRetry = useCallback(
    (assistantMessageId: MessageId): void => {
      if (isStreaming) {
        toast({
          title: "Already streaming",
          description: "Stop the current response before retrying.",
        });
        return;
      }
      void retry(assistantMessageId).catch((err: unknown) => {
        console.error("ChatHome: retry failed", err);
        toast({ title: "Retry failed", tone: "error" });
      });
    },
    [isStreaming, retry, toast],
  );
  const handleEdit = useCallback(
    (userMessageId: MessageId, newContent: string): void => {
      // Editing mid-stream means "abandon this answer and re-ask": abort the in-flight stream, then resend. The
      // pipeline's teardown is ownership-gated, so the aborted stream can't tear down the fresh one that replaces it.
      if (isStreaming) {
        abort();
      }
      void editAndResend(userMessageId, newContent).catch((err: unknown) => {
        console.warn("ChatHome: editAndResend failed", err);
        toast({ title: "Edit failed", tone: "error" });
      });
    },
    [abort, editAndResend, isStreaming, toast],
  );
  // Both actions resolve the same way, and an unresolvable key means the renderer and the cache disagree — worth a log,
  // not just a toast, since the key was emitted from this very array a frame earlier.
  const resolveOrToast = useCallback(
    (unitKey: string): string | null => {
      const excerpt = resolveExcerpt(data?.messages ?? [], unitKey);
      if (excerpt.length > 0) return excerpt;
      console.warn("ChatHome: no excerpt text for", unitKey);
      toast({ title: "Couldn't read that part", tone: "error" });
      return null;
    },
    [data?.messages, toast],
  );
  const handleDeepDive = useCallback(
    (unitKey: string): void => {
      // Guard before closing, or a refusal costs the user the selection. Sending mid-stream would also overwrite the
      // chat's single AbortController and orphan the running stream — the same guard regenerate and retry use.
      if (isStreaming) {
        toast({
          title: "Already streaming",
          description: "Stop the current response before asking for more.",
        });
        return;
      }
      const excerpt = resolveOrToast(unitKey);
      if (excerpt === null) return;
      closeExcerptMenu();
      void send({
        text: excerptPrompt(
          deepDiveInstruction ?? DEFAULT_DEEP_DIVE_INSTRUCTION,
          excerpt,
        ),
        // `send` grants tools off this flag only, so omitting it made deep dive the one path that ignored the globe.
        webSearch: webSearchEnabled,
      }).catch((err: unknown) => {
        console.warn("ChatHome: deep dive failed", err);
        toast({ title: "Couldn't send", tone: "error" });
      });
    },
    [
      closeExcerptMenu,
      deepDiveInstruction,
      isStreaming,
      resolveOrToast,
      send,
      toast,
      webSearchEnabled,
    ],
  );
  const handleWebSearch = useCallback(
    (unitKey: string): void => {
      if (isStreaming) {
        toast({
          title: "Already streaming",
          description: "Stop the current response before asking for more.",
        });
        return;
      }
      const excerpt = resolveOrToast(unitKey);
      if (excerpt === null) return;
      closeExcerptMenu();
      void send({
        text: excerptPrompt(
          webSearchInstruction ?? DEFAULT_WEB_SEARCH_INSTRUCTION,
          excerpt,
        ),
        webSearch: true,
      }).catch((err: unknown) => {
        console.warn("ChatHome: web search failed", err);
        toast({ title: "Couldn't send", tone: "error" });
      });
    },
    [
      closeExcerptMenu,
      isStreaming,
      resolveOrToast,
      send,
      toast,
      webSearchInstruction,
    ],
  );
  const handleAttachResult = useCallback((file: UiAttachment) => {
    // Last-line guard: never exceed the cap even if a picker over-delivers or a sheet gate is bypassed.
    setAttachments((prev) =>
      prev.length >= ATTACHMENT_SELECTION_LIMIT ? prev : [...prev, file],
    );
  }, []);
  // Remove by STABLE id, not array index: RN 0.83 Pressable can double-fire a tap and a stale closed-over index
  // would drop the WRONG chip. Filtering by id is idempotent, so a double-tap is a harmless no-op.
  const handleRemoveAttachment = useCallback((id: string) => {
    setAttachments((prev) => prev.filter((a) => a.id !== id));
  }, []);
  const handleClearAttachments = useCallback(() => setAttachments([]), []);
  const messages = data?.messages ?? [];
  // Resolve the select-text body from the loaded chat cache — never mirror server data into the UI store.
  const selectTextContent =
    messages.find((m) => m.id === selectTextMessageId)?.content ?? "";
  // A failed load that ISN'T a deletion (corrupt row, DB error) reads as an error, not a blank "new chat".
  const showError = isError && !chatGone && messages.length === 0;
  // Hold the spinner while redirecting away from a deleted chat so the error/empty states never flash.
  const showLoading = (isLoading || chatGone) && messages.length === 0;
  const showEmpty = !showLoading && !showError && messages.length === 0;
  return (
    <View className="flex-1 bg-background">
      {/* Body fills the screen edge-to-edge; the FloatingHeader orbs float on top, and the list's top inset pushes the first message clear of them so content scrolls under the orbs (Apple HIG topmost-layer pattern). */}
      <View className="flex-1 bg-background">
        {showLoading ? (
          <View className="flex-1 items-center justify-center">
            <Spinner />
          </View>
        ) : showError ? (
          <View
            className="flex-1 items-center justify-center px-8"
            style={{ paddingTop: listTopInset }}
          >
            <Text className="font-sans text-body text-muted-foreground text-center">
              Couldn&apos;t load this chat.
            </Text>
          </View>
        ) : showEmpty ? (
          <View className="flex-1 pb-25" style={{ paddingTop: listTopInset }}>
            <EmptyState />
          </View>
        ) : (
          <MessageList
            ref={messageListRef}
            messages={messages}
            isStreaming={isStreaming}
            topInset={listTopInset}
            bottomInset={listBottomInset}
            onScrolledUpChange={setIsScrolledUp}
            onRegenerate={handleRegenerate}
            onRetry={handleRetry}
            onEdit={handleEdit}
            attachmentsByMessage={data?.attachmentsByMessage}
          />
        )}
      </View>
      <Composer
        chatId={chatId}
        attachments={attachments}
        onRemoveAttachment={handleRemoveAttachment}
        onClearAttachments={handleClearAttachments}
        onHeightChange={setComposerHeight}
        isJumpToLatestVisible={isScrolledUp}
        onJumpToLatest={() => messageListRef.current?.scrollToLatest()}
      />
      {/* Sheets render unconditionally so their mount cost is paid once at
          screen-mount rather than on first open. */}
      <AttachSheet
        visible={attachOpen}
        onClose={closeAttach}
        onReopen={openAttach}
        onAttach={handleAttachResult}
        currentCount={attachments.length}
        chatId={chatId}
      />
      <SelectTextSheet
        visible={selectTextOpen}
        content={selectTextContent}
        onClose={closeSelectText}
      />
      <ExcerptMenu
        canWebSearch={canWebSearch}
        topInset={listTopInset}
        bottomInset={listBottomInset}
        onDeepDive={handleDeepDive}
        onWebSearch={handleWebSearch}
      />
    </View>
  );
}
