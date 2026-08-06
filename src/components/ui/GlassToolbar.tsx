// Floating action bar in the shape of the iOS text-selection menu: one glass capsule, actions inline, hairline between.
// Geometry is componentLayout.glassToolbar; the kit's mix-blend fill pair is inexpressible in RN, so the tint approximates it.

import { type LucideIcon } from "lucide-react-native";
import React from "react";
import { StyleSheet, Text, View } from "react-native";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";
import { GlassOrb } from "@/components/ui/GlassOrb";
import { Pressable } from "@/components/ui/Pressable";
import { useTheme, useThemeColors } from "@/lib/theme/ThemeContext";
import { baseAnimationDurationMs, springEasing } from "@/lib/design/motion";
import {
  componentLayout,
  iconSize,
  strokeWidth,
  timingsNamed,
} from "@/lib/design/tokens";

const TOOLBAR = componentLayout.glassToolbar;
// One home for the bar height: consumers anchor against this instead of re-deriving it from the internals.
export const GLASS_TOOLBAR_HEIGHT = TOOLBAR.height;
const ACTION_HEIGHT = TOOLBAR.height - TOOLBAR.padY * 2;

export interface GlassToolbarAction {
  icon: LucideIcon;
  label: string;
  onPress: () => void;
  accessibilityLabel?: string;
}

export interface GlassToolbarProps {
  actions: GlassToolbarAction[];
}

// iOS fills the action under the finger; ours fades the same fill tier in for the press.
const ToolbarAction = React.memo(function ToolbarAction({
  icon: Icon,
  label,
  onPress,
  accessibilityLabel,
}: GlassToolbarAction): React.ReactElement {
  const colors = useThemeColors();
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
  const tintStyle = useAnimatedStyle(() => ({ opacity: pressed.value }));
  return (
    // scale locked to 1: a press tint under a scaling child diverges at the edges on Fabric (AGENTS.md §Platform notes).
    // haptic off: the long-press that opened the menu already answered the touch.
    <Pressable
      scale={1}
      haptic={false}
      onPress={onPress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      accessibilityLabel={accessibilityLabel ?? label}
    >
      <View
        className="flex-row items-center justify-center"
        style={{
          height: ACTION_HEIGHT,
          paddingHorizontal: TOOLBAR.actionPadX,
          columnGap: TOOLBAR.iconLabelGap,
        }}
      >
        <Animated.View
          pointerEvents="none"
          style={[
            StyleSheet.absoluteFill,
            {
              backgroundColor: colors.fillTertiary,
              borderRadius: TOOLBAR.actionRadius,
            },
            tintStyle,
          ]}
        />
        <Icon
          size={iconSize.sm}
          color={colors.foreground}
          strokeWidth={strokeWidth.medium}
        />
        <Text
          numberOfLines={1}
          className="font-sans text-subhead font-medium text-foreground"
        >
          {label}
        </Text>
      </View>
    </Pressable>
  );
});

export const GlassToolbar = React.memo(function GlassToolbar({
  actions,
}: GlassToolbarProps): React.ReactElement {
  const { resolved } = useTheme();
  const colors = useThemeColors();
  return (
    <GlassOrb
      variant="regular"
      borderRadius={TOOLBAR.radius}
      tintColor={TOOLBAR.tint[resolved]}
    >
      <View
        className="flex-row items-center"
        style={{
          height: TOOLBAR.height,
          paddingHorizontal: TOOLBAR.padX,
          paddingVertical: TOOLBAR.padY,
        }}
      >
        {actions.map((action, index) => (
          <React.Fragment key={action.label}>
            {index > 0 ? (
              <View
                style={{
                  width: StyleSheet.hairlineWidth,
                  alignSelf: "stretch",
                  marginVertical: TOOLBAR.dividerInsetY,
                  backgroundColor: colors.border,
                }}
              />
            ) : null}
            <ToolbarAction {...action} />
          </React.Fragment>
        ))}
      </View>
    </GlassOrb>
  );
});
