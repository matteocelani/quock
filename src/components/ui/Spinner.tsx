// Rotating arc loading indicator (SVG + Reanimated on the UI thread).

import React, { useEffect } from "react";
import Svg, { Circle } from "react-native-svg";
import Animated, {
  Easing,
  cancelAnimation,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from "react-native-reanimated";
import { useThemeColors } from "@/lib/theme/ThemeContext";
import { size as sizeTokens, timingsNamed } from "@/lib/design/tokens";

export interface SpinnerProps {
  size?: number;
  color?: string;
  testID?: string;
}

export function Spinner({
  size = sizeTokens.spinnerDefault,
  color,
  testID,
}: SpinnerProps): React.ReactElement {
  const colors = useThemeColors();
  const resolvedColor = color ?? colors.foreground;
  const progress = useSharedValue(0);
  useEffect(() => {
    progress.value = withRepeat(
      withTiming(1, {
        duration: timingsNamed.spinnerRotation,
        easing: Easing.linear,
      }),
      -1,
      false,
    );
    return () => {
      cancelAnimation(progress);
    };
  }, [progress]);
  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${progress.value * 360}deg` }],
  }));
  // Arc dash leaves ~3/4 of the circumference visible; rotation animates the gap.
  const stroke = Math.max(1.5, size / 9);
  return (
    <Animated.View
      testID={testID}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={[{ width: size, height: size }, animatedStyle]}
    >
      <Svg width={size} height={size} viewBox="0 0 24 24">
        <Circle
          cx={12}
          cy={12}
          r={9}
          stroke={resolvedColor}
          strokeWidth={stroke}
          strokeLinecap="round"
          fill="none"
          strokeDasharray="42 60"
        />
      </Svg>
    </Animated.View>
  );
}
