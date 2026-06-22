// Unified bottom-sheet header row — centered title with fixed-width left/right slots.

import React from "react";
import { Text, View } from "react-native";

export interface SheetHeaderProps {
  title: string;
  /** Optional left slot (back chevron, close ×, etc). Renders as a 44pt-wide spacer when absent so the title stays centered. */
  left?: React.ReactNode;
  /** Optional right slot (close ×, primary action, etc). Same 44pt-wide spacer fallback. */
  right?: React.ReactNode;
  testID?: string;
}

export function SheetHeader({
  title,
  left,
  right,
  testID,
}: SheetHeaderProps): React.ReactElement {
  return (
    <View className="flex-row items-center h-11 px-4" testID={testID}>
      <View className="w-11 h-11 items-start justify-center">{left}</View>
      <Text
        className="flex-1 text-center font-sans font-bold text-foreground text-lg"
        numberOfLines={1}
      >
        {title}
      </Text>
      <View className="w-11 h-11 items-end justify-center">{right}</View>
    </View>
  );
}
