// Bottom sheet via Reanimated 4 + Gesture.Pan grabber. iOS 27 floating card: 6pt insets off the bare display edge (the card extends under the home indicator; content pads for it internally), 34/58 capsule corners, glass shadow ring, 0.2 dim scrim.

import { BlurView } from "expo-blur";
import React, { useCallback, useEffect } from "react";
import {
  Modal,
  Platform,
  Pressable,
  StyleSheet,
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
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTheme, useThemeColors } from "@/lib/theme/ThemeContext";
import { sheetSpring } from "@/lib/design/motion";
import { boxShadow, sheetPrimitive, timingsNamed } from "@/lib/design/tokens";

import { ToastViewport } from "@/components/global/ToastContext";
import { useUIStore } from "@/lib/stores/ui.store";

export interface SheetProps {
  visible: boolean;
  onClose: () => void;
  // First numeric/percent entry is the target height (API compatibility shim).
  snapPoints: (string | number)[];
  children: React.ReactNode;
  enableDynamicSizing?: boolean;
  /** Horizontal padding inside the scrollable content area. Default 0 so list rows go edge-to-edge. */
  contentPaddingHorizontal?: number;
  /** Nodes rendered inside the sheet's Modal but OUTSIDE the card — useful for dialogs that need to center against the full display, not against a 75%-height card. */
  overlays?: React.ReactNode;
  className?: string;
  testID?: string;
}

// Capsule-continuous corners — looser at the bottom so the card hugs the display curve. Shared by the ring wrapper, the clipped body, and the specular overlay so all three hug the same curve.
const cardRadii = {
  borderTopLeftRadius: sheetPrimitive.cornerRadiusTop,
  borderTopRightRadius: sheetPrimitive.cornerRadiusTop,
  borderBottomLeftRadius: sheetPrimitive.cornerRadiusBottom,
  borderBottomRightRadius: sheetPrimitive.cornerRadiusBottom,
} as const;

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
  contentPaddingHorizontal = 0,
  overlays,
  className,
  testID,
}: SheetProps): React.ReactElement {
  const { resolved } = useTheme();
  const colors = useThemeColors();
  const insets = useSafeAreaInsets();
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
          className="absolute inset-0"
          style={[{ backgroundColor: colors.scrimSheet }, scrimStyle]}
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
          // Glass ring stays on this unclipped wrapper — Fabric drops outset box shadows under overflow:hidden.
          style={[
            {
              position: "absolute",
              left: sheetPrimitive.insetMargin,
              right: sheetPrimitive.insetMargin,
              // 6pt off the bare display edge — the 58pt bottom radii exist to hug the device corner curve.
              bottom: sheetPrimitive.insetMargin,
              height: heightPercent as ViewStyle["height"],
              boxShadow: boxShadow.sheet[resolved],
              ...cardRadii,
            },
            slideStyle,
          ]}
        >
          <View
            className="flex-1 bg-card"
            // Card extends under the home indicator, so the content pads for it internally.
            style={{ ...cardRadii, overflow: "hidden", paddingBottom: insets.bottom }}
          >
            {/* Grabber zone — owns the pan gesture. The title row is <SheetHeader>, rendered by each sheet as content. */}
            <GestureDetector gesture={panGesture}>
              <View>
                <View
                  className="pb-2 items-center"
                  // Grabber offset + pill size are exact pt values from tokens — the Tailwind scale has no 5/58/4 steps.
                  style={{ paddingTop: sheetPrimitive.grabberTopOffset }}
                >
                  {/* Kit grabber is fills/vibrant #CCCCCC; separator-opaque (#C6C6C8 light, #38383A dark — §20) is visually equivalent on both themes, so no extra color token. */}
                  <View
                    className="rounded-full bg-separator-opaque"
                    style={{
                      width: sheetPrimitive.grabberWidth,
                      height: sheetPrimitive.grabberHeight,
                    }}
                  />
                </View>
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
        <ToastViewport isInSheet />
      </GestureHandlerRootView>
    </Modal>
  );
}
