import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      // Examples import the published package name (see the matching "paths"
      // entry in examples/tsconfig.json); resolve it to source so
      // examples/**/*.test.ts can run without a prior `pnpm build`.
      "@mattiasahlsen/zodql": fileURLToPath(new URL("./src/index.ts", import.meta.url)),
    },
  },
  test: {
    globals: true,
    setupFiles: ["./src/testing/vitestSetup.ts"],
    coverage: {
      provider: "v8",
      reporter: ["lcovonly"],
      reportsDirectory: "test-reports",
    },
    include: ["src/**/*.test.ts", "examples/**/*.test.ts"],
  },
});
