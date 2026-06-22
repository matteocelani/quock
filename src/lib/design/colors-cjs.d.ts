// Ambient type declaration for ./colors.cjs (CommonJS brand-color source). Co-located so the standard `**/*.ts` include picks it up.
declare module "*/design/colors.cjs" {
  interface BrandColors {
    bg: string;
    surface: string;
    surface2: string;
    surface3: string;
    ink: string;
    inkMute: string;
    inkFaint: string;
    hair: string;
    hairStrong: string;
    accent: string;
    accentInk: string;
    accentDeep: string;
    danger: string;
    dangerSoft: string;
    success: string;
    scrim: string;
    sendBg: string;
    sendInk: string;
  }

  const colors: BrandColors;
  export default colors;
}
