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
  // Shadcn-style semantic layer — every component consumes these.
  // Body sits on systemGroupedBackground (gray6) so Glass surfaces + cards stand out.
  background: grayLight.gray6,                  // #F2F2F7
  foreground: "#1C1C1E",                        // text on background
  card: "#FFFFFF",                              // sheets / rows surface
  cardForeground: "#1C1C1E",
  popover: "#FFFFFF",
  popoverForeground: "#1C1C1E",
  primary: appleLight.blue,                     // #0088FF
  primaryForeground: "#FFFFFF",
  // `secondary` = neutral button surface. Bumped to gray4 so it reads against the white card body.
  secondary: grayLight.gray4,                   // #D1D1D6
  secondaryForeground: "#1C1C1E",
  muted: grayLight.gray5,                       // search/input fields (kept softer than `secondary` so inputs blend with their card)
  mutedForeground: grayLight.gray,              // #8E8E93 — secondary text
  accent: grayLight.gray5,                      // interactive neutral surface
  accentForeground: "#1C1C1E",
  destructive: appleLight.red,
  destructiveForeground: "#FFFFFF",
  // Saturated past #FFE5E5 so the full-red label reads against this surface in light mode.
  destructiveSoft: "#FFD0D0",
  // Heavier than systemGray5 so list-row hairlines read against the white card surface.
  border: grayLight.gray4,                      // #D1D1D6
  input: grayLight.gray4,
  ring: appleLight.blue,
  // Utility.
  scrim: "rgba(0,0,0,0.4)",
  shadow: "#000000",
  // Theme-stable: iOS UISwitch thumb is white on both themes (Apple system convention).
  thumbFill: "#FFFFFF",
};

const dark = {
  ...appleDark,
  ...grayDark,
  background: "#000000",                        // systemGroupedBackground dark
  foreground: "#FFFFFF",
  card: grayDark.gray6,                         // #1C1C1E — elevated surface
  cardForeground: "#FFFFFF",
  popover: grayDark.gray6,
  popoverForeground: "#FFFFFF",
  primary: appleDark.blue,                      // #0091FF
  primaryForeground: "#FFFFFF",
  // Neutral button surface bumped to gray4 dark so Button.secondary separates from the gray6-dark card body.
  secondary: grayDark.gray4,                    // #3A3A3C
  secondaryForeground: "#FFFFFF",
  muted: grayDark.gray5,                        // #2C2C2E — search bg
  mutedForeground: grayDark.gray,               // #8E8E93
  accent: grayDark.gray5,
  accentForeground: "#FFFFFF",
  destructive: appleDark.red,
  destructiveForeground: "#FFFFFF",
  destructiveSoft: "#4D2622",
  // Heavier than systemGray5 so list-row hairlines read against the #1C1C1E card.
  border: grayDark.gray4,                       // #3A3A3C
  input: grayDark.gray4,
  ring: appleDark.blue,
  scrim: "rgba(0,0,0,0.6)",
  shadow: "#000000",
  // Same as light — Apple system convention.
  thumbFill: "#FFFFFF",
};

// Light palette is the static default; theme swap happens via `vars()` (see ThemeProvider).
// Syntax colors are per-theme: __light/__dark carry their own palette so `useThemeColors().syntax` swaps with the theme.
module.exports = {
  ...light,
  syntax: syntaxLight,
  __light: { ...light, syntax: syntaxLight },
  __dark: { ...dark, syntax: syntaxDark },
};
