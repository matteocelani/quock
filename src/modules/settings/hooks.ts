// Orchestrates the Settings "Clear all chats" flow: chooser open state, the per-account vs device-wide wipe, and
// the result toast. Extracted from SettingsView so the view stays under the size budget; composes the chat hooks.

import { useCallback, useMemo, useRef, useState } from "react";
import { useChats } from "@/modules/chat/hooks/useChats";
import { useClearAllChats } from "@/modules/chat/hooks/useClearAllChats";
import {
  useDeleteDeviceData,
  useGetDeviceStorageBytes,
} from "@/modules/chat/hooks/useDeviceStorage";
import { useToast } from "@/lib/hooks/useToast";

export interface UseClearChatsResult {
  isChooserOpen: boolean;
  openChooser: () => void;
  closeChooser: () => void;
  clearMine: () => void;
  clearDevice: () => void;
  // This account's chat bytes (the sidebar figure) and the device-wide total across every account.
  totalChatBytes: number;
  deviceBytes: number;
}

export function useClearChats(): UseClearChatsResult {
  const [isChooserOpen, setIsChooserOpen] = useState<boolean>(false);
  const { clearAll } = useClearAllChats();
  const { clearDeviceData } = useDeleteDeviceData();
  // Same `useChats` cache as the sidebar list — figure stays in sync after delete/rename without an extra query.
  const chatsQuery = useChats();
  const totalChatBytes = useMemo(
    () => (chatsQuery.data ?? []).reduce((sum, c) => sum + c.sizeBytes, 0),
    [chatsQuery.data],
  );
  // Device-wide total (all accounts) for the "clear all data" confirm + row.
  const deviceBytes = useGetDeviceStorageBytes().data ?? 0;
  const toast = useToast();
  const openChooser = useCallback((): void => {
    setIsChooserOpen(true);
  }, []);
  const closeChooser = useCallback((): void => {
    setIsChooserOpen(false);
  }, []);
  // clearAll/clearDeviceData (react-query mutations) + toast get a fresh identity each render. Behind refs so the
  // chooser node published to AccountSheet keeps a stable identity — otherwise the publish effect loops forever.
  const clearAllRef = useRef(clearAll);
  const clearDeviceDataRef = useRef(clearDeviceData);
  const toastRef = useRef(toast);
  clearAllRef.current = clearAll;
  clearDeviceDataRef.current = clearDeviceData;
  toastRef.current = toast;
  // The chooser IS the confirmation, so a choice deletes straight away — no second dialog.
  const clearMine = useCallback((): void => {
    setIsChooserOpen(false);
    void (async (): Promise<void> => {
      try {
        await clearAllRef.current();
        toastRef.current({ title: "My chats cleared", tone: "success" });
      } catch (err) {
        console.warn("useClearChats: failed to clear chats", err);
        toastRef.current({ title: "Could not clear chats", tone: "error" });
      }
    })();
  }, []);
  const clearDevice = useCallback((): void => {
    setIsChooserOpen(false);
    void (async (): Promise<void> => {
      try {
        await clearDeviceDataRef.current();
        toastRef.current({
          title: "All chats cleared on this device",
          tone: "success",
        });
      } catch (err) {
        console.warn("useClearChats: failed to clear device data", err);
        toastRef.current({ title: "Could not clear chats", tone: "error" });
      }
    })();
  }, []);
  return useMemo<UseClearChatsResult>(
    () => ({
      isChooserOpen,
      openChooser,
      closeChooser,
      clearMine,
      clearDevice,
      totalChatBytes,
      deviceBytes,
    }),
    [
      isChooserOpen,
      openChooser,
      closeChooser,
      clearMine,
      clearDevice,
      totalChatBytes,
      deviceBytes,
    ],
  );
}
