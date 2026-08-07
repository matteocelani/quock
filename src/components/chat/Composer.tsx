// Bottom input bar — attach + multi-line field + send-morphs-into-stop while streaming.

import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  ScrollView,
  Text,
  View,
  type LayoutChangeEvent,
} from "react-native";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from "react-native-reanimated";
import {
  KeyboardAvoidingView,
  useKeyboardState,
} from "react-native-keyboard-controller";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ArrowUp, ChevronDown, Globe, Plus, Square } from "lucide-react-native";
import { GlassOrb } from "@/components/ui/GlassOrb";
import { ScrollEdgeBlur } from "@/components/ui/ScrollEdgeBlur";
import { TextField } from "@/components/ui/TextField";
import { useThemeColors } from "@/lib/theme/ThemeContext";
import { useHaptics } from "@/lib/hooks/useHaptics";
import { useIsStreaming } from "@/modules/chat/hooks/useIsStreaming";
import {
  useHasToolsCapability,
  useHasVisionCapability,
} from "@/modules/models/hooks/useModelCapabilities";
import { useChatModel } from "@/modules/models/hooks/useChatModel";
import { useSendMessage } from "@/modules/chat/hooks/useSendMessage";
import { useUIStore } from "@/lib/stores/ui.store";
import { useChatComposerModes } from "@/modules/chat/hooks/useChatComposerModes";
import { withAlpha } from "@/lib/design/color";
import { pressSpring, springEasing } from "@/lib/design/motion";
import {
  componentLayout,
  iconSize,
  opacity,
  strokeWidth,
  zLayer,
} from "@/lib/design/tokens";
import type { ChatId } from "@/lib/types/ids";
import { AttachmentChip } from "@/components/chat/AttachmentChip";
import {
  ATTACHMENT_MAX_BYTES,
  ATTACHMENT_MAX_TOTAL_BYTES,
  BYTES_PER_MB,
  COMPOSER_MAX_LINES,
  COMPOSER_SEND_MORPH_DURATION_MS,
} from "@/modules/chat/constants";
import type {
  UiAttachment,
  UiAttachmentInvalidReason,
} from "@/modules/chat/types";

// Rejection copy keyed by chip `invalidReason` so the text is consistent everywhere a chip appears.
const INVALID_COPY: Record<UiAttachmentInvalidReason, string> = {
  too_large: `Too large — ${Math.floor(ATTACHMENT_MAX_BYTES / BYTES_PER_MB)} MB max`,
  unsupported_type: "Unsupported file type",
  vision_required: "Switch to a vision model",
};

export interface ComposerProps {
  chatId: ChatId;
  attachments: UiAttachment[];
  // Remove by STABLE id (not index): idempotent against RN Pressable double-fire and immune to stale-index
  // wrong-item removal during re-renders. UiAttachment.id already exists as the React list key below.
  onRemoveAttachment: (id: string) => void;
  // Clears all in-flight attachments once they've been handed to the send pipeline.
  onClearAttachments: () => void;
  // Reports the composer's measured resting height so the list can pad/scroll exactly clear of it — the bar grows with attachment + active-mode chip rows, and a stale inset leaves the last message (and the scroll-to-bottom button) trapped behind it.
  onHeightChange?: (height: number) => void;
  // The scroll-to-latest button is hosted here (not in the list) so it rides the composer's keyboard lift; the list reports visibility and owns the scroll action.
  isJumpToLatestVisible?: boolean;
  onJumpToLatest?: () => void;
}

