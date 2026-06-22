// Single- or multi-line input. Multi-line grows to `maxLines`, then RN's internal scroll kicks in.

import clsx from "clsx";
import React, { useEffect, useState } from "react";
import {
  StyleSheet,
  TextInput,
  type StyleProp,
  type TextStyle,
  type TextInputProps,
} from "react-native";
import Animated, {
  interpolateColor,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";
import { useThemeColors } from "@/lib/theme/ThemeContext";
import { springEasing } from "@/lib/design/motion";
import { componentLayout, size, timingsNamed } from "@/lib/design/tokens";

// Horizontal padding inside the single-line input box, matching the px-3 class on the multi-line baseClass so both modes feel identical.
const SINGLE_LINE_PADDING_X = 12;

export interface TextFieldProps {
  value: string;
  onChangeText: (v: string) => void;
  placeholder?: string;
  autoCapitalize?: "none" | "sentences" | "words" | "characters";
  autoComplete?: TextInputProps["autoComplete"];
  keyboardType?: TextInputProps["keyboardType"];
  multiline?: boolean;
  /** Max number of lines the multi-line field grows to. Default 8. */
  maxLines?: number;
  /** Override the multi-line row height when the caller's typography differs from the default (22 = IBM Plex Sans 16pt). */
  lineHeight?: number;
  /** Mirrors RN TextInput.editable. Defaults to true. */
  editable?: boolean;
  /** Alias for `!editable` to match interactive primitives across the UI. */
  disabled?: boolean;
  onFocus?: () => void;
  onBlur?: () => void;
  className?: string;
  /** Override the multi-line wrapper's classes (rounded-lg surface, border, padding). */
  containerClassName?: string;
  /** Style passed through to the underlying TextInput; lets callers tune typography. */
  inputStyle?: StyleProp<TextStyle>;
  testID?: string;
  accessibilityLabel?: string;
}

export function TextField({
  value,
  onChangeText,
  placeholder,
  autoCapitalize,
  autoComplete,
  keyboardType,
  multiline = false,
  maxLines = 8,
  // 22 = IBM Plex Sans 16pt rendered line-height; callers (e.g. Composer) override.
  lineHeight = componentLayout.composer.inputLineHeight,
  editable = true,
  disabled,
  onFocus,
  onBlur,
  className,
  containerClassName,
  inputStyle,
  testID,
  accessibilityLabel,
}: TextFieldProps): React.ReactElement {
  const colors = useThemeColors();
  const isEditable = disabled !== undefined ? !disabled : editable;
  const [isFocused, setIsFocused] = useState<boolean>(false);
  // 0..1 drives the hairline→primary border crossfade on focus.
  const focusProgress = useSharedValue(0);
  useEffect(() => {
    focusProgress.value = withTiming(isFocused ? 1 : 0, {
      duration: timingsNamed.focus,
      easing: springEasing,
    });
  }, [isFocused, focusProgress]);
  const handleFocus = (): void => {
    setIsFocused(true);
    onFocus?.();
  };
  const handleBlur = (): void => {
    setIsFocused(false);
    onBlur?.();
  };
  const animatedBorderStyle = useAnimatedStyle(() => ({
    borderColor: interpolateColor(
      focusProgress.value,
      [0, 1],
      [colors.border, colors.primary],
    ),
  }));
  // Border lives on the wrapper so Reanimated can animate its color without doubling the inner input's own line.
  const baseClass = "bg-card rounded-lg text-foreground font-sans text-base px-3";
  if (!multiline) {
    return (
      <Animated.View
        className="bg-card rounded-lg"
        // `alignSelf: 'stretch'` forces span on Fabric iOS 26 — width:100% loses to intrinsic content width.
        style={[
          {
            borderWidth: StyleSheet.hairlineWidth,
            width: "100%",
            alignSelf: "stretch",
            height: size.hitTargetMin,
            overflow: "hidden",
          },
          animatedBorderStyle,
        ]}
      >
        <TextInput
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor={colors.mutedForeground}
          autoCapitalize={autoCapitalize}
          autoComplete={autoComplete}
          keyboardType={keyboardType}
          editable={isEditable}
          onFocus={handleFocus}
          onBlur={handleBlur}
          multiline={false}
          numberOfLines={1}
          // Belt-and-braces against any internal RN path that might toggle the text view to lay out as a multi-line measurer.
          scrollEnabled
          testID={testID}
          accessibilityLabel={accessibilityLabel}
          className={clsx("text-foreground font-sans text-base px-3", className)}
          style={[
            { flex: 1, width: "100%", paddingHorizontal: SINGLE_LINE_PADDING_X },
            inputStyle,
          ]}
        />
      </Animated.View>
    );
  }

  // No explicit `height` — RN auto-sizes the multiline TextInput between minHeight and maxHeight; past maxHeight it scrolls internally. Manual contentSize tracking jittered on iOS Fabric, so the platform owns the layout.
  const paddingY = componentLayout.composer.inputPaddingY;
  const oneLineHeight = lineHeight + paddingY * 2;
  const maxHeight = maxLines * lineHeight + paddingY * 2;
  // Pin to one line while empty: iOS Fabric keeps a stale multi-line contentSize for a frame after a programmatic
  // clear (e.g. on send), flashing the box to two lines. Deriving from value (not contentSize) avoids the jitter.
  const isEmpty = value.length === 0;
  // When the caller owns the container surface the inner TextInput drops its own padding/border to avoid doubling.
  const hasCustomContainer = containerClassName !== undefined;
  const wrapperClass = hasCustomContainer
    ? containerClassName
    : "bg-card rounded-lg justify-center";
  const innerClass = hasCustomContainer
    ? clsx("text-foreground font-sans text-base", className)
    : clsx(baseClass, className);
  return (
    <Animated.View
      className={wrapperClass}
      style={
        hasCustomContainer
          ? undefined
          : [{ borderWidth: StyleSheet.hairlineWidth }, animatedBorderStyle]
      }
    >
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={colors.mutedForeground}
        autoCapitalize={autoCapitalize}
        autoComplete={autoComplete}
        keyboardType={keyboardType}
        editable={isEditable}
        onFocus={handleFocus}
        onBlur={handleBlur}
        multiline
        testID={testID}
        accessibilityLabel={accessibilityLabel}
        style={[
          {
            paddingTop: paddingY,
            paddingBottom: paddingY,
            textAlignVertical: "top",
            minHeight: oneLineHeight,
            maxHeight,
            ...(isEmpty ? { height: oneLineHeight } : null),
          },
          inputStyle,
        ]}
        className={innerClass}
      />
    </Animated.View>
  );
}
