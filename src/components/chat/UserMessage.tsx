// User-authored row: optional attachment chips above a right-aligned bubble, with copy and edit actions below. Editing drops into an inline TextField (Cancel/Save) that re-runs the conversation from the edited turn.

import { Brain, Check, Copy, Globe, Pencil } from "lucide-react-native";
import * as Clipboard from "expo-clipboard";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Text, View } from "react-native";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from "react-native-reanimated";
import type { DbAttachment, DbMessage } from "@/lib/db/types";
import { bytesToBase64 } from "@/lib/encoding/base64";
import { AttachmentChip } from "@/components/chat/AttachmentChip";
import { Button } from "@/components/ui/Button";
import { MessageBubble } from "@/components/chat/MessageBubble";
import { Pressable } from "@/components/ui/Pressable";
import { TextField } from "@/components/ui/TextField";
import { surfaceSpring } from "@/lib/design/motion";
import { useThemeColors } from "@/lib/theme/ThemeContext";
import { iconSize, strokeWidth, timingsNamed } from "@/lib/design/tokens";
import type { MessageId } from "@/lib/types/ids";
import { USER_MESSAGE_EDIT_MAX_LINES, USER_MESSAGE_ENTER_FADE_MS, USER_MESSAGE_ENTER_TRANSLATE_Y, USER_MESSAGE_FRESH_WINDOW_MS } from "@/modules/chat/constants";

// Fallback for pre-migration rows: re-encode the blob as a base64 data URI so expo-image can render the thumbnail.
function bytesToDataUri(bytes: Uint8Array, mime: string | null): string {
  return `data:${mime ?? "image/jpeg"};base64,${bytesToBase64(bytes)}`;
}

export interface UserMessageProps {
  message: DbMessage;
  attachments?: DbAttachment[];
  onEdit?: (userMessageId: MessageId, newContent: string) => void;
}

// Sub-component so `useMemo` can host the data-URI fallback per chip mount.
function PersistedAttachmentChip({
  attachment,
}: {
  attachment: DbAttachment;
}): React.ReactElement {
  const isImage = attachment.mimeType?.startsWith("image/") === true;
  const resolvedUri = useMemo<string | undefined>(() => {
    if (!isImage) return undefined;
    if (attachment.uri !== null) return attachment.uri;
    return bytesToDataUri(attachment.data, attachment.mimeType);
  }, [attachment.data, attachment.mimeType, attachment.uri, isImage]);
  const props: React.ComponentProps<typeof AttachmentChip> = {
    filename: attachment.filename,
    isImage,
  };
  if (resolvedUri !== undefined) props.uri = resolvedUri;
  return <AttachmentChip {...props} />;
}

