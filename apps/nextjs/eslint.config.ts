import { defineConfig } from "eslint/config";

import { baseConfig, restrictEnvAccess } from "@silo/eslint-config/base";
import { nextjsConfig } from "@silo/eslint-config/nextjs";
import { reactConfig } from "@silo/eslint-config/react";

export default defineConfig(
  {
    ignores: [".next/**"],
  },
  baseConfig,
  reactConfig,
  nextjsConfig,
  restrictEnvAccess,
);
