// Three-dot indicator shown while the assistant row is `pending`; each dot pulses with a stagger to read as a wave.

import React, { useEffect } from "react";
import { View } from "react-native";
import Animated, {
  Easing,
  cancelAnimation,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withTiming,
} from "react-native-reanimated";
import { THINKING_DOT_DURATION_MS, THINKING_DOT_MIN_OPACITY, THINKING_DOT_STAGGER_MS } from "@/modules/chat/constants";

interface DotProps {
  delayMs: number;
}

function Dot({ delayMs }: DotProps): React.ReactElement {
  const opacity = useSharedValue(THINKING_DOT_MIN_OPACITY);
  useEffect(() => {
    opacity.value = withDelay(
      delayMs,
      withRepeat(
        withTiming(1, {
          duration: THINKING_DOT_DURATION_MS,
          easing: Easing.inOut(Easing.quad),
        }),
        -1,
        true,
      ),
    );
    return () => {
      cancelAnimation(opacity);
    };
  }, [delayMs, opacity]);
  const animatedStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
  }));
  return (
    <Animated.View
      className="w-1.5 h-1.5 rounded-full bg-muted-foreground"
      style={animatedStyle}
    />
  );
}

export function ThinkingDots(): React.ReactElement {
  return (
    <View
      className="flex-row items-center gap-1 py-1"
      accessibilityElementsHidden
      importantForAccessibility="no"
      accessible={false}
    >
      <Dot delayMs={0} />
      <Dot delayMs={THINKING_DOT_STAGGER_MS} />
      <Dot delayMs={THINKING_DOT_STAGGER_MS * 2} />
    </View>
  );
}
