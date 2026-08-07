// Primary action button. Ghost variants add a press tint so taps register without relying on the scale alone.

import clsx from "clsx";
import React, { useState } from "react";
import { Text, View, type ViewStyle } from "react-native";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";
import { Pressable } from "@/components/ui/Pressable";
import { Spinner } from "@/components/ui/Spinner";
import { useThemeColors } from "@/lib/theme/ThemeContext";
import { baseAnimationDurationMs, springEasing } from "@/lib/design/motion";
import { componentLayout, iconSize, motion, opacity, timingsNamed } from "@/lib/design/tokens";
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
  // iOS Bordered-Prominent: tint fill + white label.
  primary: "bg-primary",
  // iOS Bordered: solid system fill inside surfaces — the translucent wash reads on card and background alike.
  secondary: "bg-fill-secondary",
  ghost: "bg-transparent",
  destructive: "bg-destructive",
  // Destructive-soft = Apple HIG Sign-Out pattern: soft red surface + full destructive label.
  destructiveSoft: "bg-destructive-soft",
};

const VARIANT_TEXT_CLASSES: Record<ButtonVariant, string> = {
  primary: "text-primary-foreground",
  // Primary label on the translucent system fill — iOS Bordered pairs the wash with full-strength text.
  secondary: "text-label",
  ghost: "text-muted-foreground",
  destructive: "text-destructive-foreground",
  destructiveSoft: "text-destructive",
};

// iOS 27 control heights (50/34/28) are exact pt from tokens — consumed as numeric style on the content row so the press-tint overlay keeps covering the whole pill.
const SIZE_HEIGHTS: Record<ButtonSize, number> = {
  sm: componentLayout.button.heightSmall,
  md: componentLayout.button.heightMedium,
  lg: componentLayout.button.heightLarge,
};
// Horizontal padding lives on an inner content row, not the Pressable: the press tint fills the Pressable, so padding there would leave the padded edges un-tinted (an inner-rectangle bug on the pill). lg padX comes from tokens (exact 20pt).
const SIZE_PAD_CLASSES: Record<ButtonSize, string | undefined> = {
  sm: "px-3",
  md: "px-4",
  lg: undefined,
};

// iOS UIButtonConfiguration ramp: small=footnote, medium=subhead, large=body 17 medium weight.
const SIZE_TEXT_CLASSES: Record<ButtonSize, string> = {
  sm: "text-footnote",
  md: "text-subhead",
  lg: "text-body",
};

function resolveSpinnerColor(
  variant: ButtonVariant,
  colors: DesignColors,
): string {
  if (variant === "primary") return colors.primaryForeground;
  if (variant === "secondary") return colors.label;
  if (variant === "ghost") return colors.mutedForeground;
  if (variant === "destructiveSoft") return colors.destructive;
  return colors.destructiveForeground;
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
  // Translucent fills must paint ONCE: Pressable duplicates className on two nested views, which would double-composite the wash (the trap AlertAction documents). Secondary locks scale, so hoisting its surface to a static wrapper costs nothing; opaque variants keep the fill on the Pressable so press-scale moves the pill.
  const hasTranslucentSurface = variant === "secondary";
  // Pill (rounded-full) — shares the shape language of GlassOrb so CTAs and icon orbs read as one system.
  const containerClass = clsx(
    "items-center justify-center rounded-full flex-row overflow-hidden",
    !hasTranslucentSurface && VARIANT_CLASSES[variant],
    fullWidth && "w-full",
    className,
  );
  // Height on the content row (not the Pressable style) so the Pressable's inner animated wrapper keeps deriving the same box.
  const sizeStyle: ViewStyle = {
    height: SIZE_HEIGHTS[size],
    ...(size === "lg"
      ? { paddingHorizontal: componentLayout.button.largePaddingX }
      : {}),
  };
  const textClass = clsx(
    "font-sans font-medium",
    VARIANT_TEXT_CLASSES[variant],
    SIZE_TEXT_CLASSES[size],
  );
  const button = (
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
        style={sizeStyle}
      >
        {loading ? (
          <Spinner
            size={size === "sm" ? iconSize.sm : iconSize.lg}
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
  if (!hasTranslucentSurface) return button;
  return (
    <View
      className={clsx(
        "rounded-full overflow-hidden",
        VARIANT_CLASSES[variant],
        fullWidth && "w-full",
      )}
    >
      {button}
    </View>
  );
}
