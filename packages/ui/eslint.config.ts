import { defineConfig } from "eslint/config";

import { baseConfig } from "@app/eslint-config/base";
import { reactConfig } from "@app/eslint-config/react";

export default defineConfig(
  {
    ignores: ["dist/**"],
  },
  baseConfig,
  reactConfig,
);
