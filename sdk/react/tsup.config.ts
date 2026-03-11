import { defineConfig } from "tsup";

export default defineConfig({
  clean: true,
  dts: true,
  entry: ["src/index.ts"],
  external: ["react", "@silo-storage/sdk-core"],
  format: ["esm"],
  sourcemap: true,
  target: "es2022",
});
