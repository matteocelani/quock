// Drives a 0..1 SharedValue that follows `visible` through the design system's spring easing. Returned value is consumed by useAnimatedStyle in the caller.

import { useEffect } from "react";
import {
  type SharedValue,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";
import { baseAnimationDurationMs, springEasing } from "@/lib/design/motion";

export function useFadeProgress(visible: boolean): SharedValue<number> {
  const progress = useSharedValue(visible ? 1 : 0);
  useEffect(() => {
    progress.value = withTiming(visible ? 1 : 0, {
      duration: baseAnimationDurationMs,
      easing: springEasing,
    });
  }, [progress, visible]);
  return progress;
}
