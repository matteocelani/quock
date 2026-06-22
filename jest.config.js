/** @type {import('jest').Config} */
module.exports = {
  preset: "jest-expo",
  // The optional `(\\.pnpm/[^/]+/node_modules/)?` group lets the whitelist also match pnpm's nested `node_modules/.pnpm/<pkg>@<ver>/node_modules/<pkg>/...` layout; without it Jest treats every RN/Expo source under .pnpm as already-built and chokes on ESM.
  transformIgnorePatterns: [
    "node_modules/(?!(\\.pnpm/[^/]+/node_modules/)?((jest-)?react-native|@react-native(-community)?|expo(nent)?|@expo(nent)?/.*|@expo-google-fonts/.*|react-navigation|@react-navigation/.*|@unimodules/.*|unimodules|sentry-expo|native-base|react-native-svg|nativewind|@gorhom/.*|@shopify/.*|zustand))",
  ],
  moduleNameMapper: {
    "^@/gotypes$": "<rootDir>/codegen/gotypes.gen.ts",
    "^@/(.*)$": "<rootDir>/src/$1",
    // The package is declared in package.json; the local stub uses Node's
    // built-in crypto so unit tests still exercise real Ed25519 math.
    "^tweetnacl$": "<rootDir>/__mocks__/tweetnacl.ts",
    // Expo's streaming fetch is a native module under Jest; delegate to global fetch in tests.
    "^expo/fetch$": "<rootDir>/__mocks__/expo-fetch.ts",
    // SVG files are React components in production (via react-native-svg-transformer at Metro time). Tests do not run Metro, so we stub `.svg` to a no-op component.
    "\\.svg$": "<rootDir>/__mocks__/svgFile.tsx",
  },
  // Presentational components in `src/components/` are intentionally excluded — they are covered by Maestro E2E flows on device, not Jest unit tests.
  collectCoverageFrom: [
    "src/lib/api/**/*.ts",
    "src/lib/hooks/**/*.ts",
    "src/modules/*/api/**/*.ts",
    "src/modules/*/hooks/**/*.ts",
    "src/modules/*/lib/**/*.ts",
    "!src/**/*.d.ts",
    "!src/**/index.ts",
  ],
  testMatch: ["**/?(*.)+(test).[jt]s?(x)"],
};
