// Settings pane inside AccountSheet — appearance + chat preferences. About/legal lives in AboutView.

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { ScrollView, View } from "react-native";
import {
  ChevronRight,
  Globe,
  Palette,
  Sparkles,
  Trash2,
  Vibrate,
} from "lucide-react-native";
import { ClearChatsChooser } from "@/components/settings/ClearChatsChooser";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { ListRow } from "@/components/ui/ListRow";
import { Section } from "@/components/ui/Section";
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
import { iconSize, size, strokeWidth } from "@/lib/design/tokens";
import { formatBytes } from "@/modules/chat/lib/formatBytes";
import { formatModelName } from "@/modules/models/lib/formatModelName";
import { useSelectedModel } from "@/modules/models/hooks/useSelectedModel";
import { useClearChats } from "@/modules/settings/hooks/useClearChats";
import {
  DEFAULT_DEEP_DIVE_INSTRUCTION,
  DEFAULT_WEB_SEARCH_INSTRUCTION,
} from "@/modules/chat/lib/selectionPrompts";
import { EXCERPT_INSTRUCTION_MAX_CHARS } from "@/modules/settings/constants";
import { useSettingsStore } from "@/lib/stores/settings.store";

// The two excerpt-menu actions whose wording is editable.
type ExcerptAction = "deepDive" | "webSearch";

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
  const deepDiveInstruction = useSettingsStore((st) => st.deepDiveInstruction);
  const webSearchInstruction = useSettingsStore(
    (st) => st.webSearchInstruction,
  );
  const setDeepDiveInstruction = useSettingsStore(
    (st) => st.setDeepDiveInstruction,
  );
  const setWebSearchInstruction = useSettingsStore(
    (st) => st.setWebSearchInstruction,
  );
  // Which excerpt action is being reworded, and the live draft. Null = the editor is closed.
  const [editingAction, setEditingAction] = useState<ExcerptAction | null>(
    null,
  );
  const [draft, setDraft] = useState<string>("");
  const openEditor = useCallback((action: ExcerptAction): void => {
    setDraft(
      action === "deepDive"
        ? (useSettingsStore.getState().deepDiveInstruction ??
            DEFAULT_DEEP_DIVE_INSTRUCTION)
        : (useSettingsStore.getState().webSearchInstruction ??
            DEFAULT_WEB_SEARCH_INSTRUCTION),
    );
    setEditingAction(action);
  }, []);
  const closeEditor = useCallback((): void => {
    setEditingAction(null);
  }, []);
  const handleEditDeepDive = useCallback((): void => {
    openEditor("deepDive");
  }, [openEditor]);
  const handleEditWebSearch = useCallback((): void => {
    openEditor("webSearch");
  }, [openEditor]);
  // A blanked draft is stored as null, which restores the shipped wording rather than sending an empty instruction.
  const saveEditor = useCallback((): void => {
    if (editingAction === "deepDive") setDeepDiveInstruction(draft);
    if (editingAction === "webSearch") setWebSearchInstruction(draft);
    setEditingAction(null);
  }, [draft, editingAction, setDeepDiveInstruction, setWebSearchInstruction]);
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
  const overlays = useMemo(
    () => (
      <>
        <ClearChatsChooser
          visible={isChooserOpen}
          mineBytes={totalChatBytes}
          deviceBytes={deviceBytes}
          onChooseMine={clearMine}
          onChooseDevice={clearDevice}
          onCancel={closeChooser}
        />
        {/* Same dialog the rename flow uses: a multiline field over the two actions. */}
        <ConfirmDialog
          visible={editingAction !== null}
          title={editingAction === "webSearch" ? "Web search" : "Deep dive"}
          message={
            editingAction === "webSearch"
              ? "Sent with the excerpt when you tap Web search."
              : "Sent with the excerpt when you tap Deep dive."
          }
          confirmLabel="Save"
          inputValue={draft}
          onChangeInput={setDraft}
          // Short on purpose: an empty multiline field is pinned to one line, so a long placeholder would be clipped.
          inputPlaceholder="Default wording"
          inputMaxLength={EXCERPT_INSTRUCTION_MAX_CHARS}
          onConfirm={saveEditor}
          onCancel={closeEditor}
        />
      </>
    ),
    [
      isChooserOpen,
      totalChatBytes,
      deviceBytes,
      clearMine,
      clearDevice,
      closeChooser,
      draft,
      editingAction,
      saveEditor,
      closeEditor,
    ],
  );
  useEffect(() => {
    onRenderOverlays?.(overlays);
  }, [onRenderOverlays, overlays]);
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
        contentContainerStyle={{
          paddingTop: SCROLL_PAD_TOP,
          paddingBottom: SCROLL_PAD_BOTTOM,
        }}
        showsVerticalScrollIndicator={false}
        bounces
        decelerationRate="normal"
        keyboardShouldPersistTaps="handled"
      >
        <Section label="Appearance">
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
        </Section>
        <Section label="Excerpt actions">
          <ListRow
            icon={Sparkles}
            label="Deep dive"
            subtitle={deepDiveInstruction === null ? "Default" : "Custom"}
            onPress={handleEditDeepDive}
            trailing={
              <ChevronRight
                size={iconSize.md}
                color={colors.labelTertiary}
                strokeWidth={strokeWidth.bold}
              />
            }
          />
          <ListRow
            icon={Globe}
            label="Web search"
            subtitle={webSearchInstruction === null ? "Default" : "Custom"}
            onPress={handleEditWebSearch}
            trailing={
              <ChevronRight
                size={iconSize.md}
                color={colors.labelTertiary}
                strokeWidth={strokeWidth.bold}
              />
            }
            showDivider={false}
          />
        </Section>
        <Section label="Chat">
          <ListRow
            icon={Sparkles}
            label="Default model"
            subtitle={modelLabel}
            onPress={handleChangeModel}
            trailing={
              // §15 drill-in chevrons carry the tertiary label tint (external-link rows stay secondary).
              <ChevronRight size={iconSize.md} color={colors.labelTertiary} />
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
        </Section>
      </ScrollView>
    </>
  );
}
