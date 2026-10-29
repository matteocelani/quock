// Single row in ChatHistoryPanel — ListRow + ReanimatedSwipeable revealing Pin, Rename and Delete.

import React, { useCallback, useRef, useState } from "react";
import ReanimatedSwipeable, {
  type SwipeableMethods,
} from "react-native-gesture-handler/ReanimatedSwipeable";
import Reanimated, {
  type SharedValue,
  useAnimatedStyle,
} from "react-native-reanimated";
import Pencil from "lucide-react-native/icons/pencil";
import Pin from "lucide-react-native/icons/pin";
import PinOff from "lucide-react-native/icons/pin-off";
import Trash2 from "lucide-react-native/icons/trash-2";
import { type LucideIcon } from "lucide-react-native";
import { StyleSheet, Text, View, type ViewStyle } from "react-native";
import { formatBytes } from "@/modules/chat/lib/formatBytes";
import { GlassOrb } from "@/components/ui/GlassOrb";
import { ListRow } from "@/components/ui/ListRow";
import { useHaptics } from "@/lib/hooks/useHaptics";
import { useThemeColors } from "@/lib/theme/ThemeContext";
import {
  componentLayout,
  iconSize,
  motion,
  opacity,
  strokeWidth,
  timingsNamed,
} from "@/lib/design/tokens";
import type { ChatSummary } from "@/lib/db/types";
import type { ChatId } from "@/lib/types/ids";

export interface ChatRowProps {
  chat: ChatSummary;
  showDivider: boolean;
  trailingMeta: string;
  onTap: (id: ChatId) => void;
  onDelete: (id: ChatId) => void;
  onRename: (id: ChatId, currentTitle: string) => void;
  onPin: (id: ChatId, isPinned: boolean) => void;
  /** Called whenever this row's swipe opens. The parent uses it to enforce a "single open at a time" rule by closing any previously opened row. */
  onSwipeOpen?: (swipeable: SwipeableMethods | null) => void;
}

interface RailActionProps {
  icon: LucideIcon;
  label: string;
  fill: string;
  onPress: () => void;
  accessibilityLabel: string;
  testID: string;
}
function RailAction({
  icon: Icon,
  label,
  fill,
  onPress,
  accessibilityLabel,
  testID,
}: RailActionProps): React.ReactElement {
  const colors = useThemeColors();
  return (
    <View className="items-center gap-1">
      <GlassOrb
        variant="regular"
        lift="contained"
        interactive
        onPress={onPress}
        tintColor={fill}
        borderRadius={999}
        accessibilityLabel={accessibilityLabel}
        testID={testID}
      >
        <View className="w-15 h-8.5 items-center justify-center">
          <Icon size={iconSize.lg} color={colors.actionForeground} />
        </View>
      </GlassOrb>
      {/* Hidden from VoiceOver: the capsule's own label already says it, and twice reads as a stutter. */}
      <Text
        className="font-sans text-caption-2 text-label-secondary"
        numberOfLines={1}
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
      >
        {label}
      </Text>
    </View>
  );
}

interface RightActionsProps {
  progress: SharedValue<number>;
  isPinned: boolean;
  onPin: () => void;
  onRename: () => void;
  onDelete: () => void;
}
// Own component so `useAnimatedStyle` (a hook) can read the progress SharedValue from renderRightActions.
function RightActions({
  progress,
  isPinned,
  onPin,
  onRename,
  onDelete,
}: RightActionsProps): React.ReactElement {
  const colors = useThemeColors();
  const animatedStyle = useAnimatedStyle(() => {
    "worklet";
    const p = progress.value;
    // Buttons grow from motion.scaleFrom → 1 mirroring the swipe distance.
    const scale = motion.scaleFrom + p * (1 - motion.scaleFrom);
    // Two-segment ramp so buttons look "ready" well before the row is fully open.
    const op =
      p < opacity.midpoint
        ? p
        : opacity.midpoint +
          ((p - opacity.midpoint) / (1 - opacity.midpoint)) *
            (1 - opacity.midpoint);
    return {
      opacity: op,
      transform: [{ scale }],
    };
  });
  return (
    <Reanimated.View
      className="flex-row items-center gap-2"
      // Right edge on the same 16pt grid as the timestamp; the sliding row brings its own left inset.
      style={[
        { paddingRight: componentLayout.listSection.insetX },
        animatedStyle,
      ]}
    >
      <RailAction
        icon={isPinned ? PinOff : Pin}
        label={isPinned ? "Unpin" : "Pin"}
        fill={colors.actionPin}
        onPress={onPin}
        accessibilityLabel={isPinned ? "Unpin chat" : "Pin chat"}
        testID="chat-row-pin"
      />
      {/* `Pencil` (classic edit glyph) distinguishes the swipe rename action from the `PenLine` compose icon used for "New chat" at the top of the sheet. */}
      <RailAction
        icon={Pencil}
        label="Rename"
        fill={colors.actionNeutral}
        onPress={onRename}
        accessibilityLabel="Rename chat"
        testID="chat-row-rename"
      />
      <RailAction
        icon={Trash2}
        label="Delete"
        fill={colors.destructive}
        onPress={onDelete}
        accessibilityLabel="Delete chat"
        testID="chat-row-delete"
      />
    </Reanimated.View>
  );
}

