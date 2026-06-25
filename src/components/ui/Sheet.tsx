// Bottom sheet via Reanimated 4 + Gesture.Pan grabber. Full-width slab, top corners rounded to sheetPrimitive.cornerRadius (28pt), opaque bg-card body.

import { BlurView } from "expo-blur";
import React, { useCallback, useEffect } from "react";
import {
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
  type ViewStyle,
} from "react-native";
import {
  Gesture,
  GestureDetector,
  GestureHandlerRootView,
} from "react-native-gesture-handler";
import Animated, {
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
  Easing,
} from "react-native-reanimated";
import { X } from "lucide-react-native";
import { useTheme } from "@/lib/theme/ThemeContext";
import { sheetSpring } from "@/lib/design/motion";
import { iconSize, sheetPrimitive, timingsNamed } from "@/lib/design/tokens";

import { IconButton } from "@/components/ui/IconButton";
import { ToastViewport } from "@/components/global/ToastContext";
import { useUIStore } from "@/lib/stores/ui.store";

export interface SheetProps {
  visible: boolean;
  onClose: () => void;
  // First numeric/percent entry is the target height (API compatibility shim).
  snapPoints: (string | number)[];
  children: React.ReactNode;
  enableDynamicSizing?: boolean;
  title?: string;
  /** Horizontal padding inside the scrollable content area. Default 0 so list rows go edge-to-edge. */
  contentPaddingHorizontal?: number;
  /** Nodes rendered inside the sheet's Modal but OUTSIDE the card — useful for dialogs that need to center against the full display, not against a 75%-height card. */
  overlays?: React.ReactNode;
  className?: string;
  testID?: string;
}

function resolveHeight(snap: string | number): string {
  if (typeof snap === "number") return `${snap}%`;
  if (snap.endsWith("%")) return snap;
  // Plain pixel string falls back to 60% so the percent-based layout still composes with safe-areas.
  return "60%";
}

