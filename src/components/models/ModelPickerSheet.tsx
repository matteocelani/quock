// Bottom sheet for picking the active cloud model — radio + name + capability chips, auto-dismisses on tap.

import * as Haptics from "expo-haptics";
import clsx from "clsx";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { ScrollView, Text, View } from "react-native";
import {
  Brain,
  Eye,
  Sparkles,
  Wrench,
  X,
  type LucideIcon,
} from "lucide-react-native";
import type { CloudModel } from "@/modules/models/api/models";
import { GlassOrb } from "@/components/ui/GlassOrb";
import { IconButton } from "@/components/ui/IconButton";
import { ListRow, type ListRowChip } from "@/components/ui/ListRow";
import { RadioIndicator } from "@/components/ui/RadioIndicator";
import { Sheet } from "@/components/ui/Sheet";
import { SheetHeader } from "@/components/ui/SheetHeader";
import { useThemeColors } from "@/lib/theme/ThemeContext";
import {
  componentLayout,
  iconSize,
  strokeWidth,
} from "@/lib/design/tokens";
import { formatModelName } from "@/modules/models/lib/formatModelName";
import { inferCapabilities } from "@/modules/models/lib/inferCapabilities";
import { useCloudModels } from "@/modules/models/hooks/useCloudModels";
import { useModelCapabilities } from "@/modules/models/hooks/useModelCapabilities";
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
  // The open chat; in "current" mode the picker pins the choice to this chat.
  chatId: ChatId;
}
// /api/show currently returns only { completion, tools, thinking, vision } (verified 2026-06).
const CAPABILITY_ICONS: Readonly<Record<string, LucideIcon>> = {
  vision: Eye,
  tools: Wrench,
  thinking: Brain,
  completion: Sparkles,
};
// Pill key doubles as the filtered capability name; `null` means "show all".
type CapabilityFilter = "vision" | "tools" | "thinking" | "completion";
interface FilterPill {
  key: CapabilityFilter;
  label: string;
  icon: LucideIcon;
}
const FILTER_PILLS: readonly FilterPill[] = [
  { key: "vision", label: "Vision", icon: Eye },
  { key: "thinking", label: "Thinking", icon: Brain },
  { key: "tools", label: "Tools", icon: Wrench },
  { key: "completion", label: "Completion", icon: Sparkles },
];

// Bottom padding inside the model list — leaves room below the last row so it never sits flush against the sheet's bottom edge.
const LIST_PAD_BOTTOM = 24;

interface ModelRowProps {
  model: CloudModel;
  isSelected: boolean;
  showDivider: boolean;
  onPress: () => void;
}
// One `/api/show` query per row; TanStack dedups + caches per modelName so filter toggles never re-fetch.
function ModelRow({
  model,
  isSelected,
  showDivider,
  onPress,
}: ModelRowProps): React.ReactElement {
  const capabilities = useModelCapabilities(model.name);
  // All capability chips render with the same neutral tone — the iconography is enough to differentiate them.
  const chips = useMemo<ListRowChip[]>(
    () =>
      capabilities.map((label) => {
        // Cast to `| undefined` because `noUncheckedIndexedAccess` isn't enabled.
        const icon = CAPABILITY_ICONS[label] as LucideIcon | undefined;
        return icon ? { label, icon } : { label };
      }),
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

// No search bar — the featured subset is small enough that a capability filter beats typing.
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
  // `null` means no filter applied (i.e. show every model). Tapping a pill sets it; tapping it again clears it.
  const [activeFilter, setActiveFilter] = useState<CapabilityFilter | null>(null);
  // Reset transient picker state on every open so the user always lands on the unfiltered list.
  useEffect(() => {
    if (visible) {
      setConfirmingName(null);
      setActiveFilter(null);
    }
  }, [visible]);
  const handleFilterTap = useCallback((key: CapabilityFilter): void => {
    setActiveFilter((prev) => (prev === key ? null : key));
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
  const filteredModels = useMemo(() => {
    const models = modelsQuery.data ?? [];
    if (activeFilter === null) return models;
    return models.filter((m) => {
      const caps =
        m.capabilities && m.capabilities.length > 0
          ? m.capabilities
          : inferCapabilities(m.name);
      return caps.includes(activeFilter);
    });
  }, [modelsQuery.data, activeFilter]);
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
      {/* Four equal-width filter orbs. Each is a self-contained GlassOrb pill — the foreground tint flips to the inverse on active so the selection reads at a glance. */}
      <View className="flex-row items-center px-4 pb-3 gap-1.5">
        {FILTER_PILLS.map((pill) => {
          const isActive = activeFilter === pill.key;
          const Icon = pill.icon;
          return (
            <GlassOrb
              key={pill.key}
              variant="regular"
              interactive
              onPress={(): void => handleFilterTap(pill.key)}
              tintColor={isActive ? colors.foreground : undefined}
              borderRadius={999}
              className="flex-1"
              accessibilityLabel={
                isActive ? `Clear ${pill.label} filter` : `Filter by ${pill.label}`
              }
              testID={`model-filter-${pill.key}`}
            >
              <View className="flex-row items-center justify-center gap-1.5 py-1.5 px-2">
                <Icon
                  size={iconSize.xs}
                  color={isActive ? colors.background : colors.mutedForeground}
                  strokeWidth={strokeWidth.bold}
                />
                <Text
                  className={clsx(
                    "font-sans text-xs",
                    isActive ? "text-background" : "text-muted-foreground",
                  )}
                >
                  {pill.label}
                </Text>
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
          <Text className="font-sans text-muted-foreground text-sm py-8 text-center">
            Loading models…
          </Text>
        ) : modelsQuery.isError ? (
          <Text className="font-sans text-muted-foreground text-sm py-8 text-center">
            Could not load models
          </Text>
        ) : filteredModels.length === 0 ? (
          <Text className="font-sans text-muted-foreground text-sm py-8 text-center">
            {activeFilter === null
              ? "No cloud models available"
              : `No ${activeFilter} models available`}
          </Text>
        ) : (
          filteredModels.map((m, index) => {
            const isSelected = activeModel?.name === m.name;
            const isConfirming = confirmingName === m.name;
            return (
              <ModelRow
                key={m.name}
                model={m}
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
