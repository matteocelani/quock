// 40%-snap view of AccountSheet — profile row + menu rows. Pure presentation, props-driven.

import React from "react";
import { StyleSheet, Text, View } from "react-native";
import {
  ChevronRight,
  Info,
  Settings as SettingsIcon,
} from "lucide-react-native";
import { Avatar } from "@/components/ui/Avatar";
import { Button } from "@/components/ui/Button";
import { ListRow } from "@/components/ui/ListRow";
import { Section } from "@/components/ui/Section";
import { useThemeColors } from "@/lib/theme/ThemeContext";
import { componentLayout, iconSize, size } from "@/lib/design/tokens";

export interface AccountViewProps {
  userName: string;
  userEmail: string;
  userPlan: string | null;
  avatarUri: string | undefined;
  onOpenSettings: () => void;
  onOpenAbout: () => void;
  onSignOut: () => void;
}

export function AccountView({
  userName,
  userEmail,
  userPlan,
  avatarUri,
  onOpenSettings,
  onOpenAbout,
  onSignOut,
}: AccountViewProps): React.ReactElement {
  const colors = useThemeColors();
  return (
    <View className="flex-1">
      <View
        className="flex-row items-center gap-3.5 py-3.5"
        style={{
          paddingHorizontal: componentLayout.listSection.insetX,
          borderBottomWidth: StyleSheet.hairlineWidth,
          borderBottomColor: colors.border,
        }}
      >
        <Avatar uri={avatarUri} name={userName} size={size.hitTargetMin} />
        <View className="flex-1 min-w-0">
          <View className="flex-row items-center gap-2 mb-0.5">
            <Text
              className="font-sans font-semibold text-headline text-foreground shrink"
              numberOfLines={1}
            >
              {userName}
            </Text>
            {userPlan ? (
              // Pill badge on the system shape language (§Shape language) — the mono-uppercase eyebrow was the classic style.
              <View className="px-2 py-0.5 rounded-full bg-primary">
                <Text className="font-sans text-caption-2 text-primary-foreground">
                  {userPlan.toUpperCase()}
                </Text>
              </View>
            ) : null}
          </View>
          {userEmail.length > 0 ? (
            <Text
              className="font-sans text-footnote text-muted-foreground"
              numberOfLines={1}
            >
              {userEmail}
            </Text>
          ) : null}
        </View>
      </View>
      <View className="flex-1">
        {/* No gap above the first row — a press highlight would otherwise flash the white card between the profile divider and the row. */}
        <Section>
          <ListRow
            icon={SettingsIcon}
            label="Settings"
            onPress={onOpenSettings}
            testID="account-settings"
            trailing={
              // §15 drill-in chevrons carry the tertiary label tint (external-link rows stay secondary).
              <ChevronRight size={iconSize.md} color={colors.labelTertiary} />
            }
          />
          <ListRow
            icon={Info}
            label="About"
            onPress={onOpenAbout}
            testID="account-about"
            trailing={
              <ChevronRight size={iconSize.md} color={colors.labelTertiary} />
            }
            showDivider={false}
          />
        </Section>
        <View className="flex-1" />
        <View
          className="pt-3 pb-6"
          style={{ paddingHorizontal: componentLayout.listSection.insetX }}
        >
          <Button
            variant="destructiveSoft"
            size="lg"
            fullWidth
            onPress={onSignOut}
            testID="account-signout"
          >
            Sign out
          </Button>
        </View>
      </View>
    </View>
  );
}
