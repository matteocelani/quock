// Cardless eyebrow + rows wrapper for the account-sheet setting groups; shared by SettingsView and AboutView.

import React from "react";
import { Text, View } from "react-native";

export interface SettingsGroupProps {
  label: string;
  children: React.ReactNode;
}

export function SettingsGroup({
  label,
  children,
}: SettingsGroupProps): React.ReactElement {
  return (
    <View className="mb-6">
      <Text className="font-mono text-muted-foreground text-xs uppercase tracking-widest mb-2 ml-4.5">
        {label}
      </Text>
      {children}
    </View>
  );
}
