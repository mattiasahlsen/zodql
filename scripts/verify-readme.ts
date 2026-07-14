#!/usr/bin/env -S npx tsx --tsconfig examples/tsconfig.json

import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import { generateReadmeContent } from "./lib/readme-content.js";

const rootDir = join(dirname(fileURLToPath(import.meta.url)), "..");

const expectedReadme = await generateReadmeContent(rootDir);
const actualReadme = readFileSync(join(rootDir, "README.md"), "utf-8");

if (expectedReadme !== actualReadme) {
  console.error("❌ README.md is out of date with README_TEMPLATE.md.");
  console.error("   Run `pnpm run build:docs` to regenerate it.");
  process.exit(1);
}

console.log("✅ README.md is up to date with README_TEMPLATE.md.");
