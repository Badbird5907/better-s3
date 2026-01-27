import { defineConfig } from "eslint/config";

import { baseConfig } from "@app/eslint-config/base";

export default defineConfig(
  {
    ignores: ["dist/**"],
  },
  baseConfig,
);
