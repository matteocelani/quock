// The iOS 27 Scroll Edge Effect: content dissolves into a blur at the edge of a scroller instead of being cut off by
// it. A LinearGradient mask clamps the BlurView's visibility, so the blur is total at the edge and gone by the far end.

import { BlurView } from "expo-blur";
import { LinearGradient } from "expo-linear-gradient";
import MaskedView from "@react-native-masked-view/masked-view";
import React from "react";
import { Platform, StyleSheet } from "react-native";
import { maskPaint } from "@/lib/design/tokens";

export interface ScrollEdgeBlurProps {
  edge: "top" | "bottom";
  // Where the blur is total; it fades to nothing across this distance.
  height: number;
  intensity: number;
}

export function ScrollEdgeBlur({
  edge,
  height,
  intensity,
}: ScrollEdgeBlurProps): React.ReactElement | null {
  if (height <= 0) return null;
  const isTop = edge === "top";
  // `default` tint = no vibrancy wash, just blur; keeps text legible inside the transition zone.
  const androidFallback =
    Platform.OS === "ios"
      ? {}
      : { experimentalBlurMethod: "dimezisBlurView" as const };
  return (
    <MaskedView
      pointerEvents="none"
      style={{
        position: "absolute",
        left: 0,
        right: 0,
        height,
        ...(isTop ? { top: 0 } : { bottom: 0 }),
      }}
      maskElement={
        <LinearGradient
          colors={
            isTop
              ? [maskPaint.opaque, maskPaint.clear]
              : [maskPaint.clear, maskPaint.opaque]
          }
          start={{ x: 0, y: 0 }}
          end={{ x: 0, y: 1 }}
          style={StyleSheet.absoluteFill}
        />
      }
    >
      <BlurView
        tint="default"
        intensity={intensity}
        {...androidFallback}
        style={StyleSheet.absoluteFill}
      />
    </MaskedView>
  );
}
