// Two icons sharing one box, crossing as a caller-owned progress goes 0 → 1. It runs NO animation of its own: the
// swap belongs to the movement it describes, so it can follow a finger mid-drag instead of firing after the fact.

import React from "react";
import { StyleSheet, View } from "react-native";
import Animated, {
  Extrapolation,
  interpolate,
  useAnimatedStyle,
  type SharedValue,
} from "react-native-reanimated";
import { componentLayout } from "@/lib/design/tokens";

export interface IconSwapProps {
  // 0 shows `first`, 1 shows `second`, and every value between shows the crossing.
  progress: SharedValue<number>;
  first: React.ReactNode;
  second: React.ReactNode;
  size: number;
}

export function IconSwap({
  progress,
  first,
  second,
  size,
}: IconSwapProps): React.ReactElement {
  const { startScale, exitScale, fadeOutBy, fadeInFrom } =
    componentLayout.iconSwap;
  // Opacity and scale only. A blur would match the CSS original, but CSS blurs on the compositor for free while here it
  // re-rasterises a vector glyph every frame — the one property that turns a 60fps swap into a stutter.
  const firstStyle = useAnimatedStyle(() => ({
    opacity: interpolate(
      progress.value,
      [0, fadeOutBy],
      [1, 0],
      Extrapolation.CLAMP,
    ),
    transform: [{ scale: 1 + progress.value * (exitScale - 1) }],
  }));
  const secondStyle = useAnimatedStyle(() => ({
    opacity: interpolate(
      progress.value,
      [fadeInFrom, 1],
      [0, 1],
      Extrapolation.CLAMP,
    ),
    transform: [{ scale: startScale + progress.value * (1 - startScale) }],
  }));

  return (
    <View style={{ width: size, height: size }}>
      <Animated.View
        style={[StyleSheet.absoluteFill, styles.center, firstStyle]}
      >
        {first}
      </Animated.View>
      <Animated.View
        style={[StyleSheet.absoluteFill, styles.center, secondStyle]}
      >
        {second}
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  center: { alignItems: "center", justifyContent: "center" },
});
