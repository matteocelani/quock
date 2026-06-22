// Sign-in screen. Entrance is staggered logo → title → button → legal.

import * as Application from "expo-application";
import { useRouter } from "expo-router";
import * as SecureStore from "expo-secure-store";
import * as WebBrowser from "expo-web-browser";
import React from "react";
import { DevSettings, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSpring,
  withTiming,
} from "react-native-reanimated";
import { LEGAL_URLS } from "@/lib/api/config";
import { Button } from "@/components/ui/Button";
import { Pressable } from "@/components/ui/Pressable";
import {
  KEYPAIR_SEED_STORE_KEY,
  LOGIN_ELEMENT_FADE_MS,
  LOGIN_ELEMENT_TRANSLATE_Y,
  LOGIN_ERROR_FADE_MS,
  LOGIN_ERROR_SLIDE_DISTANCE,
  LOGIN_LOGO_SCALE_FROM,
  LOGIN_LOGO_SIZE,
  LOGIN_MIN_LOADING_MS,
  LOGIN_STAGGER_BUTTON_DELAY_MS,
  LOGIN_STAGGER_LEGAL_DELAY_MS,
  LOGIN_STAGGER_LOGO_DELAY_MS,
  LOGIN_STAGGER_TITLE_DELAY_MS,
} from "@/modules/auth/constants";
import { springEasing, surfaceSpring } from "@/lib/design/motion";
import QuockSvg from "@/assets/icons/Quock.svg";
import { useThemeColors } from "@/lib/theme/ThemeContext";
import { useSignIn } from "@/modules/auth/hooks/useAuth";

function formatVersion(): string {
  // `expo-application` returns null on web / some sim configurations.
  const version =
    Application.nativeApplicationVersion ??
    Application.applicationName ??
    "0.0.0";
  const build = Application.nativeBuildVersion ?? "0";
  return `v${version} (build ${build})`;
}

