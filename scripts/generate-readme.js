#!/usr/bin/env node

import { readFileSync, writeFileSync } from "fs";
import { execSync } from "child_process";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const rootDir = join(__dirname, "..");

// Read the template
const template = readFileSync(join(rootDir, "README_TEMPLATE.md"), "utf-8");

// Validate that the placeholder exists
if (!template.includes("{{API_DOCS}}")) {
  throw new Error("README_TEMPLATE.md must contain the {{API_DOCS}} placeholder");
}

// Generate API docs from the main exported files
// These are the primary entry points that export the public API
console.log("Generating API documentation...");
const apiDocs = execSync(
  "npx --no-install jsdoc2md --files dist/index.js dist/ZodqlBuilder.js dist/ZodqlFieldBuilder.js dist/client.js dist/utils/hasTypename.js",
  {
    cwd: rootDir,
    encoding: "utf-8",
  }
);

// Replace the placeholder with the generated docs
const readme = template.replace("{{API_DOCS}}", apiDocs.trim());

// Write the README.md
writeFileSync(join(rootDir, "README.md"), readme);

console.log("✅ README.md generated successfully!");
