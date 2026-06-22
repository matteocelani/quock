// Animated selection ring with a Check that springs in when selected. Shared by the model picker (single-select) and the + hub tool toggles (per-mode on/off).

import { Check } from "lucide-react-native";
import React, { useEffect } from "react";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from "react-native-reanimated";
import { useThemeColors } from "@/lib/theme/ThemeContext";
import { toggleSpring } from "@/lib/design/motion";
import { iconSize, motion, opacity, strokeWidth } from "@/lib/design/tokens";

// Hairline ring width — sits between Tailwind's 1px and 2px, so it lives as a named value rather than a class.
const RING_BORDER_WIDTH = 1.5;

export interface RadioIndicatorProps {
  selected: boolean;
}

// Ring fill flips past the 0.5 progress midpoint; inner Check scales 0.6 to 1 so it lands rather than fading.
function RadioIndicatorImpl({
  selected,
}: RadioIndicatorProps): React.ReactElement {
  const colors = useThemeColors();
  const progress = useSharedValue(selected ? 1 : 0);
  const filledColor = colors.foreground;
  const idleBorder = colors.border;
  useEffect(() => {
    // Spring gives the check a tiny overshoot so the selection lands rather than fading in.
    progress.value = withSpring(selected ? 1 : 0, toggleSpring);
  }, [selected, progress]);
  const ringStyle = useAnimatedStyle(() => ({
    backgroundColor:
      progress.value > opacity.half ? filledColor : "transparent",
    borderColor: progress.value > opacity.half ? filledColor : idleBorder,
  }));
  const checkStyle = useAnimatedStyle(() => ({
    opacity: progress.value,
    transform: [
      { scale: motion.scaleCheckBase + progress.value * motion.scaleCheckRange },
    ],
  }));
  return (
    <Animated.View
      className="w-5.5 h-5.5 rounded-full items-center justify-center"
      style={[{ borderWidth: RING_BORDER_WIDTH }, ringStyle]}
    >
      <Animated.View style={checkStyle}>
        <Check
          size={iconSize.xs}
          color={colors.background}
          strokeWidth={strokeWidth.heavy}
        />
      </Animated.View>
    </Animated.View>
  );
}

export const RadioIndicator = React.memo(RadioIndicatorImpl);
