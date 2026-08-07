// Ambient type declaration for ./colors.cjs (CommonJS color source). Co-located so the standard `**/*.ts` include picks it up; mirrors the real module shape (static light palette + per-theme __light/__dark).
declare module "*/design/colors.cjs" {
  interface SyntaxColors {
    keyword: string;
    string: string;
    comment: string;
    number: string;
    type: string;
    function: string;
    punctuation: string;
    plain: string;
  }

  interface PaletteColors {
    // Shadcn-style semantic layer.
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
    // iOS 27 label ramp.
    label: string;
    labelSecondary: string;
    labelTertiary: string;
    // iOS 27 separators.
    separator: string;
    separatorOpaque: string;
    // iOS 27 system fills.
    fillSecondary: string;
    fillTertiary: string;
    fillQuaternary: string;
    // Apple HIG system colors.
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
    scrimPage: string;
    scrimExcerpt: string;
    excerptRimMesh: readonly string[];
    shadow: string;
    thumbFill: string;
    segmentedSelected: string;
    toggleOn: string;
    syntax: SyntaxColors;
  }

  interface BrandColors extends PaletteColors {
    __light: PaletteColors;
    __dark: PaletteColors;
  }

  const colors: BrandColors;
  export default colors;
}
