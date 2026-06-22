// Chat-history sheet — search + bucketed ChatRow list with swipe rename/delete.

import clsx from "clsx";
import React, { useCallback, useMemo, useRef, useState } from "react";
import { ScrollView, Text, View } from "react-native";
import { type SwipeableMethods } from "react-native-gesture-handler/ReanimatedSwipeable";
import { ChatRow } from "@/components/chat/ChatRow";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { PenLine } from "lucide-react-native";
import { GlassOrb } from "@/components/ui/GlassOrb";
import { SearchInput } from "@/components/ui/SearchInput";
import { Sheet } from "@/components/ui/Sheet";
import { SheetHeader } from "@/components/ui/SheetHeader";
import { useDb } from "@/lib/contexts/DbContext";
import { useThemeColors } from "@/lib/theme/ThemeContext";
import { withAlpha } from "@/lib/design/color";
import { iconSize, opacity } from "@/lib/design/tokens";
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
import { CHAT_HISTORY_SHEET_SNAP } from "@/modules/chat/constants";

export interface ChatHistorySheetProps {
  visible: boolean;
  onClose: () => void;
  onSelectChat: (chatId: ChatId) => void;
  onNewChat: () => void;
  // Excluded from `deleteEmpty()` so the currently-open empty chat is not removed under the Composer's feet.
  currentChatId?: ChatId;
}

export function ChatHistorySheet({
  visible,
  onClose,
  onSelectChat,
  onNewChat,
  currentChatId,
}: ChatHistorySheetProps): React.ReactElement {
  const chatsQuery = useChats();
  const deleteChat = useDeleteChat();
  const renameChat = useRenameChat();
  const toast = useToast();
  const db = useDb();
  const colors = useThemeColors();
  const [query, setQuery] = useState<string>("");
  const [pendingDelete, setPendingDelete] = useState<ChatId | null>(null);
  const [renamingId, setRenamingId] = useState<ChatId | null>(null);
  const [renameValue, setRenameValue] = useState<string>("");
  // Sweep empty drafts on each open since /c creates a row on every new-chat tap.
  React.useEffect(() => {
    if (!visible) return;
    void db.chats
      .deleteEmpty(currentChatId)
      .then((removed) => {
        if (removed > 0) void chatsQuery.refetch();
      })
      .catch((err: unknown) => {
        console.error("ChatHistorySheet: deleteEmpty failed", err);
      });
  }, [visible, db.chats, chatsQuery, currentChatId]);
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
        console.error("ChatHistorySheet: failed to delete", err);
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
          console.error("ChatHistorySheet: failed to rename", err);
          toast({ title: "Could not rename chat", tone: "error" });
        },
      },
    );
  }, [renameChat, renamingId, toast, trimmedRename]);
  return (
    <Sheet
      visible={visible}
      onClose={onClose}
      snapPoints={[CHAT_HISTORY_SHEET_SNAP]}
      overlays={
        <>
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
        </>
      }
    >
      <SheetHeader title="Chats" />
      <View className="flex-row items-center gap-2 px-4 pb-3 border-b border-border">
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
          <Text className="font-sans text-muted-foreground text-sm text-center mb-1">
            {query.trim().length > 0
              ? `No chats match "${query.trim()}"`
              : "No chats yet"}
          </Text>
          <Text className="font-mono text-xs text-muted-foreground uppercase tracking-widest text-center">
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
        >
          <View className="pb-6">
            {buckets.map((bucket, bucketIndex) => {
              const isLastBucket = bucketIndex === buckets.length - 1;
              return (
                <View key={bucket.label}>
                  <Text
                    className={clsx(
                      "font-mono text-sm text-muted-foreground uppercase tracking-widest mb-1.5 pl-4.5",
                      bucketIndex === 0 ? "mt-4.5" : "mt-6",
                    )}
                  >
                    {bucket.label}
                  </Text>
                  {bucket.rows.map((chat, index) => {
                    const isLastRowInBucket = index === bucket.rows.length - 1;
                    // Divider between every adjacent row, including bucket boundaries; suppress only on the last row.
                    const showDivider = !(isLastBucket && isLastRowInBucket);
                    return (
                      <ChatRow
                        key={chat.id}
                        chat={chat}
                        showDivider={showDivider}
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
    </Sheet>
  );
}
