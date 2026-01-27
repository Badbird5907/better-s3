import { defineConfig } from "eslint/config";

import { baseConfig, restrictEnvAccess } from "@app/eslint-config/base";
import { nextjsConfig } from "@app/eslint-config/nextjs";
import { reactConfig } from "@app/eslint-config/react";

export default defineConfig(
  {
    ignores: [".next/**"],
  },
  baseConfig,
  reactConfig,
  nextjsConfig,
  restrictEnvAccess,
);
