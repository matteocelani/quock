// Owns the sheet and the drill animation between AccountView (40%) and the Settings / About / Ollama / AI-data panes (75%).

import React, { useCallback, useEffect, useRef, useState } from "react";
import { View, type ViewStyle } from "react-native";
import Animated, {
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
  type AnimatedStyle,
  type SharedValue,
} from "react-native-reanimated";
import { AboutView } from "@/components/settings/AboutView";
import { AccountView } from "@/components/settings/AccountView";
import { AiDataView } from "@/components/settings/AiDataView";
import { OllamaView } from "@/components/settings/OllamaView";
import { SettingsView } from "@/components/settings/SettingsView";
import { ChevronLeft } from "lucide-react-native";
import { Pressable } from "@/components/ui/Pressable";
import { Sheet } from "@/components/ui/Sheet";
import { SheetHeader } from "@/components/ui/SheetHeader";
import { useThemeColors } from "@/lib/theme/ThemeContext";
import { springEasing } from "@/lib/design/motion";
import { motion, size, strokeWidth } from "@/lib/design/tokens";
import { useToast } from "@/lib/hooks/useToast";
import { useAuth, useSignOut } from "@/modules/auth/hooks/useAuth";
import {
  ACCOUNT_DRILL_SCALE_FROM,
  ACCOUNT_SHEET_SNAP_ACCOUNT,
  ACCOUNT_SHEET_SNAP_SETTINGS,
  SETTINGS_DRILL_SCALE_FROM,
  SETTINGS_DRILL_SCALE_TO,
  SHEET_FADE_IN_MS,
  SHEET_FADE_OUT_MS,
} from "@/modules/settings/constants";

interface DrillFrameProps {
  isAnimating: boolean;
  animatedStyle: AnimatedStyle<ViewStyle>;
  animatedKey: string;
  children: React.ReactNode;
}
// Animated.View only during entrance — plain View once settled so theme re-renders can't retrigger the transform (diag30 zoom bug).
function DrillFrame({
  isAnimating,
  animatedStyle,
  animatedKey,
  children,
}: DrillFrameProps): React.ReactElement {
  if (isAnimating) {
    return (
      <Animated.View key={animatedKey} style={animatedStyle}>
        {children}
      </Animated.View>
    );
  }
  return <View className="flex-1">{children}</View>;
}

// One pane's crossfade style: scale from `scaleFrom` to `scaleTo` and opacity 0→1 as its progress climbs.
function useDrillStyle(
  progress: SharedValue<number>,
  scaleFrom: number,
  scaleTo: number,
): AnimatedStyle<ViewStyle> {
  return useAnimatedStyle(() => ({
    flex: 1,
    opacity: progress.value,
    transform: [{ scale: scaleFrom + (scaleTo - scaleFrom) * progress.value }],
  }));
}

// Drive one pane toward its active/inactive target, clearing its settling flag when the timing lands.
function animatePane(
  progress: SharedValue<number>,
  isActive: boolean,
  setSettling: (settling: boolean) => void,
): void {
  progress.value = withTiming(
    isActive ? 1 : 0,
    {
      duration: isActive ? SHEET_FADE_IN_MS : SHEET_FADE_OUT_MS,
      easing: springEasing,
    },
    (finished) => {
      "worklet";
      if (finished) runOnJS(setSettling)(false);
    },
  );
}

export interface AccountSheetProps {
  visible: boolean;
  onClose: () => void;
  onChangeModel?: () => void;
}

type AccountSheetView = "account" | "settings" | "about" | "ollama" | "aiData";

