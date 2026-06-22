// Collapsible reasoning block — open only while it streams live, collapsed once the answer lands or the turn is past.

import React, { useEffect, useState } from "react";
import { Pressable, Text, View } from "react-native";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";
import { Brain, ChevronDown, ChevronRight } from "lucide-react-native";
import { useThemeColors } from "@/lib/theme/ThemeContext";
import { iconSize, strokeWidth, timings } from "@/lib/design/tokens";
import { springEasing } from "@/lib/design/motion";

export interface ThinkingBlockProps {
  thinking: string;
  // This row is the live-streaming turn, and whether its answer has begun.
  isStreaming: boolean;
  hasContent: boolean;
}

function ThinkingBlockImpl({
  thinking,
  isStreaming,
  hasContent,
}: ThinkingBlockProps): React.ReactElement {
  const colors = useThemeColors();
  // Open derived from the live state every render (no stored flag to desync and stick open on a finished turn):
  // open while reasoning streams, collapsed otherwise; a manual tap overrides until the phase flips.
  const liveThinking = isStreaming && !hasContent;
  const [openOverride, setOpenOverride] = useState<boolean | null>(null);
  const open = openOverride ?? liveThinking;
  useEffect(() => {
    setOpenOverride(null);
  }, [liveThinking]);
  const progress = useSharedValue(liveThinking ? 1 : 0);
  useEffect(() => {
    progress.value = withTiming(open ? 1 : 0, {
      duration: timings.base,
      easing: springEasing,
    });
  }, [open, progress]);
  const bodyAnimStyle = useAnimatedStyle(() => ({
    opacity: progress.value,
  }));
  return (
    <View className="mb-2 border-l-2 border-border pl-2.5">
      <Pressable
        onPress={(): void => setOpenOverride(!open)}
        accessibilityRole="button"
        accessibilityLabel={open ? "Hide thinking" : "Show thinking"}
        testID="thinking-block-toggle"
        className="flex-row items-center gap-1.5 py-1"
      >
        <Brain
          size={iconSize.sm}
          color={colors.mutedForeground}
          strokeWidth={strokeWidth.bold}
        />
        <Text className="flex-1 font-sans text-xs text-muted-foreground">Thinking</Text>
        {open ? (
          <ChevronDown
            size={iconSize.sm}
            color={colors.mutedForeground}
            strokeWidth={strokeWidth.bold}
          />
        ) : (
          <ChevronRight
            size={iconSize.sm}
            color={colors.mutedForeground}
            strokeWidth={strokeWidth.bold}
          />
        )}
      </Pressable>
      {open ? (
        <Animated.View className="py-1" style={bodyAnimStyle}>
          <Text
            className="font-sans text-sm text-muted-foreground italic"
            selectable
            testID="thinking-block-body"
          >
            {thinking}
          </Text>
        </Animated.View>
      ) : null}
    </View>
  );
}

// Memoized: props are primitive, so it only re-renders when thinking/isStreaming/hasContent actually change.
export const ThinkingBlock = React.memo(ThinkingBlockImpl);
