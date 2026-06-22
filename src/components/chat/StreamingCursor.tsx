// Blinking caret shown while the assistant streams; a small bar whose opacity oscillates on the UI thread via a Reanimated worklet.

import React, { useEffect } from "react";
import Animated, {
  Easing,
  cancelAnimation,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from "react-native-reanimated";
import { STREAMING_CURSOR_DURATION_MS, STREAMING_CURSOR_MIN_OPACITY } from "@/modules/chat/constants";

export function StreamingCursor(): React.ReactElement {
  const opacity = useSharedValue(1);
  useEffect(() => {
    // `reverse=true` + ease-in-out-quad turns a strobe blink into a breathing pulse.
    opacity.value = withRepeat(
      withTiming(STREAMING_CURSOR_MIN_OPACITY, {
        duration: STREAMING_CURSOR_DURATION_MS,
        easing: Easing.inOut(Easing.quad),
      }),
      -1,
      true,
    );
    return () => {
      cancelAnimation(opacity);
    };
  }, [opacity]);
  const animatedStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
  }));
  // a11y: the cursor is purely decorative; hide it from screen readers.
  return (
    <Animated.View
      className="w-0.5 h-3 bg-muted-foreground ml-0.5"
      style={animatedStyle}
      accessibilityElementsHidden
      importantForAccessibility="no"
      accessible={false}
    />
  );
}
