import { defineConfig } from "eslint/config";
import tseslint from "typescript-eslint";

export default defineConfig(...tseslint.configs.recommended, {
  rules: {
    "@typescript-eslint/no-explicit-any": "off",
    "@typescript-eslint/no-empty-object-type": "off",
    "@typescript-eslint/consistent-type-imports": "error",
  },
});
