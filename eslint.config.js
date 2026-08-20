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
      // The icon barrel has no tree-shaking under Metro, so one value import from it drags all ~1780 icons into the
      // bundle. Types are erased at compile time, so `type LucideIcon` from the root stays allowed.
      "@typescript-eslint/no-restricted-imports": [
        "error",
        {
          paths: [
            {
              name: "lucide-react-native",
              allowTypeImports: true,
              message:
                "Import each icon from its own module: lucide-react-native/icons/<kebab-name>.",
            },
            {
              // Matched exactly, so the per-icon subpaths below it stay allowed.
              name: "lucide-react-native/icons",
              allowTypeImports: true,
              message:
                "That is the barrel of every icon. Import one: lucide-react-native/icons/<kebab-name>.",
            },
          ],
        },
      ],
    },
  },
];