export function AccountSheet({
  visible,
  onClose,
  onChangeModel,
}: AccountSheetProps): React.ReactElement {
  const colors = useThemeColors();
  const [view, setView] = useState<AccountSheetView>("account");
  // The settings pane publishes its centered overlay (clear-chats chooser) here so it renders in the Sheet's
  // full-display `overlays` slot, not inside the card. Gated on the settings view so it never paints over other panes.
  const [settingsOverlays, setSettingsOverlays] =
    useState<React.ReactNode>(null);
  // The AI-data pane publishes its revoke-confirmation dialog here for the same full-display centering.
  const [aiDataOverlays, setAiDataOverlays] = useState<React.ReactNode>(null);
  const { user } = useAuth();
  const { signOut } = useSignOut();
  const toast = useToast();
  // Track the prior view so we only drive the drill animation on actual view transitions, not on theme re-renders.
  const prevViewRef = useRef<AccountSheetView>(view);
  // Once settled, render the live content without an animated wrapper so theme re-renders don't retrigger the transform (diag30 zoom bug).
  const [isSettlingSettings, setIsSettlingSettings] = useState<boolean>(false);
  const [isSettlingAccount, setIsSettlingAccount] = useState<boolean>(false);
  const [isSettlingAbout, setIsSettlingAbout] = useState<boolean>(false);
  const [isSettlingOllama, setIsSettlingOllama] = useState<boolean>(false);
  const [isSettlingAiData, setIsSettlingAiData] = useState<boolean>(false);
  // Shared values drive the crossfade. Each view animates its own progress to 1 while the others animate to 0.
  const accountProgress = useSharedValue(1);
  const settingsProgress = useSharedValue(0);
  const aboutProgress = useSharedValue(0);
  const ollamaProgress = useSharedValue(0);
  const aiDataProgress = useSharedValue(0);
  useEffect(() => {
    if (prevViewRef.current === view) return;
    prevViewRef.current = view;
    setIsSettlingSettings(true);
    setIsSettlingAccount(true);
    setIsSettlingAbout(true);
    setIsSettlingOllama(true);
    setIsSettlingAiData(true);
    animatePane(settingsProgress, view === "settings", setIsSettlingSettings);
    animatePane(accountProgress, view === "account", setIsSettlingAccount);
    animatePane(aboutProgress, view === "about", setIsSettlingAbout);
    animatePane(ollamaProgress, view === "ollama", setIsSettlingOllama);
    animatePane(aiDataProgress, view === "aiData", setIsSettlingAiData);
  }, [
    view,
    settingsProgress,
    accountProgress,
    aboutProgress,
    ollamaProgress,
    aiDataProgress,
  ]);
  const settingsAnimatedStyle = useDrillStyle(
    settingsProgress,
    SETTINGS_DRILL_SCALE_FROM,
    SETTINGS_DRILL_SCALE_TO,
  );
  const accountAnimatedStyle = useDrillStyle(
    accountProgress,
    ACCOUNT_DRILL_SCALE_FROM,
    1,
  );
  const aboutAnimatedStyle = useDrillStyle(
    aboutProgress,
    SETTINGS_DRILL_SCALE_FROM,
    SETTINGS_DRILL_SCALE_TO,
  );
  const ollamaAnimatedStyle = useDrillStyle(
    ollamaProgress,
    SETTINGS_DRILL_SCALE_FROM,
    SETTINGS_DRILL_SCALE_TO,
  );
  const aiDataAnimatedStyle = useDrillStyle(
    aiDataProgress,
    SETTINGS_DRILL_SCALE_FROM,
    SETTINGS_DRILL_SCALE_TO,
  );
  // Always re-enter on the account view so the user does not land back inside Settings or Ollama after a dismiss.
  useEffect(() => {
    if (visible) setView("account");
  }, [visible]);
  // Sheet wrapper memoises on identity, so a fresh array is required each toggle. Every drill pane shares the taller snap; only the account landing uses the shorter one.
  const snapPoints =
    view === "account"
      ? ([ACCOUNT_SHEET_SNAP_ACCOUNT] as const)
      : ([ACCOUNT_SHEET_SNAP_SETTINGS] as const);
  // iOS Modals can't stack so dismiss the sheet first; sign-out is reversible so skip the confirmation.
  const handleSignOut = useCallback((): void => {
    onClose();
    signOut().catch((err: unknown) => {
      console.error("AccountSheet: signOut failed", err);
      toast({ title: "Sign-out failed", tone: "error" });
    });
  }, [signOut, onClose, toast]);
  const renderBackChevron = useCallback(
    (target: AccountSheetView): React.ReactElement => (
      <Pressable
        onPress={(): void => setView(target)}
        scale={motion.scalePressFirm}
        className="w-10 h-10 items-center justify-center"
      >
        <ChevronLeft
          size={size.iconHeroBack}
          color={colors.foreground}
          strokeWidth={strokeWidth.bold}
        />
      </Pressable>
    ),
    [colors.foreground],
  );
  return (
    <Sheet
      visible={visible}
      onClose={onClose}
      snapPoints={[...snapPoints]}
      overlays={
        view === "settings"
          ? settingsOverlays
          : view === "aiData"
            ? aiDataOverlays
            : null
      }
    >
      {view === "settings" ? (
        <SheetHeader title="Settings" left={renderBackChevron("account")} />
      ) : null}
      {view === "about" ? (
        <SheetHeader title="About" left={renderBackChevron("account")} />
      ) : null}
      {view === "ollama" ? (
        <SheetHeader title="Ollama" left={renderBackChevron("about")} />
      ) : null}
      {view === "aiData" ? (
        <SheetHeader title="AI data" left={renderBackChevron("about")} />
      ) : null}
      <View className="flex-1">
        {view === "account" ? (
          <DrillFrame
            isAnimating={isSettlingAccount}
            animatedStyle={accountAnimatedStyle}
            animatedKey="account-view"
          >
            <AccountView
              userName={user?.name ?? "Guest"}
              userEmail={user?.email ?? ""}
              userPlan={user?.plan ?? null}
              avatarUri={user?.avatarurl}
              onOpenSettings={(): void => setView("settings")}
              onOpenAbout={(): void => setView("about")}
              onSignOut={handleSignOut}
            />
          </DrillFrame>
        ) : view === "settings" ? (
          <DrillFrame
            isAnimating={isSettlingSettings}
            animatedStyle={settingsAnimatedStyle}
            animatedKey="settings-view"
          >
            <SettingsView
              onChangeModel={onChangeModel}
              onRenderOverlays={setSettingsOverlays}
            />
          </DrillFrame>
        ) : view === "about" ? (
          <DrillFrame
            isAnimating={isSettlingAbout}
            animatedStyle={aboutAnimatedStyle}
            animatedKey="about-view"
          >
            <AboutView
              onOpenAiData={(): void => setView("aiData")}
              onOpenOllama={(): void => setView("ollama")}
            />
          </DrillFrame>
        ) : view === "ollama" ? (
          <DrillFrame
            isAnimating={isSettlingOllama}
            animatedStyle={ollamaAnimatedStyle}
            animatedKey="ollama-view"
          >
            <OllamaView />
          </DrillFrame>
        ) : (
          <DrillFrame
            isAnimating={isSettlingAiData}
            animatedStyle={aiDataAnimatedStyle}
            animatedKey="aidata-view"
          >
            <AiDataView onRenderOverlays={setAiDataOverlays} />
          </DrillFrame>
        )}
      </View>
    </Sheet>
  );
}
