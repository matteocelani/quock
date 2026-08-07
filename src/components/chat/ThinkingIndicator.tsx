// Shown before the model has produced anything at all. Once reasoning text exists the ThinkingBlock takes over and
// shimmers its own header instead: two labels both reading "Thinking" is one more than the screen needs.

import React from "react";
import { View } from "react-native";
import { Brain } from "lucide-react-native";
import { ShimmerText } from "@/components/ui/ShimmerText";
import { useThemeColors } from "@/lib/theme/ThemeContext";
import { iconSize, strokeWidth } from "@/lib/design/tokens";

export function ThinkingIndicator(): React.ReactElement {
  const colors = useThemeColors();
  return (
    <View className="flex-row items-center gap-1.5">
      {/* Still: with the light already travelling, a second moving thing reads as clutter rather than as life. */}
      <Brain
        size={iconSize.md}
        color={colors.labelTertiary}
        strokeWidth={strokeWidth.regular}
      />
      <ShimmerText
        text="Thinking"
        isActive
        className="font-sans text-footnote"
        baseColor={colors.labelTertiary}
      />
    </View>
  );
}
