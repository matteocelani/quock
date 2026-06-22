// Absolute-overlay dialog — render inside a Sheet `overlays` slot so `inset-0` resolves to the full display.

import React, { useEffect } from "react";
import { Pressable as RNPressable, Text, View } from "react-native";
import Animated, {
  FadeIn,
  FadeOut,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from "react-native-reanimated";
import { useThemeColors } from "@/lib/theme/ThemeContext";
import { baseAnimationDurationMs, surfaceSpring } from "@/lib/design/motion";
import { Button } from "@/components/ui/Button";
import { componentLayout, motion, shadow, size, zLayer } from "@/lib/design/tokens";
import { TextField } from "@/components/ui/TextField";

export interface ConfirmDialogProps {
  visible: boolean;
  title: string;
  message?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  destructive?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
  // When provided, renders a single-line input above the actions (e.g. rename flow). Value is controlled by the caller.
  inputValue?: string;
  onChangeInput?: (value: string) => void;
  inputPlaceholder?: string;
  confirmDisabled?: boolean;
  testID?: string;
}
export function ConfirmDialog({
  visible,
  title,
  message,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  destructive = false,
  onConfirm,
  onCancel,
  inputValue,
  onChangeInput,
  inputPlaceholder,
  confirmDisabled = false,
  testID,
}: ConfirmDialogProps): React.ReactElement | null {
  const colors = useThemeColors();
  // Card scales from motion.scaleDialogFrom to 1 on a spring, giving the modal a confident pop on entrance.
  const scale = useSharedValue(visible ? 1 : motion.scaleDialogFrom);
  const cardOpacity = useSharedValue(visible ? 1 : 0);
  useEffect(() => {
    scale.value = withSpring(
      visible ? 1 : motion.scaleDialogFrom,
      surfaceSpring,
    );
    cardOpacity.value = withTiming(visible ? 1 : 0, {
      duration: baseAnimationDurationMs,
    });
  }, [visible, scale, cardOpacity]);
  const cardAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
    opacity: cardOpacity.value,
  }));
  if (!visible) return null;
  return (
    <Animated.View
      entering={FadeIn.duration(baseAnimationDurationMs)}
      exiting={FadeOut.duration(baseAnimationDurationMs)}
      className="absolute inset-0 items-center justify-center px-6"
      style={{ zIndex: zLayer.dialog }}
      pointerEvents="auto"
      testID={testID}
    >
      <RNPressable
        accessibilityRole="button"
        accessibilityLabel="Dismiss dialog"
        onPress={onCancel}
        className="absolute inset-0 bg-scrim"
      />
      <Animated.View
        // Shadow on the wrapper so the inner `overflow: hidden` card doesn't clip it.
        style={[
          {
            width: "100%",
            maxWidth: size.cardWidth,
            shadowColor: colors.shadow,
            shadowOpacity: shadow.dialog.opacity,
            shadowRadius: shadow.dialog.radius,
            shadowOffset: { width: 0, height: shadow.dialog.offsetY },
            elevation: shadow.dialog.elevation,
          },
          cardAnimatedStyle,
        ]}
        pointerEvents="box-none"
        accessibilityViewIsModal
        accessibilityLiveRegion="polite"
      >
        {/* Solid surface — Apple HIG alerts use an opaque card so the message + input + actions read sharply against any underlying content (sheets, screens, photos). Glass on glass made it hard to parse the text. */}
        <View
          className="bg-card"
          style={{ borderRadius: componentLayout.dialog.cornerRadius, overflow: "hidden" }}
        >
          <View className="p-5">
            <Text
              className="font-sans font-semibold text-foreground text-lg text-center"
              numberOfLines={1}
            >
              {title}
            </Text>
            {message !== undefined ? (
              <Text className="mt-1.5 font-sans text-muted-foreground text-sm text-center">
                {message}
              </Text>
            ) : null}
            {onChangeInput !== undefined ? (
              <View className="mt-3.5 w-full">
                {/* Multiline (maxLines=3) instead of single-line: a long pre-filled value on iOS Fabric renders as a static UILabel (which wraps) until the input is focused, then snaps back to single-line — we couldn't stop it across three rewrites. Multiline lets the box grow with the content so the title is fully visible without that flicker. */}
                <TextField
                  value={inputValue ?? ""}
                  onChangeText={onChangeInput}
                  placeholder={inputPlaceholder}
                  autoCapitalize="sentences"
                  multiline
                  maxLines={3}
                  testID="confirm-dialog-input"
                />
              </View>
            ) : null}
            <View className="flex-row gap-2.5 mt-4.5">
              <View className="flex-1">
                <Button variant="secondary" fullWidth onPress={onCancel}>
                  {cancelLabel}
                </Button>
              </View>
              <View className="flex-1">
                <Button
                  variant={destructive ? "destructive" : "primary"}
                  fullWidth
                  disabled={confirmDisabled}
                  onPress={onConfirm}
                >
                  {confirmLabel}
                </Button>
              </View>
            </View>
          </View>
        </View>
      </Animated.View>
    </Animated.View>
  );
}
