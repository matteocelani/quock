// Pill-shaped search field with leading magnifier + clear-X.

import React from "react";
import { TextInput, View, type TextInputProps } from "react-native";
import clsx from "clsx";
import { Search, X } from "lucide-react-native";
import { useThemeColors } from "@/lib/theme/ThemeContext";
import { iconSize, motion } from "@/lib/design/tokens";
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
  // The iOS ramp's tertiary tint, which is what a placeholder is: any hand-rolled alpha reads as pre-filled text.
  const placeholderColor = colors.labelTertiary;
  const handleClear = (): void => {
    onChangeText("");
  };
  return (
    <View
      // UISearchBar sits on tertiarySystemFill — the translucent wash reads on card and background alike.
      className={clsx(
        "bg-fill-tertiary rounded-full px-3 h-10 flex-row items-center gap-2.5",
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
        className="flex-1 font-sans text-body text-foreground"
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
