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
  // iOS 27 label ramp — translucent below `label` so text blends with any surface.
  label: string;
  labelSecondary: string;
  labelTertiary: string;
  // iOS 27 separators — translucent hairline + opaque variant for layered content.
  separator: string;
  separatorOpaque: string;
  // iOS 27 system fills — solid control washes inside surfaces (never glass). Quaternary = faintest tier, for large-area structural washes (Markdown table header band).
  fillSecondary: string;
  fillTertiary: string;
  fillQuaternary: string;
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
  scrimSheet: string;
  // Excerpt menu dim (lighter than a sheet: it blurs too) and the ported BorderGlow rim palette, that effect only.
  scrimExcerpt: string;
  excerptRimMesh: readonly string[];
  shadow: string;
  // Theme-stable neutrals — iOS UISwitch thumb stays white on both themes.
  thumbFill: string;
  // SegmentedControl selected-option pill — white light / systemGray2 dark (iOS-real selected-segment fill).
  segmentedSelected: string;
  // Switch ON track — iOS system toggle green as a semantic control key.
  toggleOn: string;
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
  press: number; // 60   — Button + ListRow press tint fade-in
  trailingFade: number; // 140  — ListRow trailing meta fade during swipe
  focus: number; // 200  — TextField focus-border crossfade
  sheetSlide: number; // 220  — Sheet enter / exit slide
  swipeCloseTail: number; // 260  — ChatRow rename/delete: wait for ReanimatedSwipeable close before opening the dialog
  copyFeedback: number; // 1000 — CodeBlock copy checkmark linger
  spinnerRotation: number; // 833  — iOS UIActivityIndicator cadence (~1.2 rps)
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
  pressTintMax: number; // 0.10 — Button press-tint overlay clamp
  midpoint: number; // 0.4  — chip reveal curve midpoint, opacity ramp
  disabled: number; // 0.4  — disabled state dim across interactive primitives
  pressDisabled: number; // 0.45 — Pressable disabled dim (slightly less dim than GlassOrb so chevron icons stay legible)
  half: number; // 0.5  — generic threshold
  tint: number; // 0.8  — accent tint alpha for highlighted orbs/chips
}
export const opacity: DesignOpacity = {
  pressBrightnessBoost: 0.08,
  pressTintMax: 0.1,
  midpoint: 0.4,
  disabled: 0.4,
  pressDisabled: 0.45,
  half: 0.5,
  tint: 0.8,
};
// Mask paint, not palette: MaskedView and SVG masks read alpha, so these mean "show" and "hide".
export const maskPaint = { opaque: "#000000", clear: "rgba(0,0,0,0)" } as const;
// Z-index layers. NativeWind has no z-index utility past z-50, so layers flow as tokens via `style={{ zIndex }}`.
export interface DesignZLayer {
  composer: number; // 20 — sticky bottom input bar
  header: number; // 30 — sticky top bar
  menu: number; // 40 — contextual menu over content; must clear the header and composer orbs, which declare their own zIndex
  toast: number; // 50 — bottom-anchored notification
  dialog: number; // 10000 — confirm dialog, must clear nested modals
}
export const zLayer: DesignZLayer = {
  composer: 20,
  header: 30,
  menu: 40,
  toast: 50,
  dialog: 10000,
};
// Animated-value motion thresholds — small named constants the chat-row swipe + radio indicator + thumb spring reuse.
export interface DesignMotion {
  scaleFrom: number; // 0.5  — chip-row reveal scale-in start
  scaleCheckBase: number; // 0.6  — radio check scale base
  scaleCheckRange: number; // 0.4  — radio check scale travel (0.6 → 1)
  scalePressDefault: number; // 0.97 — Pressable iOS-style press scale
  scalePressFirm: number; // 0.94 — slightly deeper press for sheet open / attach tiles
  scalePressTight: number; // 0.92 — small circular icon buttons (header compose, chat row actions, search clear)
  scalePressXTight: number; // 0.9  — tiny tap targets (attachment chip remove X)
  swipeFriction: number; // 2    — RNGH friction: damped pull
  swipeRightThreshold: number; // 40   — RNGH commit distance
  thumbOvershoot: number; // 0.05 — Switch thumb clamp to keep inside track
  scaleDialogFrom: number; // 0.94 — ConfirmDialog card entrance scale, springs to 1
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
  iconHeroBack: number; // 22 — back chevron — between iconSize.xl + 2xl
  iconRowBrand: number; // 22 — brand SVG glyph in settings rows (Discord/X/Ollama)
  avatarHeader: number; // 28 — avatar size in the chat top bar
  hitTargetMin: number; // 44 — Apple HIG minimum + avatar in profile row + sheet header slot
  segmentedSlot: number; // 208 — segmented control width inside settings row trailing slot ("System" at footnote semibold needs ~53pt of label room per cell)
  avatarDefault: number; // 36 — Avatar primitive default diameter
  spinnerDefault: number; // 18 — Spinner primitive default diameter
}
export const size: DesignSize = {
  iconHeroBack: 22,
  iconRowBrand: 22,
  avatarHeader: 28,
  hitTargetMin: 44,
  segmentedSlot: 208,
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
  thumb: DesignShadowRecipe; // iOS UISwitch thumb
  dialog: DesignShadowRecipe; // ClearChatsChooser cards + Toast pill lift
  orb: DesignShadowRecipe; // GlassOrb Android solid-fallback lift (iOS lift lives in boxShadow.glass)
}
export const shadow: DesignShadows = {
  thumb: { opacity: 0.15, radius: 2, offsetY: 1, elevation: 2 },
  dialog: { opacity: 0.24, radius: 30, offsetY: 12, elevation: 12 },
  orb: { opacity: 0.1, radius: 8, offsetY: 3, elevation: 3 },
};
// iOS 27 glass recipe for floating controls over content — never inside opaque surfaces. Consumed via the RN 0.83 Fabric `boxShadow` style prop, split in two homes because Fabric paints inset shadows under children: `ring` (hairline + ambient lift) sits on the unclipped wrapper, `highlight` (inset top/bottom speculars) sits on an absolute overlay inside the clipped stack. Per theme because glass floats over unknown content.
export interface DesignBoxShadowGlass {
  ring: string;
  highlight: string;
}
export interface DesignBoxShadow {
  glass: Record<"light" | "dark", DesignBoxShadowGlass>;
  // Sheet card ring — iOS 27 kit values (hairline + deep ambient), heavier than the orb glass ring. The kit's 1.25px side speculars are deliberately omitted: sub-pixel ticks read as noise at card scale and the kit extracts no dark values for them.
  sheet: Record<"light" | "dark", string>;
  // SegmentedControl selected-pill lift — kit CSS blur rendered verbatim by Fabric (legacy shadowRadius would halve it).
  control: string;
  // Excerpt spotlight edge light: the web BorderGlow's ladder, cut where the mask cuts. Its 50px tier blurred past
  // glowReach (26) and was rasterised only to be masked away; its inset half is invisible over a white paragraph.
  excerptRim: string;
}
export const boxShadow: DesignBoxShadow = {
  glass: {
    // Rest-wash hairline is an opaque near-white per theme (iOS 27 kit §19) — a translucent white rim washed out over busy content.
    light: {
      ring: "0 0 0 0.5px #ebebeb, 0 8px 24px rgba(0,0,0,0.12)",
      highlight:
        "inset 0 1px 1px rgba(255,255,255,0.55), inset 0 -1px 1px rgba(255,255,255,0.2)",
    },
    dark: {
      ring: "0 0 0 0.5px #e6e6e6, 0 8px 24px rgba(0,0,0,0.4)",
      highlight:
        "inset 0 1px 1px rgba(255,255,255,0.18), inset 0 -1px 1px rgba(255,255,255,0.06)",
    },
  },
  sheet: {
    light: "0 0 0 0.5px #dbdbdb, 0 8px 48px rgba(0,0,0,0.25)",
    dark: "0 0 0 0.5px rgba(255,255,255,0.15), 0 8px 48px rgba(0,0,0,0.5)",
  },
  control: "0 2px 10px rgba(0,0,0,0.06)",
  excerptRim: [
    "0 0 0 1px rgba(245,218,163,1)",
    "0 0 1px rgba(245,218,163,0.6)",
    "0 0 3px rgba(245,218,163,0.5)",
    "0 0 6px rgba(245,218,163,0.4)",
    "0 0 15px rgba(245,218,163,0.3)",
    "0 0 24px 2px rgba(245,218,163,0.2)",
  ].join(", "),
};
// Per-component layout constants. Shape `{ component: { key: number } }` keeps the call sites unambiguous.
export interface DesignComponentLayout {
  toast: {
    insetX: number; // 12 — horizontal viewport inset
    topOffset: number; // 16 — gap below the FloatingHeader orb row so the pill never touches the orbs
    slideDistance: number; // 12 — enter/exit slide distance (slide down from above for top-anchored toast)
  };
  composer: {
    inputFontSize: number; // 17 — iOS body (iMessage compose size)
    inputLineHeight: number; // 22 — iOS body leading (shared with maxLines calc)
    inputPaddingY: number; // 8  — symmetric vertical padding (shared with maxLines calc)
    inputAccentLetterSpacing: number; // -0.43 — iOS body tracking
    minBottomPad: number; // 8  — used when the safe-area bottom is 0 (no notch); also when the keyboard is open
    chipScrollPadX: number; // 12 — attachment chip ScrollView horizontal padding
    chipScrollPadTop: number; // 10 — attachment chip ScrollView top padding
    chipScrollGap: number; // 8  — attachment chip ScrollView gap
    orbSize: number; // 38 — composer orb diameter (matches w-9.5/h-9.5 tailwind class)
    orbRowPaddingY: number; // 10 — vertical padding on the orb flex-row (applied numerically — py-2.5 renders 8.75 under the 14px rem)
    blurBaseIntensity: number; // 60 — peak blur intensity at the bottom edge; gradient fades to 0 at the top of the orbs. Height = insets.bottom + orbRowPaddingY + orbSize.
  };
  modelPicker: {
    descriptionMaxLines: number; // 2 — Ollama-site mirror
  };
  // iOS 27 UISwitch geometry — wide track, white pill knob.
  toggleSwitch: {
    trackWidth: number; // 64
    trackHeight: number; // 28
    knobWidth: number; // 38
    knobHeight: number; // 24
    inset: number; // 2 — knob padding inside the track
    knobStretch: number; // 6 — press-state width growth, anchored to the active edge (kit Pressed variants)
  };
  segmentedControl: {
    indicatorInset: number; // 2 — pad between track edge and the selected option (option height = track - 2*inset)
    trackHeightSmall: number; // 32 — iOS 27 small track
    trackHeightLarge: number; // 50 — iOS 27 large track
    optionGap: number; // 4  — gap between options
    optionPaddingX: number; // 6  — label padding inside the option pill so long labels never touch the edge
  };
  // iOS 27 inset-grouped list geometry (§15).
  listSection: {
    cardRadius: number; // 26
    insetX: number; // 16 — horizontal inset of the card from the screen edge
    rowHeightRegular: number; // 52 — regular (single-line) row height inside the card
  };
  // Attachment chip image thumbnail (60-pt square).
  attachmentChipThumb: number; // 60
  attachmentChipMaxWidth: number; // 200 — text doc chip max-width
  attachmentChipIconWrap: number; // 22 — small inner doc-icon halo
  attachmentChipRemoveBadge: number; // 20 — remove-X badge diameter; mirrors the w-5.25 Tailwind tier
  attachmentChipRemoveBadgeHitSlop: number; // 10 — touch-target padding around the remove-X badge
  // Three floating orbs at the top of the chat screen (FloatingHeader).
  floatingHeader: {
    topGap: number; // 8  — space above the orb row, beyond safe-area top
    sidePad: number; // 12 — horizontal padding of the orb row
    height: number; // 60 — header + topGap + orb height + breathing gap (used as MessageList topInset)
    orbHeight: number; // 44 — header orb diameter (HIG tap-target minimum; applied numerically — w-11/h-11 render 38.5 under the 14px rem)
    blurBaseIntensity: number; // 60 — peak blur intensity at the top edge; gradient fades to 0 at the bottom of the orbs. Height = insets.top + topGap + orbHeight.
  };
  iconButton: {
    defaultIconSize: number; // 22 — between iconSize.xl (20) and 2xl (24); tuned for 44pt tap targets
  };
  // iOS 27 alert geometry — capsule-continuous 34pt card with full-width stacked buttons.
  alertDialog: {
    widthRatio: number; // 0.70 — share of the display width, clamped by the two below.
    widthMin: number; // 260 — narrow Android/SE displays: 70% of 320 is 224, too tight for a sentence. Stays inside the 21pt screen padding.
    widthMax: number; // 420 — on a tablet 70% would stretch the card past a comfortable reading measure. The kit fixes its alert at 300pt, but ours also hosts an editable prompt, and 300 reads cramped for text you have to read and rewrite.
    cornerRadius: number; // 34
    padding: number; // 14
    blockPaddingTop: number; // 8  — title/message block top pad (§11)
    blockPaddingX: number; // 8  — title/message block side pad (§11)
    blockPaddingBottom: number; // 24 — space between the text block and the actions row (§11)
    blockGap: number; // 10 — title→message gap (§11); stock mt-* tiers miss it at the 14px rem
    buttonHeight: number; // 48
    buttonGap: number; // 8 — gap between the action pills (gap-2 renders 7px at the 14px rem, so exact pt lives here)
    textAreaMinHeight: number; // 52 — a MINIMUM, not a height: the field grows to maxLines (3 x 22 + 2 x 8 = 82) before it scrolls
    textAreaRadius: number; // 20 — concentric with the card (34 - padding 14). The kit's 26 is half of its fixed 52pt single-line field, i.e. a capsule; ours grows, and a radius that equals half the height at one line stops doing so at three, so the control would change identity mid-typing
  };
  // iOS 27 button control heights — consumed as numeric style values (Tailwind h-* tiers stay rem-derived).
  button: {
    heightLarge: number; // 50
    heightMedium: number; // 34
    heightSmall: number; // 28
    largePaddingX: number; // 20
  };
  // AttachSheet round tile (Apple share-sheet style: circular orb + label below).
  attachTile: {
    orbDiameter: number; // 64 — round orb size (icon + tappable area)
  };
  // Excerpt menu: the dim spares the pressed block, so it is painted as a spread shadow around a rounded hole.
  excerptMenu: {
    spotlightRadius: number; // 14 — rounded cutout, a touch looser than the unit's own corner so it reads as a halo
    spotlightPadding: number; // 2  — breathing room between the text and the dim
    dimBlurIntensity: number; // 2 — the faintest blur that still registers; above this the surround reads as frosted
    glowReach: number; // 26 — how far the edge light spreads past the cutout (the original's glowRadius, scaled to a 14pt corner)
    rimWidth: number; // 1.5 — width of the mesh-gradient ring
    coneFadeStop: number; // 0.52 — where the half-plane mask fades out, i.e. how much of the rim carries colour
  };
  // Floating action bar shaped like the iOS text-selection menu: one capsule, actions inline, hairline between them.
  glassToolbar: {
    radius: number; // 999 — pill, the corner every other floating control already uses
    height: number; // 44 — HIG minimum tap target, and the height iOS gives its selection bar
    padX: number; // 4  — inset so a pressed action's chip never touches the rim
    padY: number; // 4  — same, vertically
    actionPadX: number; // 14 — breathing room around an inline icon + label
    actionRadius: number; // 999 — a pressed action reads as a pill chip inside the bar
    iconLabelGap: number; // 6  — icon-to-label gap
    dividerInsetY: number; // 8  — hairline stops short of the rim, the way iOS insets its menu separators
    anchorGap: number; // 8  — gap between the bar and the content it points at (not a kit value; iOS leaves the source visible)
    // Kit fills the menu at 0.70 where the orb sits at 0.90, so the backdrop reads through; same bases as glassOrb.
    tint: Record<"light" | "dark", string>;
  };
  // GlassOrb tint + blur recipes per variant — component-specific, not semantic surfaces.
  glassOrb: {
    tint: Record<
      "light" | "dark",
      Record<"clear" | "regular" | "thick", string>
    >;
    blurIntensity: Record<"clear" | "regular" | "thick", number>;
  };
  // Spinner rotation cadence ≈ iOS UIActivityIndicator at ~1.2 rps → 833ms (in timingsNamed).
}
export const componentLayout: DesignComponentLayout = {
  toast: { insetX: 12, topOffset: 16, slideDistance: 12 },
  composer: {
    inputFontSize: 17,
    inputLineHeight: 22,
    inputPaddingY: 8,
    inputAccentLetterSpacing: -0.43,
    minBottomPad: 8,
    chipScrollPadX: 12,
    chipScrollPadTop: 10,
    chipScrollGap: 8,
    orbSize: 38,
    orbRowPaddingY: 10,
    blurBaseIntensity: 60,
  },
  modelPicker: { descriptionMaxLines: 2 },
  toggleSwitch: {
    trackWidth: 64,
    trackHeight: 28,
    knobWidth: 38,
    knobHeight: 24,
    inset: 2,
    knobStretch: 6,
  },
  segmentedControl: {
    indicatorInset: 2,
    trackHeightSmall: 32,
    trackHeightLarge: 50,
    optionGap: 4,
    optionPaddingX: 6,
  },
  listSection: {
    cardRadius: 26,
    insetX: 16,
    rowHeightRegular: 52,
  },
  attachmentChipThumb: 60,
  attachmentChipMaxWidth: 200,
  attachmentChipIconWrap: 22,
  attachmentChipRemoveBadge: 20,
  attachmentChipRemoveBadgeHitSlop: 10,
  floatingHeader: {
    topGap: 8,
    sidePad: 12,
    height: 60,
    orbHeight: 44,
    blurBaseIntensity: 60,
  },
  iconButton: { defaultIconSize: 22 },
  alertDialog: {
    widthRatio: 0.7,
    widthMin: 260,
    widthMax: 420,
    cornerRadius: 34,
    padding: 14,
    blockPaddingTop: 8,
    blockPaddingX: 8,
    blockPaddingBottom: 24,
    blockGap: 10,
    buttonHeight: 48,
    buttonGap: 8,
    textAreaMinHeight: 52,
    textAreaRadius: 20,
  },
  button: {
    heightLarge: 50,
    heightMedium: 34,
    heightSmall: 28,
    largePaddingX: 20,
  },
  attachTile: { orbDiameter: 64 },
  excerptMenu: {
    spotlightRadius: 14,
    spotlightPadding: 2,
    dimBlurIntensity: 2,
    glowReach: 26,
    rimWidth: 1.5,
    coneFadeStop: 0.52,
  },
  glassToolbar: {
    radius: 999,
    height: 44,
    padX: 4,
    padY: 4,
    actionPadX: 14,
    actionRadius: 999,
    iconLabelGap: 6,
    dividerInsetY: 8,
    anchorGap: 8,
    tint: {
      light: "rgba(255,255,255,0.70)",
      dark: "rgba(58,58,60,0.70)",
    },
  },
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
// Sheet geometry — iOS 27 floating card: inset from the display edge, capsule-continuous corners (looser at the bottom to hug the display curve), pill grabber, dimmed scrim. Dismiss when drag > distance OR velocity > threshold.
export const sheetPrimitive = {
  offscreenTranslateY: 800,
  scrimBlurIntensity: 14,
  dismissDistanceThreshold: 120,
  dismissVelocityThreshold: 1000,
  upwardRubberBandFactor: 0.3,
  insetMargin: 6,
  cornerRadiusTop: 34,
  cornerRadiusBottom: 58,
  grabberWidth: 58,
  grabberHeight: 4,
  grabberTopOffset: 5,
} as const;
