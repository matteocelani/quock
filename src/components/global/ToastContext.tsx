// Toast viewport — renders the top-most queued item from `useToastStore`. Mounted once in `_layout.tsx`. Apple-style floating pill: bg-card surface, soft shadow, tone-coloured Lucide icon + title.

import clsx from "clsx";
import {
  AlertTriangle,
  Check,
  Info,
  XCircle,
  type LucideIcon,
} from "lucide-react-native";
import React, { useEffect, useState } from "react";
import { Text, View } from "react-native";
import Animated, { useAnimatedStyle } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useFadeProgress } from "@/lib/hooks/useFadeProgress";
import { useThemeColors } from "@/lib/theme/ThemeContext";
import { baseAnimationDurationMs } from "@/lib/design/motion";
import { componentLayout, iconSize, shadow, strokeWidth, zLayer } from "@/lib/design/tokens";
import { useToastStore, type ToastItem, type ToastTone } from "@/lib/stores/toast.store";
import { useUIStore } from "@/lib/stores/ui.store";

const T = componentLayout.toast;

export type {
  ToastItem,
  ToastOptions,
  ToastTone,
} from "@/lib/stores/toast.store";

const TONE_ICON: Record<ToastTone, LucideIcon> = {
  info: Info,
  success: Check,
  warning: AlertTriangle,
  error: XCircle,
};

export interface ToastViewportProps {
  // Hosted inside a Sheet's Modal: anchor just below the Dynamic Island (no FloatingHeader exists over a sheet);
  // the chat-tree viewport keeps its FloatingHeader anchor.
  inSheet?: boolean;
}
// Renders only the top-most active toast, top-anchored (under the FloatingHeader in chat, below the safe area over a sheet).
export function ToastViewport({
  inSheet = false,
}: ToastViewportProps): React.ReactElement | null {
  // Latest-wins: a new toast supersedes the visible one. `shown` lags `target` by one fade so a replacement reads as
  // a clean disappear → reappear, not a text morph in place.
  const target = useToastStore((s) => s.items[s.items.length - 1]);
  const sheetOpen = useUIStore((s) => s.openSheetCount > 0);
  const colors = useThemeColors();
  const insets = useSafeAreaInsets();
  const [shown, setShown] = useState<ToastItem | undefined>(target);
  const [visible, setVisible] = useState<boolean>(target !== undefined);
  const progress = useFadeProgress(visible);
  const animatedStyle = useAnimatedStyle(() => ({
    opacity: progress.value,
    // Slide down from above the resting position as progress climbs from 0 → 1.
    transform: [
      { translateY: -T.slideDistance + progress.value * T.slideDistance },
    ],
  }));
  useEffect(() => {
    if (target?.id === shown?.id) return;
    // Nothing painted yet → bring the new toast straight in.
    if (shown === undefined) {
      setShown(target);
      setVisible(true);
      return;
    }
    // A different toast (or none) is current: fade the old out, then swap + fade the new in once the exit completes.
    setVisible(false);
    const t = setTimeout(() => {
      setShown(target);
      setVisible(target !== undefined);
    }, baseAnimationDurationMs);
    return (): void => clearTimeout(t);
  }, [target, shown]);
  if (!shown) {
    return null;
  }
  // A sheet Modal is up: only the sheet-hosted viewport (inSheet) paints. The main-tree one would bleed through the scrim blur as a faded duplicate.
  if (!inSheet && sheetOpen) {
    return null;
  }
  // Chat: land below the FloatingHeader (safe-area + topGap + orb row + gap). Over a sheet there is no header,
  // so anchor just below the Dynamic Island instead.
  const toastTop = inSheet
    ? insets.top + T.topOffset
    : insets.top +
      componentLayout.floatingHeader.topGap +
      componentLayout.floatingHeader.orbHeight +
      T.topOffset;
  const toneColor =
    shown.tone === "success"
      ? colors.green
      : shown.tone === "error"
        ? colors.destructive
        : shown.tone === "warning"
          ? colors.orange
          : colors.foreground;
  const ToneIcon = TONE_ICON[shown.tone];
  return (
    <Animated.View
      pointerEvents="none"
      // Centered pill — the wrapper drives positioning; the pill itself wraps to its content width.
      style={[
        {
          position: "absolute",
          left: 0,
          right: 0,
          top: toastTop,
          zIndex: zLayer.toast,
          alignItems: "center",
        },
        animatedStyle,
      ]}
    >
      <View
        className="bg-card rounded-full flex-row items-center px-4 py-2.5 border border-border"
        style={{
          shadowColor: colors.shadow,
          shadowOpacity: shadow.dialog.opacity,
          shadowRadius: shadow.dialog.radius,
          shadowOffset: { width: 0, height: shadow.dialog.offsetY },
          elevation: shadow.dialog.elevation,
        }}
      >
        <ToneIcon
          size={iconSize.md}
          color={toneColor}
          strokeWidth={strokeWidth.bold}
        />
        <View className="ml-2 max-w-65">
          <Text
            className={clsx(
              "text-sm font-sans font-medium text-foreground",
            )}
            numberOfLines={1}
          >
            {shown.title}
          </Text>
          {shown.description !== undefined ? (
            <Text
              className="mt-0.5 text-xs font-sans text-muted-foreground"
              numberOfLines={2}
            >
              {shown.description}
            </Text>
          ) : null}
        </View>
      </View>
    </Animated.View>
  );
}
