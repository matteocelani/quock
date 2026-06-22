// Pill orb — BlurView + tint + press feedback. Blur reveals scroll content; opaque surfaces show tint only.

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
import { componentLayout, motion, opacity, shadow } from "@/lib/design/tokens";

export type GlassVariant = "clear" | "regular" | "thick";

export interface GlassOrbProps {
  children?: React.ReactNode;
  variant?: GlassVariant;
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
  // Soft drop shadow lifts the orb off the surface. Android elevation needs an opaque base + radius on the wrapper (a transparent view casts nothing), so we paint the card surface under the blur; iOS honours shadow* on a transparent view untouched.
  const shadowStyle: ViewStyle = {
    shadowColor: themeColors.shadow,
    shadowOpacity: shadow.orb.opacity,
    shadowRadius: shadow.orb.radius,
    shadowOffset: { width: 0, height: shadow.orb.offsetY },
    elevation: shadow.orb.elevation,
    ...(isIOS ? {} : { backgroundColor: themeColors.card, borderRadius }),
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
      // dimStyle on the OUTER wrapper so the disabled fade also covers the Android opaque base + shadow (both live on this view); on the inner Pressable it would leave a full-opacity card pill on Android.
      <Animated.View style={[shadowStyle, scaleStyle, dimStyle, style]}>
        <RNPressable
          onPress={disabled ? undefined : onPress}
          onPressIn={disabled ? undefined : handlePressIn}
          onPressOut={disabled ? undefined : handlePressOut}
          accessibilityRole={accessibilityRole ?? "button"}
          accessibilityLabel={accessibilityLabel}
          accessibilityState={{ disabled }}
          testID={testID}
          style={wrapperStyle}
          className={className}
        >
          {stack}
          {children}
        </RNPressable>
      </Animated.View>
    );
  }
  return (
    <View
      style={[shadowStyle, wrapperStyle, dimStyle, style]}
      className={className}
      testID={testID}
      accessibilityLabel={accessibilityLabel}
      accessibilityRole={accessibilityRole}
      accessibilityState={{ disabled }}
    >
      {stack}
      {children}
    </View>
  );
}
