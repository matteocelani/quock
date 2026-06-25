// 90%-snap settings view inside AccountSheet — appearance / chat / about + a drill entry to OllamaView.

import * as Application from "expo-application";
import * as WebBrowser from "expo-web-browser";
import React, { useCallback, useEffect, useMemo } from "react";
import { ScrollView, Text, View } from "react-native";
import {
  ChevronRight,
  ExternalLink,
  FileText,
  Info,
  LifeBuoy,
  Palette,
  Sparkles,
  Trash2,
  Vibrate,
} from "lucide-react-native";
import OllamaSvg from "@/assets/icons/Ollama.svg";
import { LEGAL_URLS } from "@/lib/api/config";
import { ClearChatsChooser } from "@/components/settings/ClearChatsChooser";
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
import { useClearChats } from "@/modules/settings/hooks";
import { useToast } from "@/lib/hooks/useToast";
import { useSettingsStore } from "@/lib/stores/settings.store";

const THEME_OPTIONS: readonly SegmentedOption[] = [
  { value: "system", label: "System" },
  { value: "light", label: "Light" },
  { value: "dark", label: "Dark" },
];

// Visual rhythm for the settings ScrollView: a little breathing space after the sheet header, generous bottom inset so the last row never sits flush against the safe-area edge.
const SCROLL_PAD_TOP = 14;
const SCROLL_PAD_BOTTOM = 40;

interface SettingsGroupProps {
  label: string;
  children: React.ReactNode;
}
// Cardless eyebrow + rows wrapper; mirrors Section's label typography for consistency.
function SettingsGroup({
  label,
  children,
}: SettingsGroupProps): React.ReactElement {
  return (
    <View className="mb-6">
      <Text className="font-mono text-muted-foreground text-xs uppercase tracking-widest mb-2 ml-4.5">
        {label}
      </Text>
      {children}
    </View>
  );
}

export interface SettingsViewProps {
  onChangeModel?: () => void;
  onOpenOllama: () => void;
  // Publishes the centered overlay (the clear-chats chooser) up to AccountSheet so it renders in the Sheet's
  // `overlays` slot — full-display centering, not inside the 90%-height settings card. Null clears it.
  onRenderOverlays?: (overlays: React.ReactNode) => void;
}

export function SettingsView({
  onChangeModel,
  onOpenOllama,
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
  const toast = useToast();
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
  const openPrivacy = useCallback((): void => {
    WebBrowser.openBrowserAsync(LEGAL_URLS.privacy).catch((err: unknown) => {
      console.warn("SettingsView: failed to open privacy", err);
      toast({ title: "Could not open link", tone: "error" });
    });
  }, [toast]);
  const openTerms = useCallback((): void => {
    WebBrowser.openBrowserAsync(LEGAL_URLS.terms).catch((err: unknown) => {
      console.warn("SettingsView: failed to open terms", err);
      toast({ title: "Could not open link", tone: "error" });
    });
  }, [toast]);
  const openSupport = useCallback((): void => {
    WebBrowser.openBrowserAsync(LEGAL_URLS.support).catch((err: unknown) => {
      console.warn("SettingsView: failed to open support", err);
      toast({ title: "Could not open link", tone: "error" });
    });
  }, [toast]);
  // ChatHome's onChangeModel already closes the sheet and schedules the picker; calling onClose() here would double-fire the dismiss.
  const handleChangeModel = useCallback((): void => {
    onChangeModel?.();
  }, [onChangeModel]);
  const versionLabel = `v${Application.nativeApplicationVersion ?? "?"} (build ${Application.nativeBuildVersion ?? "?"})`;
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
        <SettingsGroup label="ABOUT">
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
        {/* `OLLAMA` eyebrow names the brand once; the row label is the
            descriptive content. No repetition. The drill panel re-states
            the full disclaimer at the top for legal prominence. */}
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
            testID="settings-open-ollama"
          />
        </SettingsGroup>
      </ScrollView>
    </>
  );
}
