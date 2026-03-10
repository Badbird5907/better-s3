import { defineConfig } from "eslint/config";

import { baseConfig } from "@silo/eslint-config/base";
import { reactConfig } from "@silo/eslint-config/react";

export default defineConfig(
  {
    ignores: ["dist/**"],
  },
  baseConfig,
  reactConfig,
);
