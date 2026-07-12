import { readFileSync } from "fs";
import { execSync } from "child_process";
import { join } from "path";

export function generateReadmeContent(rootDir) {
  const template = readFileSync(join(rootDir, "README_TEMPLATE.md"), "utf-8");

  if (!template.includes("{{API_DOCS}}")) {
    throw new Error("README_TEMPLATE.md must contain the {{API_DOCS}} placeholder");
  }

  console.log("Generating API documentation...");
  const apiDocs = execSync(
    "npx --no-install jsdoc2md --files dist/index.js dist/ZodqlBuilder.js dist/ZodqlFieldBuilder.js dist/client.js dist/utils/hasTypename.js dist/types.js",
    {
      cwd: rootDir,
      encoding: "utf-8",
    }
  );

  // Use a replacer function rather than a string so `$` sequences in the API docs
  // (e.g. GraphQL variables like `$id`, or the literal `` `$` ``) are inserted
  // verbatim instead of being interpreted as `String.prototype.replace` special
  // patterns such as `` $` `` (which would splice in the surrounding template).
  return template.replace("{{API_DOCS}}", () => apiDocs.trim());
}
