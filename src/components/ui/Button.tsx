// Primary action button. Ghost variants add a press tint so taps register without relying on the scale alone.

import clsx from "clsx";
import React, { useState } from "react";
import { Text, View } from "react-native";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";
import { Pressable } from "@/components/ui/Pressable";
import { Spinner } from "@/components/ui/Spinner";
import { useThemeColors } from "@/lib/theme/ThemeContext";
import { baseAnimationDurationMs, springEasing } from "@/lib/design/motion";
import { motion, opacity, timingsNamed } from "@/lib/design/tokens";
import type { DesignColors } from "@/lib/design/tokens";

export type ButtonVariant =
  | "primary"
  | "secondary"
  | "ghost"
  | "destructive"
  | "destructiveSoft";
export type ButtonSize = "sm" | "md" | "lg";
export interface ButtonProps {
  children: React.ReactNode;
  onPress?: () => void;
  variant?: ButtonVariant;
  size?: ButtonSize;
  disabled?: boolean;
  loading?: boolean;
  fullWidth?: boolean;
  className?: string;
  testID?: string;
}

const VARIANT_CLASSES: Record<ButtonVariant, string> = {
  primary: "bg-primary",
  // Secondary uses bg-secondary (gray4) so it reads against the white card surface.
  secondary: "bg-secondary",
  ghost: "bg-transparent",
  destructive: "bg-destructive",
  // Destructive-soft = Apple HIG Sign-Out pattern: soft red surface + full destructive label.
  destructiveSoft: "bg-destructive-soft",
};

const VARIANT_TEXT_CLASSES: Record<ButtonVariant, string> = {
  primary: "text-primary-foreground",
  secondary: "text-secondary-foreground",
  ghost: "text-muted-foreground",
  destructive: "text-white",
  destructiveSoft: "text-destructive",
};

const SIZE_CLASSES: Record<ButtonSize, string> = {
  sm: "h-9",
  md: "h-11",
  lg: "h-13",
};
// Horizontal padding lives on an inner content row, not the Pressable: the press tint fills the Pressable, so padding there would leave the padded edges un-tinted (an inner-rectangle bug on the pill).
const SIZE_PAD_CLASSES: Record<ButtonSize, string> = {
  sm: "px-3",
  md: "px-4",
  lg: "px-5",
};

const SIZE_TEXT_CLASSES: Record<ButtonSize, string> = {
  sm: "text-sm",
  md: "text-base",
  lg: "text-base",
};

function resolveSpinnerColor(
  variant: ButtonVariant,
  colors: DesignColors,
): string {
  if (variant === "primary") return colors.primaryForeground;
  if (variant === "secondary") return colors.foreground;
  if (variant === "ghost") return colors.mutedForeground;
  if (variant === "destructiveSoft") return colors.destructive;
  return colors.primaryForeground;
}

export function Button({
  children,
  onPress,
  variant = "primary",
  size = "md",
  disabled = false,
  loading = false,
  fullWidth = false,
  className,
  testID,
}: ButtonProps): React.ReactElement {
  const colors = useThemeColors();
  // Loading implies non-interactive to prevent double-fires during async work.
  const isDisabled = disabled || loading;
  // Ghost/secondary variants gain a soft surface tint on press so taps land visually even when scale alone is too subtle.
  const tintOpacity = useSharedValue(0);
  const [didMountPress, setDidMountPress] = useState<boolean>(false);
  const hasPressTint = variant === "ghost" || variant === "secondary";
  const handlePressIn = (): void => {
    if (!hasPressTint) return;
    setDidMountPress(true);
    tintOpacity.value = withTiming(opacity.pressTintMax, {
      duration: timingsNamed.press,
      easing: springEasing,
    });
  };
  const handlePressOut = (): void => {
    if (!hasPressTint) return;
    tintOpacity.value = withTiming(0, {
      duration: baseAnimationDurationMs,
      easing: springEasing,
    });
  };
  const tintStyle = useAnimatedStyle(() => ({
    opacity: tintOpacity.value,
  }));
  // Pill (rounded-full) — shares the shape language of GlassOrb so CTAs and icon orbs read as one system.
  const containerClass = clsx(
    "items-center justify-center rounded-full flex-row overflow-hidden",
    VARIANT_CLASSES[variant],
    SIZE_CLASSES[size],
    fullWidth && "w-full",
    className,
  );
  const textClass = clsx(
    "font-sans font-medium",
    VARIANT_TEXT_CLASSES[variant],
    SIZE_TEXT_CLASSES[size],
  );
  return (
    <Pressable
      onPress={onPress}
      disabled={isDisabled}
      // Tinted variants skip the inner scale — otherwise the overlay scales and leaves an inner-rectangle bug.
      scale={hasPressTint ? 1 : motion.scalePressDefault}
      className={containerClass}
      testID={testID}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
    >
      {hasPressTint && didMountPress ? (
        <Animated.View
          pointerEvents="none"
          // bg-foreground gives a real luminance shift on any variant surface; alpha clamped by opacity.pressTintMax.
          className="absolute inset-0 bg-foreground"
          style={tintStyle}
        />
      ) : null}
      <View
        className={clsx(
          "flex-row items-center justify-center",
          SIZE_PAD_CLASSES[size],
        )}
      >
        {loading ? (
          <Spinner
            size={size === "sm" ? 14 : 18}
            color={resolveSpinnerColor(variant, colors)}
          />
        ) : typeof children === "string" || typeof children === "number" ? (
          <Text className={textClass}>{children}</Text>
        ) : (
          children
        )}
      </View>
    </Pressable>
  );
}
