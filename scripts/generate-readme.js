#!/usr/bin/env node

import { writeFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import { generateReadmeContent } from "./lib/readme-content.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const rootDir = join(__dirname, "..");

const readme = generateReadmeContent(rootDir);

writeFileSync(join(rootDir, "README.md"), readme);

console.log("✅ README.md generated successfully!");
