import { defineConfig } from "vitest/config";

export default defineConfig({
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
