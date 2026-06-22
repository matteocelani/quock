// Pill-shaped search field with leading magnifier + clear-X.

import React from "react";
import { TextInput, View, type TextInputProps } from "react-native";
import clsx from "clsx";
import { Search, X } from "lucide-react-native";
import { useThemeColors } from "@/lib/theme/ThemeContext";
import { withAlpha } from "@/lib/design/color";
import { iconSize, motion, opacity } from "@/lib/design/tokens";
import { Pressable } from "@/components/ui/Pressable";

export interface SearchInputProps {
  value: string;
  onChangeText: (next: string) => void;
  placeholder?: string;
  autoCapitalize?: TextInputProps["autoCapitalize"];
  autoCorrect?: boolean;
  returnKeyType?: TextInputProps["returnKeyType"];
  onSubmitEditing?: () => void;
  className?: string;
  testID?: string;
  clearAccessibilityLabel?: string;
}

export function SearchInput({
  value,
  onChangeText,
  placeholder,
  autoCapitalize = "none",
  autoCorrect = false,
  returnKeyType = "search",
  onSubmitEditing,
  className,
  testID,
  clearAccessibilityLabel = "Clear search",
}: SearchInputProps): React.ReactElement {
  const colors = useThemeColors();
  const hasValue = value.length > 0;
  // Foreground @ 50% alpha — mutedForeground over muted bg was too low contrast in light.
  const placeholderColor = withAlpha(colors.foreground, opacity.half);
  const handleClear = (): void => {
    onChangeText("");
  };
  return (
    <View
      className={clsx(
        "bg-muted rounded-full px-3 h-10 flex-row items-center gap-2.5",
        className,
      )}
    >
      <Search size={iconSize.md} color={colors.mutedForeground} />
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={placeholderColor}
        autoCapitalize={autoCapitalize}
        autoCorrect={autoCorrect}
        returnKeyType={returnKeyType}
        onSubmitEditing={onSubmitEditing}
        className="flex-1 font-sans text-foreground text-base"
        testID={testID}
      />
      {hasValue ? (
        <Pressable
          onPress={handleClear}
          scale={motion.scalePressTight}
          haptic={false}
          accessibilityLabel={clearAccessibilityLabel}
          testID={testID ? `${testID}-clear` : undefined}
        >
          <X size={iconSize.md} color={colors.mutedForeground} />
        </Pressable>
      ) : null}
    </View>
  );
}
