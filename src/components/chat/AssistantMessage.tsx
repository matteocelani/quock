// Assistant chat row; picks its surface off `message.status` so the bubble stays in one slot across the lifecycle.

import clsx from "clsx";
import * as Clipboard from "expo-clipboard";
import React, { useCallback } from "react";
import { Text, View } from "react-native";
import { Copy, Globe, RotateCw, type LucideIcon } from "lucide-react-native";
import { Button } from "@/components/ui/Button";
import { Markdown } from "@/components/ui/Markdown";
import { Pressable } from "@/components/ui/Pressable";
import { useThemeColors } from "@/lib/theme/ThemeContext";
import { iconSize, strokeWidth } from "@/lib/design/tokens";
import { MessageBubble } from "@/components/chat/MessageBubble";
import { StreamingCursor } from "@/components/chat/StreamingCursor";
import { ThinkingBlock } from "@/components/chat/ThinkingBlock";
import { ThinkingDots } from "@/components/chat/ThinkingDots";
import type { DbMessage, MessageErrorCode } from "@/lib/db/types";
import { useToast } from "@/lib/hooks/useToast";
import {
  useStreamingStore,
  type ToolActivity,
} from "@/modules/chat/stores/streaming.store";
import type { MessageId } from "@/lib/types/ids";

export interface AssistantMessageProps {
  message: DbMessage;
  isStreaming: boolean;
  onRegenerate?: (assistantMessageId: MessageId) => void;
  onRetry?: (assistantMessageId: MessageId) => void;
}

// Copy keyed off the persisted error code, worded so the user can tell whose side the failure is on (Ollama / their connection / the Quock app) and route a report accordingly.
const ERROR_COPY: Record<MessageErrorCode, string> = {
  network: "Couldn't reach Ollama. Check your connection.",
  cloud: "Ollama couldn't process this request.",
  subscription: "Ollama usage limit reached.",
  unknown: "Quock hit an unexpected error.",
};

interface ActionButtonProps {
  icon: LucideIcon;
  onPress: () => void;
  accessibilityLabel: string;
  testID?: string;
}

function ActionButton({
  icon: IconComponent,
  onPress,
  accessibilityLabel,
  testID,
}: ActionButtonProps): React.ReactElement {
  const colors = useThemeColors();
  return (
    <Pressable
      onPress={onPress}
      accessibilityLabel={accessibilityLabel}
      testID={testID}
      className="p-2"
    >
      <IconComponent
        size={iconSize.sm}
        color={colors.mutedForeground}
        strokeWidth={strokeWidth.bold}
      />
    </Pressable>
  );
}

interface SearchingIndicatorProps {
  activity: ToolActivity;
}
// Mid-stream tool status: a live line that stacks beneath any reasoning/answer while a web tool runs (it never replaces them).
function SearchingIndicator({
  activity,
}: SearchingIndicatorProps): React.ReactElement {
  const colors = useThemeColors();
  const verb = activity.name === "web_fetch" ? "Fetching" : "Searching for";
  return (
    <View className="flex-row items-center gap-2">
      <Globe
        size={iconSize.sm}
        color={colors.mutedForeground}
        strokeWidth={strokeWidth.regular}
      />
      <Text
        className="flex-1 font-sans text-sm text-muted-foreground"
        numberOfLines={1}
      >
        {verb} {activity.query}…
      </Text>
    </View>
  );
}

// Non-fatal note on a landed bubble: the web search failed (auth/network) but the model still answered, so the user knows the reply wasn't grounded in a search.
function WebSearchFailedNote(): React.ReactElement {
  const colors = useThemeColors();
  return (
    <View className="mt-2 flex-row items-center self-start rounded-full bg-destructive-soft px-3 py-1.5">
      <Globe
        size={iconSize.xs}
        color={colors.destructive}
        strokeWidth={strokeWidth.regular}
      />
      <Text className="ml-1.5 font-sans text-xs text-destructive">
        Web search unavailable
      </Text>
    </View>
  );
}

