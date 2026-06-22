// Design tokens. Colors live in `./colors.cjs` so `tailwind.config.js` shares the source.
import brandColors from "@/lib/design/colors.cjs";

export interface SyntaxColors {
  keyword: string;
  string: string;
  comment: string;
  number: string;
  type: string;
  function: string;
  punctuation: string;
  plain: string;
}

export interface DesignColors {
  // Shadcn-style semantic layer — consumed by every component.
  background: string;
  foreground: string;
  card: string;
  cardForeground: string;
  popover: string;
  popoverForeground: string;
  primary: string;
  primaryForeground: string;
  secondary: string;
  secondaryForeground: string;
  muted: string;
  mutedForeground: string;
  accent: string;
  accentForeground: string;
  destructive: string;
  destructiveForeground: string;
  destructiveSoft: string;
  border: string;
  input: string;
  ring: string;
  // Apple HIG system colors — status / charts only.
  red: string;
  orange: string;
  yellow: string;
  green: string;
  mint: string;
  teal: string;
  cyan: string;
  blue: string;
  indigo: string;
  purple: string;
  pink: string;
  brown: string;
  // Apple HIG system grays.
  gray: string;
  gray2: string;
  gray3: string;
  gray4: string;
  gray5: string;
  gray6: string;
  // Utility.
  scrim: string;
  shadow: string;
  // Theme-stable neutrals — iOS UISwitch thumb stays white on both themes.
  thumbFill: string;
  // Code syntax, per-theme; read via `useThemeColors().syntax`, never a static import (the static light palette is invisible on the dark code surface).
  syntax: SyntaxColors;
}
// Both palettes exposed to the ThemeProvider so it can pick at runtime.
export const lightColors: DesignColors = brandColors.__light;
export const darkColors: DesignColors = brandColors.__dark;
// Apple's standard spring/easing curve, exported as a 4-tuple for Reanimated.
export type CubicBezier = readonly [number, number, number, number];
export const spring: CubicBezier = [0.32, 0.72, 0, 1] as const;
// Millisecond durations matching the design system.
export interface DesignTimings {
  fast: number;
  base: number;
  slow: number;
  page: number;
}

