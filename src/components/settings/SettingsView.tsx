// Settings pane inside AccountSheet — appearance + chat preferences. About/legal lives in AboutView.

import React, { useCallback, useEffect, useMemo } from "react";
import { ScrollView, View } from "react-native";
import { ChevronRight, Palette, Sparkles, Trash2, Vibrate } from "lucide-react-native";
import { ClearChatsChooser } from "@/components/settings/ClearChatsChooser";
import { SettingsGroup } from "@/components/settings/SettingsGroup";
import { ListRow } from "@/components/ui/ListRow";
import {
  SegmentedControl,
  type SegmentedOption,
} from "@/components/ui/SegmentedControl";
import { Switch } from "@/components/ui/Switch";
import {
  useTheme,
  useThemeColors,
  type ThemeMode,
} from "@/lib/theme/ThemeContext";
import { iconSize, size } from "@/lib/design/tokens";
import { formatBytes } from "@/modules/chat/lib/formatBytes";
import { formatModelName } from "@/modules/models/lib/formatModelName";
import { useSelectedModel } from "@/modules/models/hooks/useSelectedModel";
import { useClearChats } from "@/modules/settings/hooks/useClearChats";
import { useSettingsStore } from "@/lib/stores/settings.store";

const THEME_OPTIONS: readonly SegmentedOption[] = [
  { value: "system", label: "System" },
  { value: "light", label: "Light" },
  { value: "dark", label: "Dark" },
];

// Visual rhythm for the settings ScrollView: a little breathing space after the sheet header, generous bottom inset so the last row never sits flush against the safe-area edge.
const SCROLL_PAD_TOP = 14;
const SCROLL_PAD_BOTTOM = 40;

export interface SettingsViewProps {
  onChangeModel?: () => void;
  // Publishes the centered overlay (the clear-chats chooser) up to AccountSheet so it renders in the Sheet's
  // `overlays` slot — full-display centering, not inside the settings card. Null clears it.
  onRenderOverlays?: (overlays: React.ReactNode) => void;
}

export function SettingsView({
  onChangeModel,
  onRenderOverlays,
}: SettingsViewProps): React.ReactElement {
  const colors = useThemeColors();
  const { mode: themeMode, setMode: setThemeMode } = useTheme();
  const haptics = useSettingsStore((s) => s.hapticsEnabled);
  const setHapticsEnabled = useSettingsStore((s) => s.setHapticsEnabled);
  const {
    isChooserOpen,
    openChooser,
    closeChooser,
    clearMine,
    clearDevice,
    totalChatBytes,
    deviceBytes,
  } = useClearChats();
  const selected = useSelectedModel();
  const handleThemeChange = useCallback(
    (next: string): void => {
      setThemeMode(next as ThemeMode);
    },
    [setThemeMode],
  );
  const handleHapticsChange = useCallback(
    (next: boolean): void => {
      setHapticsEnabled(next);
    },
    [setHapticsEnabled],
  );
  const clearOverlay = useMemo(
    () => (
      <ClearChatsChooser
        visible={isChooserOpen}
        mineBytes={totalChatBytes}
        deviceBytes={deviceBytes}
        onChooseMine={clearMine}
        onChooseDevice={clearDevice}
        onCancel={closeChooser}
      />
    ),
    [
      isChooserOpen,
      totalChatBytes,
      deviceBytes,
      clearMine,
      clearDevice,
      closeChooser,
    ],
  );
  useEffect(() => {
    onRenderOverlays?.(clearOverlay);
  }, [onRenderOverlays, clearOverlay]);
  useEffect(
    () => (): void => {
      onRenderOverlays?.(null);
    },
    [onRenderOverlays],
  );
  // ChatHome's onChangeModel already closes the sheet and schedules the picker; calling onClose() here would double-fire the dismiss.
  const handleChangeModel = useCallback((): void => {
    onChangeModel?.();
  }, [onChangeModel]);
  const modelLabel = selected.model
    ? formatModelName(selected.model.name)
    : "Not set";
  return (
    <>
      <ScrollView
        className="flex-1"
        contentContainerStyle={{ paddingTop: SCROLL_PAD_TOP, paddingBottom: SCROLL_PAD_BOTTOM }}
        showsVerticalScrollIndicator={false}
        bounces
        decelerationRate="normal"
        keyboardShouldPersistTaps="handled"
      >
        <SettingsGroup label="APPEARANCE">
          <ListRow
            icon={Palette}
            label="Theme"
            trailing={
              <View className="pr-2" style={{ width: size.segmentedSlot }}>
                <SegmentedControl
                  options={[...THEME_OPTIONS]}
                  value={themeMode}
                  onChange={handleThemeChange}
                  size="compact"
                />
              </View>
            }
          />
          <ListRow
            icon={Vibrate}
            label="Haptics"
            trailing={
              <Switch value={haptics} onValueChange={handleHapticsChange} />
            }
            showDivider={false}
          />
        </SettingsGroup>
        <SettingsGroup label="CHAT">
          <ListRow
            icon={Sparkles}
            label="Default model"
            subtitle={modelLabel}
            onPress={handleChangeModel}
            trailing={
              <ChevronRight size={iconSize.md} color={colors.mutedForeground} />
            }
          />
          <ListRow
            icon={Trash2}
            label="Clear all chats"
            destructive
            trailingMeta={
              totalChatBytes > 0 ? formatBytes(totalChatBytes) : "Empty"
            }
            onPress={openChooser}
            showDivider={false}
          />
        </SettingsGroup>
      </ScrollView>
    </>
  );
}
