// Rim light on the excerpt spotlight, ported from the web BorderGlow and looping instead of pointer-driven.
// RN has no conic-gradient mask, so each of its three layers is rebuilt: see the commit for the mapping.
import React from "react";
import { Platform, StyleSheet, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import MaskedView from "@react-native-masked-view/masked-view";
import Animated, {
  cancelAnimation,
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
  type SharedValue,
} from "react-native-reanimated";
import Svg, {
  ClipPath,
  Defs,
  G,
  Path,
  RadialGradient,
  Rect,
  Stop,
} from "react-native-svg";
import { useThemeColors } from "@/lib/theme/ThemeContext";
import { boxShadow, componentLayout, maskPaint } from "@/lib/design/tokens";
import { EXCERPT_GLOW_LAP_MS } from "@/modules/chat/constants";
import type { SpotlightRect } from "@/lib/types/geometry";

// GRADIENT_POSITIONS paired with COLOR_MAP from the source, unchanged: SVG gradient centres, not design values.
const MESH = [
  { x: 0.8, y: 0.55, color: 0 },
  { x: 0.69, y: 0.34, color: 1 },
  { x: 0.08, y: 0.06, color: 2 },
  { x: 0.41, y: 0.38, color: 0 },
  { x: 0.86, y: 0.85, color: 1 },
  { x: 0.82, y: 0.18, color: 2 },
  { x: 0.51, y: 0.04, color: 1 },
] as const;

// Its edge-light cone is `black 2.5%, transparent 10%` mirrored: a narrow core with a fade, as three stacked wedges.
const CONE = [
  { spreadDeg: 9, alpha: 1 },
  { spreadDeg: 22, alpha: 0.4 },
  { spreadDeg: 40, alpha: 0.14 },
] as const;

function roundedRectPath(
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
): string {
  return `M ${x + r} ${y} H ${x + w - r} A ${r} ${r} 0 0 1 ${x + w} ${y + r} V ${y + h - r} A ${r} ${r} 0 0 1 ${x + w - r} ${y + h} H ${x + r} A ${r} ${r} 0 0 1 ${x} ${y + h - r} V ${y + r} A ${r} ${r} 0 0 1 ${x + r} ${y} Z`;
}

// Pie slice centred on straight up, so rotating the parent aims it at the current angle.
function wedgePath(centre: number, radius: number, spreadDeg: number): string {
  const toRad = (deg: number): number => ((deg - 90) * Math.PI) / 180;
  const a0 = toRad(-spreadDeg);
  const a1 = toRad(spreadDeg);
  return `M ${centre} ${centre} L ${centre + radius * Math.cos(a0)} ${
    centre + radius * Math.sin(a0)
  } A ${radius} ${radius} 0 ${spreadDeg > 90 ? 1 : 0} 1 ${
    centre + radius * Math.cos(a1)
  } ${centre + radius * Math.sin(a1)} Z`;
}

export interface SpotlightGlowProps {
  rect: SpotlightRect;
  /** The menu's open progress, so the rim arrives and leaves with the dim. */
  progress: SharedValue<number>;
}

const SPOTLIGHT = componentLayout.excerptMenu;

export function SpotlightGlow({
  rect,
  progress,
}: SpotlightGlowProps): React.ReactElement | null {
  const colors = useThemeColors();
  // Clamped: a one-line excerpt can be shorter than two radii, and the path's vertical edges would then reverse.
  const radius = Math.min(
    SPOTLIGHT.spotlightRadius,
    rect.width / 2,
    rect.height / 2,
  );
  // Both masks turn, so each is a square on the rim's diagonal — otherwise a corner leaves the mask mid-lap.
  const side = Math.hypot(rect.width, rect.height) + SPOTLIGHT.glowReach * 2;
  const centre = side / 2;
  const angle = useSharedValue(0);
  React.useEffect(() => {
    angle.value = withRepeat(
      withTiming(1, { duration: EXCERPT_GLOW_LAP_MS, easing: Easing.linear }),
      -1,
      false,
    );
    return () => {
      cancelAnimation(angle);
    };
  }, [angle]);
  const fadeStyle = useAnimatedStyle(() => ({ opacity: progress.value }));
  const spinStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${angle.value * 360}deg` }],
  }));
  // Android renders nothing: MaskedView there never applies the mask child's rotation, so the light would sit frozen
  // and offset while still allocating a bitmap per mask per frame.
  const isSupported = Platform.OS === "ios";
  const squareStyle = {
    position: "absolute" as const,
    left: (rect.width - side) / 2,
    top: (rect.height - side) / 2,
    width: side,
    height: side,
  };
  if (!isSupported) return null;
  return (
    <Animated.View
      pointerEvents="none"
      accessible={false}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={[
        {
          position: "absolute",
          left: rect.left,
          top: rect.top,
          width: rect.width,
          height: rect.height,
        },
        fadeStyle,
      ]}
    >
      <MaskedView
        style={StyleSheet.absoluteFill}
        maskElement={
          <Animated.View style={[squareStyle, spinStyle]}>
            <LinearGradient
              colors={[maskPaint.opaque, maskPaint.clear]}
              locations={[0, SPOTLIGHT.coneFadeStop]}
              style={StyleSheet.absoluteFill}
            />
          </Animated.View>
        }
      >
        <Svg width={rect.width} height={rect.height}>
          <Defs>
            <ClipPath id="excerptRim">
              <Path
                d={`${roundedRectPath(0, 0, rect.width, rect.height, radius)} ${roundedRectPath(
                  SPOTLIGHT.rimWidth,
                  SPOTLIGHT.rimWidth,
                  rect.width - SPOTLIGHT.rimWidth * 2,
                  rect.height - SPOTLIGHT.rimWidth * 2,
                  Math.max(0, radius - SPOTLIGHT.rimWidth),
                )}`}
                fillRule="evenodd"
              />
            </ClipPath>
            {MESH.map((mesh, index) => (
              <RadialGradient
                key={`mesh-${index}`}
                id={`excerptMesh${index}`}
                cx={`${mesh.x * 100}%`}
                cy={`${mesh.y * 100}%`}
                r="50%"
              >
                <Stop
                  offset="0"
                  stopColor={colors.excerptRimMesh[mesh.color]}
                />
                <Stop
                  offset="1"
                  stopColor={colors.excerptRimMesh[mesh.color]}
                  stopOpacity="0"
                />
              </RadialGradient>
            ))}
          </Defs>
          <G clipPath="url(#excerptRim)">
            {MESH.map((_, index) => (
              <Rect
                key={`fill-${index}`}
                width={rect.width}
                height={rect.height}
                fill={`url(#excerptMesh${index})`}
              />
            ))}
          </G>
        </Svg>
      </MaskedView>
      <MaskedView
        style={StyleSheet.absoluteFill}
        maskElement={
          <Animated.View style={[squareStyle, spinStyle]}>
            <Svg width={side} height={side}>
              {CONE.map((cone) => (
                <Path
                  key={`cone-${cone.spreadDeg}`}
                  d={wedgePath(centre, centre, cone.spreadDeg)}
                  fill={maskPaint.opaque}
                  fillOpacity={cone.alpha}
                />
              ))}
            </Svg>
          </Animated.View>
        }
      >
        <View
          style={[
            StyleSheet.absoluteFillObject,
            { borderRadius: radius, boxShadow: boxShadow.excerptRim },
          ]}
        />
      </MaskedView>
    </Animated.View>
  );
}
