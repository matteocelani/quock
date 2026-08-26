// Contextual menu for a long-pressed reply unit — Deep dive / Web search on that excerpt. RN cannot extend iOS's own
// selection menu, so the platter is <GlassToolbar> and this file owns anchoring, the dim behind it, and the transitions.

import { BlurView } from "expo-blur";
import MaskedView from "@react-native-masked-view/masked-view";
import Globe from "lucide-react-native/icons/globe";
import Sparkles from "lucide-react-native/icons/sparkles";
import React, { useCallback, useMemo } from "react";
import {
  BackHandler,
  Platform,
  Pressable as RNPressable,
  StyleSheet,
  useWindowDimensions,
  View,
} from "react-native";
import Svg, { Path } from "react-native-svg";
import Animated, {
  cancelAnimation,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from "react-native-reanimated";
import {
  GlassToolbar,
  GLASS_TOOLBAR_HEIGHT,
  type GlassToolbarAction,
} from "@/components/ui/GlassToolbar";
import { SpotlightGlow } from "@/components/chat/SpotlightGlow";
import type { SpotlightRect } from "@/lib/types/geometry";
import { useHaptics } from "@/lib/hooks/useHaptics";
import { useTheme, useThemeColors } from "@/lib/theme/ThemeContext";
import { springEasing, surfaceSpring } from "@/lib/design/motion";
import {
  componentLayout,
  maskPaint,
  motion,
  timings,
  zLayer,
} from "@/lib/design/tokens";
import { useUIStore } from "@/lib/stores/ui.store";
import { excerptMenuTop } from "@/modules/chat/lib/excerptMenuPlacement";

const TOOLBAR = componentLayout.glassToolbar;
const SPOTLIGHT = componentLayout.excerptMenu;
// The platter shares the gutter the floating header orbs keep off the display edge.
const SIDE_GUTTER = componentLayout.floatingHeader.sidePad;

// Everything except the excerpt: a screen-sized rect with the cutout punched out of it.
function dimMaskPath(
  screenWidth: number,
  screenHeight: number,
  rect: SpotlightRect,
  radius: number,
): string {
  const { top, left, width, height } = rect;
  return (
    `M 0 0 H ${screenWidth} V ${screenHeight} H 0 Z ` +
    `M ${left + radius} ${top} H ${left + width - radius} ` +
    `A ${radius} ${radius} 0 0 1 ${left + width} ${top + radius} ` +
    `V ${top + height - radius} ` +
    `A ${radius} ${radius} 0 0 1 ${left + width - radius} ${top + height} ` +
    `H ${left + radius} ` +
    `A ${radius} ${radius} 0 0 1 ${left} ${top + height - radius} ` +
    `V ${top + radius} ` +
    `A ${radius} ${radius} 0 0 1 ${left + radius} ${top} Z`
  );
}

export interface ExcerptMenuProps {
  canWebSearch: boolean;
  /** Safe-area top + floating header, so the menu never rises into the header orbs. */
  topInset: number;
  /** Composer as measured by ChatHome (plus the keyboard when isOpen), so the menu never drops into it. */
  bottomInset: number;
  /** Receive the unit key; the caller resolves its text from the loaded chat. */
  onDeepDive: (unitKey: string) => void;
  onWebSearch: (unitKey: string) => void;
}

export const ExcerptMenu = React.memo(function ExcerptMenu({
  canWebSearch,
  topInset,
  bottomInset,
  onDeepDive,
  onWebSearch,
}: ExcerptMenuProps): React.ReactElement | null {
  const { resolved } = useTheme();
  const colors = useThemeColors();
  const haptics = useHaptics();
  const hapticsRef = React.useRef(haptics);
  hapticsRef.current = haptics;
  const { height: screenHeight, width: screenWidth } = useWindowDimensions();
  const isOpen = useUIStore((s) => s.excerptMenuOpen);
  const unitKey = useUIStore((s) => s.excerptMenuKey);
  const anchor = useUIStore((s) => s.excerptMenuAnchor);
  const close = useUIStore((s) => s.closeExcerptMenu);
  // Kept mounted through the exit animation, as <Sheet> does — unmounting on the flag alone would cut it off mid-fade.
  const [mounted, setMounted] = React.useState(isOpen);
  const progress = useSharedValue(0);
  const clearHighlight = useUIStore((s) => s.clearExcerptHighlight);
  // Held until the exit finishes: clearing on the flag left the rim and the undimmed hole over untinted text.
  const releaseMount = useCallback((): void => {
    setMounted(false);
    clearHighlight();
  }, [clearHighlight]);
  React.useEffect(() => {
    if (isOpen) {
      setMounted(true);
      // No Keyboard.dismiss() here: the anchor was measured a frame earlier, and dropping the keyboard shrinks the
      // list's bottom inset, which scrolls the content out from under the cutout by up to the keyboard's height.
      hapticsRef.current.medium();
      progress.value = withSpring(1, surfaceSpring);
      return;
    }
    progress.value = withTiming(
      0,
      { duration: timings.fast, easing: springEasing },
      (finished) => {
        "worklet";
        if (finished) runOnJS(releaseMount)();
      },
    );
    return () => {
      cancelAnimation(progress);
    };
  }, [isOpen, progress, releaseMount]);
  // Android's hardware back is the platform's dismiss for anything floating, and iOS has no such key — so without this
  // back pops the route instead, and the menu rides into the next screen still open over content it never anchored to.
  React.useEffect(() => {
    if (!isOpen) return;
    const sub = BackHandler.addEventListener(
      "hardwareBackPress",
      (): boolean => {
        close();
        return true;
      },
    );
    return () => {
      sub.remove();
    };
  }, [isOpen, close]);
  const scrimStyle = useAnimatedStyle(() => ({ opacity: progress.value }));
  const toolbarStyle = useAnimatedStyle(() => ({
    opacity: progress.value,
    transform: [
      {
        scale:
          motion.scaleDialogFrom +
          (1 - motion.scaleDialogFrom) * progress.value,
      },
    ],
  }));
  const actions = useMemo<GlassToolbarAction[]>(
    () => [
      {
        icon: Sparkles,
        label: "Deep dive",
        onPress: (): void => onDeepDive(unitKey),
        accessibilityLabel: "Deep dive on this",
      },
      ...(canWebSearch
        ? [
            {
              icon: Globe,
              label: "Web search",
              onPress: (): void => onWebSearch(unitKey),
              accessibilityLabel: "Web search on this",
            },
          ]
        : []),
    ],
    [canWebSearch, onDeepDive, onWebSearch, unitKey],
  );
  const spotlightRect = useMemo<SpotlightRect>(
    () => ({
      top: anchor.top - SPOTLIGHT.spotlightPadding,
      left: anchor.left - SPOTLIGHT.spotlightPadding,
      width: anchor.width + SPOTLIGHT.spotlightPadding * 2,
      height: anchor.bottom - anchor.top + SPOTLIGHT.spotlightPadding * 2,
    }),
    [anchor],
  );
  const dimMask = useMemo(
    () =>
      dimMaskPath(
        screenWidth,
        screenHeight,
        spotlightRect,
        SPOTLIGHT.spotlightRadius,
      ),
    [screenWidth, screenHeight, spotlightRect],
  );
  const position = useMemo(
    () => ({
      top: excerptMenuTop({
        anchorTop: anchor.top,
        anchorBottom: anchor.bottom,
        topInset,
        bottomInset,
        screenHeight,
        barHeight: GLASS_TOOLBAR_HEIGHT,
        gap: TOOLBAR.anchorGap,
      }),
      // Centred on the display rather than leading-aligned to the block: the kit anchors to the content, but a centred
      // bar reads better over a full-width reply.
      maxWidth: screenWidth - SIDE_GUTTER * 2,
    }),
    [anchor, bottomInset, screenHeight, screenWidth, topInset],
  );
  if (!mounted) return null;
  return (
    <View
      className="absolute inset-0"
      style={{ zIndex: zLayer.menu }}
      pointerEvents="box-none"
      accessibilityViewIsModal
    >
      {/* Kit ships a "Context Menu - Dimming Overlay", and iOS lifts the pressed content above it — so the dim and its
          blur stop at the excerpt, which stays sharp and unshaded. The whole surface is the dismiss target. */}
      <RNPressable
        style={StyleSheet.absoluteFill}
        accessibilityRole="button"
        accessibilityLabel="Dismiss"
        onPress={close}
      />
      {Platform.OS === "ios" ? (
        <MaskedView
          pointerEvents="none"
          style={StyleSheet.absoluteFill}
          maskElement={
            <Svg width={screenWidth} height={screenHeight}>
              <Path d={dimMask} fill={maskPaint.opaque} fillRule="evenodd" />
            </Svg>
          }
        >
          <Animated.View
            style={[
              StyleSheet.absoluteFill,
              { backgroundColor: colors.scrimExcerpt },
              scrimStyle,
            ]}
          >
            {/* iOS only, as the sheet scrim does — Android's blur fallback is too uneven to dim with. */}
            <BlurView
              tint={resolved === "dark" ? "dark" : "light"}
              intensity={SPOTLIGHT.dimBlurIntensity}
              style={StyleSheet.absoluteFill}
              pointerEvents="none"
            />
          </Animated.View>
        </MaskedView>
      ) : (
        // Android has no blur here, so the dim is one filled path with the cutout punched out — a masked view would
        // allocate a screen-sized bitmap every frame to achieve the same flat colour.
        <Animated.View
          pointerEvents="none"
          style={[StyleSheet.absoluteFill, scrimStyle]}
        >
          <Svg width={screenWidth} height={screenHeight}>
            <Path d={dimMask} fill={colors.scrim} fillRule="evenodd" />
          </Svg>
        </Animated.View>
      )}
      <SpotlightGlow rect={spotlightRect} progress={progress} />
      <Animated.View
        pointerEvents="box-none"
        style={[
          {
            position: "absolute",
            top: position.top,
            left: 0,
            right: 0,
            alignItems: "center",
          },
          toolbarStyle,
        ]}
      >
        <View style={{ maxWidth: position.maxWidth }}>
          <GlassToolbar actions={actions} />
        </View>
      </Animated.View>
    </View>
  );
});
