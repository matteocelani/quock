const { getDefaultConfig } = require("expo/metro-config");
const { withNativeWind } = require("nativewind/metro");

const config = getDefaultConfig(__dirname);

// SVGR: import `.svg` as React components via react-native-svg-transformer (Lucide covers most icons; this is for brand glyphs Lucide does not ship). The transformer is applied BEFORE `withNativeWind` so the Babel chain composes correctly.
const { transformer, resolver } = config;
config.transformer = {
  ...transformer,
  babelTransformerPath: require.resolve("react-native-svg-transformer/expo"),
};
config.resolver = {
  ...resolver,
  assetExts: resolver.assetExts.filter((ext) => ext !== "svg"),
  sourceExts: [...resolver.sourceExts, "svg"],
};

module.exports = withNativeWind(config, { input: "./global.css" });
