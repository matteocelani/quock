// Drill panel from Settings — non-affiliation disclaimer + official Ollama community links.

import * as WebBrowser from "expo-web-browser";
import React, { useCallback } from "react";
import { Linking, ScrollView, Text, View } from "react-native";
import { ExternalLink, Mail } from "lucide-react-native";
import DiscordSvg from "@/assets/icons/Discord.svg";
import GithubSvg from "@/assets/icons/Github.svg";
import OllamaSvg from "@/assets/icons/Ollama.svg";
import XSvg from "@/assets/icons/X.svg";
import { OLLAMA_LINKS } from "@/lib/api/config";
import { ListRow } from "@/components/ui/ListRow";
import { Section } from "@/components/ui/Section";
import { useThemeColors } from "@/lib/theme/ThemeContext";
import { iconSize, size } from "@/lib/design/tokens";
import { useToast } from "@/lib/hooks/useToast";

// Top-edge breathing space below the sheet header; bottom-edge spacing before the sheet bottom inset so the last row never sits flush against the safe-area edge.
const SCROLL_PAD_TOP = 8;
const SCROLL_PAD_BOTTOM = 40;

export function OllamaView(): React.ReactElement {
  const colors = useThemeColors();
  const toast = useToast();
  const openUrl = useCallback(
    (url: string): void => {
      WebBrowser.openBrowserAsync(url).catch((err: unknown) => {
        console.warn("OllamaView: failed to open Ollama link", err);
        toast({ title: "Could not open link", tone: "error" });
      });
    },
    [toast],
  );
  // No mail client registered → Linking rejects; surface a toast with the address so the user can copy it.
  const openEmail = useCallback((): void => {
    const url = `mailto:${OLLAMA_LINKS.contactEmail}`;
    Linking.openURL(url).catch((err: unknown) => {
      console.warn("OllamaView: failed to open mail composer", err);
      toast({
        title: `Email: ${OLLAMA_LINKS.contactEmail}`,
        tone: "info",
      });
    });
  }, [toast]);
  return (
    <ScrollView
      className="flex-1"
      contentContainerStyle={{ paddingTop: SCROLL_PAD_TOP, paddingBottom: SCROLL_PAD_BOTTOM }}
      showsVerticalScrollIndicator={false}
      bounces
      decelerationRate="normal"
    >
      <View className="flex-row items-center gap-3 px-4.5 mt-2.5 mb-3">
        <OllamaSvg
          width={iconSize["3xl"]}
          height={iconSize["3xl"]}
          color={colors.foreground}
        />
        <Text className="font-sans font-semibold text-foreground text-xl">
          Ollama
        </Text>
      </View>
      <Text className="font-sans text-muted-foreground text-sm px-4.5 mb-4.5">
        Quock is a third-party chat client for Ollama Cloud — your messages
        go to Ollama&apos;s servers and the responses stream back to your
        device. Quock is not affiliated with or endorsed by Ollama, Inc.
      </Text>
      <Section>
        <ListRow
          leading={
            <GithubSvg
              width={size.iconRowBrand}
              height={size.iconRowBrand}
              color={colors.foreground}
            />
          }
          label="GitHub"
          onPress={(): void => openUrl(OLLAMA_LINKS.github)}
          trailing={
            <ExternalLink size={iconSize.md} color={colors.mutedForeground} />
          }
        />
        <ListRow
          leading={
            <DiscordSvg
              width={size.iconRowBrand}
              height={size.iconRowBrand}
              color={colors.foreground}
            />
          }
          label="Discord"
          onPress={(): void => openUrl(OLLAMA_LINKS.discord)}
          trailing={
            <ExternalLink size={iconSize.md} color={colors.mutedForeground} />
          }
        />
        <ListRow
          leading={
            <XSvg
              width={size.iconRowBrand}
              height={size.iconRowBrand}
              color={colors.foreground}
            />
          }
          label="X"
          onPress={(): void => openUrl(OLLAMA_LINKS.twitter)}
          trailing={
            <ExternalLink size={iconSize.md} color={colors.mutedForeground} />
          }
        />
        <ListRow
          leading={<Mail size={size.iconRowBrand} color={colors.foreground} />}
          label="Contact"
          subtitle={OLLAMA_LINKS.contactEmail}
          onPress={openEmail}
          trailing={
            <ExternalLink size={iconSize.md} color={colors.mutedForeground} />
          }
          showDivider={false}
        />
      </Section>
    </ScrollView>
  );
}
