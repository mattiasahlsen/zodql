#!/usr/bin/env -S npx tsx --tsconfig examples/tsconfig.json

import { writeFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import { generateReadmeContent } from "./lib/readme-content.js";

const rootDir = join(dirname(fileURLToPath(import.meta.url)), "..");

const readme = await generateReadmeContent(rootDir);

writeFileSync(join(rootDir, "README.md"), readme);

console.log("✅ README.md generated successfully!");
