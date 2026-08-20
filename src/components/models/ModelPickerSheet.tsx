// Bottom sheet for picking the active cloud model — radio + name + capability chips, auto-dismisses on tap.

import * as Haptics from "expo-haptics";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { ScrollView, Text, View } from "react-native";
import Brain from "lucide-react-native/icons/brain";
import Eye from "lucide-react-native/icons/eye";
import X from "lucide-react-native/icons/x";
import { type LucideIcon } from "lucide-react-native";
import type { CloudModel } from "@/modules/models/api/models";
import { GlassOrb } from "@/components/ui/GlassOrb";
import { IconButton } from "@/components/ui/IconButton";
import { ListRow, type ListRowChip } from "@/components/ui/ListRow";
import { NoModelMatches } from "@/components/models/NoModelMatches";
import { RadioIndicator } from "@/components/ui/RadioIndicator";
import { SearchInput } from "@/components/ui/SearchInput";
import { Sheet } from "@/components/ui/Sheet";
import { SheetHeader } from "@/components/ui/SheetHeader";
import { useThemeColors } from "@/lib/theme/ThemeContext";
import { componentLayout, iconSize, strokeWidth } from "@/lib/design/tokens";
import { formatModelName } from "@/modules/models/lib/formatModelName";
import { useCloudModels } from "@/modules/models/hooks/useCloudModels";
import { useListModelCapabilities } from "@/modules/models/hooks/useModelCapabilities";
import { useChatModel } from "@/modules/models/hooks/useChatModel";
import { useSelectedModel } from "@/modules/models/hooks/useSelectedModel";
import { useUIStore } from "@/lib/stores/ui.store";
import type { ChatId } from "@/lib/types/ids";
import {
  MODEL_PICKER_SHEET_SNAP,
  SHEET_CLOSE_DELAY_MS,
} from "@/modules/models/constants";

export interface ModelPickerSheetProps {
  visible: boolean;
  onClose: () => void;
  // The open chat, pinned to in "current" mode. Null while one is being created: the picker lives in the header, which
  // outlives the screen, and with no chat to pin to a pick can only move the global default.
  chatId: ChatId | null;
}
// `/api/show` also reports `completion` and `tools`, deliberately not shown: every cloud model has both, so they pushed
// each row onto a second chip line to say nothing. These two are the capabilities a user actually feels in the app.
type CapabilityFilter = "vision" | "thinking";
interface CapabilityChoice {
  key: CapabilityFilter;
  label: string;
  icon: LucideIcon;
}
// Fixed order, so a row's chips read the same way every time — `/api/show` returns them in no particular order.
const CAPABILITY_CHOICES: readonly CapabilityChoice[] = [
  { key: "vision", label: "Vision", icon: Eye },
  { key: "thinking", label: "Thinking", icon: Brain },
];

// Bottom padding inside the model list — leaves room below the last row so it never sits flush against the sheet's bottom edge.
const LIST_PAD_BOTTOM = 24;

interface ModelRowProps {
  model: CloudModel;
  capabilities: readonly string[];
  isSelected: boolean;
  showDivider: boolean;
  onPress: () => void;
}
// Capabilities arrive from the list, not from a per-row query, so a row can never show a chip the filter disagrees with.
function ModelRow({
  model,
  capabilities,
  isSelected,
  showDivider,
  onPress,
}: ModelRowProps): React.ReactElement {
  // All capability chips render with the same neutral tone — the iconography is enough to differentiate them.
  const chips = useMemo<ListRowChip[]>(
    () =>
      CAPABILITY_CHOICES.filter((choice) =>
        capabilities.includes(choice.key),
      ).map((choice) => ({ label: choice.key, icon: choice.icon })),
    [capabilities],
  );
  return (
    <ListRow
      leading={<RadioIndicator selected={isSelected} />}
      label={formatModelName(model.name)}
      subtitle={model.description}
      chips={chips}
      onPress={onPress}
      showDivider={showDivider}
      chipsBelowSubtitle
      subtitleNumberOfLines={componentLayout.modelPicker.descriptionMaxLines}
      testID={`model-row-${model.name.replace(/:/g, "-")}`}
    />
  );
}

