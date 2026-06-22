const colors = require("./src/lib/design/colors.cjs");

/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./app/**/*.{ts,tsx}", "./src/**/*.{ts,tsx}"],
  presets: [require("nativewind/preset")],
  // CSS-variable based theming. `darkMode: 'class'` lets `dark:` variants
  // activate via `setColorScheme()`; we also rebind the base color values to
  // `var(--*)` so `bg-background`, `text-foreground`, etc. switch palettes the
  // moment ThemeProvider swaps the vars on the root view.
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        // Shadcn semantic layer.
        background: "var(--color-background, " + colors.background + ")",
        foreground: "var(--color-foreground, " + colors.foreground + ")",
        card: "var(--color-card, " + colors.card + ")",
        "card-foreground": "var(--color-card-foreground, " + colors.cardForeground + ")",
        popover: "var(--color-popover, " + colors.popover + ")",
        "popover-foreground": "var(--color-popover-foreground, " + colors.popoverForeground + ")",
        primary: "var(--color-primary, " + colors.primary + ")",
        "primary-foreground": "var(--color-primary-foreground, " + colors.primaryForeground + ")",
        secondary: "var(--color-secondary, " + colors.secondary + ")",
        "secondary-foreground": "var(--color-secondary-foreground, " + colors.secondaryForeground + ")",
        muted: "var(--color-muted, " + colors.muted + ")",
        "muted-foreground": "var(--color-muted-foreground, " + colors.mutedForeground + ")",
        accent: "var(--color-accent, " + colors.accent + ")",
        "accent-foreground": "var(--color-accent-foreground, " + colors.accentForeground + ")",
        destructive: "var(--color-destructive, " + colors.destructive + ")",
        "destructive-foreground": "var(--color-destructive-foreground, " + colors.destructiveForeground + ")",
        "destructive-soft": "var(--color-destructive-soft, " + colors.destructiveSoft + ")",
        border: "var(--color-border, " + colors.border + ")",
        input: "var(--color-input, " + colors.input + ")",
        ring: "var(--color-ring, " + colors.ring + ")",
        // Apple HIG system colors (status / charts).
        red: "var(--color-red, " + colors.red + ")",
        orange: "var(--color-orange, " + colors.orange + ")",
        yellow: "var(--color-yellow, " + colors.yellow + ")",
        green: "var(--color-green, " + colors.green + ")",
        mint: "var(--color-mint, " + colors.mint + ")",
        teal: "var(--color-teal, " + colors.teal + ")",
        cyan: "var(--color-cyan, " + colors.cyan + ")",
        blue: "var(--color-blue, " + colors.blue + ")",
        indigo: "var(--color-indigo, " + colors.indigo + ")",
        purple: "var(--color-purple, " + colors.purple + ")",
        pink: "var(--color-pink, " + colors.pink + ")",
        brown: "var(--color-brown, " + colors.brown + ")",
        // Apple HIG system grays.
        gray: "var(--color-gray, " + colors.gray + ")",
        gray2: "var(--color-gray2, " + colors.gray2 + ")",
        gray3: "var(--color-gray3, " + colors.gray3 + ")",
        gray4: "var(--color-gray4, " + colors.gray4 + ")",
        gray5: "var(--color-gray5, " + colors.gray5 + ")",
        gray6: "var(--color-gray6, " + colors.gray6 + ")",
        // Utility.
        scrim: "var(--color-scrim, " + colors.scrim + ")",
      },
      spacing: {
        // Fixed-px layout values Tailwind's scale lacks. NativeWind inlines rem at 14px, so these are exact pt, not rem-derived; keys avoid the stock numeric scale (e.g. no 80) so nothing is redefined.
        4.5: "18px",
        5.5: "22px",
        8.5: "34px",
        9.5: "38px",
        13: "52px",
        15: "60px",
        25: "100px",
        50: "200px",
        65: "260px",
      },
      maxWidth: {
        card: "360px",
        // Login hero title cap (was the stock-colliding spacing key `80`).
        title: "320px",
      },
      fontFamily: {
        // System = SF Pro on iOS, Roboto on Android — Apple HIG defaults. No custom font is loaded.
        sans: ["System"],
        mono: ["Menlo", "monospace"],
      },
    },
  },
  plugins: [],
};
