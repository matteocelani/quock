// About pane inside AccountSheet — AI data sharing, legal/support links, app version, and a drill entry to OllamaView.

import React from "react";
import { ScrollView, Text } from "react-native";
import {
  ChevronRight,
  ExternalLink,
  FileText,
  Info,
  LifeBuoy,
  ShieldCheck,
} from "lucide-react-native";
import OllamaSvg from "@/assets/icons/Ollama.svg";
import { SettingsGroup } from "@/components/settings/SettingsGroup";
import { ListRow } from "@/components/ui/ListRow";
import { useThemeColors } from "@/lib/theme/ThemeContext";
import { iconSize, size } from "@/lib/design/tokens";
import { useAbout } from "@/modules/settings/hooks/useAbout";

// Visual rhythm shared with SettingsView: breathing space after the sheet header, generous bottom inset.
const SCROLL_PAD_TOP = 14;
const SCROLL_PAD_BOTTOM = 40;

export interface AboutViewProps {
  onOpenAiData: () => void;
  onOpenOllama: () => void;
}

export function AboutView({
  onOpenAiData,
  onOpenOllama,
}: AboutViewProps): React.ReactElement {
  const colors = useThemeColors();
  const { openPrivacy, openTerms, openSupport, versionLabel } = useAbout();
  return (
    <ScrollView
      className="flex-1"
      contentContainerStyle={{
        paddingTop: SCROLL_PAD_TOP,
        paddingBottom: SCROLL_PAD_BOTTOM,
      }}
      showsVerticalScrollIndicator={false}
      bounces
      decelerationRate="normal"
    >
      <SettingsGroup label="ABOUT">
        <ListRow
          icon={ShieldCheck}
          label="AI data sharing"
          onPress={onOpenAiData}
          trailing={
            <ChevronRight size={iconSize.md} color={colors.mutedForeground} />
          }
          testID="about-ai-consent"
        />
        <ListRow
          icon={FileText}
          label="Privacy Policy"
          onPress={openPrivacy}
          trailing={
            <ExternalLink size={iconSize.md} color={colors.mutedForeground} />
          }
        />
        <ListRow
          icon={FileText}
          label="Terms of Service"
          onPress={openTerms}
          trailing={
            <ExternalLink size={iconSize.md} color={colors.mutedForeground} />
          }
        />
        <ListRow
          icon={LifeBuoy}
          label="Support"
          onPress={openSupport}
          trailing={
            <ExternalLink size={iconSize.md} color={colors.mutedForeground} />
          }
        />
        <ListRow
          icon={Info}
          label="Version"
          trailing={
            <Text className="font-mono text-muted-foreground text-sm">
              {versionLabel}
            </Text>
          }
          showDivider={false}
        />
      </SettingsGroup>
      {/* `OLLAMA` eyebrow names the brand once; the row label is the descriptive content. The drill panel re-states the full disclaimer at the top for legal prominence. */}
      <SettingsGroup label="OLLAMA">
        <ListRow
          leading={
            <OllamaSvg
              width={size.iconRowBrand}
              height={size.iconRowBrand}
              color={colors.foreground}
            />
          }
          label="Official channels — not affiliated"
          onPress={onOpenOllama}
          trailing={
            <ChevronRight size={iconSize.md} color={colors.mutedForeground} />
          }
          showDivider={false}
          testID="about-open-ollama"
        />
      </SettingsGroup>
    </ScrollView>
  );
}
