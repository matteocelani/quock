// 40%-snap view of AccountSheet — profile row + menu rows. Pure presentation, props-driven.

import React from "react";
import { StyleSheet, Text, View } from "react-native";
import {
  ChevronRight,
  CreditCard,
  ExternalLink,
  Settings as SettingsIcon,
} from "lucide-react-native";
import { Avatar } from "@/components/ui/Avatar";
import { Button } from "@/components/ui/Button";
import { ListRow } from "@/components/ui/ListRow";
import { Section } from "@/components/ui/Section";
import { useThemeColors } from "@/lib/theme/ThemeContext";
import { iconSize, size } from "@/lib/design/tokens";

export interface AccountViewProps {
  userName: string;
  userEmail: string;
  userPlan: string | null;
  avatarUri: string | undefined;
  onOpenSettings: () => void;
  onManageSubscription: () => void;
  onSignOut: () => void;
}

export function AccountView({
  userName,
  userEmail,
  userPlan,
  avatarUri,
  onOpenSettings,
  onManageSubscription,
  onSignOut,
}: AccountViewProps): React.ReactElement {
  const colors = useThemeColors();
  return (
    <View className="flex-1">
      <View
        className="flex-row items-center gap-3.5 px-4.5 py-3.5"
        style={{
          borderBottomWidth: StyleSheet.hairlineWidth,
          borderBottomColor: colors.border,
        }}
      >
        <Avatar uri={avatarUri} name={userName} size={size.hitTargetMin} />
        <View className="flex-1 min-w-0">
          <View className="flex-row items-center gap-2 mb-0.5">
            <Text
              className="font-sans font-semibold text-foreground shrink text-lg"
              numberOfLines={1}
            >
              {userName}
            </Text>
            {userPlan ? (
              <View className="px-2 py-0.5 rounded bg-primary">
                <Text className="font-mono text-xs text-primary-foreground uppercase tracking-wide">
                  {userPlan.toUpperCase()}
                </Text>
              </View>
            ) : null}
          </View>
          {userEmail.length > 0 ? (
            <Text
              className="font-sans text-muted-foreground text-sm"
              numberOfLines={1}
            >
              {userEmail}
            </Text>
          ) : null}
        </View>
      </View>
      <View className="flex-1">
        <View className="py-1.5">
          <Section>
            <ListRow
              icon={SettingsIcon}
              label="Settings"
              onPress={onOpenSettings}
              testID="account-settings"
              trailing={
                <ChevronRight size={iconSize.md} color={colors.mutedForeground} />
              }
            />
            <ListRow
              icon={CreditCard}
              label="Manage subscription"
              onPress={onManageSubscription}
              trailing={
                <ExternalLink size={iconSize.md} color={colors.mutedForeground} />
              }
              showDivider={false}
            />
          </Section>
        </View>
        <View className="flex-1" />
        <View className="px-4.5 pt-3 pb-6">
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
