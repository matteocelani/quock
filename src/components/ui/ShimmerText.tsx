// A band of light crossing a word, for a label that means "this is happening right now". Directional on purpose: a
// pulse says "alive", a sweep says "progressing", and the difference is what tells a long wait apart from a freeze.

import React, { useEffect, useState } from "react";
import clsx from "clsx";
import { LinearGradient } from "expo-linear-gradient";
import MaskedView from "@react-native-masked-view/masked-view";
import { StyleSheet, Text, View, type LayoutChangeEvent } from "react-native";
import Animated, {
  Easing,
  cancelAnimation,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from "react-native-reanimated";
import { useThemeColors } from "@/lib/theme/ThemeContext";
import { componentLayout, timingsNamed } from "@/lib/design/tokens";

export interface ShimmerTextProps {
  text: string;
  // While false the label is painted flat — the sweep is the claim that something is happening, so it must stop when
  // nothing is.
  isActive: boolean;
  // Type + base tint, so a caller can place this at any tier of the ramp.
  className: string;
  baseColor: string;
}

export function ShimmerText({
  text,
  isActive,
  className,
  baseColor,
}: ShimmerTextProps): React.ReactElement {
  const colors = useThemeColors();
  const band = componentLayout.shimmerText.bandWidth;
  // Measured, so the band always crosses the whole word whatever the copy or the locale makes of it.
  const [width, setWidth] = useState<number>(0);
  const progress = useSharedValue<number>(0);

  useEffect(() => {
    if (!isActive) {
      cancelAnimation(progress);
      progress.value = 0;
      return;
    }
    progress.value = withRepeat(
      withTiming(1, {
        duration: timingsNamed.shimmerSweep,
        easing: Easing.inOut(Easing.quad),
      }),
      -1,
      false,
    );
    return () => {
      cancelAnimation(progress);
    };
  }, [isActive, progress]);

  const sweepStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: interpolate(progress.value, [0, 1], [-width, width]) },
    ],
  }));

  const handleLayout = (e: LayoutChangeEvent): void => {
    setWidth(e.nativeEvent.layout.width);
  };

  if (!isActive) {
    return (
      <Text className={className} style={{ color: baseColor }}>
        {text}
      </Text>
    );
  }
  return (
    <MaskedView
      maskElement={
        <Text className={className} onLayout={handleLayout}>
          {text}
        </Text>
      }
    >
      {/* Both layers live inside the glyphs: the flat tint is the label's real colour and the travelling band is the
          only thing that moves. Stacking two copies of the text instead would show the lower one's edges. */}
      <Text className={clsx(className, "opacity-0")}>{text}</Text>
      <View style={[StyleSheet.absoluteFill, { backgroundColor: baseColor }]} />
      {width > 0 ? (
        <Animated.View
          style={[StyleSheet.absoluteFill, sweepStyle]}
          pointerEvents="none"
        >
          <LinearGradient
            colors={["transparent", colors.label, "transparent"]}
            locations={[0.5 - band / 2, 0.5, 0.5 + band / 2]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={StyleSheet.absoluteFill}
          />
        </Animated.View>
      ) : null}
    </MaskedView>
  );
}
