// Owns the sheet and the 3-way drill animation between AccountView (40%) / SettingsView (90%) / OllamaView (90%).

import * as WebBrowser from "expo-web-browser";
import React, { useCallback, useEffect, useRef, useState } from "react";
import { View, type ViewStyle } from "react-native";
import Animated, {
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
  type AnimatedStyle,
} from "react-native-reanimated";
import { LEGAL_URLS } from "@/lib/api/config";
import { AccountView } from "@/components/settings/AccountView";
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

export interface AccountSheetProps {
  visible: boolean;
  onClose: () => void;
  onChangeModel?: () => void;
}

type AccountSheetView = "account" | "settings" | "ollama";

export function AccountSheet({
  visible,
  onClose,
  onChangeModel,
}: AccountSheetProps): React.ReactElement {
  const colors = useThemeColors();
  const [view, setView] = useState<AccountSheetView>("account");
  const { user } = useAuth();
  const { signOut } = useSignOut();
  const toast = useToast();
  // Track the prior view so we only drive the drill animation on actual view transitions, not on theme re-renders.
  const prevViewRef = useRef<AccountSheetView>(view);
  // Once settled, render the live content without an animated wrapper so theme re-renders don't retrigger the transform (diag30 zoom bug).
  const [isSettlingSettings, setIsSettlingSettings] = useState<boolean>(false);
  const [isSettlingAccount, setIsSettlingAccount] = useState<boolean>(false);
  const [isSettlingOllama, setIsSettlingOllama] = useState<boolean>(false);
  // Three shared values drive the 3-way crossfade. Each view animates its own progress to 1 while the other two animate to 0.
  const accountProgress = useSharedValue(1);
  const settingsProgress = useSharedValue(0);
  const ollamaProgress = useSharedValue(0);
  useEffect(() => {
    if (prevViewRef.current === view) return;
    prevViewRef.current = view;
    const settingsTarget = view === "settings" ? 1 : 0;
    const accountTarget = view === "account" ? 1 : 0;
    const ollamaTarget = view === "ollama" ? 1 : 0;
    setIsSettlingSettings(true);
    setIsSettlingAccount(true);
    setIsSettlingOllama(true);
    settingsProgress.value = withTiming(
      settingsTarget,
      {
        duration: view === "settings" ? SHEET_FADE_IN_MS : SHEET_FADE_OUT_MS,
        easing: springEasing,
      },
      (finished) => {
        "worklet";
        if (finished) runOnJS(setIsSettlingSettings)(false);
      },
    );
    accountProgress.value = withTiming(
      accountTarget,
      {
        duration: view === "account" ? SHEET_FADE_IN_MS : SHEET_FADE_OUT_MS,
        easing: springEasing,
      },
      (finished) => {
        "worklet";
        if (finished) runOnJS(setIsSettlingAccount)(false);
      },
    );
    ollamaProgress.value = withTiming(
      ollamaTarget,
      {
        duration: view === "ollama" ? SHEET_FADE_IN_MS : SHEET_FADE_OUT_MS,
        easing: springEasing,
      },
      (finished) => {
        "worklet";
        if (finished) runOnJS(setIsSettlingOllama)(false);
      },
    );
  }, [view, settingsProgress, accountProgress, ollamaProgress]);
  const settingsAnimatedStyle = useAnimatedStyle(() => {
    const scaleValue =
      SETTINGS_DRILL_SCALE_FROM +
      (SETTINGS_DRILL_SCALE_TO - SETTINGS_DRILL_SCALE_FROM) *
        settingsProgress.value;
    return {
      flex: 1,
      opacity: settingsProgress.value,
      transform: [{ scale: scaleValue }],
    };
  });
  const accountAnimatedStyle = useAnimatedStyle(() => {
    const scaleValue =
      ACCOUNT_DRILL_SCALE_FROM +
      (1 - ACCOUNT_DRILL_SCALE_FROM) * accountProgress.value;
    return {
      flex: 1,
      opacity: accountProgress.value,
      transform: [{ scale: scaleValue }],
    };
  });
  const ollamaAnimatedStyle = useAnimatedStyle(() => {
    const scaleValue =
      SETTINGS_DRILL_SCALE_FROM +
      (SETTINGS_DRILL_SCALE_TO - SETTINGS_DRILL_SCALE_FROM) *
        ollamaProgress.value;
    return {
      flex: 1,
      opacity: ollamaProgress.value,
      transform: [{ scale: scaleValue }],
    };
  });
  // Always re-enter on the account view so the user does not land back inside Settings or Ollama after a dismiss.
  useEffect(() => {
    if (visible) setView("account");
  }, [visible]);
  // Sheet wrapper memoises on identity, so a fresh array is required each toggle. Ollama and Settings share the 90% snap.
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
  const handleManageSubscription = useCallback((): void => {
    WebBrowser.openBrowserAsync(LEGAL_URLS.manageSubscription).catch(
      (err: unknown) => {
        console.error("AccountSheet: failed to open subscription", err);
        toast({ title: "Could not open link", tone: "error" });
      },
    );
  }, [toast]);
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
    <Sheet visible={visible} onClose={onClose} snapPoints={[...snapPoints]}>
      {view === "settings" ? (
        <SheetHeader title="Settings" left={renderBackChevron("account")} />
      ) : null}
      {view === "ollama" ? (
        <SheetHeader title="Ollama" left={renderBackChevron("settings")} />
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
              onManageSubscription={handleManageSubscription}
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
              onOpenOllama={(): void => setView("ollama")}
            />
          </DrillFrame>
        ) : (
          <DrillFrame
            isAnimating={isSettlingOllama}
            animatedStyle={ollamaAnimatedStyle}
            animatedKey="ollama-view"
          >
            <OllamaView />
          </DrillFrame>
        )}
      </View>
    </Sheet>
  );
}