export const timings: DesignTimings = {
  fast: 120,
  base: 180,
  slow: 240,
  page: 320,
};
// Named-behaviour timings (ms) — bound to a specific animation where `fast/base/slow` would be misleading.
export interface DesignTimingsNamed {
  press: number;          // 60   — Button + ListRow press tint fade-in
  trailingFade: number;   // 140  — ListRow trailing meta fade during swipe
  focus: number;          // 200  — TextField focus-border crossfade
  sheetSlide: number;     // 220  — Sheet enter / exit slide
  swipeCloseTail: number; // 260  — ChatRow rename/delete: wait for ReanimatedSwipeable close before opening the dialog
  copyFeedback: number;   // 1000 — CodeBlock copy checkmark linger
  spinnerRotation: number;// 833  — iOS UIActivityIndicator cadence (~1.2 rps)
  routeSpinnerDefer: number; // 250 — wait before showing route spinner
  sheetCloseTail: number; // 350  — iOS Modal dismiss safety pad
}
export const timingsNamed: DesignTimingsNamed = {
  press: 60,
  trailingFade: 140,
  focus: 200,
  sheetSlide: 220,
  swipeCloseTail: 260,
  copyFeedback: 1000,
  spinnerRotation: 833,
  routeSpinnerDefer: 250,
  sheetCloseTail: 350,
};
// Lucide glyph sizes — consumed as `size` prop (number), not Tailwind classes.
export interface DesignIconSize {
  "2xs": number;
  xs: number;
  sm: number;
  md: number;
  lg: number;
  xl: number;
  "2xl": number;
  "3xl": number;
}
export const iconSize: DesignIconSize = {
  "2xs": 10,
  xs: 12,
  sm: 14,
  md: 16,
  lg: 18,
  xl: 20,
  "2xl": 24,
  "3xl": 28,
};
// Lucide stroke widths — thin (metadata) / regular (affordance) / bold (high-emphasis).
export interface DesignStrokeWidth {
  thin: number;
  regular: number;
  medium: number;
  bold: number;
  heavy: number;
}
export const strokeWidth: DesignStrokeWidth = {
  thin: 1.4,
  regular: 1.6,
  medium: 1.8,
  bold: 2,
  heavy: 2.2,
};
// Opacity tiers — Lucide and Reanimated don't accept Tailwind utilities, so values flow through here.
export interface DesignOpacity {
  pressBrightnessBoost: number; // 0.08 — GlassOrb press-in white wash
  ringSubtle: number;     // 0.08 — avatar ring hairline tint
  pressTintMax: number;   // 0.10 — Button press-tint overlay clamp
  ghostTint: number;      // 0.12 — Listrow press highlight midpoint
  shadowSoft: number;     // 0.15 — Switch thumb shadow
  shadowHeavy: number;    // 0.24 — ConfirmDialog elevated shadow
  midpoint: number;       // 0.4  — chip reveal curve midpoint, opacity ramp
  disabled: number;       // 0.4  — disabled state dim across interactive primitives
  pressDisabled: number;  // 0.45 — Pressable disabled dim (slightly less dim than GlassOrb so chevron icons stay legible)
  half: number;           // 0.5  — generic threshold
  tint: number;           // 0.8  — accent tint alpha for highlighted orbs/chips
}
export const opacity: DesignOpacity = {
  pressBrightnessBoost: 0.08,
  ringSubtle: 0.08,
  pressTintMax: 0.1,
  ghostTint: 0.12,
  shadowSoft: 0.15,
  shadowHeavy: 0.24,
  midpoint: 0.4,
  disabled: 0.4,
  pressDisabled: 0.45,
  half: 0.5,
  tint: 0.8,
};
// Z-index layers. NativeWind has no z-index utility past z-50, so layers flow as tokens via `style={{ zIndex }}`.
export interface DesignZLayer {
  composer: number;  // 20 — sticky bottom input bar
  header: number;    // 30 — sticky top bar
  toast: number;     // 50 — bottom-anchored notification
  dialog: number;    // 10000 — confirm dialog, must clear nested modals
}
export const zLayer: DesignZLayer = {
  composer: 20,
  header: 30,
  toast: 50,
  dialog: 10000,
};
// Animated-value motion thresholds — small named constants the chat-row swipe + radio indicator + thumb spring reuse.
export interface DesignMotion {
  scaleFrom: number;            // 0.5  — chip-row reveal scale-in start
  scaleCheckBase: number;       // 0.6  — radio check scale base
  scaleCheckRange: number;      // 0.4  — radio check scale travel (0.6 → 1)
  scalePressDefault: number;    // 0.97 — Pressable iOS-style press scale
  scalePressFirm: number;       // 0.94 — slightly deeper press for sheet open / attach tiles
  scalePressTight: number;      // 0.92 — small circular icon buttons (header compose, chat row actions, search clear)
  scalePressXTight: number;     // 0.9  — tiny tap targets (attachment chip remove X)
  swipeFriction: number;        // 2    — RNGH friction: damped pull
  swipeRightThreshold: number;  // 40   — RNGH commit distance
  thumbOvershoot: number;       // 0.05 — Switch thumb clamp to keep inside track
  scaleDialogFrom: number;      // 0.94 — ConfirmDialog card entrance scale, springs to 1
}
export const motion: DesignMotion = {
  scaleFrom: 0.5,
  scaleCheckBase: 0.6,
  scaleCheckRange: 0.4,
  scalePressDefault: 0.97,
  scalePressFirm: 0.94,
  scalePressTight: 0.92,
  scalePressXTight: 0.9,
  swipeFriction: 2,
  swipeRightThreshold: 40,
  thumbOvershoot: 0.05,
  scaleDialogFrom: 0.94,
};
// Hit-target / surface dimensions consumed as numeric props (Avatar `size`, icon slots, etc.). All in pts.
export interface DesignSize {
  iconHeroBack: number;  // 22 — back chevron — between iconSize.xl + 2xl
  iconRowBrand: number;  // 22 — brand SVG glyph in settings rows (Discord/X/Ollama)
  avatarHeader: number;  // 28 — avatar size in the chat top bar
  hitTargetMin: number;  // 44 — Apple HIG minimum + avatar in profile row + switch track width + sheet header slot
  segmentedSlot: number; // 188 — segmented control width inside settings row trailing slot
  cardWidth: number;     // 320 — confirm dialog max-width
  avatarDefault: number; // 36 — Avatar primitive default diameter
  spinnerDefault: number; // 18 — Spinner primitive default diameter
}
export const size: DesignSize = {
  iconHeroBack: 22,
  iconRowBrand: 22,
  avatarHeader: 28,
  hitTargetMin: 44,
  segmentedSlot: 188,
  cardWidth: 320,
  avatarDefault: 36,
  spinnerDefault: 18,
};
// Shadow recipes — three tiers consumed by `style={{ shadow* }}` because NativeWind has no shadow utility map on RN.
export interface DesignShadowRecipe {
  opacity: number;
  radius: number;
  offsetY: number;
  elevation: number;
}
export interface DesignShadows {
  thumb: DesignShadowRecipe;     // iOS UISwitch thumb
  control: DesignShadowRecipe;   // SegmentedControl indicator
  dialog: DesignShadowRecipe;    // ConfirmDialog elevated card
  orb: DesignShadowRecipe;       // GlassOrb soft lift — barely-there to "float" the orb above content
}
export const shadow: DesignShadows = {
  thumb: { opacity: 0.15, radius: 2, offsetY: 1, elevation: 2 },
  control: { opacity: 0.08, radius: 2, offsetY: 1, elevation: 1 },
  dialog: { opacity: 0.24, radius: 30, offsetY: 12, elevation: 12 },
  orb: { opacity: 0.10, radius: 8, offsetY: 3, elevation: 3 },
};
// Per-component layout constants. Shape `{ component: { key: number } }` keeps the call sites unambiguous.
export interface DesignComponentLayout {
  toast: {
    insetX: number;        // 12 — horizontal viewport inset
    topOffset: number;     // 16 — gap below the FloatingHeader orb row so the pill never touches the orbs
    slideDistance: number; // 12 — enter/exit slide distance (slide down from above for top-anchored toast)
  };
  composer: {
    inputFontSize: number;    // 14 — matches text-sm
    inputLineHeight: number;  // 22 — rendered line-height for the 14pt input
    inputPaddingY: number;    // 8  — symmetric vertical padding (shared with maxLines calc)
    inputAccentLetterSpacing: number; // -0.1
    minBottomPad: number;     // 8  — used when the safe-area bottom is 0 (no notch); also when the keyboard is open
    chipScrollPadX: number;   // 12 — attachment chip ScrollView horizontal padding
    chipScrollPadTop: number; // 10 — attachment chip ScrollView top padding
    chipScrollGap: number;    // 8  — attachment chip ScrollView gap
    orbSize: number;          // 38 — composer orb diameter (matches w-9.5/h-9.5 tailwind class)
    orbRowPaddingY: number;   // 10 — vertical padding on the orb flex-row (matches py-2.5)
    blurBaseIntensity: number; // 60 — peak blur intensity at the bottom edge; gradient fades to 0 at the top of the orbs. Height = insets.bottom + orbRowPaddingY + orbSize.
  };
  modelPicker: {
    descriptionMaxLines: number; // 2 — Ollama-site mirror
  };
  switchControl: {
    trackWidth: number;   // 44
    trackHeight: number;  // 26
    thumbSize: number;    // 22
    thumbPadding: number; // 2  — (track - thumb) / 2
    thumbTravel: number;  // 18 — thumb max translateX (= trackWidth 44 - thumb 22 - 2*padding 2)
  };
  segmentedControl: {
    defaultPadVertical: number; // 6
    defaultFontSize: number;    // 13
    compactPadVertical: number; // 4
    compactFontSize: number;    // 12
    indicatorInset: number;     // 2
  };
  // Attachment chip image thumbnail (60-pt square).
  attachmentChipThumb: number;       // 60
  attachmentChipMaxWidth: number;    // 200 — text doc chip max-width
  attachmentChipIconWrap: number;    // 22 — small inner doc-icon halo
  // Three floating orbs at the top of the chat screen (FloatingHeader).
  floatingHeader: {
    topGap: number;   // 8  — space above the orb row, beyond safe-area top
    sidePad: number;  // 12 — horizontal padding of the orb row
    height: number;   // 60 — header + topGap + orb height + breathing gap (used as MessageList topInset)
    orbHeight: number; // 44 — header orb diameter (matches h-11 tailwind class)
    blurBaseIntensity: number; // 60 — peak blur intensity at the top edge; gradient fades to 0 at the bottom of the orbs. Height = insets.top + topGap + orbHeight.
  };
  iconButton: {
    defaultIconSize: number; // 22 — between iconSize.xl (20) and 2xl (24); tuned for 44pt tap targets
  };
  // ConfirmDialog card corner radius (Apple HIG system-alert rounding, smaller than a sheet's 28pt).
  dialog: {
    cornerRadius: number; // 22
  };
  // AttachSheet round tile (Apple share-sheet style: circular orb + label below).
  attachTile: {
    orbDiameter: number; // 64 — round orb size (icon + tappable area)
  };
  // GlassOrb tint + blur recipes per variant — component-specific, not semantic surfaces.
  glassOrb: {
    tint: Record<"light" | "dark", Record<"clear" | "regular" | "thick", string>>;
    blurIntensity: Record<"clear" | "regular" | "thick", number>;
  };
  // Spinner rotation cadence ≈ iOS UIActivityIndicator at ~1.2 rps → 833ms (in timingsNamed).
}
export const componentLayout: DesignComponentLayout = {
  toast: { insetX: 12, topOffset: 16, slideDistance: 12 },
  composer: {
    inputFontSize: 14,
    inputLineHeight: 22,
    inputPaddingY: 8,
    inputAccentLetterSpacing: -0.1,
    minBottomPad: 8,
    chipScrollPadX: 12,
    chipScrollPadTop: 10,
    chipScrollGap: 8,
    orbSize: 38,
    orbRowPaddingY: 10,
    blurBaseIntensity: 60,
  },
  modelPicker: { descriptionMaxLines: 2 },
  switchControl: {
    trackWidth: 44,
    trackHeight: 26,
    thumbSize: 22,
    thumbPadding: 2,
    thumbTravel: 18,
  },
  segmentedControl: {
    defaultPadVertical: 6,
    defaultFontSize: 13,
    compactPadVertical: 4,
    compactFontSize: 12,
    indicatorInset: 2,
  },
  attachmentChipThumb: 60,
  attachmentChipMaxWidth: 200,
  attachmentChipIconWrap: 22,
  floatingHeader: {
    topGap: 8,
    sidePad: 12,
    height: 60,
    orbHeight: 44,
    blurBaseIntensity: 60,
  },
  iconButton: { defaultIconSize: 22 },
  dialog: { cornerRadius: 22 },
  attachTile: { orbDiameter: 64 },
  glassOrb: {
    tint: {
      light: {
        clear: "rgba(255,255,255,0.65)",
        regular: "rgba(255,255,255,0.90)",
        thick: "#FFFFFF",
      },
      dark: {
        clear: "rgba(58,58,60,0.65)",
        regular: "rgba(58,58,60,0.85)",
        thick: "#3A3A3C",
      },
    },
    blurIntensity: { clear: 40, regular: 70, thick: 95 },
  },
};
// Sheet geometry — full-width slab, top corners rounded. Dismiss when drag > distance OR velocity > threshold.
export const sheetPrimitive = {
  offscreenTranslateY: 800,
  scrimBlurIntensity: 14,
  insetX: 0,
  insetBottom: 0,
  cornerRadius: 28,
  dismissDistanceThreshold: 120,
  dismissVelocityThreshold: 1000,
  upwardRubberBandFactor: 0.3,
} as const;