export function Composer({
  chatId,
  attachments,
  onRemoveAttachment,
  onClearAttachments,
  onHeightChange,
  isJumpToLatestVisible,
  onJumpToLatest,
}: ComposerProps): React.ReactElement {
  const colors = useThemeColors();
  const [text, setText] = useState<string>("");
  const insets = useSafeAreaInsets();
  // Cover bottom edge → top of orbs so the gradient's 0% mark lands exactly on the orb seam. insets.bottom adapts per device; the orb sums come from the design system.
  const composerBlurHeight =
    insets.bottom +
    componentLayout.composer.orbRowPaddingY +
    componentLayout.composer.orbSize;
  // Selector, not the whole store: subscribing to the full keyboard state re-rendered the Composer (BlurView +
  // MaskedView + gradient) on every keyboard animation frame, adding churn to the lift. We only need the boolean.
  const isKeyboardVisible = useKeyboardState((s) => s.isVisible);
  const haptics = useHaptics();
  const isStreaming = useIsStreaming(chatId);
  const { send, abort } = useSendMessage(chatId);
  const { model } = useChatModel(chatId);
  const hasVision = useHasVisionCapability(model?.name);
  const hasWebSearch = useHasToolsCapability(model?.name);
  // Web search is the inline globe toggle, persisted per-chat (DB-backed via useChatComposerModes) so each chat keeps its own setting across switches and restarts. Think is no longer a composer control — it lives in the + hub and useSendMessage decides whether to send it. Capability is an EFFECTIVE gate (the persisted preference is kept; it's just inert under a model without tools).
  const { webSearchEnabled, setWebSearchEnabled } = useChatComposerModes(chatId);
  const effectiveWebSearch = webSearchEnabled && hasWebSearch;
  const openAttach = useUIStore((s) => s.openAttach);
  const hasText = text.trim().length > 0;
  // Re-validate against the live model so switching to a non-vision model flips already-attached images to invalid.
  const validatedAttachments = useMemo<UiAttachment[]>(() => {
    return attachments.map((a) => {
      if (a.status === "invalid") return a;
      const isImage = a.mimeType?.startsWith("image/") === true;
      if (isImage && !hasVision) {
        return { ...a, status: "invalid", invalidReason: "vision_required" };
      }
      return a;
    });
  }, [attachments, hasVision]);
  const hasInvalidAttachment = useMemo<boolean>(
    () => validatedAttachments.some((a) => a.status === "invalid"),
    [validatedAttachments],
  );
  // One global rejection line (deduped) instead of repeating the reason under every chip — e.g. all images flip to "Switch to a vision model" at once.
  const invalidReasonText = useMemo<string | null>(() => {
    const reasons = [
      ...new Set(
        validatedAttachments
          .filter((a) => a.status === "invalid" && a.invalidReason !== undefined)
          .map((a) => a.invalidReason as UiAttachmentInvalidReason),
      ),
    ];
    return reasons.length > 0
      ? reasons.map((r) => INVALID_COPY[r]).join(" · ")
      : null;
  }, [validatedAttachments]);
  // Total payload across the ready chips: a single oversized file is caught per-chip, but a pile of in-budget ones can still overflow the request and stall the stream.
  const isAttachmentTotalTooLarge = useMemo<boolean>(() => {
    const total = validatedAttachments
      .filter((a) => a.status === "ready")
      .reduce((sum, a) => sum + a.sizeBytes, 0);
    return total > ATTACHMENT_MAX_TOTAL_BYTES;
  }, [validatedAttachments]);
  const sendDisabled =
    (!hasText && !isStreaming) ||
    ((hasInvalidAttachment || isAttachmentTotalTooLarge) && !isStreaming);
  // Cross-fade + spring scale on the send/stop morph; the spring lets the new icon "settle" into shape.
  const morphProgress = useSharedValue(isStreaming ? 1 : 0);
  const morphScale = useSharedValue(1);
  useEffect(() => {
    morphProgress.value = withTiming(isStreaming ? 1 : 0, {
      duration: COMPOSER_SEND_MORPH_DURATION_MS,
      easing: springEasing,
    });
    // Tiny pop on each toggle — settle back to 1 via the same press spring profile used elsewhere.
    morphScale.value = withSpring(0.88, pressSpring, () => {
      "worklet";
      morphScale.value = withSpring(1, pressSpring);
    });
  }, [isStreaming, morphProgress, morphScale]);
  const sendStyle = useAnimatedStyle(() => ({
    opacity: 1 - morphProgress.value,
    transform: [{ scale: morphScale.value }],
  }));
  const stopStyle = useAnimatedStyle(() => ({
    opacity: morphProgress.value,
    transform: [{ scale: morphScale.value }],
  }));
  // Synchronous double-send gate: `isStreaming` only flips true deep inside the async send (after the DB
  // writes), leaving a window where a second tap would append a duplicate message. This blocks that window.
  const sendingRef = React.useRef(false);
  const handleSend = useCallback((): void => {
    if (isStreaming) {
      abort();
      return;
    }
    if (
      sendingRef.current ||
      !hasText ||
      hasInvalidAttachment ||
      isAttachmentTotalTooLarge
    )
      return;
    const trimmed = text.trim();
    // Only ship valid chips over the wire.
    const outgoingAttachments = validatedAttachments.filter(
      (a) => a.status === "ready",
    );
    haptics.light();
    sendingRef.current = true;
    // Think is decided in useSendMessage from the chat's persisted preference (omitted when off → the model decides); the composer only carries the web-search flag.
    void send({
      text: trimmed,
      attachments: outgoingAttachments,
      webSearch: effectiveWebSearch,
      // Clear the draft only once the turn is persisted — a pre-persist failure (no model, DB error) keeps the text recoverable instead of silently losing it.
      onPersisted: () => {
        setText("");
        onClearAttachments();
      },
    })
      .catch((err: unknown) => {
        // Every send failure (incl. a subscription gate) lands as status:'error' with neutral copy — no purchase/
        // upgrade path is surfaced (App Store 3.1.1). warn, not error, so the diagnostic doesn't trigger LogBox.
        console.warn("Composer: send failed", err);
      })
      .finally(() => {
        sendingRef.current = false;
      });
    // Web search is sticky: it stays on across messages (persisted per chat) so iterative searching needs no re-tap. Toggle it via the inline globe.
  }, [
    abort,
    isAttachmentTotalTooLarge,
    effectiveWebSearch,
    hasInvalidAttachment,
    hasText,
    haptics,
    isStreaming,
    onClearAttachments,
    send,
    text,
    validatedAttachments,
  ]);
  // Constant inner pad + negative KAV offset = one interpolated lift landing at minBottomPad above the keyboard. Switching the pad on isKeyboardVisible instead desyncs from KAV's ramp and reads as a bump.
  const restingBottomPad = Math.max(
    insets.bottom,
    componentLayout.composer.minBottomPad,
  );
  // Single source for the arrow orb so its one placement below doesn't duplicate the GlassOrb JSX.
  const jumpToLatestOrb =
    isJumpToLatestVisible && onJumpToLatest ? (
      <GlassOrb
        variant="regular"
        interactive
        onPress={onJumpToLatest}
        borderRadius={999}
        accessibilityLabel="Scroll to latest"
      >
        <View className="w-9.5 h-9.5 items-center justify-center">
          <ChevronDown
            size={iconSize.lg}
            color={colors.foreground}
            strokeWidth={strokeWidth.regular}
          />
        </View>
      </GlassOrb>
    ) : null;
  // Report the bar's rendered height up so the list inset tracks chip/attachment rows; rounded to avoid sub-pixel re-render churn.
  const handleComposerLayout = useCallback(
    (e: LayoutChangeEvent): void => {
      onHeightChange?.(Math.round(e.nativeEvent.layout.height));
    },
    [onHeightChange],
  );
  return (
    <KeyboardAvoidingView
      behavior="padding"
      style={{
        position: "absolute",
        left: 0,
        right: 0,
        bottom: 0,
        zIndex: zLayer.composer,
      }}
      keyboardVerticalOffset={
        -(restingBottomPad - componentLayout.composer.minBottomPad)
      }
    >
      {/* Total blur at the screen edge, gone exactly at the orb seam. Hidden with the keyboard up: it would sit on the
          keyboard surface, which has its own material. */}
      {!isKeyboardVisible ? (
        <ScrollEdgeBlur
          edge="bottom"
          height={composerBlurHeight}
          intensity={componentLayout.scrollEdgeBlur.intensity}
        />
      ) : null}
      {/* Background-less surface: the orbs + TextField float over MessageList directly (Apple HIG iOS 26 topmost-layer pattern). Each control owns its own surface (GlassOrb shadow on the orbs, bg-card on the TextField) so they read cleanly without a strip behind them. */}
      <View
        style={{ position: "relative", paddingBottom: restingBottomPad }}
        onLayout={handleComposerLayout}
      >
        {validatedAttachments.length > 0 ? (
          // Chip band: a single horizontal scroller. The scroll-to-latest arrow is anchored to the input row
          // below, so it never overlaps the chips — symmetric padding, no right-side reservation.
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{
              paddingHorizontal: componentLayout.composer.chipScrollPadX,
              paddingTop: componentLayout.composer.chipScrollPadTop,
              gap: componentLayout.composer.chipScrollGap,
            }}
          >
            {validatedAttachments.map((a) => (
              <AttachmentChip
                key={a.id}
                filename={a.filename}
                isImage={a.mimeType?.startsWith("image/") === true}
                uri={a.uri}
                invalid={a.status === "invalid"}
                onRemove={() => onRemoveAttachment(a.id)}
              />
            ))}
          </ScrollView>
        ) : null}
        {invalidReasonText !== null ? (
          <Text
            className="font-sans text-caption-1 text-destructive px-3 pb-1.5"
            numberOfLines={1}
          >
            {invalidReasonText}
          </Text>
        ) : null}
        {isAttachmentTotalTooLarge ? (
          <Text className="font-sans text-caption-1 text-destructive px-3 pb-1">
            Attachments too large —{" "}
            {Math.floor(ATTACHMENT_MAX_TOTAL_BYTES / BYTES_PER_MB)} MB max total
          </Text>
        ) : null}
        {/* Orb-row vertical padding is exact pt from the token (py-2.5 renders 8.75 under the 14px rem) so the blur height and jump-arrow anchor math stay true. */}
        <View
          className="flex-row items-end px-3 gap-2"
          style={{ paddingVertical: componentLayout.composer.orbRowPaddingY }}
        >
          <GlassOrb
            variant="regular"
            interactive
            onPress={openAttach}
            borderRadius={999}
            accessibilityLabel="Attach"
            testID="composer-attach"
          >
            <View className="w-9.5 h-9.5 items-center justify-center">
              <Plus
                size={iconSize.lg}
                color={colors.foreground}
                strokeWidth={strokeWidth.medium}
              />
            </View>
          </GlassOrb>
          {/* Web-search toggle, always at hand (only when the model supports tools). Tinted while on; persisted per chat. */}
          {hasWebSearch ? (
            <GlassOrb
              variant="regular"
              interactive
              onPress={(): void => {
                setWebSearchEnabled(!webSearchEnabled);
                haptics.light();
              }}
              tintColor={
                webSearchEnabled
                  ? withAlpha(colors.primary, opacity.tint)
                  : undefined
              }
              borderRadius={999}
              accessibilityLabel={
                webSearchEnabled ? "Disable web search" : "Enable web search"
              }
              testID="composer-web-toggle"
            >
              <View className="w-9.5 h-9.5 items-center justify-center">
                <Globe
                  size={iconSize.lg}
                  color={
                    webSearchEnabled
                      ? colors.primaryForeground
                      : colors.foreground
                  }
                  strokeWidth={strokeWidth.medium}
                />
              </View>
            </GlassOrb>
          ) : null}
          <TextField
            value={text}
            onChangeText={setText}
            placeholder="Type a message..."
            multiline
            maxLines={COMPOSER_MAX_LINES}
            lineHeight={componentLayout.composer.inputLineHeight}
            // Always editable: the user can compose their next message while the assistant is still streaming. The send orb stays in STOP mode mid-stream, so this only enables typing — not sending (a send queue comes later).
            editable
            testID="composer-input"
            containerClassName="flex-1 bg-card border border-border rounded-3xl px-3.5"
            // Line-height locked to the shared token (iOS body 17/22) so the maxLines computation stays accurate.
            inputStyle={{
              fontSize: componentLayout.composer.inputFontSize,
              lineHeight: componentLayout.composer.inputLineHeight,
              letterSpacing: componentLayout.composer.inputAccentLetterSpacing,
              color: colors.foreground,
            }}
          />
          {/* Send / Stop morphing orb — the tint is primary whenever the action is "armed" (has text OR currently streaming); falls back to the muted recipe otherwise. */}
          <GlassOrb
            variant="regular"
            interactive
            disabled={sendDisabled}
            onPress={handleSend}
            tintColor={
              isStreaming || hasText
                ? withAlpha(colors.primary, opacity.tint)
                : undefined
            }
            borderRadius={999}
            accessibilityLabel={
              isStreaming ? "Stop generation" : "Send message"
            }
            testID="composer-send"
          >
            <View className="w-9.5 h-9.5 items-center justify-center">
              <Animated.View
                className="absolute items-center justify-center"
                style={sendStyle}
              >
                <ArrowUp
                  size={iconSize.lg}
                  color={
                    hasText ? colors.primaryForeground : colors.mutedForeground
                  }
                  strokeWidth={strokeWidth.heavy}
                />
              </Animated.View>
              <Animated.View
                className="absolute items-center justify-center"
                style={stopStyle}
              >
                <Square
                  size={iconSize.md}
                  color={colors.primaryForeground}
                  strokeWidth={strokeWidth.heavy}
                />
              </Animated.View>
            </View>
          </GlassOrb>
        </View>
        {jumpToLatestOrb !== null ? (
          // One arrow for every state, out of flow so warning texts / chip band grow without moving it. Inline style
          // carries the computed bottom (restingBottomPad + orbRowPaddingY*2 + orbSize) that lands it above the send orb.
          <View
            pointerEvents="box-none"
            className="pr-3"
            style={{
              position: "absolute",
              right: 0,
              bottom:
                restingBottomPad +
                componentLayout.composer.orbRowPaddingY * 2 +
                componentLayout.composer.orbSize,
              zIndex: zLayer.composer + 1,
              elevation: zLayer.composer + 1,
            }}
          >
            {jumpToLatestOrb}
          </View>
        ) : null}
      </View>
    </KeyboardAvoidingView>
  );
}
