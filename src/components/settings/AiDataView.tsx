// Drill panel from About — re-read the AI data-sharing disclosure or revoke consent (a full device reset).

import * as WebBrowser from "expo-web-browser";
import React, { useCallback, useEffect, useMemo } from "react";
import { ScrollView, Text, View } from "react-native";
import {
  SETTINGS_DRILL_SCROLL_PAD_TOP,
  SETTINGS_SCROLL_PAD_BOTTOM,
} from "@/modules/settings/constants";
import { OLLAMA_LINKS } from "@/lib/api/config";
import { Button } from "@/components/ui/Button";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { useToast } from "@/lib/hooks/useToast";
import { useSettingsStore } from "@/lib/stores/settings.store";
import { componentLayout } from "@/lib/design/tokens";
import { useRevokeAiConsent } from "@/modules/settings/hooks/useRevokeAiConsent";


export interface AiDataViewProps {
  // Publishes the revoke confirmation up to AccountSheet so it renders in the Sheet's `overlays` slot — centered
  // against the full display, not inside the pane card. Null clears it.
  onRenderOverlays?: (overlays: React.ReactNode) => void;
}

export function AiDataView({
  onRenderOverlays,
}: AiDataViewProps): React.ReactElement {
  const acceptedAt = useSettingsStore((s) => s.aiConsentAcceptedAt);
  const toast = useToast();
  const { isConfirmOpen, openConfirm, closeConfirm, confirmRevoke } =
    useRevokeAiConsent();
  const openCloudDocs = useCallback((): void => {
    WebBrowser.openBrowserAsync(OLLAMA_LINKS.cloudDocs).catch((err: unknown) => {
      console.warn("AiDataView: failed to open Ollama Cloud docs", err);
      toast({ title: "Could not open link", tone: "error" });
    });
  }, [toast]);
  const revokeOverlay = useMemo(
    () => (
      <ConfirmDialog
        visible={isConfirmOpen}
        title="Delete all data?"
        message="This permanently erases every chat on this device and signs you out. It can't be undone."
        destructive
        confirmLabel="Delete everything"
        onConfirm={confirmRevoke}
        onCancel={closeConfirm}
        testID="ai-data-revoke-confirm"
      />
    ),
    [isConfirmOpen, confirmRevoke, closeConfirm],
  );
  useEffect(() => {
    onRenderOverlays?.(revokeOverlay);
  }, [onRenderOverlays, revokeOverlay]);
  useEffect(
    () => (): void => {
      onRenderOverlays?.(null);
    },
    [onRenderOverlays],
  );
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
        paddingTop: SETTINGS_DRILL_SCROLL_PAD_TOP,
        paddingBottom: SETTINGS_SCROLL_PAD_BOTTOM,
      }}
      showsVerticalScrollIndicator={false}
      bounces
      decelerationRate="normal"
    >
      <View style={{ paddingHorizontal: componentLayout.listSection.insetX }}>
        <Text className="font-sans text-subhead text-muted-foreground mb-4">
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
        <Text className="font-sans text-subhead text-muted-foreground mb-4">
          Your chats are stored only on this device. Quock runs no servers of its
          own and collects no analytics or tracking.
        </Text>
        {agreedOn !== null ? (
          <Text className="font-sans text-footnote text-muted-foreground mb-6">
            You agreed on {agreedOn}.
          </Text>
        ) : null}
        {/* Revoke section — flat like the rest of Settings; the red heading + warning + button carry the destructive intent, no boxed surface. */}
        <Text className="font-sans font-semibold text-body text-destructive mb-2.5">
          Revoke consent
        </Text>
        <Text className="font-sans text-subhead text-foreground mb-3">
          Revoking is a full reset of Quock on this device — it will:
        </Text>
        <Text className="font-sans text-subhead text-foreground">
          1.  Delete every chat saved on this device
        </Text>
        <Text className="font-sans text-subhead text-foreground">
          2.  Sign you out of your account
        </Text>
        <Text className="font-sans text-subhead text-foreground mb-3">
          3.  Turn off AI data sharing
        </Text>
        <Text className="font-sans text-footnote text-destructive mb-4">
          This wipes data for every account on this phone and can&apos;t be
          undone.
        </Text>
        <Button
          variant="destructiveSoft"
          size="lg"
          fullWidth
          onPress={openConfirm}
          testID="ai-data-revoke"
        >
          Revoke &amp; delete all data
        </Button>
      </View>
    </ScrollView>
  );
}
