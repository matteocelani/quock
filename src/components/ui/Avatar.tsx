// Circular user avatar — photo or initials fallback.

import { Image, type ImageSource } from "expo-image";
import React, { useMemo } from "react";
import { StyleSheet, View } from "react-native";
import Svg, { Circle, Path, Text as SvgText } from "react-native-svg";
import { useTheme, useThemeColors } from "@/lib/theme/ThemeContext";
import { size as sizeTokens } from "@/lib/design/tokens";

// Fallback-glyph geometry as ratios of the avatar diameter so the face scales with `size`.
const AVATAR_INITIALS_FONT_RATIO = 0.4;
const AVATAR_INITIALS_FONT_MIN = 10;
const AVATAR_INITIALS_BASELINE_RATIO = 0.35;
const AVATAR_FACE_STROKE_WIDTH = 1.4;
const AVATAR_EYE_RADIUS = 1.2;
const AVATAR_EYE_Y_RATIO = 0.42;
const AVATAR_EYE_LEFT_X_RATIO = 0.4;
const AVATAR_EYE_RIGHT_X_RATIO = 0.6;
const AVATAR_MOUTH_X_RATIO = 0.375;
const AVATAR_MOUTH_Y_RATIO = 0.5;
// Image cross-fade duration and the light-theme ring (1pt reads where the hairline vanishes over gray5).
const AVATAR_IMAGE_TRANSITION_MS = 120;
const AVATAR_LIGHT_RING_WIDTH = 1;

export interface AvatarProps {
  /** Remote image URL. */
  uri?: string;
  /** Bundled local image (e.g. via `require()`). Takes priority over `uri`. */
  source?: ImageSource | number;
  name?: string;
  size?: number;
  testID?: string;
  accessibilityLabel?: string;
}
// Take up to 2 uppercase initials so single-word names still produce a glyph.
function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "";
  if (parts.length === 1) return parts[0].charAt(0).toUpperCase();
  return (
    parts[0].charAt(0).toUpperCase() +
    parts[parts.length - 1].charAt(0).toUpperCase()
  );
}

export function Avatar({
  uri,
  source,
  name,
  size = sizeTokens.avatarDefault,
  testID,
  accessibilityLabel,
}: AvatarProps): React.ReactElement {
  const colors = useThemeColors();
  const { resolved } = useTheme();
  const initials = useMemo(
    () => (name !== undefined ? getInitials(name) : ""),
    [name],
  );
  // Wrapper enforces the circular clip so the SVG fallback path is symmetric with the expo-image rendering.
  const containerStyle = {
    width: size,
    height: size,
    borderRadius: size / 2,
    overflow: "hidden" as const,
    backgroundColor: colors.muted,
  };
  // Bundled local source wins over the remote `uri`; either renders the image.
  const imageSource =
    source !== undefined
      ? source
      : uri !== undefined && uri.length > 0
        ? { uri }
        : null;
  // Light gets 1pt — hairline over the gray5 avatar bg disappears; dark keeps the iOS hairline.
  const ringStyle = {
    position: "absolute" as const,
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    borderRadius: size / 2,
    borderWidth:
      resolved === "light" ? AVATAR_LIGHT_RING_WIDTH : StyleSheet.hairlineWidth,
    borderColor: colors.border,
  };
  if (imageSource !== null) {
    return (
      <View
        style={containerStyle}
        testID={testID}
        accessibilityLabel={accessibilityLabel}
      >
        <Image
          source={imageSource}
          style={{ width: size, height: size }}
          contentFit="cover"
          transition={AVATAR_IMAGE_TRANSITION_MS}
        />
        <View pointerEvents="none" style={ringStyle} />
      </View>
    );
  }
  // Font-size scales with the avatar diameter so small and large avatars stay legible.
  const fontSize = Math.max(
    AVATAR_INITIALS_FONT_MIN,
    Math.round(size * AVATAR_INITIALS_FONT_RATIO),
  );
  return (
    <View
      style={containerStyle}
      testID={testID}
      accessibilityLabel={accessibilityLabel}
    >
      <Svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={size / 2}
          fill={colors.muted}
        />
        {initials.length > 0 ? (
          <SvgText
            x={size / 2}
            y={size / 2 + fontSize * AVATAR_INITIALS_BASELINE_RATIO}
            fontSize={fontSize}
            fontWeight="600"
            fill={colors.foreground}
            textAnchor="middle"
          >
            {initials}
          </SvgText>
        ) : (
          <>
            <Path
              d={`M${size * AVATAR_MOUTH_X_RATIO} ${size * AVATAR_MOUTH_Y_RATIO}c0.5 0.4 1 0.6 1.5 0.6s1-0.2 1.5-0.6`}
              stroke={colors.foreground}
              strokeWidth={AVATAR_FACE_STROKE_WIDTH}
              fill="none"
              strokeLinecap="round"
            />
            <Circle
              cx={size * AVATAR_EYE_LEFT_X_RATIO}
              cy={size * AVATAR_EYE_Y_RATIO}
              r={AVATAR_EYE_RADIUS}
              fill={colors.foreground}
            />
            <Circle
              cx={size * AVATAR_EYE_RIGHT_X_RATIO}
              cy={size * AVATAR_EYE_Y_RATIO}
              r={AVATAR_EYE_RADIUS}
              fill={colors.foreground}
            />
          </>
        )}
      </Svg>
    </View>
  );
}
