// Single source of truth for colors. Apple HIG palette + iOS "grouped" semantic layer (body=gray6, card=white).

// Code syntax for light mode (Xcode "Default (Light)"): dark inks tuned for the light `muted` code surface.
const syntaxLight = {
  keyword: "#C41A16",
  string: "#007400",
  comment: "#5D6C79",
  number: "#1C00CF",
  type: "#5C2D91",
  function: "#2E7D7D",
  punctuation: "#0F0F0E",
  plain: "#0F0F0E",
};
// Code syntax for dark mode (Xcode "Default (Dark)"): the light inks above are invisible on the dark `muted` surface, so dark needs its own bright set. plain/punctuation track the white foreground since every segment overrides the body text color.
const syntaxDark = {
  keyword: "#FF7AB2",
  string: "#FF8170",
  comment: "#8A99A6",
  number: "#D9C97C",
  type: "#7AC9FF",
  function: "#82D9C5",
  punctuation: "#FFFFFF",
  plain: "#FFFFFF",
};

// Apple HIG system colors — light + dark — values copy-checked against the spec table.
const appleLight = {
  red: "#FF383C",
  orange: "#FF8D28",
  yellow: "#FFCC00",
  green: "#34C759",
  mint: "#00C8B3",
  teal: "#00C3D0",
  cyan: "#00C0E8",
  blue: "#0088FF",
  indigo: "#6155F5",
  purple: "#CB30E0",
  pink: "#FF2D55",
  brown: "#AC7F5E",
};
const appleDark = {
  red: "#FF4245",
  orange: "#FF9230",
  yellow: "#FFD600",
  green: "#30D158",
  mint: "#00DAC3",
  teal: "#00D2E0",
  cyan: "#3CD3FE",
  blue: "#0091FF",
  indigo: "#6D7CFF",
  purple: "#DB34F2",
  pink: "#FF375F",
  brown: "#B78A66",
};

// iOS 27 label ramp — secondary/tertiary/quaternary are translucent so text blends with whatever surface it sits on (HIG label colors).
const labelLight = {
  label: "#000000",
  labelSecondary: "rgba(60,60,67,0.6)",
  labelTertiary: "rgba(60,60,67,0.3)",
};
// Dark secondary sits at 70% — the iOS 27 kit value (brighter than the classic UIKit 60%).
const labelDark = {
  label: "#FFFFFF",
  labelSecondary: "rgba(235,235,245,0.7)",
  labelTertiary: "rgba(235,235,245,0.3)",
};
// iOS 27 separators — translucent hairline for stacked rows; opaque variant where translucency would compound over layered content. Dark non-opaque is a white wash (kit value), not the classic UIKit gray.
const separatorLight = {
  separator: "rgba(60,60,67,0.29)",
  separatorOpaque: "#C6C6C8",
};
const separatorDark = {
  separator: "rgba(255,255,255,0.17)",
  separatorOpaque: "#38383A",
};
// iOS 27 system fills — translucent gray washes for control backgrounds INSIDE surfaces (glass stays on floating controls only). Quaternary is the faintest tier — large-area structural washes (Markdown table header band).
const fillLight = {
  fillSecondary: "rgba(120,120,128,0.16)",
  fillTertiary: "rgba(118,118,128,0.12)",
  fillQuaternary: "rgba(116,116,128,0.08)",
};
const fillDark = {
  fillSecondary: "rgba(120,120,128,0.32)",
  fillTertiary: "rgba(118,118,128,0.24)",
  fillQuaternary: "rgba(118,118,128,0.18)",
};
// Apple HIG system grays — light + dark.
const grayLight = {
  gray: "#8E8E93",
  gray2: "#AEAEB2",
  gray3: "#C7C7CC",
  gray4: "#D1D1D6",
  gray5: "#E5E5EA",
  gray6: "#F2F2F7",
};
const grayDark = {
  gray: "#8E8E93",
  gray2: "#636366",
  gray3: "#48484A",
  gray4: "#3A3A3C",
  gray5: "#2C2C2E",
  gray6: "#1C1C1E",
};

