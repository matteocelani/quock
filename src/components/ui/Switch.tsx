// Boolean toggle with iOS 26 UISwitch geometry — values flow through `componentLayout.switchControl`, `motion`, `shadow`.

import React, { useEffect } from "react";
import Animated, {
  interpolateColor,
  useAnimatedStyle,
  useDerivedValue,
  useSharedValue,
  withSpring,
  withTiming,
} from "react-native-reanimated";
import { Pressable } from "@/components/ui/Pressable";
import { useThemeColors } from "@/lib/theme/ThemeContext";
import {
  baseAnimationDurationMs,
  springEasing,
  toggleSpring,
} from "@/lib/design/motion";
import { componentLayout, motion, shadow } from "@/lib/design/tokens";

export interface SwitchProps {
  value: boolean;
  onValueChange: (v: boolean) => void;
  disabled?: boolean;
  testID?: string;
  accessibilityLabel?: string;
}
const S = componentLayout.switchControl;

export function Switch({
  value,
  onValueChange,
  disabled = false,
  testID,
  accessibilityLabel,
}: SwitchProps): React.ReactElement {
  const colors = useThemeColors();
  // Track crossfades on timing (smooth color), thumb travels on spring (settled overshoot).
  const trackProgress = useSharedValue(value ? 1 : 0);
  const thumbProgress = useSharedValue(value ? 1 : 0);
  const offColor = colors.secondary;
  const onColor = colors.primary;
  useEffect(() => {
    trackProgress.value = withTiming(value ? 1 : 0, {
      duration: baseAnimationDurationMs,
      easing: springEasing,
    });
    thumbProgress.value = withSpring(value ? 1 : 0, toggleSpring);
  }, [value, trackProgress, thumbProgress]);
  // Clamp the spring overshoot so the thumb never visually exits the track.
  const thumbX = useDerivedValue(
    () =>
      Math.min(
        1 + motion.thumbOvershoot,
        Math.max(-motion.thumbOvershoot, thumbProgress.value),
      ) * S.thumbTravel,
  );
  const trackStyle = useAnimatedStyle(() => ({
    backgroundColor: interpolateColor(
      trackProgress.value,
      [0, 1],
      [offColor, onColor],
    ),
  }));
  const thumbStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: thumbX.value }],
  }));
  const handlePress = (): void => {
    if (disabled) return;
    onValueChange(!value);
  };
  return (
    // Disable press-scale so only the thumb animates; rely on Pressable for haptics + hit area.
    <Pressable
      onPress={handlePress}
      disabled={disabled}
      scale={1}
      testID={testID}
      accessibilityLabel={accessibilityLabel}
      accessibilityRole="switch"
      accessibilityState={{ checked: value, disabled }}
    >
      <Animated.View
        style={[
          {
            width: S.trackWidth,
            height: S.trackHeight,
            borderRadius: S.trackHeight / 2,
            padding: S.thumbPadding,
            justifyContent: "center",
          },
          trackStyle,
        ]}
      >
        <Animated.View
          style={[
            {
              width: S.thumbSize,
              height: S.thumbSize,
              borderRadius: S.thumbSize / 2,
              backgroundColor: colors.thumbFill,
              shadowColor: colors.shadow,
              shadowOpacity: shadow.thumb.opacity,
              shadowRadius: shadow.thumb.radius,
              shadowOffset: { width: 0, height: shadow.thumb.offsetY },
              elevation: shadow.thumb.elevation,
            },
            thumbStyle,
          ]}
        />
      </Animated.View>
    </Pressable>
  );
}
