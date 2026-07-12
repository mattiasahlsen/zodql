import { readFileSync, mkdtempSync, rmSync } from "fs";
import { execSync } from "child_process";
import { tmpdir } from "os";
import { join } from "path";

export function generateReadmeContent(rootDir) {
  const template = readFileSync(join(rootDir, "README_TEMPLATE.md"), "utf-8");

  if (!template.includes("{{API_DOCS}}")) {
    throw new Error("README_TEMPLATE.md must contain the {{API_DOCS}} placeholder");
  }

  console.log("Generating API documentation...");
  const apiDocs = generateApiDocs(rootDir);

  // Use a replacer function rather than a string so `$` sequences in the API docs
  // (e.g. GraphQL variables like `$id`, or the literal `` `$` ``) are inserted
  // verbatim instead of being interpreted as `String.prototype.replace` special
  // patterns such as `` $` `` (which would splice in the surrounding template).
  return template.replace("{{API_DOCS}}", () => apiDocs);
}

// Runs TypeDoc (configured by `typedoc.json`) into a throwaway directory and
// returns the generated Markdown. TypeDoc only writes to disk, so it's pointed
// at a temp dir that is read back and removed rather than left in the tree.
function generateApiDocs(rootDir) {
  const outDir = mkdtempSync(join(tmpdir(), "zodql-typedoc-"));
  try {
    execSync(`npx --no-install typedoc --out "${outDir}"`, {
      cwd: rootDir,
      encoding: "utf-8",
      stdio: ["ignore", "inherit", "inherit"],
    });
    return readFileSync(join(outDir, "README.md"), "utf-8").trim();
  } finally {
    rmSync(outDir, { recursive: true, force: true });
  }
}
