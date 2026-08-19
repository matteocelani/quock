// The chat list, as the drawer's panel: search + bucketed ChatRow list with swipe rename/delete. Same content the
// history sheet used to hold, minus the sheet — it now lives behind the screen instead of over it.

import clsx from "clsx";
import React, { useCallback, useMemo, useRef, useState } from "react";
import { ScrollView, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { type SwipeableMethods } from "react-native-gesture-handler/ReanimatedSwipeable";
import { PenLine } from "lucide-react-native";
import { ChatRow } from "@/components/chat/ChatRow";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { GlassOrb } from "@/components/ui/GlassOrb";
import { SearchInput } from "@/components/ui/SearchInput";
import { ScrollEdgeBlur } from "@/components/ui/ScrollEdgeBlur";
import { SheetHeader } from "@/components/ui/SheetHeader";
import { useDb } from "@/lib/contexts/DbContext";
import { useThemeColors } from "@/lib/theme/ThemeContext";
import { withAlpha } from "@/lib/design/color";
import { componentLayout, iconSize, opacity } from "@/lib/design/tokens";
import { useChats } from "@/modules/chat/hooks/useChats";
import { useDeleteChat } from "@/modules/chat/hooks/useDeleteChat";
import { useRenameChat } from "@/modules/chat/hooks/useRenameChat";
import { useToast } from "@/lib/hooks/useToast";
import {
  formatRelativeTimestamp,
  groupChats,
  type Bucket,
} from "@/modules/chat/lib/chatTimestamp";
import type { ChatId } from "@/lib/types/ids";

export interface ChatHistoryPanelProps {
  // Drives the empty-draft sweep only; the panel itself is always mounted behind the screen.
  isOpen: boolean;
  onClose: () => void;
  onSelectChat: (chatId: ChatId) => void;
  onNewChat: () => void;
  // Excluded from `deleteEmpty()` so the currently-open empty chat is not removed under the Composer's feet.
  currentChatId?: ChatId;
}

export function ChatHistoryPanel({
  isOpen,
  onClose,
  onSelectChat,
  onNewChat,
  currentChatId,
}: ChatHistoryPanelProps): React.ReactElement {
  const chatsQuery = useChats();
  const deleteChat = useDeleteChat();
  const renameChat = useRenameChat();
  const toast = useToast();
  const db = useDb();
  const colors = useThemeColors();
  const insets = useSafeAreaInsets();
  const [query, setQuery] = useState<string>("");
  const [pendingDelete, setPendingDelete] = useState<ChatId | null>(null);
  const [renamingId, setRenamingId] = useState<ChatId | null>(null);
  const [renameValue, setRenameValue] = useState<string>("");
  // Sweep empty drafts on each open since /c creates a row on every new-chat tap.
  React.useEffect(() => {
    if (!isOpen) return;
    void db.chats
      .deleteEmpty(currentChatId)
      .then((removed) => {
        if (removed > 0) void chatsQuery.refetch();
      })
      .catch((err: unknown) => {
        console.warn("ChatHistoryPanel: deleteEmpty failed", err);
      });
  }, [isOpen, db.chats, chatsQuery, currentChatId]);
  const buckets = useMemo<Bucket[]>(() => {
    const raw = chatsQuery.data ?? [];
    // Defense-in-depth: skip rows with empty title AND excerpt even before deleteEmpty runs.
    const nonEmpty = raw.filter(
      (c) => c.title.trim().length > 0 || c.excerpt.trim().length > 0,
    );
    const trimmed = query.trim().toLowerCase();
    const filtered =
      trimmed.length === 0
        ? nonEmpty
        : nonEmpty.filter(
            (c) =>
              c.title.toLowerCase().includes(trimmed) ||
              c.excerpt.toLowerCase().includes(trimmed),
          );
    return groupChats(filtered);
  }, [chatsQuery.data, query]);
  // Pin `now` to dataUpdatedAt so timestamps don't tick mid-session but stay accurate across refetches.
  const dataUpdatedAt = chatsQuery.dataUpdatedAt;
  const now = useMemo<Date>(
    () => new Date(dataUpdatedAt > 0 ? dataUpdatedAt : Date.now()),
    [dataUpdatedAt],
  );
  const handleSelect = useCallback(
    (id: ChatId): void => {
      onSelectChat(id);
      onClose();
    },
    [onSelectChat, onClose],
  );
  // iOS Mail / Messages pattern — only one row's action rail open at a time.
  const openSwipeableRef = useRef<SwipeableMethods | null>(null);
  const handleSwipeOpen = useCallback(
    (swipeable: SwipeableMethods | null): void => {
      const prev = openSwipeableRef.current;
      if (prev && prev !== swipeable) {
        prev.close();
      }
      openSwipeableRef.current = swipeable;
    },
    [],
  );
  // Reset on dialog dismiss; otherwise handleSwipeOpen's equality check short-circuits the next swipe of the same row.
  const clearOpenSwipeable = useCallback((): void => {
    openSwipeableRef.current = null;
  }, []);
  const handleNew = useCallback((): void => {
    // Delegate creation to the `/c` route so exactly one chat row is created per tap.
    onNewChat();
    onClose();
  }, [onNewChat, onClose]);
  // Confirmation acts as a safety net until the undo-toast UX lands.
  const handleDelete = useCallback((id: ChatId): void => {
    setPendingDelete(id);
  }, []);
  const confirmDeleteNow = useCallback((): void => {
    if (pendingDelete === null) return;
    const id = pendingDelete;
    setPendingDelete(null);
    deleteChat.mutate(id, {
      onSuccess: () => {
        toast({ title: "Chat deleted", tone: "success" });
      },
      onError: (err: Error) => {
        console.warn("ChatHistoryPanel: failed to delete", err);
        toast({ title: "Could not delete chat", tone: "error" });
      },
    });
  }, [deleteChat, pendingDelete, toast]);
  const handleRename = useCallback((id: ChatId, currentTitle: string): void => {
    setRenamingId(id);
    setRenameValue(currentTitle);
  }, []);
  const trimmedRename = renameValue.trim();
  const confirmRenameNow = useCallback((): void => {
    if (renamingId === null || trimmedRename.length === 0) return;
    const id = renamingId;
    setRenamingId(null);
    renameChat.mutate(
      { id, title: trimmedRename },
      {
        onSuccess: () => {
          toast({ title: "Chat renamed", tone: "success" });
        },
        onError: (err: Error) => {
          console.warn("ChatHistoryPanel: failed to rename", err);
          toast({ title: "Could not rename chat", tone: "error" });
        },
      },
    );
  }, [renameChat, renamingId, toast, trimmedRename]);
  return (
    <View
      className="flex-1 bg-background"
      // Starts below the floating orbs, not under them: they stay anchored while this page slides in, so the same inset
      // the message list uses to clear them applies here — otherwise the title and the search field sit beneath glass.
      style={{ paddingTop: insets.top + componentLayout.floatingHeader.height }}
    >
      <SheetHeader title="Chats" />
      <View
        className="flex-row items-center gap-2 pb-3"
        // Control row shares the 16pt list grid with the headers/rows below (px-4 renders 14 at the 14px rem).
        style={{ paddingHorizontal: componentLayout.listSection.insetX }}
      >
        <View className="flex-1">
          <SearchInput
            value={query}
            onChangeText={setQuery}
            placeholder="Search chats"
            testID="chats-search"
          />
        </View>
        <GlassOrb
          variant="regular"
          interactive
          onPress={handleNew}
          tintColor={withAlpha(colors.primary, opacity.tint)}
          borderRadius={999}
          accessibilityLabel="New chat"
          testID="chats-new"
        >
          <View className="w-8.5 h-8.5 items-center justify-center">
            <PenLine size={iconSize.lg} color={colors.primaryForeground} />
          </View>
        </GlassOrb>
      </View>
      {buckets.length === 0 ? (
        <View className="flex-1 px-4 py-10 items-center">
          <Text className="font-sans font-semibold text-body text-foreground text-center mb-1">
            {query.trim().length > 0
              ? `No chats match "${query.trim()}"`
              : "No chats yet"}
          </Text>
          <Text className="font-sans text-footnote text-muted-foreground text-center">
            {query.trim().length > 0
              ? "Try a different search term"
              : "Tap the compose button to start a conversation"}
          </Text>
        </View>
      ) : (
        <ScrollView
          className="flex-1"
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          // Runs to the very bottom edge and pads past it, so the last row can scroll clear of the blur instead of
          // ending underneath it.
          contentContainerStyle={{
            paddingBottom:
              insets.bottom + componentLayout.drawer.listFadeHeight,
          }}
        >
          <View>
            {buckets.map((bucket, bucketIndex) => {
              return (
                <View key={bucket.label}>
                  <Text
                    // Below the kit's Body-17-semibold section header on purpose: chat titles are 17 themselves, so a
                    // header at that size matches its content and the page flattens. 16pt inset shared with the rows.
                    className={clsx(
                      "font-sans font-semibold text-footnote text-label-tertiary mb-2",
                      bucketIndex === 0 ? "mt-4.5" : "mt-6",
                    )}
                    style={{ paddingLeft: componentLayout.listSection.insetX }}
                  >
                    {bucket.label}
                  </Text>
                  {bucket.rows.map((chat) => {
                    return (
                      <ChatRow
                        key={chat.id}
                        chat={chat}
                        // No hairlines here: the bucket headings already group the rows, and a full-bleed line is the
                        // one element that stays pin-sharp while the page scales, so it fights the arrival.
                        showDivider={false}
                        trailingMeta={formatRelativeTimestamp(
                          chat.updatedAt,
                          now,
                        )}
                        onTap={handleSelect}
                        onDelete={handleDelete}
                        onRename={handleRename}
                        onSwipeOpen={handleSwipeOpen}
                      />
                    );
                  })}
                </View>
              );
            })}
          </View>
        </ScrollView>
      )}
      <ScrollEdgeBlur
        edge="bottom"
        height={insets.bottom + componentLayout.drawer.listFadeHeight}
        intensity={componentLayout.scrollEdgeBlur.intensity}
      />
      <ConfirmDialog
        visible={pendingDelete !== null}
        title="Delete chat?"
        message="This will permanently remove the conversation from this device."
        destructive
        confirmLabel="Delete"
        onConfirm={(): void => {
          clearOpenSwipeable();
          confirmDeleteNow();
        }}
        onCancel={(): void => {
          clearOpenSwipeable();
          setPendingDelete(null);
        }}
      />
      <ConfirmDialog
        visible={renamingId !== null}
        title="Rename chat"
        confirmLabel="Rename"
        confirmDisabled={trimmedRename.length === 0}
        inputValue={renameValue}
        onChangeInput={setRenameValue}
        inputPlaceholder="Chat title"
        onConfirm={(): void => {
          clearOpenSwipeable();
          confirmRenameNow();
        }}
        onCancel={(): void => {
          clearOpenSwipeable();
          setRenamingId(null);
        }}
      />
    </View>
  );
}
