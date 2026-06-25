// Bottom-anchored action sheet to pick + confirm what to clear (this account's chats vs all on the device); it
// IS the confirmation, so a tap deletes — rendered in Sheet's `overlays` slot so it centers against the display.

import React from "react";
import { Pressable as RNPressable, StyleSheet, Text, View } from "react-native";
import Animated, {
  FadeIn,
  FadeOut,
  SlideInDown,
  SlideOutDown,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  Smartphone,
  Trash2,
  User,
  type LucideIcon,
} from "lucide-react-native";
import { useThemeColors } from "@/lib/theme/ThemeContext";
import { baseAnimationDurationMs } from "@/lib/design/motion";
import {
  componentLayout,
  iconSize,
  shadow,
  strokeWidth,
  zLayer,
} from "@/lib/design/tokens";
import { formatBytes } from "@/modules/chat/lib/formatBytes";

// formatBytes(0) returns "—" (right for list trailing-meta, wrong here): a choice row must read as a calm,
// explicit zero, never an ambiguous dash.
function sizeLabel(bytes: number): string {
  return bytes > 0 ? formatBytes(bytes) : "Empty";
}

interface ChoiceRowProps {
  icon: LucideIcon;
  label: string;
  hint: string;
  bytes: number;
  onPress: () => void;
  showDivider: boolean;
  testID?: string;
}
function ChoiceRow({
  icon: Icon,
  label,
  hint,
  bytes,
  onPress,
  showDivider,
  testID,
}: ChoiceRowProps): React.ReactElement {
  const colors = useThemeColors();
  return (
    <RNPressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${label}, ${sizeLabel(bytes)}. ${hint}`}
      testID={testID}
      style={({ pressed }): object | undefined =>
        pressed ? { backgroundColor: colors.muted } : undefined
      }
    >
      <View
        className="flex-row items-center gap-3.5 px-4.5 py-3.5"
        style={
          showDivider
            ? {
                borderBottomWidth: StyleSheet.hairlineWidth,
                borderBottomColor: colors.border,
              }
            : undefined
        }
      >
        <View
          className="items-center justify-center rounded-xl bg-destructive-soft"
          style={{ width: 36, height: 36 }}
        >
          <Icon
            size={iconSize.xl}
            color={colors.destructive}
            strokeWidth={strokeWidth.regular}
          />
        </View>
        <View className="flex-1">
          <View className="flex-row items-center gap-2">
            <Text
              className="flex-1 font-sans font-medium text-base text-destructive"
              numberOfLines={1}
            >
              {label}
            </Text>
            <Text
              className="font-mono text-muted-foreground text-xs"
              numberOfLines={1}
            >
              {sizeLabel(bytes)}
            </Text>
          </View>
          <Text
            className="mt-0.5 font-sans text-muted-foreground text-xs"
            numberOfLines={1}
          >
            {hint}
          </Text>
        </View>
      </View>
    </RNPressable>
  );
}

export interface ClearChatsChooserProps {
  visible: boolean;
  mineBytes: number;
  deviceBytes: number;
  onChooseMine: () => void;
  onChooseDevice: () => void;
  onCancel: () => void;
}

export function ClearChatsChooser({
  visible,
  mineBytes,
  deviceBytes,
  onChooseMine,
  onChooseDevice,
  onCancel,
}: ClearChatsChooserProps): React.ReactElement | null {
  const colors = useThemeColors();
  const insets = useSafeAreaInsets();
  if (!visible) return null;

  const cardShadow = {
    shadowColor: colors.shadow,
    shadowOpacity: shadow.dialog.opacity,
    shadowRadius: shadow.dialog.radius,
    shadowOffset: { width: 0, height: shadow.dialog.offsetY },
    elevation: shadow.dialog.elevation,
  };
  const cardRadius = componentLayout.dialog.cornerRadius;

  return (
    <Animated.View
      entering={FadeIn.duration(baseAnimationDurationMs)}
      exiting={FadeOut.duration(baseAnimationDurationMs)}
      className="absolute inset-0 justify-end"
      style={{ zIndex: zLayer.dialog }}
      testID="clear-chats-chooser"
    >
      <RNPressable
        accessibilityRole="button"
        accessibilityLabel="Dismiss"
        onPress={onCancel}
        className="absolute inset-0 bg-scrim"
      />
      <Animated.View
        entering={SlideInDown.duration(baseAnimationDurationMs)}
        exiting={SlideOutDown.duration(baseAnimationDurationMs)}
        className="px-3 gap-2"
        style={{ paddingBottom: insets.bottom + 8 }}
        pointerEvents="box-none"
        accessibilityViewIsModal
      >
        <View
          className="bg-card overflow-hidden"
          style={[{ borderRadius: cardRadius }, cardShadow]}
        >
          <View className="items-center px-5 pt-6 pb-3.5 border-b border-border">
            <View className="w-11 h-11 rounded-full bg-destructive-soft items-center justify-center mb-2.5">
              <Trash2
                size={iconSize.xl}
                color={colors.destructive}
                strokeWidth={strokeWidth.medium}
              />
            </View>
            <Text className="font-sans font-semibold text-foreground text-base text-center">
              Clear chats
            </Text>
            <Text className="mt-1 font-sans text-muted-foreground text-xs text-center">
              Choose what to delete. This can&apos;t be undone.
            </Text>
          </View>
          <ChoiceRow
            icon={User}
            label="My chats"
            hint="Only chats in this account"
            bytes={mineBytes}
            onPress={onChooseMine}
            showDivider
            testID="clear-scope-mine"
          />
          <ChoiceRow
            icon={Smartphone}
            label="All chats on this device"
            hint="Everything saved on this phone"
            bytes={deviceBytes}
            onPress={onChooseDevice}
            showDivider={false}
            testID="clear-scope-device"
          />
        </View>
        <RNPressable
          onPress={onCancel}
          accessibilityRole="button"
          accessibilityLabel="Cancel"
          className="bg-card overflow-hidden"
          style={[{ borderRadius: cardRadius }, cardShadow]}
        >
          {({ pressed }): React.ReactElement => (
            <View
              className="py-3.5 items-center justify-center"
              style={pressed ? { backgroundColor: colors.muted } : undefined}
            >
              <Text className="font-sans font-semibold text-foreground text-base">
                Cancel
              </Text>
            </View>
          )}
        </RNPressable>
      </Animated.View>
    </Animated.View>
  );
}
