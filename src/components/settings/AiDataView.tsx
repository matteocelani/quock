// Drill panel from Settings — re-read the AI data-sharing disclosure or revoke consent (a full device reset).

import * as WebBrowser from "expo-web-browser";
import React, { useCallback } from "react";
import { ScrollView, Text, View } from "react-native";
import { OLLAMA_LINKS } from "@/lib/api/config";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/lib/hooks/useToast";
import { useSettingsStore } from "@/lib/stores/settings.store";
import { useUIStore } from "@/lib/stores/ui.store";
import { useDeleteDeviceData } from "@/modules/chat/hooks/useDeviceStorage";
import { useSignOut } from "@/modules/auth/hooks/useAuth";

// Top-edge breathing space below the sheet header; generous bottom inset before the sheet edge.
const SCROLL_PAD_TOP = 8;
const SCROLL_PAD_BOTTOM = 40;

export function AiDataView(): React.ReactElement {
  const acceptedAt = useSettingsStore((s) => s.aiConsentAcceptedAt);
  const revokeAiConsent = useSettingsStore((s) => s.revokeAiConsent);
  const closeAccount = useUIStore((s) => s.closeAccount);
  const { clearDeviceData } = useDeleteDeviceData();
  const { signOut } = useSignOut();
  const toast = useToast();
  const openCloudDocs = useCallback((): void => {
    WebBrowser.openBrowserAsync(OLLAMA_LINKS.cloudDocs).catch((err: unknown) => {
      console.warn("AiDataView: failed to open Ollama Cloud docs", err);
      toast({ title: "Could not open link", tone: "error" });
    });
  }, [toast]);
  // Wipe + sign out FIRST, then clear consent and close the sheet — so a failed reset surfaces a toast (the blocking
  // gate hasn't taken over yet) instead of silently leaving data behind while the gate implies the reset succeeded.
  const handleRevoke = useCallback((): void => {
    void (async (): Promise<void> => {
      try {
        await clearDeviceData();
        await signOut();
      } catch (err) {
        console.warn("AiDataView: revoke reset failed", err);
        toast({ title: "Could not complete the reset", tone: "error" });
        return;
      }
      revokeAiConsent();
      closeAccount();
    })();
  }, [clearDeviceData, signOut, revokeAiConsent, closeAccount, toast]);
  const agreedOn =
    acceptedAt !== null
      ? new Intl.DateTimeFormat(undefined, { dateStyle: "long" }).format(
          new Date(acceptedAt),
        )
      : null;
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
      <View className="px-4.5">
        <Text className="font-sans text-muted-foreground text-base leading-6 mb-4">
          When you send a message, your text and any attachments are sent to{" "}
          <Text
            accessibilityRole="link"
            className="text-foreground underline"
            onPress={openCloudDocs}
          >
            Ollama Cloud
          </Text>{" "}
          — a third-party service — to generate the AI reply.
        </Text>
        <Text className="font-sans text-muted-foreground text-base leading-6 mb-4">
          Your chats are stored only on this device. Quock runs no servers of its
          own and collects no analytics or tracking.
        </Text>
        {agreedOn !== null ? (
          <Text className="font-sans text-muted-foreground text-sm mb-6">
            You agreed on {agreedOn}.
          </Text>
        ) : null}
        {/* Danger zone — the destructive reset grouped as one deliberate block; calm neutral surface, red kept to accents. */}
        <View className="rounded-2xl bg-muted p-5">
          <Text className="font-sans font-semibold text-destructive text-base mb-2.5">
            Revoke consent
          </Text>
          <Text className="font-sans text-foreground text-sm leading-6 mb-3">
            Revoking is a full reset of Quock on this device — it will:
          </Text>
          <Text className="font-sans text-foreground text-sm leading-6">
            1.  Delete every chat saved on this device
          </Text>
          <Text className="font-sans text-foreground text-sm leading-6">
            2.  Sign you out of your account
          </Text>
          <Text className="font-sans text-foreground text-sm leading-6 mb-3">
            3.  Turn off AI data sharing
          </Text>
          <Text className="font-sans text-destructive text-xs leading-5 mb-4">
            This wipes data for every account on this phone and can&apos;t be
            undone.
          </Text>
          <Button
            variant="destructiveSoft"
            size="lg"
            fullWidth
            onPress={handleRevoke}
            testID="ai-data-revoke"
          >
            Revoke &amp; delete all data
          </Button>
        </View>
      </View>
    </ScrollView>
  );
}
