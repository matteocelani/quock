// The Settings "Answer notifications" switch: asks iOS when turned on and stays in step with the real permission.
// Extracted from SettingsView so the view stays under the size budget.

import { useCallback, useEffect } from "react";
import { AppState } from "react-native";
import { useToast } from "@/lib/hooks/useToast";
import { useSettingsStore } from "@/lib/stores/settings.store";
import {
  hasAnswerNotificationPermission,
  requestAnswerNotificationPermission,
} from "@/modules/chat/lib/answerNotification";

export interface UseAnswerNotificationSettingResult {
  isEnabled: boolean;
  onChange: (next: boolean) => void;
}

export function useAnswerNotificationSetting(): UseAnswerNotificationSettingResult {
  const isEnabled = useSettingsStore((s) => s.isAnswerNotificationEnabled);
  const setEnabled = useSettingsStore((s) => s.setAnswerNotificationEnabled);
  const toast = useToast();
  // iOS asks only once, so after a denial the toast is the one way back to the permission.
  const onChange = useCallback(
    (next: boolean): void => {
      if (!next) {
        setEnabled(false);
        return;
      }
      requestAnswerNotificationPermission()
        .then((isGranted) => {
          setEnabled(isGranted);
          if (!isGranted) {
            toast({ title: "Allow notifications for Quock in iOS Settings." });
          }
        })
        .catch((err: unknown) => {
          console.warn("[settings] notification permission failed:", err);
          setEnabled(false);
          toast({ title: "Couldn't turn on notifications.", tone: "error" });
        });
    },
    [setEnabled, toast],
  );
  // A permission revoked in iOS Settings, or a backup restored onto a new phone, would leave the switch promising a
  // banner iOS drops. Checked on open and on every return from iOS Settings.
  useEffect(() => {
    if (!isEnabled) return undefined;
    const syncWithPermission = (): void => {
      hasAnswerNotificationPermission()
        .then((isAllowed) => {
          if (!isAllowed) setEnabled(false);
        })
        .catch((err: unknown) => {
          console.warn("[settings] notification permission check failed:", err);
        });
    };
    syncWithPermission();
    const subscription = AppState.addEventListener("change", (state) => {
      if (state === "active") syncWithPermission();
    });
    return () => subscription.remove();
  }, [isEnabled, setEnabled]);
  return { isEnabled, onChange };
}
