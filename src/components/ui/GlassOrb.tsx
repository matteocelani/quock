// Liquid Glass pill orb — BlurView + layered tint + specular ring/highlights + press feedback. Glass lives ONLY on floating controls over content (AGENTS.md §Surface primitives); solid surfaces never adopt it.

import { BlurView } from "expo-blur";
import React, { useCallback } from "react";
import {
  Platform,
  Pressable as RNPressable,
  StyleSheet,
  View,
  type AccessibilityRole,
  type ViewStyle,
} from "react-native";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from "react-native-reanimated";
import { useTheme, useThemeColors } from "@/lib/theme/ThemeContext";
import { pressSpring } from "@/lib/design/motion";
import { boxShadow, componentLayout, motion, opacity, shadow } from "@/lib/design/tokens";

export type GlassVariant = "clear" | "regular" | "thick";

export interface GlassOrbProps {
  children?: React.ReactNode;
  variant?: GlassVariant;
  /** `contained` shortens the ambient lift so the orb can sit inside a list row without shadowing its neighbours. */
  lift?: "floating" | "contained";
  /** Adds the press-down feedback (scale + brightness boost). Default false. */
  interactive?: boolean;
  /** Suppresses the press handler + dims children + flags accessibility. */
  disabled?: boolean;
  /** Override the resolved tint with an accent (e.g. send-button blue, destructive red). */
  tintColor?: string;
  /** Corner radius applied to the wrapper. Pill orbs use 999. */
  borderRadius?: number;
  className?: string;
  style?: ViewStyle;
  onPress?: () => void;
  accessibilityLabel?: string;
  accessibilityRole?: AccessibilityRole;
  testID?: string;
}

export function GlassOrb({
  children,
  variant = "regular",
  lift = "floating",
  interactive = false,
  disabled = false,
  tintColor,
  borderRadius = 999,
  className,
  style,
  onPress,
  accessibilityLabel,
  accessibilityRole,
  testID,
}: GlassOrbProps): React.ReactElement {
  const { resolved } = useTheme();
  const themeColors = useThemeColors();
  const resolvedTint = tintColor ?? componentLayout.glassOrb.tint[resolved][variant];
  const isIOS = Platform.OS === "ios";
  // iOS draws the glass ring + ambient lift via Fabric boxShadow on this unclipped wrapper (outset shadows escape the inner overflow-hidden). Android falls back to the solid recipe — dimezis blur + boxShadow insets misrender there, and elevation needs an opaque base + radius (a transparent view casts nothing).
  const glassRecipe =
    lift === "contained" ? boxShadow.glassContained : boxShadow.glass;
  const shadowStyle: ViewStyle = isIOS
    ? { borderRadius, boxShadow: glassRecipe[resolved].ring }
    : {
        shadowColor: themeColors.shadow,
        shadowOpacity: shadow.orb.opacity,
        shadowRadius: shadow.orb.radius,
        shadowOffset: { width: 0, height: shadow.orb.offsetY },
        elevation: shadow.orb.elevation,
        backgroundColor: themeColors.card,
        borderRadius,
      };
  // Press feedback driven by one shared value so brightness boost + scale stay in sync.
  const pressed = useSharedValue(0);
  const handlePressIn = useCallback((): void => {
    pressed.value = withSpring(1, pressSpring);
  }, [pressed]);
  const handlePressOut = useCallback((): void => {
    pressed.value = withSpring(0, pressSpring);
  }, [pressed]);
  const scaleStyle = useAnimatedStyle(() => ({
    transform: [
      { scale: 1 - pressed.value * (1 - motion.scalePressDefault) },
    ],
  }));
  const brightnessStyle = useAnimatedStyle(() => ({
    opacity: pressed.value * opacity.pressBrightnessBoost,
  }));
  const wrapperStyle: ViewStyle = {
    borderRadius,
    overflow: "hidden",
  };
  const dimStyle: ViewStyle = disabled ? { opacity: opacity.disabled } : {};
  // Blur + tint + optional press-brightness; pointer-events none so taps reach the wrapper Pressable.
  const stack = (
    <>
      <View pointerEvents="none" style={StyleSheet.absoluteFill}>
        <BlurView
          tint={resolved === "dark" ? "dark" : "light"}
          intensity={componentLayout.glassOrb.blurIntensity[variant]}
          {...(isIOS ? {} : { experimentalBlurMethod: "dimezisBlurView" as const })}
          style={StyleSheet.absoluteFill}
        />
      </View>
      <View
        pointerEvents="none"
        style={[StyleSheet.absoluteFill, { backgroundColor: resolvedTint }]}
      />
      {isIOS ? (
        // Inset speculars need their own layer above the tint: Fabric paints inset box-shadows under children, so on the wrapper they would hide behind blur + tint.
        <View
          pointerEvents="none"
          style={[
            StyleSheet.absoluteFill,
            { borderRadius, boxShadow: glassRecipe[resolved].highlight },
          ]}
        />
      ) : null}
      {interactive ? (
        <Animated.View
          pointerEvents="none"
          className="bg-white"
          style={[StyleSheet.absoluteFill, brightnessStyle]}
        />
      ) : null}
    </>
  );
  if (interactive && onPress !== undefined) {
    return (
      // dimStyle and className both belong on the OUTER wrapper: the disabled fade has to cover the Android opaque base
      // + shadow that live here, and a caller's `flex-1` would flatten the orb to zero height on the inner column node.
      <Animated.View
        style={[shadowStyle, scaleStyle, dimStyle, style]}
        className={className}
      >
        <RNPressable
          onPress={disabled ? undefined : onPress}
          onPressIn={disabled ? undefined : handlePressIn}
          onPressOut={disabled ? undefined : handlePressOut}
          accessibilityRole={accessibilityRole ?? "button"}
          accessibilityLabel={accessibilityLabel}
          accessibilityState={{ disabled }}
          testID={testID}
          style={wrapperStyle}
        >
          {stack}
          {children}
        </RNPressable>
      </Animated.View>
    );
  }
  return (
    // Same two-view split as the interactive branch: the outset glass ring dies under overflow:hidden on Fabric, so the clip lives one level in.
    <View
      style={[shadowStyle, dimStyle, style]}
      className={className}
      testID={testID}
      accessibilityLabel={accessibilityLabel}
      accessibilityRole={accessibilityRole}
      accessibilityState={{ disabled }}
    >
      <View style={wrapperStyle}>
        {stack}
        {children}
      </View>
    </View>
  );
}
