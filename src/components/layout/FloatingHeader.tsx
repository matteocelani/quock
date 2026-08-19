// Three floating orbs (hamburger / model picker / avatar) over the chat content — iOS 26 topmost-layer pattern.

import React, { useCallback } from "react";
import { Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ChevronDown, Menu, X } from "lucide-react-native";
import type { SharedValue } from "react-native-reanimated";
import { Avatar } from "@/components/ui/Avatar";
import { GlassOrb } from "@/components/ui/GlassOrb";
import { ScrollEdgeBlur } from "@/components/ui/ScrollEdgeBlur";
import { IconSwap } from "@/components/ui/IconSwap";
import { useThemeColors } from "@/lib/theme/ThemeContext";
import { componentLayout, iconSize, size, strokeWidth, zLayer } from "@/lib/design/tokens";
import { useAuth } from "@/modules/auth/hooks/useAuth";
import { formatModelName } from "@/modules/models/lib/formatModelName";
import { useChatModel } from "@/modules/models/hooks/useChatModel";
import { useUIStore } from "@/lib/stores/ui.store";
import type { ChatId } from "@/lib/types/ids";

export interface FloatingHeaderProps {
  // The drawer's own 0 → 1, read (never written) so the menu glyph crosses to the close glyph in step with the page —
  // including mid-drag, when no state has flipped yet.
  drawerProgress: SharedValue<number>;
  // The open chat, or null while one is being created: the orbs outlive the screen under them, so the badge falls back
  // to the global default — which is the model that chat is about to be born with anyway.
  chatId: ChatId | null;
}

export function FloatingHeader({
  chatId,
  drawerProgress,
}: FloatingHeaderProps): React.ReactElement {
  const colors = useThemeColors();
  const insets = useSafeAreaInsets();
  // Cover top edge → bottom of orbs so the gradient's 0% mark lands exactly on the orb seam. insets.top adapts per device; the orb sums come from the design system.
  const headerBlurHeight =
    insets.top +
    componentLayout.floatingHeader.topGap +
    componentLayout.floatingHeader.orbHeight;
  const { user } = useAuth();
  const openChatHistory = useUIStore((s) => s.openChatHistory);
  const closeChatHistory = useUIStore((s) => s.closeChatHistory);
  // The orbs stay put while the screen slides out from under them, so this one has to say which way it now points.
  const isDrawerOpen = useUIStore((s) => s.chatHistoryOpen);
  // On the chats page the badge must read the DEFAULT, not the pin of the conversation hidden behind the panel: that
  // chat is pinned from its first send, so it would keep naming its own model while the picker changed a different one.
  const { model } = useChatModel(isDrawerOpen ? null : chatId);
  const openModelPicker = useUIStore((s) => s.openModelPicker);
  const openModelPickerAsDefault = useUIStore((s) => s.openModelPickerAsDefault);
  const openAccount = useUIStore((s) => s.openAccount);
  const modelName = model ? formatModelName(model.name) : "Select model";
  const onHamburger = useCallback(
    () => (isDrawerOpen ? closeChatHistory() : openChatHistory()),
    [isDrawerOpen, closeChatHistory, openChatHistory],
  );
  // On the chats page there is no conversation to pin a model to, so the pick moves the default instead.
  const onModel = useCallback(
    () => (isDrawerOpen ? openModelPickerAsDefault() : openModelPicker()),
    [isDrawerOpen, openModelPickerAsDefault, openModelPicker],
  );
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
      {/* Sits INSIDE the safe-area-top + the orb row's topGap: total blur at the screen edge, gone exactly at the orb seam. */}
      <ScrollEdgeBlur
        edge="top"
        height={headerBlurHeight}
        intensity={componentLayout.scrollEdgeBlur.intensity}
      />
      <View className="flex-row items-center justify-between">
        <GlassOrb
          variant="regular"
          interactive
          onPress={onHamburger}
          borderRadius={999}
          accessibilityLabel={isDrawerOpen ? "Close chats" : "Open chats"}
          testID="header-menu"
        >
          {/* Exact 44pt orb boxes from the token — w-11/h-11 render 38.5px under the 14px rem, under-shooting the HIG tap target and the blur-seam math. */}
          <View
            className="items-center justify-center"
            style={{
              width: componentLayout.floatingHeader.orbHeight,
              height: componentLayout.floatingHeader.orbHeight,
            }}
          >
            <IconSwap
              progress={drawerProgress}
              size={iconSize.xl}
              first={
                <Menu
                  size={iconSize.xl}
                  color={colors.foreground}
                  strokeWidth={strokeWidth.regular}
                />
              }
              second={
                <X
                  size={iconSize.xl}
                  color={colors.foreground}
                  strokeWidth={strokeWidth.regular}
                />
              }
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
          <View
            className="flex-row items-center px-4"
            style={{ height: componentLayout.floatingHeader.orbHeight }}
          >
            <Text
              className="font-mono text-footnote text-foreground font-medium"
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
          <View
            className="items-center justify-center"
            style={{
              width: componentLayout.floatingHeader.orbHeight,
              height: componentLayout.floatingHeader.orbHeight,
            }}
          >
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