export default function Login(): React.ReactElement {
  const router = useRouter();
  const colors = useThemeColors();
  const { signIn, isLoading, error } = useSignIn();
  const [isPerceivedLoading, setPerceivedLoading] = React.useState(false);
  // Stagger choreography: each element starts at opacity 0 / translateY 8 / logo at scale 0.85 and animates in on a delayed spring.
  const logoOpacity = useSharedValue(0);
  const logoScale = useSharedValue(LOGIN_LOGO_SCALE_FROM);
  const titleOpacity = useSharedValue(0);
  const titleTranslate = useSharedValue(LOGIN_ELEMENT_TRANSLATE_Y);
  const buttonOpacity = useSharedValue(0);
  const buttonTranslate = useSharedValue(LOGIN_ELEMENT_TRANSLATE_Y);
  const legalOpacity = useSharedValue(0);
  const legalTranslate = useSharedValue(LOGIN_ELEMENT_TRANSLATE_Y);
  const errorOpacity = useSharedValue(0);
  const errorTranslate = useSharedValue(-LOGIN_ERROR_SLIDE_DISTANCE);
  React.useEffect(() => {
    logoOpacity.value = withDelay(
      LOGIN_STAGGER_LOGO_DELAY_MS,
      withTiming(1, { duration: LOGIN_ELEMENT_FADE_MS, easing: springEasing }),
    );
    logoScale.value = withDelay(
      LOGIN_STAGGER_LOGO_DELAY_MS,
      withSpring(1, surfaceSpring),
    );
    titleOpacity.value = withDelay(
      LOGIN_STAGGER_TITLE_DELAY_MS,
      withTiming(1, { duration: LOGIN_ELEMENT_FADE_MS, easing: springEasing }),
    );
    titleTranslate.value = withDelay(
      LOGIN_STAGGER_TITLE_DELAY_MS,
      withSpring(0, surfaceSpring),
    );
    buttonOpacity.value = withDelay(
      LOGIN_STAGGER_BUTTON_DELAY_MS,
      withTiming(1, { duration: LOGIN_ELEMENT_FADE_MS, easing: springEasing }),
    );
    buttonTranslate.value = withDelay(
      LOGIN_STAGGER_BUTTON_DELAY_MS,
      withSpring(0, surfaceSpring),
    );
    legalOpacity.value = withDelay(
      LOGIN_STAGGER_LEGAL_DELAY_MS,
      withTiming(1, { duration: LOGIN_ELEMENT_FADE_MS, easing: springEasing }),
    );
    legalTranslate.value = withDelay(
      LOGIN_STAGGER_LEGAL_DELAY_MS,
      withSpring(0, surfaceSpring),
    );
  }, [
    buttonOpacity,
    buttonTranslate,
    legalOpacity,
    legalTranslate,
    logoOpacity,
    logoScale,
    titleOpacity,
    titleTranslate,
  ]);
  // Error banner: slide + fade in/out keyed to the presence of an error.
  React.useEffect(() => {
    const isVisible = error !== null;
    errorOpacity.value = withTiming(isVisible ? 1 : 0, {
      duration: LOGIN_ERROR_FADE_MS,
      easing: springEasing,
    });
    errorTranslate.value = withSpring(
      isVisible ? 0 : -LOGIN_ERROR_SLIDE_DISTANCE,
      surfaceSpring,
    );
  }, [error, errorOpacity, errorTranslate]);
  const logoAnimatedStyle = useAnimatedStyle(() => ({
    opacity: logoOpacity.value,
    transform: [{ scale: logoScale.value }],
  }));
  const titleAnimatedStyle = useAnimatedStyle(() => ({
    opacity: titleOpacity.value,
    transform: [{ translateY: titleTranslate.value }],
  }));
  const buttonAnimatedStyle = useAnimatedStyle(() => ({
    opacity: buttonOpacity.value,
    transform: [{ translateY: buttonTranslate.value }],
  }));
  const legalAnimatedStyle = useAnimatedStyle(() => ({
    opacity: legalOpacity.value,
    transform: [{ translateY: legalTranslate.value }],
  }));
  const errorAnimatedStyle = useAnimatedStyle(() => ({
    opacity: errorOpacity.value,
    transform: [{ translateY: errorTranslate.value }],
  }));
  const handleContinue = React.useCallback(async (): Promise<void> => {
    if (isLoading || isPerceivedLoading) return;
    setPerceivedLoading(true);
    const startedAt = Date.now();
    try {
      await signIn();
      const elapsed = Date.now() - startedAt;
      const remaining = Math.max(0, LOGIN_MIN_LOADING_MS - elapsed);
      if (remaining > 0) {
        await new Promise<void>((resolve) => setTimeout(resolve, remaining));
      }
      // Safety net — the root layout normally handles this once auth flips.
      router.replace("/c");
    } catch (err) {
      // `useSignIn`'s `error` state surfaces the message to the user; warn so the failure still hits the dev log.
      console.warn("login: sign-in failed", err);
    } finally {
      setPerceivedLoading(false);
    }
  }, [isLoading, isPerceivedLoading, router, signIn]);
  const openExternal = React.useCallback((url: string): void => {
    WebBrowser.openBrowserAsync(url).catch((err: unknown) => {
      console.warn("WebBrowser.openBrowserAsync failed", err);
    });
  }, []);
  const handleWipeAndReload = React.useCallback(async (): Promise<void> => {
    try {
      await SecureStore.deleteItemAsync(KEYPAIR_SEED_STORE_KEY);
      console.warn("[LOGIN] wiped SecureStore keypair; reloading");
    } catch (err) {
      console.error("Failed to wipe SecureStore", err);
    }
    DevSettings.reload();
  }, []);
  const isShowingSpinner = isLoading || isPerceivedLoading;
  return (
    <SafeAreaView className="flex-1 bg-background" edges={["top", "bottom"]}>
      <View className="flex-1 px-6">
        {error !== null && (
          <Animated.View
            style={errorAnimatedStyle}
            className="mt-4 rounded-lg border border-destructive/40 bg-destructive-soft px-4 py-3"
          >
            <Text className="font-sans text-sm text-destructive">
              {error.message || "Sign-in failed. Please try again."}
            </Text>
          </Animated.View>
        )}
        {/* Optical centering pulls the visual mass slightly above the geometric center via pb-15. */}
        <View className="flex-1 items-center justify-center pb-15">
          <Animated.View style={logoAnimatedStyle} className="mb-8">
            <QuockSvg
              width={LOGIN_LOGO_SIZE}
              height={LOGIN_LOGO_SIZE}
              color={colors.foreground}
              accessibilityLabel="Quock"
            />
          </Animated.View>
          <Animated.Text
            className="mb-8 text-center font-sans text-foreground font-semibold text-xl max-w-title"
            style={titleAnimatedStyle}
          >
            Sign in to your Ollama account
          </Animated.Text>
          <Animated.View
            style={buttonAnimatedStyle}
            className="w-full max-w-card"
          >
            <Button
              variant="primary"
              size="lg"
              fullWidth
              loading={isShowingSpinner}
              testID="login-continue"
              onPress={() => {
                void handleContinue();
              }}
            >
              {isShowingSpinner ? "Opening sign-in…" : "Continue with Ollama"}
            </Button>
          </Animated.View>
        </View>
        <Animated.View style={legalAnimatedStyle} className="pb-6">
          <View className="flex-row items-center justify-center gap-3.5">
            <Pressable
              onPress={() => openExternal(LEGAL_URLS.privacy)}
              haptic={false}
            >
              <Text className="font-sans text-muted-foreground text-sm">
                Privacy
              </Text>
            </Pressable>
            <View className="w-1 h-1 rounded-full bg-border" />
            <Pressable
              onPress={() => openExternal(LEGAL_URLS.terms)}
              haptic={false}
            >
              <Text className="font-sans text-muted-foreground text-sm">
                Terms of Service
              </Text>
            </Pressable>
          </View>
          <Text className="mt-3.5 text-center font-mono text-xs tracking-wide text-muted-foreground">
            {formatVersion()}
          </Text>
          {__DEV__ ? (
            <Pressable
              onPress={() => {
                void handleWipeAndReload();
              }}
              haptic={false}
              className="mt-3 self-center"
              accessibilityLabel="Wipe SecureStore and reload (dev only)"
              testID="dev-wipe"
            >
              <Text className="font-mono text-muted-foreground text-xs tracking-wide underline">
                DEV: wipe keypair &amp; reload
              </Text>
            </Pressable>
          ) : null}
        </Animated.View>
      </View>
    </SafeAreaView>
  );
}