function UserMessageImpl({
  message,
  attachments,
  onEdit,
}: UserMessageProps): React.ReactElement {
  const colors = useThemeColors();
  const hasAttachments = attachments !== undefined && attachments.length > 0;
  const [isEditing, setIsEditing] = useState<boolean>(false);
  const [draft, setDraft] = useState<string>(message.content);
  // Gate the entrance to the just-sent turn so recycled cells don't re-fire when scrolling.
  const isFresh = Date.now() - message.createdAt < USER_MESSAGE_FRESH_WINDOW_MS;
  const didAnimateRef = useRef<boolean>(!isFresh);
  const translateY = useSharedValue<number>(
    didAnimateRef.current ? 0 : USER_MESSAGE_ENTER_TRANSLATE_Y,
  );
  const opacity = useSharedValue<number>(didAnimateRef.current ? 1 : 0);
  useEffect(() => {
    if (didAnimateRef.current) return;
    didAnimateRef.current = true;
    translateY.value = withSpring(0, surfaceSpring);
    opacity.value = withTiming(1, { duration: USER_MESSAGE_ENTER_FADE_MS });
  }, [opacity, translateY]);
  const animatedStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ translateY: translateY.value }],
  }));
  const handleStartEdit = useCallback((): void => {
    setDraft(message.content);
    setIsEditing(true);
  }, [message.content]);
  // Bubble text isn't selectable, so a one-tap copy saves the edit-then-copy detour.
  const [isCopied, setIsCopied] = useState<boolean>(false);
  const copyTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    return () => {
      if (copyTimerRef.current !== null) clearTimeout(copyTimerRef.current);
    };
  }, []);
  const handleCopy = useCallback(async (): Promise<void> => {
    try {
      await Clipboard.setStringAsync(message.content);
      setIsCopied(true);
      if (copyTimerRef.current !== null) clearTimeout(copyTimerRef.current);
      copyTimerRef.current = setTimeout(() => {
        setIsCopied(false);
        copyTimerRef.current = null;
      }, timingsNamed.copyFeedback);
    } catch (err: unknown) {
      console.warn("UserMessage: clipboard write failed", err);
    }
  }, [message.content]);
  const handleCancelEdit = useCallback((): void => {
    setIsEditing(false);
    setDraft(message.content);
  }, [message.content]);
  const handleSaveEdit = useCallback((): void => {
    const trimmed = draft.trim();
    if (trimmed.length === 0 || trimmed === message.content) {
      setIsEditing(false);
      return;
    }
    setIsEditing(false);
    onEdit?.(message.id, trimmed);
  }, [draft, message.content, message.id, onEdit]);
  const isDirty = draft.trim() !== message.content && draft.trim().length > 0;
  if (isEditing) {
    return (
      <Animated.View style={animatedStyle}>
        {hasAttachments ? (
          <View className="px-4 pt-2 items-end">
            <View className="flex-row flex-wrap gap-2 justify-end">
              {attachments?.map((a) => (
                <PersistedAttachmentChip key={String(a.id)} attachment={a} />
              ))}
            </View>
          </View>
        ) : null}
        <View className="px-4 py-2">
          <TextField
            value={draft}
            onChangeText={setDraft}
            multiline
            maxLines={USER_MESSAGE_EDIT_MAX_LINES}
            autoCapitalize="sentences"
            testID="user-message-edit-input"
            containerClassName="bg-card border border-border rounded-3xl px-3 py-1"
          />
          <View className="flex-row justify-end gap-2 mt-2">
            <Button variant="secondary" size="sm" onPress={handleCancelEdit}>
              Cancel
            </Button>
            <Button
              variant="primary"
              size="sm"
              onPress={handleSaveEdit}
              disabled={!isDirty}
              testID="user-message-edit-save"
            >
              Save
            </Button>
          </View>
        </View>
      </Animated.View>
    );
  }
  return (
    <Animated.View style={animatedStyle}>
      {hasAttachments ? (
        <View className="px-4 pt-2 items-end">
          <View className="flex-row flex-wrap gap-2 justify-end">
            {attachments?.map((a) => (
              <PersistedAttachmentChip key={String(a.id)} attachment={a} />
            ))}
          </View>
        </View>
      ) : null}
      <MessageBubble role="user">
        <Text className="font-sans text-primary-foreground text-base leading-6">
          {message.content}
        </Text>
      </MessageBubble>
      <View className="px-4 -mt-3 mb-2 flex-row justify-end items-center">
        {message.sentWithWebSearch || message.sentWithThink ? (
          // Read-only indicators of the modes this prompt was sent with — same size/weight as the copy/edit
          // actions so they read clearly. Non-interactive, purely informational.
          <View
            className="flex-row items-center gap-1.5 mr-1.5"
            accessibilityLabel={`Sent with ${[
              message.sentWithWebSearch ? "web search" : null,
              message.sentWithThink ? "thinking" : null,
            ]
              .filter(Boolean)
              .join(" and ")}`}
          >
            {message.sentWithWebSearch ? (
              <Globe
                size={iconSize.sm}
                color={colors.mutedForeground}
                strokeWidth={strokeWidth.bold}
              />
            ) : null}
            {message.sentWithThink ? (
              <Brain
                size={iconSize.sm}
                color={colors.mutedForeground}
                strokeWidth={strokeWidth.bold}
              />
            ) : null}
          </View>
        ) : null}
        <Pressable
          onPress={() => {
            void handleCopy();
          }}
          accessibilityLabel="Copy message"
          haptic={false}
          className="p-2"
        >
          {isCopied ? (
            <Check
              size={iconSize.sm}
              color={colors.mutedForeground}
              strokeWidth={strokeWidth.bold}
            />
          ) : (
            <Copy
              size={iconSize.sm}
              color={colors.mutedForeground}
              strokeWidth={strokeWidth.bold}
            />
          )}
        </Pressable>
        {onEdit !== undefined ? (
          <Pressable
            onPress={handleStartEdit}
            accessibilityLabel="Edit message"
            testID="user-message-edit"
            className="p-2"
          >
            <Pencil
              size={iconSize.sm}
              color={colors.mutedForeground}
              strokeWidth={strokeWidth.bold}
            />
          </Pressable>
        ) : null}
      </View>
    </Animated.View>
  );
}

function areEqual(prev: UserMessageProps, next: UserMessageProps): boolean {
  // Repository layer produces stable references between renders so identity checks on message + attachments + onEdit are sufficient.
  return (
    prev.message === next.message &&
    prev.attachments === next.attachments &&
    prev.onEdit === next.onEdit
  );
}

export const UserMessage = React.memo(UserMessageImpl, areEqual);
