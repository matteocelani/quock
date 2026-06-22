// Three floating orbs (hamburger / model picker / avatar) over the chat content — iOS 26 topmost-layer pattern.

import { BlurView } from "expo-blur";
import { LinearGradient } from "expo-linear-gradient";
import MaskedView from "@react-native-masked-view/masked-view";
import React, { useCallback } from "react";
import { Platform, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ChevronDown, Menu } from "lucide-react-native";
import { Avatar } from "@/components/ui/Avatar";
import { GlassOrb } from "@/components/ui/GlassOrb";
import { useThemeColors } from "@/lib/theme/ThemeContext";
import { componentLayout, iconSize, size, strokeWidth, zLayer } from "@/lib/design/tokens";
import { useAuth } from "@/modules/auth/hooks/useAuth";
import { formatModelName } from "@/modules/models/lib/formatModelName";
import { useChatModel } from "@/modules/models/hooks/useChatModel";
import { useUIStore } from "@/lib/stores/ui.store";
import type { ChatId } from "@/lib/types/ids";

export interface FloatingHeaderProps {
  // The open chat; drives the model badge so each chat shows its own pinned model.
  chatId: ChatId;
}

export function FloatingHeader({
  chatId,
}: FloatingHeaderProps): React.ReactElement {
  const colors = useThemeColors();
  const insets = useSafeAreaInsets();
  // `default` tint = no vibrancy wash, just blur; keeps chat text legible inside the gradient transition zone.
  const blurTint = "default" as const;
  const blurAndroidFallback =
    Platform.OS === "ios"
      ? {}
      : { experimentalBlurMethod: "dimezisBlurView" as const };
  // Cover top edge → bottom of orbs so the gradient's 0% mark lands exactly on the orb seam. insets.top adapts per device; the orb sums come from the design system.
  const headerBlurHeight =
    insets.top +
    componentLayout.floatingHeader.topGap +
    componentLayout.floatingHeader.orbHeight;
  const { model } = useChatModel(chatId);
  const { user } = useAuth();
  const openChatHistory = useUIStore((s) => s.openChatHistory);
  const openModelPicker = useUIStore((s) => s.openModelPicker);
  const openAccount = useUIStore((s) => s.openAccount);
  const modelName = model ? formatModelName(model.name) : "Select model";
  const onHamburger = useCallback(() => openChatHistory(), [openChatHistory]);
  const onModel = useCallback(() => openModelPicker(), [openModelPicker]);
  const onAccount = useCallback(() => openAccount(), [openAccount]);
  return (
    <View
      // `box-none` lets taps fall through to the MessageList wherever an orb isn't covering the screen.
      pointerEvents="box-none"
      style={{
        position: "absolute",
        top: 0,
        left: 0,
        right: 0,
        paddingTop: insets.top + componentLayout.floatingHeader.topGap,
        paddingLeft: componentLayout.floatingHeader.sidePad,
        paddingRight: componentLayout.floatingHeader.sidePad,
        zIndex: zLayer.header,
      }}
    >
      {/* Linear gradient blur sitting INSIDE the safe-area-top + the orb row's topGap — above the orbs, never covering them. 100% blur at the screen edge, fading to 0% just before the orbs start. The mask is a black→transparent LinearGradient (black at top, transparent at bottom); MaskedView clamps the BlurView's visibility to the mask's alpha. */}
      {headerBlurHeight > 0 ? (
        <MaskedView
          pointerEvents="none"
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            height: headerBlurHeight,
          }}
          maskElement={
            <LinearGradient
              colors={["black", "transparent"]}
              start={{ x: 0, y: 0 }}
              end={{ x: 0, y: 1 }}
              style={StyleSheet.absoluteFill}
            />
          }
        >
          <BlurView
            tint={blurTint}
            intensity={componentLayout.floatingHeader.blurBaseIntensity}
            {...blurAndroidFallback}
            style={StyleSheet.absoluteFill}
          />
        </MaskedView>
      ) : null}
      <View className="flex-row items-center justify-between">
        <GlassOrb
          variant="regular"
          interactive
          onPress={onHamburger}
          borderRadius={999}
          accessibilityLabel="Open chat history"
          testID="header-menu"
        >
          <View className="w-11 h-11 items-center justify-center">
            <Menu
              size={iconSize.xl}
              color={colors.foreground}
              strokeWidth={strokeWidth.regular}
            />
          </View>
        </GlassOrb>
        <GlassOrb
          variant="regular"
          interactive
          onPress={onModel}
          borderRadius={999}
          accessibilityLabel="Choose a model"
          testID="header-model"
        >
          <View className="h-11 flex-row items-center px-4">
            <Text
              className="font-mono text-foreground text-sm font-medium"
              numberOfLines={1}
            >
              {modelName}
            </Text>
            <View className="ml-1">
              <ChevronDown
                size={iconSize.md}
                color={colors.mutedForeground}
                strokeWidth={strokeWidth.bold}
              />
            </View>
          </View>
        </GlassOrb>
        <GlassOrb
          variant="regular"
          interactive
          onPress={onAccount}
          borderRadius={999}
          accessibilityLabel="Open account"
          testID="header-account"
        >
          <View className="w-11 h-11 items-center justify-center">
            <Avatar
              size={size.avatarHeader}
              uri={user?.avatarurl}
              name={user?.name}
            />
          </View>
        </GlassOrb>
      </View>
    </View>
  );
}
