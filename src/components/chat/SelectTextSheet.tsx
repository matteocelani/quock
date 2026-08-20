// Lifts one assistant reply into a sheet as read-only selectable text — the in-list Markdown can't be selected
// (FlashList + Fabric swallow the long-press), so this is where a user grabs and copies an arbitrary portion.

import X from "lucide-react-native/icons/x";
import React, { useMemo } from "react";
import { TextInput, View } from "react-native";
import { IconButton } from "@/components/ui/IconButton";
import { Sheet } from "@/components/ui/Sheet";
import { SheetHeader } from "@/components/ui/SheetHeader";
import { useThemeColors } from "@/lib/theme/ThemeContext";
import { SELECT_TEXT_SHEET_SNAP } from "@/modules/chat/constants";
import { markdownToPlainText } from "@/components/ui/markdown/toPlainText";

export interface SelectTextSheetProps {
  visible: boolean;
  content: string;
  onClose: () => void;
}

export function SelectTextSheet({
  visible,
  content,
  onClose,
}: SelectTextSheetProps): React.ReactElement {
  const colors = useThemeColors();
  // Cleaned of markdown marks but keeping structure, so a selection copies clean words (no stray ** or #).
  const plain = useMemo(() => markdownToPlainText(content), [content]);
  return (
    <Sheet
      visible={visible}
      onClose={onClose}
      snapPoints={[SELECT_TEXT_SHEET_SNAP]}
    >
      <SheetHeader
        title="Select text"
        right={
          <IconButton
            icon={X}
            onPress={onClose}
            accessibilityLabel="Close"
            tone="muted"
          />
        }
      />
      {/* Read-only multiline TextInput, not `<Text selectable>`: a non-editable iOS TextInput selects reliably,
          while `selectable` is swallowed inside the message FlashList on this New-Architecture stack. */}
      <View className="flex-1 px-4 pb-4">
        <TextInput
          value={plain}
          editable={false}
          multiline
          scrollEnabled
          textAlignVertical="top"
          selectionColor={colors.primary}
          style={{ flex: 1 }}
          className="font-sans text-body text-foreground"
        />
      </View>
    </Sheet>
  );
}
