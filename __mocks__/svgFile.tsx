// SVG files import as React components in production via Metro + react-native-svg-transformer. Jest does not run Metro, so we stub `.svg` imports to a no-op component that accepts SvgProps and renders nothing.

import React from "react";
import { View, type ViewProps } from "react-native";

export default function SvgMock(props: ViewProps): React.ReactElement {
  return <View {...props} />;
}
