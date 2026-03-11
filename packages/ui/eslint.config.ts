import { defineConfig } from "eslint/config";

import { baseConfig } from "@silo-storage/eslint-config/base";
import { reactConfig } from "@silo-storage/eslint-config/react";

export default defineConfig(
  {
    ignores: ["dist/**"],
  },
  baseConfig,
  reactConfig,
);
