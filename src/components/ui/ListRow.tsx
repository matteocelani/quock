// Sheet list row primitive — leading + label + chips/subtitle + trailing, with optional hairline.

import React, { type ReactNode, useEffect } from "react";
import {
  Pressable as RNPressable,
  StyleSheet,
  Text,
  View,
  type ViewStyle,
} from "react-native";
import clsx from "clsx";
import { type LucideIcon } from "lucide-react-native";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";
import { useThemeColors } from "@/lib/theme/ThemeContext";
import { baseAnimationDurationMs, springEasing } from "@/lib/design/motion";
import { iconSize, strokeWidth, timingsNamed } from "@/lib/design/tokens";

export type ListRowChipTone = "neutral" | "accent";
export interface ListRowChip {
  label: string;
  tone?: ListRowChipTone;
  icon?: LucideIcon;
}

export interface ListRowProps {
  // Lucide icon component (or any compatible component with the same prop API). Use the `leading` slot for non-Lucide brand glyphs.
  icon?: LucideIcon;
  /** Custom node in the leading slot. Takes precedence over `icon` when both are passed. */
  leading?: ReactNode;
  label: string;
  subtitle?: string;
  /** Compact pill chips rendered below the label. Strings render with the neutral tone; pass descriptors to opt into the accent tone or attach a leading icon. */
  chips?: readonly (string | ListRowChip)[];
  trailing?: ReactNode;
  /** Tiny mono caption rendered top-right of the row (e.g. relative timestamp). */
  trailingMeta?: string;
  onPress?: () => void;
  destructive?: boolean;
  showDivider?: boolean;
  /** Render subtitle at the tiny `text-xs` scale instead of the default `sm`. Used where the subtitle is supporting metadata (e.g. a byte-size string), not real content. */
  subtitleTiny?: boolean;
  /** Center the leading slot vertically against the full content block. Useful when the row stacks title + chips + subtitle and a radio/checkbox would otherwise sit aligned to the title only. */
  centerLeading?: boolean;
  /** Pin a minimum content height so multi-line rows render at a fixed height instead of varying with the chip/subtitle presence. */
  minRowHeight?: number;
  /** When true, the visual order becomes label → subtitle → chips (mirrors the ollama.com model card stack). Default is label → chips → subtitle, which is the long-standing settings-row order. */
  chipsBelowSubtitle?: boolean;
  /** Max lines for the subtitle. Defaults to 1; pass 2-3 for the Ollama-style model card where descriptions can run long. */
  subtitleNumberOfLines?: number;
  /** Fade the trailing meta caption to 0. Used by ChatRow during a swipe so the timestamp doesn't visually clash with the revealed action buttons. */
  hideTrailingMeta?: boolean;
  testID?: string;
}

