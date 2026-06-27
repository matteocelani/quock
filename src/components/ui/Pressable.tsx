// Press-scale + haptic wrapper; animation runs on the UI thread via Reanimated.

import * as Haptics from "expo-haptics";
import React from "react";
import {
  Pressable as RNPressable,
  type AccessibilityRole,
  type AccessibilityState,
  type Insets,
  type View,
  type ViewStyle,
} from "react-native";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from "react-native-reanimated";
import { pressSpring } from "@/lib/design/motion";
import { motion, opacity } from "@/lib/design/tokens";

export interface PressableProps {
  children: React.ReactNode;
  onPress?: () => void;
  onLongPress?: () => void;
  /** Press-state scale target. Defaults to motion.scalePressDefault (0.97). */
  scale?: number;
  /** Trigger `ImpactFeedbackStyle.Light` on press. Defaults to true. */
  haptic?: boolean;
  disabled?: boolean;
  className?: string;
  style?: ViewStyle;
  testID?: string;
  accessibilityLabel?: string;
  /** Defaults to "button"; pass "switch" for toggles, etc. */
  accessibilityRole?: AccessibilityRole;
  accessibilityState?: AccessibilityState;
  /** Extends the touchable area past the visual bounds — for small targets like a remove badge. */
  hitSlop?: number | Insets;
  /** Optional press-state observers — let parents layer their own animations (e.g. background tint). */
  onPressIn?: () => void;
  onPressOut?: () => void;
}

export const Pressable = React.forwardRef<View, PressableProps>(
  function Pressable(
    {
      children,
      onPress,
      onLongPress,
      scale = motion.scalePressDefault,
      haptic = true,
      disabled = false,
      className,
      style,
      testID,
      accessibilityLabel,
      accessibilityRole = "button",
      accessibilityState,
      hitSlop,
      onPressIn,
      onPressOut,
    },
    ref,
  ) {
    const pressed = useSharedValue(0);
    const animatedStyle = useAnimatedStyle(() => {
      const scaleValue = 1 - pressed.value * (1 - scale);
      return {
        transform: [{ scale: scaleValue }],
        opacity: disabled ? opacity.pressDisabled : 1,
      };
    }, [disabled, scale]);
    // Spring (not timing) gives the in-out asymmetry the iOS finger-lift feel relies on.
    const handlePressIn = (): void => {
      pressed.value = withSpring(1, pressSpring);
      onPressIn?.();
    };

    const handlePressOut = (): void => {
      pressed.value = withSpring(0, pressSpring);
      onPressOut?.();
    };

    const handlePress = (): void => {
      if (disabled) return;
      if (haptic) {
        // Fire-and-forget — simulators without taptic reject; we log and continue.
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(
          (err: unknown) => {
            console.warn("Pressable: haptic failed", err);
          },
        );
      }
      onPress?.();
    };
    // Wrapping an `Animated.createAnimatedComponent(RNPressable)` breaks hit-testing on RN 0.83, so the transform animates on an inner Animated.View while the outer Pressable stays plain.
    return (
      <RNPressable
        ref={ref}
        disabled={disabled}
        onPress={handlePress}
        onLongPress={onLongPress}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        hitSlop={hitSlop}
        testID={testID}
        accessibilityLabel={accessibilityLabel}
        accessibilityRole={accessibilityRole}
        accessibilityState={accessibilityState}
        className={className}
        style={style}
      >
        <Animated.View className={className} style={animatedStyle}>
          {children}
        </Animated.View>
      </RNPressable>
    );
  },
);
