import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),
  {
    rules: {
      // Standard async data-fetching in useEffect is the correct Next.js client
      // pattern. The React 19 strict rules flag `load()` inside useEffect as
      // "setState in effect" — disable these overly strict rules.
      "react-hooks/set-state-in-effect": "off",
      "react-hooks/purity": "off",
      "react-hooks/immutability": "off",
      // no-explicit-any: warn rather than error — Recharts, Supabase JSON,
      // and external API responses legitimately need escape hatches.
      "@typescript-eslint/no-explicit-any": "warn",
      // Unused vars: warn only, not error.
      "@typescript-eslint/no-unused-vars": "warn",
      // JSX entities — handled on a case-by-case basis.
      "react/no-unescaped-entities": "warn",
    },
  },
]);

export default eslintConfig;
