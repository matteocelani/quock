// Presentational rows for the + hub: the attach tiles (Camera/Photo/File) and the tool toggle rows (web/think).

import React from "react";
import { Text, View } from "react-native";
import type { LucideIcon } from "lucide-react-native";
import { GlassOrb } from "@/components/ui/GlassOrb";
import { Pressable } from "@/components/ui/Pressable";
import { RadioIndicator } from "@/components/ui/RadioIndicator";
import { useThemeColors } from "@/lib/theme/ThemeContext";
import { componentLayout, iconSize, strokeWidth } from "@/lib/design/tokens";

interface AttachTileProps {
  icon: LucideIcon;
  label: string;
  onPress: () => void;
}

function AttachTileImpl({
  icon: IconComponent,
  label,
  onPress,
}: AttachTileProps): React.ReactElement {
  const colors = useThemeColors();
  const diameter = componentLayout.attachTile.orbDiameter;
  return (
    <View className="items-center gap-2">
      <GlassOrb
        variant="regular"
        interactive
        onPress={onPress}
        accessibilityLabel={label}
        style={{ width: diameter, height: diameter }}
      >
        <View
          className="items-center justify-center"
          style={{ width: diameter, height: diameter }}
        >
          <IconComponent
            size={iconSize["2xl"]}
            color={colors.foreground}
            strokeWidth={strokeWidth.regular}
          />
        </View>
      </GlassOrb>
      <Text className="font-mono uppercase text-muted-foreground text-xs tracking-widest">
        {label}
      </Text>
    </View>
  );
}

interface ToolRowProps {
  icon: LucideIcon;
  label: string;
  selected: boolean;
  onToggle: () => void;
}

// iOS settings-style row: icon + label + selection ring. scale 1 keeps the full-width row from shrinking on press.
function ToolRowImpl({
  icon: IconComponent,
  label,
  selected,
  onToggle,
}: ToolRowProps): React.ReactElement {
  const colors = useThemeColors();
  return (
    <Pressable
      onPress={onToggle}
      scale={1}
      accessibilityLabel={`${selected ? "Disable" : "Enable"} ${label.toLowerCase()}`}
    >
      <View className="flex-row items-center px-6 py-2">
        <IconComponent
          size={iconSize.md}
          color={colors.foreground}
          strokeWidth={strokeWidth.regular}
        />
        <Text className="flex-1 ml-3 font-sans text-base text-foreground">
          {label}
        </Text>
        <RadioIndicator selected={selected} />
      </View>
    </Pressable>
  );
}

export const AttachTile = React.memo(AttachTileImpl);
export const ToolRow = React.memo(ToolRowImpl);
