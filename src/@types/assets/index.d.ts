// Ambient module declaration that lets TS type `.svg` imports as React components after react-native-svg-transformer takes over at Metro time.

declare module "*.svg" {
  import type React from "react";
  import type { SvgProps } from "react-native-svg";

  const content: React.ComponentType<SvgProps>;
  export default content;
}
