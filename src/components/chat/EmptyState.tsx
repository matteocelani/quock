// Shown when a chat has zero messages: a centered hero with a short greeting inviting the user to start typing.

import React, { useEffect } from "react";
import { Text, View } from "react-native";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";
import { springEasing } from "@/lib/design/motion";
import { EMPTY_STATE_FADE_MS } from "@/modules/chat/constants";

export function EmptyState(): React.ReactElement {
  // Hero fade-in driven by explicit shared value so it fires once at mount, not on every parent re-render.
  const opacity = useSharedValue(0);
  useEffect(() => {
    opacity.value = withTiming(1, {
      duration: EMPTY_STATE_FADE_MS,
      easing: springEasing,
    });
  }, [opacity]);
  const animatedStyle = useAnimatedStyle(() => ({ opacity: opacity.value }));
  return (
    <Animated.View style={animatedStyle} className="flex-1 justify-end pb-4">
      <View className="flex-1 items-center justify-center px-6">
        <Text className="font-sans font-semibold text-foreground text-center text-xl mb-1.5">
          Start a conversation
        </Text>
        <Text className="font-sans text-muted-foreground text-center text-sm max-w-65">
          Ask anything to get started.
        </Text>
      </View>
    </Animated.View>
  );
}