export function ChatRow({
  chat,
  showDivider,
  trailingMeta,
  onTap,
  onDelete,
  onRename,
  onPin,
  onSwipeOpen,
}: ChatRowProps): React.ReactElement {
  const haptics = useHaptics();
  const swipeableRef = useRef<SwipeableMethods>(null);
  // Tracks the swipe state so we can fade out the trailing meta caption while the action rail is exposed.
  const [isSwipeOpen, setIsSwipeOpen] = useState<boolean>(false);
  // Holds the deferred-dialog timer so we can cancel it if the row unmounts (sheet dismissed) before it fires —
  // otherwise the rename/delete dialog would pop up over the parent after the sheet has already closed.
  const pendingActionRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Defer the dialog until the swipeable close animation finishes — otherwise its gesture handler stays armed and the row refuses to reopen on the next swipe.
  const handleRenamePress = useCallback((): void => {
    swipeableRef.current?.close();
    pendingActionRef.current = setTimeout(() => {
      onRename(chat.id, chat.title);
    }, timingsNamed.swipeCloseTail);
  }, [chat.id, chat.title, onRename]);
  // A light tap on press: unlike rename and delete there is no dialog after it, so the hand needs the confirmation.
  const handlePinPress = useCallback((): void => {
    haptics.light();
    swipeableRef.current?.close();
    pendingActionRef.current = setTimeout(() => {
      onPin(chat.id, !chat.isPinned);
    }, timingsNamed.swipeCloseTail);
  }, [chat.id, chat.isPinned, haptics, onPin]);
  const handleDeletePress = useCallback((): void => {
    swipeableRef.current?.close();
    pendingActionRef.current = setTimeout(() => {
      onDelete(chat.id);
    }, timingsNamed.swipeCloseTail);
  }, [chat.id, onDelete]);
  React.useEffect(
    () => () => {
      if (pendingActionRef.current !== null) {
        clearTimeout(pendingActionRef.current);
      }
    },
    [],
  );
  const renderRightActions = useCallback(
    (progress: SharedValue<number>): React.ReactElement => (
      <RightActions
        progress={progress}
        isPinned={chat.isPinned}
        onPin={handlePinPress}
        onRename={handleRenamePress}
        onDelete={handleDeletePress}
      />
    ),
    [chat.isPinned, handlePinPress, handleRenamePress, handleDeletePress],
  );
  // Fallback to the excerpt when the chat has no title yet (drafts).
  const rowLabel = chat.title.length > 0 ? chat.title : chat.excerpt;
  // Size is meaningful only for chats that actually hold content; we hide it for empty drafts so the row stays clean.
  const sizeLabel =
    chat.sizeBytes > 0 ? formatBytes(chat.sizeBytes) : undefined;
  // Hairline lives on the wrapper (outside the swipeable) so it stays put while the row content slides — a native borderBottom, not a sibling View, to stay crisp over the sheet's Glass blur.
  const colors = useThemeColors();
  const dividerStyle = React.useMemo<ViewStyle>(
    () =>
      showDivider
        ? {
            borderBottomWidth: StyleSheet.hairlineWidth,
            borderBottomColor: colors.border,
          }
        : {},
    [showDivider, colors.border],
  );
  return (
    <View style={dividerStyle}>
      <ReanimatedSwipeable
        ref={swipeableRef}
        renderRightActions={renderRightActions}
        overshootRight={false}
        friction={motion.swipeFriction}
        rightThreshold={motion.swipeRightThreshold}
        // `willOpen` fires at animation start so meta-fade aligns; surfaces the ref for the parent's single-open rule.
        onSwipeableWillOpen={(): void => {
          setIsSwipeOpen(true);
          onSwipeOpen?.(swipeableRef.current);
        }}
        onSwipeableWillClose={(): void => setIsSwipeOpen(false)}
      >
        {/* Row keeps its transparent background so the parent sheet's Glass surface (BlurView + iOS 26 tint) shows through cleanly. The "26 min" timestamp doesn't need a backing — it fades out during swipe via `hideTrailingMeta` below. */}
        <ListRow
          label={rowLabel}
          subtitle={sizeLabel}
          subtitleTiny
          trailingMeta={trailingMeta}
          hideTrailingMeta={isSwipeOpen}
          metaAccessory={
            chat.isPinned ? (
              <Pin
                size={iconSize.sm}
                color={colors.labelTertiary}
                strokeWidth={strokeWidth.regular}
              />
            ) : undefined
          }
          onPress={(): void => onTap(chat.id)}
          showDivider={false}
          testID={`chat-row-${chat.id}`}
        />
      </ReanimatedSwipeable>
    </View>
  );
}
