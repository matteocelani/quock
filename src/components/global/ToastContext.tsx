// Toast viewport — renders the top-most queued item from `useToastStore`. Mounted once in `_layout.tsx`. Apple-style floating pill: bg-card surface, soft shadow, tone-coloured Lucide icon + title.

import clsx from "clsx";
import {
  AlertCircle,
  AlertTriangle,
  Check,
  Info,
  type LucideIcon,
} from "lucide-react-native";
import React from "react";
import { Text, View } from "react-native";
import Animated, { useAnimatedStyle } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useFadeProgress } from "@/lib/hooks/useFadeProgress";
import { useThemeColors } from "@/lib/theme/ThemeContext";
import { componentLayout, iconSize, shadow, strokeWidth, zLayer } from "@/lib/design/tokens";
import { useToastStore, type ToastTone } from "@/lib/stores/toast.store";

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
  error: AlertCircle,
};

// Renders only the top-most active toast, top-anchored just under the FloatingHeader orb row, animated with the design spring.
export function ToastViewport(): React.ReactElement | null {
  const top = useToastStore((s) => s.items[0]);
  const colors = useThemeColors();
  const isVisible = top !== undefined;
  const insets = useSafeAreaInsets();
  const progress = useFadeProgress(isVisible);
  const animatedStyle = useAnimatedStyle(() => ({
    opacity: progress.value,
    // Slide down from above the resting position as progress climbs from 0 → 1.
    transform: [
      { translateY: -T.slideDistance + progress.value * T.slideDistance },
    ],
  }));
  if (!top) {
    return null;
  }
  // Land exactly below the FloatingHeader: safe-area + topGap + orb row + a small breathing gap.
  const toastTop =
    insets.top +
    componentLayout.floatingHeader.topGap +
    componentLayout.floatingHeader.orbHeight +
    T.topOffset;
  const toneColor =
    top.tone === "success"
      ? colors.green
      : top.tone === "error"
        ? colors.destructive
        : top.tone === "warning"
          ? colors.orange
          : colors.foreground;
  const ToneIcon = TONE_ICON[top.tone];
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
            {top.title}
          </Text>
          {top.description !== undefined ? (
            <Text
              className="mt-0.5 text-xs font-sans text-muted-foreground"
              numberOfLines={2}
            >
              {top.description}
            </Text>
          ) : null}
        </View>
      </View>
    </Animated.View>
  );
}
