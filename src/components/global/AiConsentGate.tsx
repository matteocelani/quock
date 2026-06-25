// First-launch AI data-sharing consent (Apple 5.1.2(i)): blocks the app until the user explicitly agrees their
// messages leave for Ollama Cloud. Persisted in settings.store, so it appears once; re-readable in Settings.

import * as WebBrowser from "expo-web-browser";
import React from "react";
import { ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { LEGAL_URLS, OLLAMA_LINKS } from "@/lib/api/config";
import { Button } from "@/components/ui/Button";
import { Pressable } from "@/components/ui/Pressable";
import QuockSvg from "@/assets/icons/Quock.svg";
import { zLayer } from "@/lib/design/tokens";
import { useThemeColors } from "@/lib/theme/ThemeContext";
import { useSettingsStore } from "@/lib/stores/settings.store";

// Logo mark size on the consent screen; used only here.
const CONSENT_LOGO_SIZE = 60;

export function AiConsentGate(): React.ReactElement | null {
  const colors = useThemeColors();
  const acceptedAt = useSettingsStore((s) => s.aiConsentAcceptedAt);
  const acceptAiConsent = useSettingsStore((s) => s.acceptAiConsent);
  const openExternal = React.useCallback((url: string): void => {
    WebBrowser.openBrowserAsync(url).catch((err: unknown) => {
      console.warn("AiConsentGate: openBrowserAsync failed", err);
    });
  }, []);
  if (acceptedAt !== null) return null;
  return (
    <View
      className="absolute inset-0 bg-background"
      style={{ zIndex: zLayer.dialog }}
    >
      <SafeAreaView className="flex-1" edges={["top", "bottom"]}>
        <ScrollView
          className="flex-1"
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ flexGrow: 1 }}
        >
          {/* Content flows from the top; a flex spacer keeps the action anchored at the bottom. */}
          <View className="flex-1 px-6 pt-8 pb-2">
            <View className="items-center mb-9">
              <QuockSvg
                width={CONSENT_LOGO_SIZE}
                height={CONSENT_LOGO_SIZE}
                color={colors.foreground}
                accessibilityLabel="Quock"
              />
            </View>
            <Text className="font-sans font-semibold text-foreground text-xl text-center mb-8">
              How Quock uses your messages
            </Text>
            <Text className="font-sans text-muted-foreground text-base leading-6 mb-6">
              Quock is an open-source client for{" "}
              <Text
                accessibilityRole="link"
                className="text-foreground underline"
                onPress={(): void => openExternal(OLLAMA_LINKS.cloudDocs)}
              >
                Ollama Cloud
              </Text>
              .
            </Text>
            <Text className="font-sans text-foreground text-base leading-6 mb-6">
              When you send a message, your text and any attachments are sent to
              Ollama Cloud — a third-party service — to generate the AI reply.
            </Text>
            <Text className="font-sans text-muted-foreground text-base leading-6 mb-7">
              Your chats are stored only on this device. Quock runs no servers of
              its own and collects no analytics or tracking.
            </Text>
            <View className="flex-row items-center justify-center gap-3.5">
              <Pressable
                onPress={(): void => openExternal(LEGAL_URLS.privacy)}
                haptic={false}
              >
                <Text className="font-sans text-muted-foreground text-sm underline">
                  Privacy Policy
                </Text>
              </Pressable>
              <View className="w-1 h-1 rounded-full bg-border" />
              <Pressable
                onPress={(): void => openExternal(LEGAL_URLS.terms)}
                haptic={false}
              >
                <Text className="font-sans text-muted-foreground text-sm underline">
                  Terms of Service
                </Text>
              </Pressable>
            </View>
            <View className="flex-1" />
            <Text className="font-sans text-muted-foreground text-xs leading-5 text-center mb-4">
              By continuing, you consent to your messages being sent to Ollama
              Cloud for AI processing.
            </Text>
            <Button
              variant="primary"
              size="lg"
              fullWidth
              onPress={acceptAiConsent}
              testID="ai-consent-accept"
            >
              I agree &amp; continue
            </Button>
          </View>
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}