// Search leads, because the cloud catalogue is long enough to scroll; the two capability toggles are the shortcut.
export function ModelPickerSheet({
  visible,
  onClose,
  chatId,
}: ModelPickerSheetProps): React.ReactElement {
  const colors = useThemeColors();
  const modelsQuery = useCloudModels();
  const mode = useUIStore((s) => s.modelPickerMode);
  // "default" → writes the persisted user preference; "current" → pins the model to this chat (chats.model).
  const defaultModel = useSelectedModel();
  const chat = useChatModel(chatId);
  const activeModel = mode === "default" ? defaultModel.model : chat.model;
  const writeModel = mode === "default" ? defaultModel.setModel : chat.setForCurrentChat;
  const title = mode === "default" ? "Default model" : "Choose a model";
  // Tracks which model is being confirmed (showing the check) before close.
  const [confirmingName, setConfirmingName] = useState<string | null>(null);
  // Independent toggles rather than one selection: asking for a model that both sees and reasons is a real request.
  const [activeFilters, setActiveFilters] = useState<
    readonly CapabilityFilter[]
  >([]);
  const [query, setQuery] = useState("");
  // Reset transient picker state on every open so the user always lands on the full, unfiltered list.
  useEffect(() => {
    if (visible) {
      setConfirmingName(null);
      setActiveFilters([]);
      setQuery("");
    }
  }, [visible]);
  const handleFilterTap = useCallback((key: CapabilityFilter): void => {
    setActiveFilters((prev) =>
      prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key],
    );
  }, []);
  const handleReset = useCallback((): void => {
    setActiveFilters([]);
    setQuery("");
  }, []);
  const handleSelect = useCallback(
    (m: CloudModel): void => {
      writeModel(m);
      setConfirmingName(m.name);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(
        (err: unknown) => {
          console.warn("ModelPickerSheet: haptic failed", err);
        },
      );
      setTimeout(() => onClose(), SHEET_CLOSE_DELAY_MS);
    },
    [writeModel, onClose],
  );
  const models = useMemo(() => modelsQuery.data ?? [], [modelsQuery.data]);
  // Asked for only while open: this sheet is mounted for the whole session (visibility is a prop, and `Modal` renders
  // nothing while hidden), so an unconditional list would fire one `/api/show` per model at launch for nobody.
  const names = useMemo(
    () => (visible ? models.map((m) => m.name) : []),
    [models, visible],
  );
  const capabilitiesByName = useListModelCapabilities(names);
  const activeLabels = useMemo(
    () =>
      CAPABILITY_CHOICES.filter((c) => activeFilters.includes(c.key)).map(
        (c) => c.label,
      ),
    [activeFilters],
  );
  const filteredModels = useMemo(() => {
    // Matched against the displayed name so typing "kimi" finds it whether or not the wire name carries a cloud tag.
    const needle = query.trim().toLowerCase();
    return models.filter((m) => {
      if (needle && !formatModelName(m.name).toLowerCase().includes(needle)) {
        return false;
      }
      const caps = capabilitiesByName.get(m.name) ?? [];
      return activeFilters.every((key) => caps.includes(key));
    });
  }, [models, capabilitiesByName, activeFilters, query]);
  return (
    <Sheet
      visible={visible}
      onClose={onClose}
      snapPoints={[MODEL_PICKER_SHEET_SNAP]}
    >
      <SheetHeader
        title={title}
        right={
          <IconButton
            icon={X}
            onPress={onClose}
            accessibilityLabel="Close"
            tone="muted"
          />
        }
      />
      {/* Search carries the list; the two orbs beside it are the only capabilities that change what the app can do. */}
      <View
        className="flex-row items-center pb-3 gap-2"
        // Shares the 16pt list grid with the rows below (px-4 renders 14 at the 14px rem).
        style={{ paddingHorizontal: componentLayout.listSection.insetX }}
      >
        <SearchInput
          value={query}
          onChangeText={setQuery}
          placeholder="Search models"
          className="flex-1"
          testID="model-search"
        />
        {CAPABILITY_CHOICES.map((choice) => {
          const isActive = activeFilters.includes(choice.key);
          const Icon = choice.icon;
          return (
            <GlassOrb
              key={choice.key}
              variant="regular"
              interactive
              onPress={(): void => handleFilterTap(choice.key)}
              tintColor={isActive ? colors.foreground : undefined}
              borderRadius={999}
              accessibilityLabel={
                isActive
                  ? `Clear ${choice.label} filter`
                  : `Filter by ${choice.label}`
              }
              testID={`model-filter-${choice.key}`}
            >
              {/* Sized here rather than with flex, which would collapse against the row's cross axis. */}
              <View className="w-10 h-10 items-center justify-center">
                <Icon
                  size={iconSize.md}
                  color={isActive ? colors.background : colors.mutedForeground}
                  strokeWidth={strokeWidth.bold}
                />
              </View>
            </GlassOrb>
          );
        })}
      </View>
      <ScrollView
        className="flex-1"
        contentContainerStyle={{ paddingBottom: LIST_PAD_BOTTOM }}
        showsVerticalScrollIndicator={false}
        bounces
      >
        {modelsQuery.isLoading ? (
          <Text className="font-sans text-footnote text-muted-foreground py-8 text-center">
            Loading models…
          </Text>
        ) : modelsQuery.isError ? (
          <Text className="font-sans text-footnote text-muted-foreground py-8 text-center">
            Could not load models
          </Text>
        ) : models.length === 0 ? (
          <Text className="font-sans text-footnote text-muted-foreground py-8 text-center">
            No cloud models available
          </Text>
        ) : filteredModels.length === 0 ? (
          <NoModelMatches
            query={query}
            activeLabels={activeLabels}
            onReset={handleReset}
          />
        ) : (
          filteredModels.map((m, index) => {
            const isSelected = activeModel?.name === m.name;
            const isConfirming = confirmingName === m.name;
            return (
              <ModelRow
                key={m.name}
                model={m}
                capabilities={capabilitiesByName.get(m.name) ?? []}
                isSelected={isSelected || isConfirming}
                showDivider={index < filteredModels.length - 1}
                onPress={(): void => handleSelect(m)}
              />
            );
          })
        )}
      </ScrollView>
    </Sheet>
  );
}
