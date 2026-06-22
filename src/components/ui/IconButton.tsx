// Icon-only 44pt tap target (Apple HIG minimum) — accepts any Lucide-compatible icon.

import clsx from "clsx";
import { type LucideIcon } from "lucide-react-native";
import React from "react";
import { useThemeColors } from "@/lib/theme/ThemeContext";
import { componentLayout, type DesignColors } from "@/lib/design/tokens";
import { Pressable } from "@/components/ui/Pressable";

export type IconButtonTone = "default" | "muted" | "danger";
export interface IconButtonProps {
  icon: LucideIcon;
  onPress?: () => void;
  size?: number;
  tone?: IconButtonTone;
  /** Required for screen-readers and E2E targeting. */
  accessibilityLabel: string;
  className?: string;
  disabled?: boolean;
  testID?: string;
}

function resolveToneColor(tone: IconButtonTone, colors: DesignColors): string {
  if (tone === "muted") return colors.mutedForeground;
  if (tone === "danger") return colors.destructive;
  return colors.foreground;
}

export function IconButton({
  icon: IconComponent,
  onPress,
  size = componentLayout.iconButton.defaultIconSize,
  tone = "default",
  accessibilityLabel,
  className,
  disabled,
  testID,
}: IconButtonProps): React.ReactElement {
  const colors = useThemeColors();
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled ?? false}
      className={clsx(
        "w-11 h-11 items-center justify-center rounded-lg",
        className,
      )}
      accessibilityLabel={accessibilityLabel}
      testID={testID}
    >
      <IconComponent size={size} color={resolveToneColor(tone, colors)} />
    </Pressable>
  );
}