export function Sheet({
  visible,
  onClose,
  snapPoints,
  children,
  title,
  contentPaddingHorizontal = 0,
  overlays,
  className,
  testID,
}: SheetProps): React.ReactElement {
  const { resolved } = useTheme();
  // `translateY` is the rest offset (0=open, offscreen=closed); `dragY` is the live finger offset added during a pan.
  const translateY = useSharedValue<number>(sheetPrimitive.offscreenTranslateY);
  const scrimOpacity = useSharedValue<number>(0);
  const dragY = useSharedValue<number>(0);
  // Keep the Modal mounted through the slide-down so children don't flicker out before the animation ends.
  const [mounted, setMounted] = React.useState(visible);
  const heightPercent = resolveHeight(snapPoints[0] ?? "60%");
  // JS bridge for the worklet — Reanimated callbacks can't call React setters directly.
  const setMountedFromWorklet = useCallback((next: boolean): void => {
    setMounted(next);
  }, []);
  useEffect(() => {
    if (visible) {
      setMounted(true);
      // Reset live drag so the open animation always starts from the true offscreen position.
      dragY.value = 0;
      translateY.value = withTiming(0, {
        duration: timingsNamed.sheetSlide,
        easing: Easing.out(Easing.cubic),
      });
      scrimOpacity.value = withTiming(1, {
        duration: timingsNamed.sheetSlide,
      });
    } else {
      translateY.value = withTiming(
        sheetPrimitive.offscreenTranslateY,
        {
          duration: timingsNamed.sheetSlide,
          easing: Easing.in(Easing.cubic),
        },
        (finished) => {
          "worklet";
          if (finished) runOnJS(setMountedFromWorklet)(false);
        },
      );
      scrimOpacity.value = withTiming(0, {
        duration: timingsNamed.sheetSlide,
      });
    }
  }, [visible, translateY, scrimOpacity, dragY, setMountedFromWorklet]);
  const pushSheet = useUIStore((s) => s.pushSheet);
  const popSheet = useUIStore((s) => s.popSheet);
  // While this sheet's Modal is mounted, suppress the main-tree toast viewport so only the sheet-hosted one paints —
  // otherwise the main-tree toast bleeds through the scrim blur as a faded duplicate beneath this sheet.
  useEffect(() => {
    if (!mounted) return;
    pushSheet();
    return (): void => popSheet();
  }, [mounted, pushSheet, popSheet]);
  // `activeOffsetY: [10, 9999]` — pan only claims the gesture after ~10pt down, so taps on the title still fire.
  const panGesture = Gesture.Pan()
    .activeOffsetY([10, 9999])
    .onUpdate((e) => {
      "worklet";
      // Rubber-band upward drag so the user feels resistance instead of pulling past the rest position.
      if (e.translationY < 0) {
        dragY.value = e.translationY * sheetPrimitive.upwardRubberBandFactor;
      } else {
        dragY.value = e.translationY;
      }
    })
    .onEnd((e) => {
      "worklet";
      const shouldDismiss =
        e.translationY > sheetPrimitive.dismissDistanceThreshold ||
        e.velocityY > sheetPrimitive.dismissVelocityThreshold;
      if (shouldDismiss) {
        // The useEffect drives the timing-to-offscreen; `dragY` stays put so the slide continues from the finger.
        runOnJS(onClose)();
      } else {
        // Spring back home.
        dragY.value = withSpring(0, sheetSpring);
      }
    });
  const slideStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value + dragY.value }],
  }));
  const scrimStyle = useAnimatedStyle(() => ({
    opacity: scrimOpacity.value,
  }));

  const handleBackdropPress = useCallback(() => {
    onClose();
  }, [onClose]);
  return (
    <Modal
      visible={mounted}
      transparent
      animationType="none"
      onRequestClose={onClose}
      statusBarTranslucent
      testID={testID}
    >
      {/* GestureHandlerRootView inside the Modal — iOS renders the Modal in a separate window where the app-level gesture root doesn't reach, so every gesture handler inside the sheet needs this root. */}
      <GestureHandlerRootView style={StyleSheet.absoluteFill}>
        <Animated.View
          className="absolute inset-0 bg-scrim"
          style={scrimStyle}
        >
          {/* Faint blur turns the dimmed background into bokeh rather than a flat wash. iOS only — Android's BlurView fallback is too uneven. */}
          {Platform.OS === "ios" ? (
            <BlurView
              tint={resolved === "dark" ? "dark" : "light"}
              intensity={sheetPrimitive.scrimBlurIntensity}
              style={StyleSheet.absoluteFill}
              pointerEvents="none"
            />
          ) : null}
          <Pressable
            style={StyleSheet.absoluteFill}
            onPress={handleBackdropPress}
            accessibilityLabel="Dismiss sheet"
          />
        </Animated.View>
        <Animated.View
          className={className}
          style={[
            {
              position: "absolute",
              left: sheetPrimitive.insetX,
              right: sheetPrimitive.insetX,
              bottom: sheetPrimitive.insetBottom,
              height: heightPercent as ViewStyle["height"],
              // Only the top corners are rounded (28pt); the bottom + sides touch the display edges.
              borderTopLeftRadius: sheetPrimitive.cornerRadius,
              borderTopRightRadius: sheetPrimitive.cornerRadius,
              overflow: "hidden",
            },
            slideStyle,
          ]}
        >
          <View className="flex-1 bg-card">
            {/* Grabber zone — drag handle + optional title row — owns the pan gesture. */}
            <GestureDetector gesture={panGesture}>
              <View>
                <View className="pt-2.5 pb-1.5 items-center">
                  <View className="w-9 h-1 rounded-sm bg-muted-foreground" />
                </View>
                {title !== undefined ? (
                  <View className="flex-row items-center justify-between py-1 px-4 border-b border-border">
                    <View className="w-11" />
                    <Text className="flex-1 text-center font-sans font-bold text-foreground text-lg">
                      {title}
                    </Text>
                    <View className="w-11 items-end">
                      <IconButton
                        icon={X}
                        size={iconSize.xl}
                        tone="muted"
                        accessibilityLabel="Close"
                        onPress={onClose}
                      />
                    </View>
                  </View>
                ) : null}
              </View>
            </GestureDetector>
            <View
              className="flex-1"
              // contentPaddingHorizontal is a runtime number prop — kept inline.
              style={{ paddingHorizontal: contentPaddingHorizontal }}
            >
              {children}
            </View>
          </View>
        </Animated.View>
        {/* Overlays — modals/dialogs that should center against the full display, not against the sheet card. Rendered AFTER the card so they paint above it within the same Modal layer. */}
        {overlays}
        {/* The main-tree toast viewport sits behind this Modal, so host one here too — alerts (e.g. "cleared") must surface above the open sheet, not vanish under it. Anchored below the Dynamic Island (no header over a sheet). */}
        <ToastViewport inSheet />
      </GestureHandlerRootView>
    </Modal>
  );
}
