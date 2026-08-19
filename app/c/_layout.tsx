// The drawer and the floating orbs live HERE, above the router. Inside a screen they died with it: picking a chat
// replaced the route, so the open drawer unmounted and a closed one took its place — a cut, not a transition.

import { Slot, useGlobalSearchParams, useRouter } from "expo-router";
import React, { useCallback } from "react";
import { View } from "react-native";
import { useSharedValue } from "react-native-reanimated";
import { AccountSheet } from "@/components/settings/AccountSheet";
import { ChatHistoryPanel } from "@/components/chat/ChatHistoryPanel";
import { FloatingHeader } from "@/components/layout/FloatingHeader";
import { ModelPickerSheet } from "@/components/models/ModelPickerSheet";
import { Drawer } from "@/components/ui/Drawer";
import { useUIStore } from "@/lib/stores/ui.store";
import { asChatId, type ChatId } from "@/lib/types/ids";

export default function ChatSectionLayout(): React.ReactElement {
  const router = useRouter();
  // Null on `/c`, the route that creates a chat and redirects: the orbs stay up through that moment rather than
  // blinking out of existence mid-animation.
  const { chatId: rawChatId } = useGlobalSearchParams<{ chatId?: string }>();
  const chatId: ChatId | null =
    rawChatId === undefined || rawChatId === "" ? null : asChatId(rawChatId);
  // One value for the whole choreography: the page travels on it and the header's icon reads it, so a drag can never
  // move one without the other. 0 closed, 1 open.
  const drawerProgress = useSharedValue<number>(0);
  const isDrawerOpen = useUIStore((s) => s.chatHistoryOpen);
  const modelPickerOpen = useUIStore((s) => s.modelPickerOpen);
  const accountOpen = useUIStore((s) => s.accountOpen);
  const closeModelPicker = useUIStore((s) => s.closeModelPicker);
  const closeAccount = useUIStore((s) => s.closeAccount);
  const switchToModelPickerFromAccount = useUIStore(
    (s) => s.switchToModelPickerFromAccount,
  );
  const openChatHistory = useUIStore((s) => s.openChatHistory);
  const closeChatHistory = useUIStore((s) => s.closeChatHistory);
  const handleOpenChange = useCallback(
    (shouldOpen: boolean): void => {
      if (shouldOpen) openChatHistory();
      else closeChatHistory();
    },
    [openChatHistory, closeChatHistory],
  );
  // Navigate FIRST, then close: the new chat mounts behind a panel that still covers the screen, so the slide reveals
  // it already loaded instead of revealing the old one and swapping under the user's eyes.
  const handleSelectChat = useCallback(
    (selectedId: ChatId): void => {
      router.replace(`/c/${selectedId}`);
      closeChatHistory();
    },
    [router, closeChatHistory],
  );
  const handleNewChat = useCallback((): void => {
    router.replace("/c");
    closeChatHistory();
  }, [router, closeChatHistory]);
  return (
    <View className="flex-1 bg-background">
      <Drawer
        progress={drawerProgress}
        isOpen={isDrawerOpen}
        onOpenChange={handleOpenChange}
        panel={
          <ChatHistoryPanel
            isOpen={isDrawerOpen}
            onClose={closeChatHistory}
            onSelectChat={handleSelectChat}
            onNewChat={handleNewChat}
            {...(chatId !== null ? { currentChatId: chatId } : {})}
          />
        }
      >
        <Slot />
      </Drawer>
      {/* Outside the drawer on purpose: the orbs stay anchored while the page slides out from under them, which is what
          turns a panel that merely appears into one the screen makes room for. */}
      <FloatingHeader chatId={chatId} drawerProgress={drawerProgress} />
      {/* These two belong to the header, not to the screen: on `/c` the screen does not exist yet, and a sheet mounted
          there would leave the orbs raising a flag nobody renders — then fire it late on the next chat. */}
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
    </View>
  );
}