const light = {
  ...appleLight,
  ...grayLight,
  ...labelLight,
  ...separatorLight,
  ...fillLight,
  // Shadcn-style semantic layer — every component consumes these.
  // Body sits on systemGroupedBackground (gray6) so Glass surfaces + cards stand out.
  background: grayLight.gray6, // #F2F2F7
  foreground: "#1C1C1E", // text on background
  card: "#FFFFFF", // sheets / rows surface
  cardForeground: "#1C1C1E",
  popover: "#FFFFFF",
  popoverForeground: "#1C1C1E",
  primary: appleLight.blue, // #0088FF
  primaryForeground: "#FFFFFF",
  // `secondary` = neutral button surface. Bumped to gray4 so it reads against the white card body.
  secondary: grayLight.gray4, // #D1D1D6
  secondaryForeground: "#1C1C1E",
  muted: grayLight.gray5, // search/input fields (kept softer than `secondary` so inputs blend with their card)
  // iOS secondaryLabel — translucent so secondary text adapts to whichever surface hosts it.
  mutedForeground: labelLight.labelSecondary,
  accent: grayLight.gray5, // interactive neutral surface
  accentForeground: "#1C1C1E",
  destructive: appleLight.red,
  destructiveForeground: "#FFFFFF",
  // Saturated past #FFE5E5 so the full-red label reads against this surface in light mode.
  destructiveSoft: "#FFD0D0",
  // iOS separator (non-opaque) — translucent hairline reads on both the white card and the gray6 body.
  border: separatorLight.separator,
  input: separatorLight.separator,
  ring: appleLight.blue,
  // Utility.
  scrim: "rgba(0,0,0,0.4)",
  // Sheet scrim is lighter than the dialog scrim — iOS 27 kit overlay value.
  scrimSheet: "rgba(0,0,0,0.2)",
  scrimPage: "rgba(0,0,0,0.07)",
  // Excerpt menu dims less than a sheet because it also blurs, and the blur separates the surround on its own.
  scrimExcerpt: "rgba(0,0,0,0.08)",
  // Excerpt spotlight rim ONLY — the ported BorderGlow mesh hues. Never an app accent: they live outside the Apple HIG
  // set on purpose and must not leak into general use. The rim's warm edge light lives in boxShadow.excerptRim.
  excerptRimMesh: ["#c084fc", "#f472b6", "#38bdf8"],
  shadow: "#000000",
  // Theme-stable: iOS UISwitch thumb is white on both themes (Apple system convention).
  thumbFill: "#FFFFFF",
  // Segmented selected-option pill — white over the fillTertiary track in light mode.
  segmentedSelected: "#FFFFFF",
  // Switch ON track — iOS system toggle green (semantic control key; components never read palette accessors).
  toggleOn: appleLight.green,
};

const dark = {
  ...appleDark,
  ...grayDark,
  ...labelDark,
  ...separatorDark,
  ...fillDark,
  background: "#000000", // systemGroupedBackground dark
  foreground: "#FFFFFF",
  card: grayDark.gray6, // #1C1C1E — elevated surface
  cardForeground: "#FFFFFF",
  popover: grayDark.gray6,
  popoverForeground: "#FFFFFF",
  primary: appleDark.blue, // #0091FF
  primaryForeground: "#FFFFFF",
  // Neutral button surface bumped to gray4 dark so Button.secondary separates from the gray6-dark card body.
  secondary: grayDark.gray4, // #3A3A3C
  secondaryForeground: "#FFFFFF",
  muted: grayDark.gray5, // #2C2C2E — search bg
  // iOS secondaryLabel dark — translucent so secondary text adapts to whichever surface hosts it.
  mutedForeground: labelDark.labelSecondary,
  accent: grayDark.gray5,
  accentForeground: "#FFFFFF",
  destructive: appleDark.red,
  destructiveForeground: "#FFFFFF",
  destructiveSoft: "#4D2622",
  // iOS separator (non-opaque) dark — translucent hairline reads on both the #1C1C1E card and the black body.
  border: separatorDark.separator,
  input: separatorDark.separator,
  ring: appleDark.blue,
  scrim: "rgba(0,0,0,0.6)",
  // Same value both themes — the kit overlay does not deepen for dark.
  scrimSheet: "rgba(0,0,0,0.2)",
  scrimPage: "rgba(0,0,0,0.16)",
  // Deeper than light: over a near-black body a 0.08 wash does not separate the surround at all.
  scrimExcerpt: "rgba(0,0,0,0.16)",
  // Same rim palette as light — the effect sits on the dimmed surround, which is neutral in both themes.
  excerptRimMesh: ["#c084fc", "#f472b6", "#38bdf8"],
  shadow: "#000000",
  // Same as light — Apple system convention.
  thumbFill: "#FFFFFF",
  // iOS-real dark selected-segment fill is systemGray2 (§21) — the kit example renders a light pill; gray4 was too close to the dark track to read as selected.
  segmentedSelected: grayDark.gray2,
  toggleOn: appleDark.green,
};

// Light palette is the static default; theme swap happens via `vars()` (see ThemeProvider).
// Syntax colors are per-theme: __light/__dark carry their own palette so `useThemeColors().syntax` swaps with the theme.
module.exports = {
  ...light,
  syntax: syntaxLight,
  __light: { ...light, syntax: syntaxLight },
  __dark: { ...dark, syntax: syntaxDark },
};
