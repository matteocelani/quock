// Root layout provider tree. DbProvider's <SplashLogo> fallback takes over the native splash the moment SQLite opens, so the brand mark is the Quock SVG on a theme canvas (never a PNG) and the cut to the app is instant.

import "../global.css";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Slot, useRouter, useSegments } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { StatusBar } from "expo-status-bar";
import * as SystemUI from "expo-system-ui";
import React from "react";
import { View } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { KeyboardProvider } from "react-native-keyboard-controller";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { QUERY_STALE_TIME_MS } from "@/lib/constants/magic-numbers";
import { ApiProvider } from "@/lib/contexts/ApiContext";
import { AuthProvider, useAuthContext } from "@/modules/auth/context/AuthContext";
import { DbProvider } from "@/lib/contexts/DbContext";
import { ToastViewport } from "@/components/global/ToastContext";
import {
  ThemeProvider,
  useResolvedThemeColors,
  useTheme,
  useThemeColors,
} from "@/lib/theme/ThemeContext";
import QuockSvg from "@/assets/icons/Quock.svg";

// Hold the OS splash until <SplashLogo> mounts and dismisses it, so there's no flash between the native canvas and our JS splash.
SplashScreen.preventAutoHideAsync().catch((err: unknown) => {
  console.warn("SplashScreen.preventAutoHideAsync failed", err);
});
// `networkMode: "always"` lets queries run offline since the local repos serve cached data.
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      networkMode: "always",
      staleTime: QUERY_STALE_TIME_MS,
    },
    mutations: {
      networkMode: "always",
    },
  },
});
// Vector splash mark size; module const, not an inline literal.
const SPLASH_LOGO_SIZE = 96;
// DbProvider's fallback while SQLite opens. Paints the Quock SVG on the resolved theme background (grouped-gray in light, black in dark) and dismisses the native splash so the brand mark is always the vector logo, never a PNG. Resolves theme without <ThemeProvider> (it sits above it), so a forced light/dark override is honored too.
function SplashLogo(): React.ReactElement {
  const colors = useResolvedThemeColors();
  React.useEffect(() => {
    SplashScreen.hideAsync().catch((err: unknown) => {
      console.warn("SplashScreen.hideAsync failed", err);
    });
  }, []);
  return (
    <View
      className="flex-1 items-center justify-center"
      style={{ backgroundColor: colors.background }}
    >
      <QuockSvg
        width={SPLASH_LOGO_SIZE}
        height={SPLASH_LOGO_SIZE}
        color={colors.foreground}
        accessibilityLabel="Quock"
      />
    </View>
  );
}
// Bounces the user back to /login when AuthContext goes "unauthenticated" while parked on an authed route.
function AuthRouteGuard(): null {
  const { status } = useAuthContext();
  const router = useRouter();
  const segments = useSegments();
  React.useEffect(() => {
    if (status === "checking") return;
    const isOnLogin = segments[0] === "login";
    if (status === "unauthenticated" && !isOnLogin) {
      router.replace("/login");
    }
    if (status === "authenticated" && isOnLogin) {
      router.replace("/c");
    }
  }, [status, segments, router]);
  return null;
}

// Drives the OS chrome from the resolved theme: light status-bar glyphs + black Android window in dark mode (dark glyphs were invisible on the black canvas, and a static light window flashed). Rendered inside <ThemeProvider> so it sees the resolved theme and re-applies on theme change.
function SystemChrome(): React.ReactElement {
  const { resolved } = useTheme();
  const colors = useThemeColors();
  React.useEffect(() => {
    SystemUI.setBackgroundColorAsync(colors.background).catch((err: unknown) => {
      console.warn("SystemUI.setBackgroundColorAsync failed", err);
    });
  }, [colors.background]);
  return <StatusBar style={resolved === "dark" ? "light" : "dark"} />;
}

export default function RootLayout(): React.ReactElement {
  // Order matters: Auth above Db (signed-in state ready before SQLite), Theme inside Db so its CSS vars wrap the app; the SplashLogo fallback resolves theme on its own while Db opens.
  return (
    <GestureHandlerRootView className="flex-1">
      <SafeAreaProvider>
        <KeyboardProvider>
          <QueryClientProvider client={queryClient}>
            <ApiProvider>
              <AuthProvider>
                <DbProvider fallback={<SplashLogo />}>
                  <ThemeProvider>
                    <AuthRouteGuard />
                    <Slot />
                    <ToastViewport />
                    <SystemChrome />
                  </ThemeProvider>
                </DbProvider>
              </AuthProvider>
            </ApiProvider>
          </QueryClientProvider>
        </KeyboardProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
