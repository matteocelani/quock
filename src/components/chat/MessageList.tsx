// FlashList of messages — follows token streams only when the user is pinned to the tail.

import { FlashList, type FlashListRef } from "@shopify/flash-list";
import React, {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from "react";
import {
  View,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from "react-native";
import type { DbAttachment, DbMessage } from "@/lib/db/types";
import type { MessageId } from "@/lib/types/ids";
import { AssistantMessage } from "@/components/chat/AssistantMessage";
import {
  AT_BOTTOM_CLAMP_PX,
  AT_BOTTOM_REENGAGE_PX,
  DEFAULT_BOTTOM_INSET,
  DRAG_NET_DEAD_ZONE_PX,
  LIST_DRAW_DISTANCE,
} from "@/modules/chat/constants";
import { UserMessage } from "@/components/chat/UserMessage";

// Lets the composer drive scroll-to-latest while OWNING the floating button itself — the button rides the composer's keyboard lift, so it lives there, not here.
export interface MessageListHandle {
  scrollToLatest: () => void;
}

export interface MessageListProps {
  messages: DbMessage[];
  isStreaming: boolean;
  /** Space at the top of the scroll content so the first row clears the floating header instead of being hidden behind it. */
  topInset?: number;
  bottomInset?: number;
  // Reports whether the user has scrolled off the tail so the composer can show its jump-to-latest button.
  onScrolledUpChange?: (isScrolledUp: boolean) => void;
  onRegenerate?: (assistantMessageId: MessageId) => void;
  onRetry?: (assistantMessageId: MessageId) => void;
  onEdit?: (userMessageId: MessageId, newContent: string) => void;
  attachmentsByMessage?: ReadonlyMap<MessageId, DbAttachment[]>;
}

function MessageListInner(
  {
    messages,
    isStreaming,
    topInset = 0,
    bottomInset = DEFAULT_BOTTOM_INSET,
    onScrolledUpChange,
    onRegenerate,
    onRetry,
    onEdit,
    attachmentsByMessage,
  }: MessageListProps,
  ref: React.ForwardedRef<MessageListHandle>,
): React.ReactElement {
  const listRef = useRef<FlashListRef<DbMessage>>(null);
  // Gates the streaming auto-scroll; a ref so deferred scrolls read it synchronously. Mirrored to isScrolledUp so the composer's jump-to-latest button can render.
  const isAtBottomRef = useRef<boolean>(true);
  const lastMessageIdRef = useRef<number | null>(null);
  const [isScrolledUp, setIsScrolledUp] = useState<boolean>(false);
  // Single writer for the follow flag: the ref drives the auto-scroll logic, the state drives the button. setState dedupes, so frequent calls don't re-render.
  const setFollow = useCallback((isFollowing: boolean): void => {
    isAtBottomRef.current = isFollowing;
    setIsScrolledUp(!isFollowing);
  }, []);
  // Surface the scrolled-up flag so the composer can show its button (which rides the composer's own keyboard lift).
  useEffect(() => {
    onScrolledUpChange?.(isScrolledUp);
  }, [isScrolledUp, onScrolledUpChange]);
  const renderItem = useCallback(
    ({
      item,
      index,
    }: {
      item: DbMessage;
      index: number;
    }): React.ReactElement => {
      const isLast = index === messages.length - 1;
      const isLastAssistantStreaming =
        isLast && item.role === "assistant" && isStreaming;
      if (item.role === "user") {
        const rowAttachments = attachmentsByMessage?.get(item.id);
        const props: React.ComponentProps<typeof UserMessage> = {
          message: item,
        };
        if (rowAttachments !== undefined) props.attachments = rowAttachments;
        if (onEdit !== undefined) props.onEdit = onEdit;
        return <UserMessage {...props} />;
      }
      // Tool messages reuse the assistant row in v1 since their content already contains the formatted tool output.
      const aProps: React.ComponentProps<typeof AssistantMessage> = {
        message: item,
        isStreaming: isLastAssistantStreaming,
      };
      if (onRegenerate !== undefined) aProps.onRegenerate = onRegenerate;
      if (onRetry !== undefined) aProps.onRetry = onRetry;
      return <AssistantMessage {...aProps} />;
    },
    [messages.length, isStreaming, onRegenerate, onRetry, onEdit, attachmentsByMessage],
  );
  const keyExtractor = useCallback(
    (item: DbMessage): string => String(item.id),
    [],
  );
  const getItemType = useCallback((item: DbMessage): string => item.role, []);
  // Follow gating runs on the drag lifecycle only: a real finger drag releases follow instantly (programmatic scrolls never fire begin-drag, so no false positives), and re-engage is decided once per gesture at its end. A streaming reply is one giant growing row, so per-event offset deltas and mid-growth contentSize are both too unreliable to gate on.
  const isDraggingRef = useRef<boolean>(false);
  const dragStartYRef = useRef<number>(0);
  // Armed at end-drag so momentum-end only acts when it concludes a real user gesture; iOS emits a synthetic momentum-end for every non-animated programmatic scrollToEnd.
  const isUserGestureRef = useRef<boolean>(false);
  const onBeginDrag = useCallback(
    (e: NativeSyntheticEvent<NativeScrollEvent>): void => {
      const { contentOffset, contentSize, layoutMeasurement } = e.nativeEvent;
      isDraggingRef.current = true;
      dragStartYRef.current = contentOffset.y;
      // A list shorter than the viewport can't scroll; releasing would only flash the jump button.
      if (contentSize.height <= layoutMeasurement.height) return;
      setFollow(false);
    },
    [setFollow],
  );
  // Gesture direction comes from NET displacement (end minus start), never per-event deltas: a slow drag moves ~1px per event and is direction-blind to any epsilon. At the clamped bottom the offset can't lie regardless of contentSize lag, so engagement there is unconditional; otherwise re-engage only when the user arrived moving down and near the end.
  const maybeReengage = useCallback(
    (e: NativeSyntheticEvent<NativeScrollEvent>): void => {
      const { contentOffset, contentSize, layoutMeasurement } = e.nativeEvent;
      const distanceFromBottom =
        contentSize.height - (contentOffset.y + layoutMeasurement.height);
      const net = contentOffset.y - dragStartYRef.current;
      if (
        distanceFromBottom <= AT_BOTTOM_CLAMP_PX ||
        (net > DRAG_NET_DEAD_ZONE_PX &&
          distanceFromBottom <= AT_BOTTOM_REENGAGE_PX)
      ) {
        setFollow(true);
      }
    },
    [setFollow],
  );
  const onEndDrag = useCallback(
    (e: NativeSyntheticEvent<NativeScrollEvent>): void => {
      isDraggingRef.current = false;
      isUserGestureRef.current = true;
      maybeReengage(e);
    },
    [maybeReengage],
  );
  const onMomentumEnd = useCallback(
    (e: NativeSyntheticEvent<NativeScrollEvent>): void => {
      // A momentum-end with the finger down is a cancelled prior scroll (fling catch), and an unarmed one is synthetic or programmatic; neither concludes the user's gesture.
      if (isDraggingRef.current || !isUserGestureRef.current) return;
      isUserGestureRef.current = false;
      maybeReengage(e);
    },
    [maybeReengage],
  );
  const handleScrollToBottom = useCallback((): void => {
    // Tapping the button proves no finger is on the list, which also heals a drag flag leaked by Android's ACTION_CANCEL (it can swallow end-drag).
    isDraggingRef.current = false;
    setFollow(true);
    listRef.current?.scrollToEnd({ animated: true });
  }, [setFollow]);
  useImperativeHandle(
    ref,
    () => ({ scrollToLatest: handleScrollToBottom }),
    [handleScrollToBottom],
  );
  // Auto-scroll on new tail, or during streaming only when pinned. An active drag always wins: the user's gesture is fresher intent than any auto-scroll.
  useEffect(() => {
    const last = messages[messages.length - 1];
    if (!last) return;
    const isNew = lastMessageIdRef.current !== last.id;
    lastMessageIdRef.current = last.id;
    if (isDraggingRef.current) return;
    if (isNew) setFollow(true);
    if (isNew || isAtBottomRef.current) {
      // Defer one frame so FlashList has measured the new row, then re-check: a token can queue this scroll one frame before the user grabs the list.
      requestAnimationFrame(() => {
        if (!isDraggingRef.current && (isNew || isAtBottomRef.current)) {
          listRef.current?.scrollToEnd({ animated: !isStreaming });
        }
      });
    }
  }, [messages, isStreaming, setFollow]);
  // Retry and regenerate reuse the same row id, so the new-tail check misses them; any stream start is user-initiated generation and should re-pin.
  useEffect(() => {
    if (!isStreaming || isDraggingRef.current) return;
    setFollow(true);
    requestAnimationFrame(() => {
      if (!isDraggingRef.current && isAtBottomRef.current) {
        listRef.current?.scrollToEnd({ animated: false });
      }
    });
  }, [isStreaming, setFollow]);
  // Keyboard open/close changes bottomInset; if the user was pinned to the tail, follow the inset so the last bubble keeps clearing the composer instead of being trapped behind the keyboard.
  useEffect(() => {
    if (!isAtBottomRef.current) return;
    requestAnimationFrame(() => {
      if (!isDraggingRef.current && isAtBottomRef.current) {
        listRef.current?.scrollToEnd({ animated: true });
      }
    });
  }, [bottomInset]);
  return (
    <View className="flex-1">
      <FlashList<DbMessage>
        ref={listRef}
        data={messages}
        renderItem={renderItem}
        keyExtractor={keyExtractor}
        getItemType={getItemType}
        onScrollBeginDrag={onBeginDrag}
        onScrollEndDrag={onEndDrag}
        onMomentumScrollEnd={onMomentumEnd}
        contentContainerStyle={{ paddingTop: topInset, paddingBottom: bottomInset }}
        drawDistance={LIST_DRAW_DISTANCE}
      />
    </View>
  );
}

export const MessageList = React.memo(forwardRef(MessageListInner));
