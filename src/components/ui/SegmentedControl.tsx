// N-option selector with a Reanimated sliding indicator.

import clsx from "clsx";
import React, { useEffect, useState } from "react";
import {
  LayoutChangeEvent,
  Pressable,
  Text,
  View,
} from "react-native";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from "react-native-reanimated";
import { useThemeColors } from "@/lib/theme/ThemeContext";
import { toggleSpring } from "@/lib/design/motion";
import { componentLayout, shadow } from "@/lib/design/tokens";

export interface SegmentedOption {
  label: string;
  value: string;
}

export type SegmentedControlSize = "default" | "compact";
export interface SegmentedControlProps {
  options: SegmentedOption[];
  value: string;
  onChange: (v: string) => void;
  size?: SegmentedControlSize;
  disabled?: boolean;
  className?: string;
  testID?: string;
  accessibilityLabel?: string;
}

const SC = componentLayout.segmentedControl;
// Default = 28pt iOS UISegmentedControl height; compact fits inside a ListRow trailing slot.
const SIZE_RECIPES: Record<
  SegmentedControlSize,
  { padVertical: number; fontSize: number }
> = {
  default: { padVertical: SC.defaultPadVertical, fontSize: SC.defaultFontSize },
  compact: { padVertical: SC.compactPadVertical, fontSize: SC.compactFontSize },
};

export function SegmentedControl({
  options,
  value,
  onChange,
  size = "default",
  disabled = false,
  className,
  testID,
  accessibilityLabel,
}: SegmentedControlProps): React.ReactElement {
  const colors = useThemeColors();
  // Indicator positions in absolute px; hidden until first layout measurement arrives.
  const [width, setWidth] = useState<number>(0);
  // Measure against the track's inner width (full width minus the 2px inset on each side) so segments align with their Pressables and the rightmost indicator stays inside the track.
  const innerWidth = Math.max(0, width - SC.indicatorInset * 2);
  const segmentWidth = options.length > 0 ? innerWidth / options.length : 0;
  const selectedIndex = Math.max(
    0,
    options.findIndex((o) => o.value === value),
  );
  const progress = useSharedValue(selectedIndex);
  // Spring with overshoot — replaces the timing-cut for the iOS feel.
  useEffect(() => {
    progress.value = withSpring(selectedIndex, toggleSpring);
  }, [selectedIndex, progress]);
  const indicatorStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: progress.value * segmentWidth }],
    width: segmentWidth,
  }));
  const handleLayout = (e: LayoutChangeEvent): void => {
    setWidth(e.nativeEvent.layout.width);
  };

  const recipe = SIZE_RECIPES[size];
  // Fabric+Pressable edge case: `flex: 1` from a StyleSheet doesn't propagate into the style callback — percentage width works.
  const segmentPercent: `${number}%` =
    options.length > 0 ? `${100 / options.length}%` : "100%";
  return (
    <View
      onLayout={handleLayout}
      testID={testID}
      accessibilityLabel={accessibilityLabel}
      className={clsx(
        "bg-muted rounded-lg p-0.5 flex-row relative",
        disabled && "opacity-50",
        className,
      )}
    >
      {/* Hidden until width is measured so the first paint is not misaligned. */}
      {width > 0 ? (
        <Animated.View
          pointerEvents="none"
          className="absolute top-0.5 bottom-0.5 left-0.5 bg-card rounded-md"
          style={[
            {
              shadowColor: colors.shadow,
              shadowOpacity: shadow.control.opacity,
              shadowRadius: shadow.control.radius,
              shadowOffset: { width: 0, height: shadow.control.offsetY },
              elevation: shadow.control.elevation,
            },
            indicatorStyle,
          ]}
        />
      ) : null}
      {options.map((opt) => {
        const isSelected = opt.value === value;
        return (
          // Static style on the Pressable (no callback) since Fabric drops styles from callbacks; the inner View centers the Text via its own layout.
          <Pressable
            key={opt.value}
            onPress={() => onChange(opt.value)}
            disabled={disabled}
            style={{ width: segmentPercent }}
          >
            <View
              className="items-center justify-center"
              style={{ paddingVertical: recipe.padVertical }}
            >
              <Text
                className={clsx(
                  "font-medium",
                  isSelected ? "text-foreground" : "text-muted-foreground",
                )}
                style={{ fontSize: recipe.fontSize }}
              >
                {opt.label}
              </Text>
            </View>
          </Pressable>
        );
      })}
    </View>
  );
}
