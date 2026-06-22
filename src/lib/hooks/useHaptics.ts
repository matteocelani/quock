// Thin wrapper over expo-haptics that no-ops on web and honours the `hapticsEnabled` preference from `useSettingsStore`. Reading the store reactively means a toggle in Settings updates every consumer on the next frame, no remount required.

import * as Haptics from "expo-haptics";
import React from "react";
import { Platform } from "react-native";
import { useSettingsStore } from "@/lib/stores/settings.store";

export interface UseHapticsResult {
  light: () => void;
  medium: () => void;
  heavy: () => void;
  success: () => void;
  warning: () => void;
  error: () => void;
  selection: () => void;
}

const NOOP_RESULT: UseHapticsResult = {
  light: () => {},
  medium: () => {},
  heavy: () => {},
  success: () => {},
  warning: () => {},
  error: () => {},
  selection: () => {},
};
// Web / RN-web does not implement Haptics; we gate at module level so call sites stay one-line.
const IS_HAPTICS_SUPPORTED = Platform.OS === "ios" || Platform.OS === "android";
function safeCall(fn: () => Promise<void>): void {
  fn().catch((err: unknown) => {
    // Haptics is ergonomic-only; failures are warned but never bubble.
    console.warn("Haptics failed:", err);
  });
}

export function useHaptics(): UseHapticsResult {
  const isEnabled = useSettingsStore((s) => s.hapticsEnabled);
  return React.useMemo<UseHapticsResult>(() => {
    if (!IS_HAPTICS_SUPPORTED || !isEnabled) {
      return NOOP_RESULT;
    }
    return {
      light: () =>
        safeCall(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)),
      medium: () =>
        safeCall(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)),
      heavy: () =>
        safeCall(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy)),
      success: () =>
        safeCall(() =>
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success),
        ),
      warning: () =>
        safeCall(() =>
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning),
        ),
      error: () =>
        safeCall(() =>
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error),
        ),
      selection: () => safeCall(() => Haptics.selectionAsync()),
    };
  }, [isEnabled]);
}
