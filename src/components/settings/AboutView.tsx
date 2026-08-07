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
import {
  SETTINGS_SCROLL_PAD_TOP,
  SETTINGS_SCROLL_PAD_BOTTOM,
} from "@/modules/settings/constants";
import OllamaSvg from "@/assets/icons/Ollama.svg";
import { Section } from "@/components/ui/Section";
import { ListRow } from "@/components/ui/ListRow";
import { useThemeColors } from "@/lib/theme/ThemeContext";
import { iconSize, size } from "@/lib/design/tokens";
import { useAbout } from "@/modules/settings/hooks/useAbout";

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
        paddingTop: SETTINGS_SCROLL_PAD_TOP,
        paddingBottom: SETTINGS_SCROLL_PAD_BOTTOM,
      }}
      showsVerticalScrollIndicator={false}
      bounces
      decelerationRate="normal"
    >
      <Section label="About">
        <ListRow
          icon={ShieldCheck}
          label="AI data sharing"
          onPress={onOpenAiData}
          trailing={
            <ChevronRight size={iconSize.md} color={colors.labelTertiary} />
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
            <Text className="font-mono text-body text-muted-foreground">
              {versionLabel}
            </Text>
          }
          showDivider={false}
        />
      </Section>
      {/* `OLLAMA` eyebrow names the brand once; the row label is the descriptive content. The drill panel re-states the full disclaimer at the top for legal prominence. */}
      <Section label="Ollama">
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
            <ChevronRight size={iconSize.md} color={colors.labelTertiary} />
          }
          showDivider={false}
          testID="about-open-ollama"
        />
      </Section>
    </ScrollView>
  );
}
