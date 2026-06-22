// Flat ESLint config; we layer project rules on top of `eslint-config-expo/flat` which already registers `@typescript-eslint`, so we DO NOT re-register the plugin here (pnpm's strict hoisting surfaces the duplicate as a hard error, npm's flat tree silently deduped it).

const expoConfig = require("eslint-config-expo/flat");

module.exports = [
  ...expoConfig,
  {
    ignores: [
      ".design/**",
      ".audit/**",
      "dist/**",
      "node_modules/**",
      ".expo/**",
      "codegen/**",
    ],
  },
  {
    files: ["**/*.{ts,tsx}"],
    rules: {
      "@typescript-eslint/no-explicit-any": "error",
      "@typescript-eslint/no-unused-vars": [
        "error",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
      ],
      "no-console": ["error", { allow: ["error", "warn", "info"] }],
      "import/no-named-as-default": "off",
    },
  },
];
