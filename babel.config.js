module.exports = function (api) {
  api.cache(true);
  return {
    presets: [
      ["babel-preset-expo", { jsxImportSource: "nativewind" }],
      "nativewind/babel",
    ],
    // Reanimated v4 moved its babel plugin out into react-native-worklets.
    plugins: ["react-native-worklets/plugin"],
  };
};
