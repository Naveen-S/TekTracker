import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";

const eslintConfig = defineConfig([
  ...nextVitals,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Prisma's generated client (modern `prisma-client` generator) — generated code, not linted.
    "src/generated/**",
    // The retired Vite prototype (backed up at the 2026-07-18 cutover) — reference only, never
    // held to this ruleset.
    "legacy/**",
  ]),
]);

export default eslintConfig;
