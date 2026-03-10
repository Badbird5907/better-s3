import { defineConfig } from "eslint/config";

import { baseConfig } from "@silo/eslint-config/base";

export default defineConfig(
  {
    ignores: ["dist/**", "seed-analytics.ts"],
  },
  baseConfig,
);
