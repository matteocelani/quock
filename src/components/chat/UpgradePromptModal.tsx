// Modal shown when the server gates a model behind a paid plan (CloudAPIError code `subscription_required`).

import * as WebBrowser from "expo-web-browser";
import React, { useCallback } from "react";
import { Modal, Pressable as RNPressable, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { LEGAL_URLS } from "@/lib/api/config";
import { Button } from "@/components/ui/Button";

export interface UpgradePromptModalProps {
  visible: boolean;
  modelName: string;
  onClose: () => void;
  onPickAnotherModel: () => void;
}

export function UpgradePromptModal({
  visible,
  modelName,
  onClose,
  onPickAnotherModel,
}: UpgradePromptModalProps): React.ReactElement {
  const insets = useSafeAreaInsets();
  const handleUpgrade = useCallback((): void => {
    WebBrowser.openBrowserAsync(LEGAL_URLS.upgrade).catch((err: unknown) => {
      console.error("UpgradePromptModal: failed to open upgrade URL", err);
    });
  }, []);
  const handlePickAnother = useCallback((): void => {
    onPickAnotherModel();
    onClose();
  }, [onPickAnotherModel, onClose]);
  return (
    <Modal
      transparent
      visible={visible}
      animationType="fade"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      {/* SafeAreaView insets stay inline because they're runtime values from useSafeAreaInsets — NativeWind can't reach them. */}
      <View
        style={{ paddingTop: insets.top, paddingBottom: insets.bottom }}
        className="flex-1 items-center justify-center px-6"
      >
        <RNPressable
          accessibilityRole="button"
          accessibilityLabel="Dismiss dialog"
          onPress={onClose}
          className="absolute inset-0 bg-scrim"
        />
        <View
          className="w-full max-w-card"
          pointerEvents="box-none"
          accessibilityViewIsModal
          accessibilityLiveRegion="polite"
        >
          <View className="bg-card rounded-3xl p-5">
            <Text className="text-foreground font-sans text-base font-semibold">
              Subscription required
            </Text>
            <Text className="text-muted-foreground font-sans text-sm mt-1.5">
              {modelName} is an Ollama Cloud model. Upgrade to use it, or pick a
              different model.
            </Text>
            {/* Stack vertically so the longer "Pick another model" label always fits without truncation. */}
            <View className="gap-2.5 mt-4">
              <Button
                variant="primary"
                fullWidth
                onPress={handleUpgrade}
                testID="upgrade-modal-upgrade"
              >
                Upgrade
              </Button>
              <Button
                variant="secondary"
                fullWidth
                onPress={handlePickAnother}
                testID="upgrade-modal-pick-another"
              >
                Pick another model
              </Button>
            </View>
          </View>
        </View>
      </View>
    </Modal>
  );
}
