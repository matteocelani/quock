// Side drawer: the screen itself slides right and reveals a panel that was always behind it. Deliberately NOT a Sheet —
// a Sheet is a Modal in its own window, so it can cover the screen but never move it, which is the whole gesture here.

import React, { useCallback, useEffect, useRef } from "react";
import { StyleSheet, useWindowDimensions, View } from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, {
  clamp,
  type SharedValue,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from "react-native-reanimated";
import { boxShadow, componentLayout, timingsNamed } from "@/lib/design/tokens";
import { useTheme, useThemeColors } from "@/lib/theme/ThemeContext";
import { decelerateEasing, sheetSpring } from "@/lib/design/motion";

export interface DrawerProps {
  // Owned by the caller so other surfaces can read the SAME value — the header's icon rides it and therefore follows a
  // drag, instead of running its own animation that only starts once the gesture is already over.
  progress: SharedValue<number>;
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  panel: React.ReactNode;
  children: React.ReactNode;
}

export function Drawer({
  progress,
  isOpen,
  onOpenChange,
  panel,
  children,
}: DrawerProps): React.ReactElement {
  const { width } = useWindowDimensions();
  const { resolved } = useTheme();
  const colors = useThemeColors();
  const { drawer } = componentLayout;
  const panelWidth = Math.round(width * drawer.widthRatio);
  const startProgress = useSharedValue<number>(0);
  // A closed drawer only answers a pull that STARTED at the left edge, otherwise every horizontal swipe in the chat
  // would drag the screen sideways.
  const isTracking = useSharedValue<boolean>(false);

  // A release already started its own spring, so the state flip it causes must not restart the animation as a curve.
  const isSettlingFromGesture = useRef<boolean>(false);
  // Tap path: a decelerating curve, and leaving is quicker than arriving. A finger release never lands here — it springs
  // from wherever the drag left off, because a gesture that ends in a fixed curve feels detached from the hand.
  useEffect(() => {
    if (isSettlingFromGesture.current) {
      isSettlingFromGesture.current = false;
      return;
    }
    progress.value = withTiming(isOpen ? 1 : 0, {
      duration: isOpen ? timingsNamed.drawerOpen : timingsNamed.drawerClose,
      easing: decelerateEasing,
    });
  }, [isOpen, progress]);

  const settle = useCallback(
    (shouldOpen: boolean): void => {
      // Only when the state actually flips: otherwise the flag would survive and swallow the next tap's animation.
      if (shouldOpen !== isOpen) isSettlingFromGesture.current = true;
      onOpenChange(shouldOpen);
    },
    [isOpen, onOpenChange],
  );

  const pan = Gesture.Pan()
    .activeOffsetX([-drawer.activateX, drawer.activateX])
    .failOffsetY([-drawer.failY, drawer.failY])
    .onBegin((e) => {
      // Edge-anchored on both sides: left edge pulls the page in, right edge pushes it back. Anywhere else belongs to
      // whatever is under the finger — a chat row's own swipe, a scroll — which a page-wide pan would steal.
      isTracking.value =
        progress.value > 0
          ? e.x >= width - drawer.edgeWidth
          : e.x <= drawer.edgeWidth;
      startProgress.value = progress.value;
    })
    .onUpdate((e) => {
      if (!isTracking.value) return;
      progress.value = clamp(
        startProgress.value + e.translationX / panelWidth,
        0,
        1,
      );
    })
    .onEnd((e) => {
      if (!isTracking.value) return;
      // Velocity wins over position: a short flick should open or close, the way a page turn does.
      const isFlung =
        Math.abs(e.velocityX) > drawer.flingVelocity
          ? e.velocityX > 0
          : progress.value > drawer.openThreshold;
      progress.value = withSpring(isFlung ? 1 : 0, sheetSpring);
      runOnJS(settle)(isFlung);
    });

  // Scale and wash both ride the same progress, so the page can never be half-arrived in one and landed in the other.
  const panelStyle = useAnimatedStyle(() => ({
    transform: [
      {
        scale:
          drawer.panelScaleFrom + progress.value * (1 - drawer.panelScaleFrom),
      },
    ],
  }));
  const veilStyle = useAnimatedStyle(() => ({ opacity: 1 - progress.value }));
  const contentStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: progress.value * panelWidth }],
  }));

  return (
    <GestureDetector gesture={pan}>
      <View className="flex-1 bg-background">
        {/* Never fades in — a page that arrives translucent reads as an overlay. It grows into place and sheds a wash
            instead: both say "coming forward" without pretending the page is made of glass. */}
        <Animated.View
          style={[
            {
              position: "absolute",
              left: 0,
              top: 0,
              bottom: 0,
              width: panelWidth,
            },
            panelStyle,
          ]}
        >
          {panel}
        </Animated.View>
        {/* OUTSIDE the scaled view on purpose: inside it, the strip the zoom uncovers stays unwashed and reads as a
            bright frame around the page — the brighter the more the zoom widens. */}
        <Animated.View
          pointerEvents="none"
          style={[
            StyleSheet.absoluteFill,
            { backgroundColor: colors.scrimPage },
            veilStyle,
          ]}
        />
        {/* The chat stays ON TOP of the page it uncovers, so its leading edge carries a shadow — kept almost
            imperceptible, because at full strength it would turn a page reveal into a card sliding over a backdrop. */}
        <Animated.View
          className="flex-1"
          style={[{ boxShadow: boxShadow.pageEdge[resolved] }, contentStyle]}
        >
          {children}
        </Animated.View>
      </View>
    </GestureDetector>
  );
}
