// Top-level chat screen — stitches header, MessageList, empty state, and Composer.

import { useRouter } from "expo-router";
import React, { useCallback, useEffect, useRef, useState } from "react";
import { Text, View } from "react-native";
import { useKeyboardState } from "react-native-keyboard-controller";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { FloatingHeader } from "@/components/layout/FloatingHeader";
import { AccountSheet } from "@/components/settings/AccountSheet";
import { AttachSheet } from "@/components/chat/AttachSheet";
import { ChatHistorySheet } from "@/components/chat/ChatHistorySheet";
import { ModelPickerSheet } from "@/components/models/ModelPickerSheet";
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
import { MessageList, type MessageListHandle } from "@/components/chat/MessageList";
import type { UiAttachment } from "@/modules/chat/types";
import { UpgradePromptModal } from "@/components/chat/UpgradePromptModal";

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
  const [composerHeight, setComposerHeight] = useState<number>(
    DEFAULT_BOTTOM_INSET,
  );
  const listBottomInset = isKeyboardVisible
    ? composerHeight + keyboardHeight
    : composerHeight;
  // Sheet visibility comes from the UI store; individual selectors so each sheet only re-renders when its own flag flips.
  const chatHistoryOpen = useUIStore((s) => s.chatHistoryOpen);
  const modelPickerOpen = useUIStore((s) => s.modelPickerOpen);
  const accountOpen = useUIStore((s) => s.accountOpen);
  const attachOpen = useUIStore((s) => s.attachOpen);
  const upgradeModalOpen = useUIStore((s) => s.upgradeModalOpen);
  const upgradeModelName = useUIStore((s) => s.upgradeModalModelName);
  const closeChatHistory = useUIStore((s) => s.closeChatHistory);
  const closeModelPicker = useUIStore((s) => s.closeModelPicker);
  const closeAccount = useUIStore((s) => s.closeAccount);
  const closeAttach = useUIStore((s) => s.closeAttach);
  const openAttach = useUIStore((s) => s.openAttach);
  const switchToModelPickerFromAccount = useUIStore(
    (s) => s.switchToModelPickerFromAccount,
  );
  const closeUpgradeModal = useUIStore((s) => s.closeUpgradeModal);
  const pickAnotherFromUpgrade = useUIStore((s) => s.pickAnotherFromUpgrade);
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
  const { regenerate, retry, editAndResend } = useSendMessage(chatId);
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
      if (isStreaming) {
        toast({
          title: "Already streaming",
          description: "Stop the current response before editing.",
        });
        return;
      }
      void editAndResend(userMessageId, newContent).catch((err: unknown) => {
        console.warn("ChatHome: editAndResend failed", err);
        toast({ title: "Edit failed", tone: "error" });
      });
    },
    [editAndResend, isStreaming, toast],
  );
  const handleSelectChat = useCallback(
    (selectedId: ChatId) => {
      closeChatHistory();
      router.replace(`/c/${selectedId}`);
    },
    [closeChatHistory, router],
  );
  const handleNewChat = useCallback(() => {
    closeChatHistory();
    router.replace("/c");
  }, [closeChatHistory, router]);
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
  // A failed load that ISN'T a deletion (corrupt row, DB error) reads as an error, not a blank "new chat".
  const showError = isError && !chatGone && messages.length === 0;
  // Hold the spinner while redirecting away from a deleted chat so the error/empty states never flash.
  const showLoading = (isLoading || chatGone) && messages.length === 0;
  const showEmpty = !showLoading && !showError && messages.length === 0;
  return (
    <View className="flex-1 bg-background">
      {/* Body fills the screen edge-to-edge; the FloatingHeader orbs float on top, and the list's top inset pushes the first message clear of them so content scrolls under the orbs (Apple HIG topmost-layer pattern). */}
      <View className="flex-1">
        {showLoading ? (
          <View className="flex-1 items-center justify-center">
            <Spinner />
          </View>
        ) : showError ? (
          <View
            className="flex-1 items-center justify-center px-8"
            style={{ paddingTop: listTopInset }}
          >
            <Text className="font-sans text-base text-muted-foreground text-center">
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
      <FloatingHeader chatId={chatId} />
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
      <ChatHistorySheet
        visible={chatHistoryOpen}
        onClose={closeChatHistory}
        onSelectChat={handleSelectChat}
        onNewChat={handleNewChat}
        currentChatId={chatId}
      />
      <ModelPickerSheet
        visible={modelPickerOpen}
        onClose={closeModelPicker}
        chatId={chatId}
      />
      <AccountSheet
        visible={accountOpen}
        onClose={closeAccount}
        onChangeModel={switchToModelPickerFromAccount}
      />
      <AttachSheet
        visible={attachOpen}
        onClose={closeAttach}
        onReopen={openAttach}
        onAttach={handleAttachResult}
        currentCount={attachments.length}
        chatId={chatId}
      />
      <UpgradePromptModal
        visible={upgradeModalOpen}
        modelName={upgradeModelName}
        onClose={closeUpgradeModal}
        onPickAnotherModel={pickAnotherFromUpgrade}
      />
    </View>
  );
}