function ListRowImpl({
  icon: IconComponent,
  leading,
  label,
  subtitle,
  chips,
  trailing,
  trailingMeta,
  onPress,
  destructive = false,
  showDivider = true,
  subtitleTiny = false,
  centerLeading = false,
  minRowHeight,
  chipsBelowSubtitle = false,
  subtitleNumberOfLines = 1,
  hideTrailingMeta = false,
  testID,
}: ListRowProps): React.ReactElement {
  const colors = useThemeColors();
  const labelColor = destructive ? "text-destructive" : "text-foreground";
  const iconColor = destructive ? colors.destructive : colors.foreground;
  // `leading` wins over `icon` so model-row radios sit in the same slot settings-row icons do.
  const leadingNode =
    leading ??
    (IconComponent ? (
      <IconComponent size={iconSize.xl} color={iconColor} />
    ) : null);
  // ChatRow toggles this during swipe so the timestamp doesn't overlap the revealed action buttons.
  const trailingMetaOpacity = useSharedValue(hideTrailingMeta ? 0 : 1);
  useEffect(() => {
    trailingMetaOpacity.value = withTiming(hideTrailingMeta ? 0 : 1, {
      duration: timingsNamed.trailingFade,
    });
  }, [hideTrailingMeta, trailingMetaOpacity]);
  const trailingMetaAnimStyle = useAnimatedStyle(() => ({
    opacity: trailingMetaOpacity.value,
  }));
  // `centerLeading` centers a radio/checkbox against the full label+chips+subtitle stack rather than just the label.
  const alignmentClass = centerLeading ? "items-center" : "items-start";
  // Render the divider as a `borderBottom` on the content itself — a sibling `<View>` with `height: hairlineWidth` rasterises irregularly above the Glass blur, while iOS's native border-hairline path stays stable.
  const contentStyle = React.useMemo(() => {
    const base: ViewStyle = {};
    if (minRowHeight !== undefined) base.minHeight = minRowHeight;
    if (showDivider) {
      base.borderBottomWidth = StyleSheet.hairlineWidth;
      base.borderBottomColor = colors.border;
    }
    return base;
  }, [minRowHeight, showDivider, colors.border]);
  const content = (
    <View
      className={`flex-row ${alignmentClass} gap-3.5 px-4.5 py-3.5`}
      style={contentStyle}
    >
      {leadingNode}
      <View className="flex-1">
        <View className="flex-row items-center gap-2">
          <Text
            className={clsx("flex-1 font-sans text-base", labelColor)}
            numberOfLines={1}
          >
            {label}
          </Text>
          {trailingMeta ? (
            <Animated.View style={trailingMetaAnimStyle}>
              <Text
                className="font-mono text-muted-foreground text-xs"
                numberOfLines={1}
              >
                {trailingMeta}
              </Text>
            </Animated.View>
          ) : null}
        </View>
        {/* Order toggled by `chipsBelowSubtitle` so the model picker can mirror the ollama.com card stack while other consumers keep chips-first. */}
        {chipsBelowSubtitle && subtitle ? (
          <Text
            className={clsx(
              "font-sans text-muted-foreground mt-1",
              subtitleTiny ? "text-xs" : "text-sm",
            )}
            numberOfLines={subtitleNumberOfLines}
          >
            {subtitle}
          </Text>
        ) : null}
        {chips && chips.length > 0 ? (
          <View className="flex-row flex-wrap gap-1 mt-1">
            {chips.map((chip) => {
              const descriptor: ListRowChip =
                typeof chip === "string" ? { label: chip } : chip;
              const Icon = descriptor.icon;
              const isAccent = descriptor.tone === "accent";
              return (
                <View
                  key={descriptor.label}
                  className={clsx(
                    "flex-row items-center gap-1 rounded-full px-2 py-0.5 border",
                    isAccent
                      ? "bg-primary border-primary"
                      : "bg-muted border-border",
                  )}
                >
                  {Icon ? (
                    <Icon
                      size={iconSize.xs}
                      color={isAccent ? colors.primaryForeground : colors.mutedForeground}
                      strokeWidth={strokeWidth.bold}
                    />
                  ) : null}
                  <Text
                    className={clsx(
                      "font-mono text-xs",
                      isAccent ? "text-primary-foreground" : "text-muted-foreground",
                    )}
                  >
                    {descriptor.label}
                  </Text>
                </View>
              );
            })}
          </View>
        ) : null}
        {!chipsBelowSubtitle && subtitle ? (
          <Text
            className={clsx(
              "font-sans text-muted-foreground mt-1",
              subtitleTiny ? "text-xs" : "text-sm",
            )}
            numberOfLines={subtitleNumberOfLines}
          >
            {subtitle}
          </Text>
        ) : null}
      </View>
      {trailing}
    </View>
  );
  return onPress ? (
    <ListRowPressable
      onPress={onPress}
      testID={testID}
      highlightColor={colors.muted}
    >
      {content}
    </ListRowPressable>
  ) : (
    <View testID={testID}>{content}</View>
  );
}

interface ListRowPressableProps {
  onPress: () => void;
  testID?: string;
  highlightColor: string;
  children: ReactNode;
}
// Settings-table press cue: background fades in to surface-2 on press and out on release.
function ListRowPressable({
  onPress,
  testID,
  highlightColor,
  children,
}: ListRowPressableProps): React.ReactElement {
  const pressed = useSharedValue(0);
  const handlePressIn = (): void => {
    pressed.value = withTiming(1, {
      duration: timingsNamed.press,
      easing: springEasing,
    });
  };
  const handlePressOut = (): void => {
    pressed.value = withTiming(0, {
      duration: baseAnimationDurationMs,
      easing: springEasing,
    });
  };
  const animatedStyle = useAnimatedStyle(() => ({
    opacity: pressed.value,
  }));
  return (
    <RNPressable
      onPress={onPress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      testID={testID}
      accessibilityRole="button"
    >
      <View>
        <Animated.View
          pointerEvents="none"
          style={[StyleSheet.absoluteFill, { backgroundColor: highlightColor }, animatedStyle]}
        />
        {children}
      </View>
    </RNPressable>
  );
}

export const ListRow = React.memo(ListRowImpl);
