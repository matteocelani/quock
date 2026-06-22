// Grouped list block with an optional uppercase eyebrow label.

import React, { type ReactNode } from "react";
import { Text, View } from "react-native";
import clsx from "clsx";

export interface SectionProps {
  label?: string;
  children: ReactNode;
  /** Wrap children in the legacy `bg-card rounded-xl` card. Defaults to false. */
  card?: boolean;
  className?: string;
  testID?: string;
}
function SectionImpl({
  label,
  children,
  card = false,
  className,
  testID,
}: SectionProps): React.ReactElement {
  return (
    <View className={clsx("mb-6", className)} testID={testID}>
      {label ? (
        <Text className="font-mono uppercase text-muted-foreground font-medium text-xs mb-2 ml-4.5 tracking-widest">
          {label}
        </Text>
      ) : null}
      {card ? (
        <View className="bg-card rounded-xl overflow-hidden">
          {children}
        </View>
      ) : (
        <View>{children}</View>
      )}
    </View>
  );
}

export const Section = React.memo(SectionImpl);