function AssistantMessageImpl({
  message,
  isStreaming,
  onRegenerate,
  onRetry,
}: AssistantMessageProps): React.ReactElement {
  const toast = useToast();
  // Mid-stream web-tool status for this chat (cleared between rounds); shown only on the streaming row.
  const toolActivity = useStreamingStore((s) =>
    s.toolActivity.get(message.chatId),
  );
  const handleCopy = useCallback((): void => {
    Clipboard.setStringAsync(message.content)
      .then(() => {
        toast({ title: "Copied to clipboard", tone: "success" });
      })
      .catch((err: unknown) => {
        console.warn("AssistantMessage: clipboard write failed", err);
        toast({ title: "Copy failed", tone: "error" });
      });
  }, [message.content, toast]);
  const handleRegenerate = useCallback((): void => {
    onRegenerate?.(message.id);
  }, [onRegenerate, message.id]);
  const handleRetry = useCallback((): void => {
    onRetry?.(message.id);
  }, [onRetry, message.id]);
  const isPending = message.status === "pending";
  const isError = message.status === "error";
  const isInterrupted = message.status === "interrupted";
  // Has the model produced any reasoning yet (think: true models stream `<think>` tokens before the answer).
  const hasThinking =
    message.thinking !== null && message.thinking.length > 0;
  const hasContent = message.content.length > 0;
  // A web tool is running right now — only on the live streaming row, never on older bubbles that share the chat's transient activity.
  const isSearching = isStreaming && toolActivity !== undefined;
  const showCursor = !isPending && isStreaming && !hasContent;
  // Spinner only when there is genuinely nothing to show yet: no reasoning, no answer, no active tool. Everything else stacks, so think + search no longer fight for the same slot.
  const showThinkingDots =
    isPending && !hasThinking && !hasContent && !isSearching;
  // Non-fatal note: the search failed but the model still answered (hard failures take the error branch instead).
  const showWebSearchFailed =
    message.webSearchFailed && !isError && !isInterrupted;
  // Action row visible only once the response is fully landed — hide during pending / streaming / error / interrupted so the icons never offer regenerate over an in-flight answer.
  const showActionRow = message.status === "complete" && hasContent;
  return (
    <View>
      <MessageBubble role="assistant" isStreaming={isStreaming}>
        {hasThinking ? (
          <ThinkingBlock
            key={message.id}
            thinking={message.thinking ?? ""}
            isStreaming={isStreaming}
            hasContent={hasContent}
          />
        ) : null}
        {hasContent || showCursor ? (
          <View className="flex-row items-end flex-wrap">
            <Markdown source={message.content} className="flex-1" />
            {showCursor ? <StreamingCursor /> : null}
          </View>
        ) : null}
        {isStreaming && toolActivity ? (
          <View className={clsx((hasThinking || hasContent) && "mt-2")}>
            <SearchingIndicator activity={toolActivity} />
          </View>
        ) : null}
        {showThinkingDots ? <ThinkingDots /> : null}
        {showWebSearchFailed ? <WebSearchFailedNote /> : null}
        {isError ? (
          <View className="mt-2 flex-row items-center self-start rounded-full bg-destructive-soft pl-3.5 pr-1.5 py-1.5">
            <Text className="font-sans text-sm text-destructive mr-2">
              {ERROR_COPY[message.errorCode ?? "unknown"]}
            </Text>
            {onRetry !== undefined ? (
              <Button variant="secondary" size="sm" onPress={handleRetry}>
                <RotateCw size={iconSize.xs} />
                <Text className="ml-1 font-sans text-xs text-secondary-foreground">Retry</Text>
              </Button>
            ) : null}
          </View>
        ) : null}
        {isInterrupted ? (
          <View className="mt-2 flex-row items-center self-start">
            <Text className="font-sans italic text-sm text-muted-foreground mr-2">
              Interrupted
            </Text>
            {onRetry !== undefined ? (
              <Button variant="secondary" size="sm" onPress={handleRetry}>
                <RotateCw size={iconSize.xs} />
                <Text className="ml-1 font-sans text-xs text-secondary-foreground">Retry</Text>
              </Button>
            ) : null}
          </View>
        ) : null}
      </MessageBubble>
      {showActionRow ? (
        <View className="px-4 -mt-3 mb-2 flex-row items-center">
          <ActionButton
            icon={Copy}
            onPress={handleCopy}
            accessibilityLabel="Copy message"
            testID="assistant-action-copy"
          />
          {onRegenerate !== undefined ? (
            <ActionButton
              icon={RotateCw}
              onPress={handleRegenerate}
              accessibilityLabel="Regenerate response"
              testID="assistant-action-regenerate"
            />
          ) : null}
        </View>
      ) : null}
    </View>
  );
}

function areEqual(
  prev: AssistantMessageProps,
  next: AssistantMessageProps,
): boolean {
  // Repo updates allocate a new message object on every content/status change, so reference identity suffices.
  return (
    prev.message === next.message &&
    prev.isStreaming === next.isStreaming &&
    prev.onRegenerate === next.onRegenerate &&
    prev.onRetry === next.onRetry
  );
}

export const AssistantMessage = React.memo(AssistantMessageImpl, areEqual);
