// Absolute-overlay dialog — render inside a Sheet `overlays` slot so `inset-0` resolves to the full display.

import clsx from "clsx";
import React, { useEffect } from "react";
import {
  Pressable as RNPressable,
  Text,
  useWindowDimensions,
  View,
} from "react-native";
import Animated, {
  FadeIn,
  FadeOut,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from "react-native-reanimated";
import { useTheme } from "@/lib/theme/ThemeContext";
import { baseAnimationDurationMs, surfaceSpring } from "@/lib/design/motion";
import { Pressable } from "@/components/ui/Pressable";
import {
  boxShadow,
  componentLayout,
  motion,
  zLayer,
} from "@/lib/design/tokens";
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
  inputMaxLength?: number;
  confirmDisabled?: boolean;
  testID?: string;
}

interface AlertActionProps {
  label: string;
  onPress: () => void;
  surfaceClass: string;
  labelClass: string;
  disabled?: boolean;
}
// iOS 27 alert action pill — the 48pt alert tier sits between Button md/lg, so the alert owns its
// action recipe as the one sanctioned exception to the <Button>-for-CTAs rule (AGENTS.md §How to add things).
function AlertAction({
  label,
  onPress,
  surfaceClass,
  labelClass,
  disabled = false,
}: AlertActionProps): React.ReactElement {
  return (
    // Surface lives on the wrapper: Pressable paints className on two nested views, which would double a translucent fill.
    <View
      className={clsx("flex-1 rounded-full overflow-hidden", surfaceClass)}
      style={{ height: componentLayout.alertDialog.buttonHeight }}
    >
      <Pressable
        onPress={onPress}
        disabled={disabled}
        className="flex-1 items-center justify-center"
      >
        <Text className={clsx("font-sans font-semibold text-body", labelClass)}>
          {label}
        </Text>
      </Pressable>
    </View>
  );
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
  inputMaxLength,
  confirmDisabled = false,
  testID,
}: ConfirmDialogProps): React.ReactElement | null {
  const { resolved } = useTheme();
  const { width: windowWidth } = useWindowDimensions();
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
      // On the card this only hid the scrim; the sheet behind stayed in the VoiceOver tree.
      accessibilityViewIsModal
      accessibilityLiveRegion="polite"
      testID={testID}
    >
      <RNPressable
        accessibilityRole="button"
        accessibilityLabel="Dismiss dialog"
        onPress={onCancel}
        className="absolute inset-0 bg-scrim"
      />
      <Animated.View
        // §11 alert carries the Sheet's shadow ring; it sits on this unclipped wrapper (radius matched so the hairline hugs the card curve) because the inner `overflow: hidden` card would clip it.
        style={[
          {
            width: "100%",
            maxWidth: Math.min(
              Math.max(
                windowWidth * componentLayout.alertDialog.widthRatio,
                componentLayout.alertDialog.widthMin,
              ),
              componentLayout.alertDialog.widthMax,
            ),
            borderRadius: componentLayout.alertDialog.cornerRadius,
            boxShadow: boxShadow.sheet[resolved],
          },
          cardAnimatedStyle,
        ]}
        pointerEvents="box-none"
      >
        {/* Near-opaque card material — iOS 27 alerts stay readable over any underlying content (sheets, screens, photos); a frosted blur inside a Modal added weight without payoff. */}
        <View
          className="bg-card"
          style={{
            borderRadius: componentLayout.alertDialog.cornerRadius,
            overflow: "hidden",
          }}
        >
          <View style={{ padding: componentLayout.alertDialog.padding }}>
            {/* §11 text block spacing is exact pt from tokens — stock pt-2/mt-1/mt-4 silently miss the extracted values at the 14px rem. */}
            <View
              style={{
                paddingTop: componentLayout.alertDialog.blockPaddingTop,
                paddingHorizontal: componentLayout.alertDialog.blockPaddingX,
                paddingBottom:
                  onChangeInput === undefined
                    ? componentLayout.alertDialog.blockPaddingBottom
                    : componentLayout.alertDialog.blockGap,
                gap: componentLayout.alertDialog.blockGap,
              }}
            >
              <Text
                className="font-sans font-semibold text-headline text-label text-center"
                numberOfLines={1}
              >
                {title}
              </Text>
              {message !== undefined ? (
                <Text className="font-sans text-body text-label-secondary text-center">
                  {message}
                </Text>
              ) : null}
            </View>
            {/* Outside the text block on purpose: Apple lines the field up with the action row, and matching that inset
                is what makes the concentric corner (card 34 − padding 14 = 20) correct instead of merely chosen. */}
            {onChangeInput !== undefined ? (
              <View
                style={{
                  paddingBottom: componentLayout.alertDialog.blockPaddingBottom,
                }}
              >
                {/* Multiline (maxLines=3) instead of single-line: a long pre-filled value on iOS Fabric renders as a static UILabel (which wraps) until the input is focused, then snaps back to single-line — we couldn't stop it across three rewrites. Multiline lets the box grow with the content so the title is fully visible without that flicker. */}
                <TextField
                  value={inputValue ?? ""}
                  onChangeText={onChangeInput}
                  placeholder={inputPlaceholder}
                  {...(inputMaxLength !== undefined
                    ? { maxLength: inputMaxLength }
                    : {})}
                  autoCapitalize="sentences"
                  multiline
                  maxLines={3}
                  testID="confirm-dialog-input"
                  // Padding on the container, not the input: it insets the TextInput frame so the scroll indicator
                  // rides 14pt inside the 20pt curve instead of on top of it.
                  containerClassName="bg-fill-secondary justify-center px-4"
                  containerStyle={{
                    borderRadius: componentLayout.alertDialog.textAreaRadius,
                    minHeight: componentLayout.alertDialog.textAreaMinHeight,
                  }}
                  className="text-body font-medium"
                />
              </View>
            ) : null}
            <View
              className="flex-row"
              style={{ gap: componentLayout.alertDialog.buttonGap }}
            >
              <AlertAction
                label={cancelLabel}
                onPress={onCancel}
                surfaceClass="bg-fill-secondary"
                labelClass="text-label"
              />
              {/* Destructive role = red label on the neutral fill — iOS alerts never paint a solid red action. */}
              <AlertAction
                label={confirmLabel}
                onPress={onConfirm}
                disabled={confirmDisabled}
                surfaceClass={destructive ? "bg-fill-secondary" : "bg-primary"}
                labelClass={
                  destructive ? "text-destructive" : "text-primary-foreground"
                }
              />
            </View>
          </View>
        </View>
      </Animated.View>
    </Animated.View>
  );
}
