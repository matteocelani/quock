// Theme bridge between the persisted `useSettingsStore` and the React UI layer. Owns the resolution of the user-selected mode against the system color scheme, the NativeWind colorScheme sync, and the CSS-variable wrapping that drives every `bg-background`, `text-foreground`, etc. class. State lives in the Zustand settings store — this file only translates it into UI side effects.

import { useColorScheme as useNwColorScheme, vars } from "nativewind";
import React from "react";
import {
  useColorScheme as useRNColorScheme,
  StyleSheet,
  View,
} from "react-native";
import { useSettingsStore, type ThemeMode } from "@/lib/stores/settings.store";
import { darkColors, lightColors, type DesignColors } from "@/lib/design/tokens";

type ResolvedTheme = "light" | "dark";
export type { ThemeMode };

function resolveMode(
  mode: ThemeMode,
  systemScheme: "light" | "dark" | null | undefined,
): ResolvedTheme {
  if (mode === "system") {
    return systemScheme === "dark" ? "dark" : "light";
  }
  return mode;
}

function resolveColors(resolved: ResolvedTheme): DesignColors {
  return resolved === "dark" ? darkColors : lightColors;
}
// Resolves the active light/dark colors WITHOUT requiring <ThemeProvider>, for surfaces that paint before it mounts (the DB-open splash). Reads the same persisted mode + system scheme the provider does, so a forced override is honored too.
export function useResolvedThemeColors(): DesignColors {
  const mode = useSettingsStore((s) => s.themeMode);
  const raw = useRNColorScheme();
  const systemScheme: "light" | "dark" | null =
    raw === "dark" ? "dark" : raw === "light" ? "light" : null;
  return resolveColors(resolveMode(mode, systemScheme));
}
// CSS-variable bindings consumed by tailwind.config.js (every `var(--color-*)` in the theme.colors map resolves against these). Re-keyed to dash-separated names so they read identically across CSS, JS, and Tailwind class generation.
function palette(c: DesignColors): Record<string, string> {
  return {
    // shadcn semantics
    "--color-background": c.background,
    "--color-foreground": c.foreground,
    "--color-card": c.card,
    "--color-card-foreground": c.cardForeground,
    "--color-popover": c.popover,
    "--color-popover-foreground": c.popoverForeground,
    "--color-primary": c.primary,
    "--color-primary-foreground": c.primaryForeground,
    "--color-secondary": c.secondary,
    "--color-secondary-foreground": c.secondaryForeground,
    "--color-muted": c.muted,
    "--color-muted-foreground": c.mutedForeground,
    "--color-accent": c.accent,
    "--color-accent-foreground": c.accentForeground,
    "--color-destructive": c.destructive,
    "--color-destructive-foreground": c.destructiveForeground,
    "--color-destructive-soft": c.destructiveSoft,
    "--color-border": c.border,
    "--color-input": c.input,
    "--color-ring": c.ring,
    // Apple HIG system colors.
    "--color-red": c.red,
    "--color-orange": c.orange,
    "--color-yellow": c.yellow,
    "--color-green": c.green,
    "--color-mint": c.mint,
    "--color-teal": c.teal,
    "--color-cyan": c.cyan,
    "--color-blue": c.blue,
    "--color-indigo": c.indigo,
    "--color-purple": c.purple,
    "--color-pink": c.pink,
    "--color-brown": c.brown,
    // Apple HIG system grays.
    "--color-gray": c.gray,
    "--color-gray2": c.gray2,
    "--color-gray3": c.gray3,
    "--color-gray4": c.gray4,
    "--color-gray5": c.gray5,
    "--color-gray6": c.gray6,
    // Utility.
    "--color-scrim": c.scrim,
  };
}

const LIGHT_VARS = vars(palette(lightColors));
const DARK_VARS = vars(palette(darkColors));

interface ThemeApi {
  mode: ThemeMode;
  resolved: ResolvedTheme;
  setMode: (next: ThemeMode) => void;
}
const ThemeContext = React.createContext<ThemeApi | null>(null);

interface ThemeProviderProps {
  children: React.ReactNode;
}

export function ThemeProvider({
  children,
}: ThemeProviderProps): React.ReactElement {
  const mode = useSettingsStore((s) => s.themeMode);
  const setStoreMode = useSettingsStore((s) => s.setThemeMode);
  const rawSystemScheme = useRNColorScheme();
  // `useColorScheme` can return "unspecified" on some Android skins; coerce to a strict light/dark/null for our resolver.
  const systemScheme: "light" | "dark" | null =
    rawSystemScheme === "dark" ? "dark" : rawSystemScheme === "light" ? "light" : null;
  const resolved = resolveMode(mode, systemScheme);
  // NativeWind tracks its own scheme so `dark:` variants resolve correctly even when we drive theming via CSS vars. Pass `mode` (not `resolved`) so NativeWind owns OS-tracking when mode === "system" — passing an explicit light/dark value left the `dark:` variant cache stuck on the previous scheme when transitioning back to "system" (NativeWind v4 #587).
  const { setColorScheme } = useNwColorScheme();
  React.useEffect(() => {
    setColorScheme(mode);
  }, [mode, setColorScheme]);
  const setMode = React.useCallback(
    (next: ThemeMode): void => {
      setStoreMode(next);
    },
    [setStoreMode],
  );
  const value = React.useMemo<ThemeApi>(
    () => ({ mode, resolved, setMode }),
    [mode, resolved, setMode],
  );
  const styleVars = resolved === "dark" ? DARK_VARS : LIGHT_VARS;
  return (
    <ThemeContext.Provider value={value}>
      <View style={[styleVars, StyleSheet.absoluteFill]}>{children}</View>
    </ThemeContext.Provider>
  );
}

export function useTheme(): ThemeApi {
  const ctx = React.useContext(ThemeContext);
  if (!ctx) {
    throw new Error("useTheme must be used inside <ThemeProvider>");
  }
  return ctx;
}
// Convenience hook for components that need raw color values (e.g. Lucide `color` prop) rather than NativeWind classes.
export function useThemeColors(): DesignColors {
  const { resolved } = useTheme();
  return resolveColors(resolved);
}
