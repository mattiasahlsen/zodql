import { readFileSync, readdirSync, mkdtempSync, rmSync } from "fs";
import { execSync, execFileSync } from "child_process";
import { tmpdir } from "os";
import { join } from "path";

export function generateReadmeContent(rootDir) {
  const template = readFileSync(join(rootDir, "README_TEMPLATE.md"), "utf-8");

  if (!template.includes("{{API_DOCS}}")) {
    throw new Error("README_TEMPLATE.md must contain the {{API_DOCS}} placeholder");
  }

  const exampleNames = collectPlaceholderNames(template, "EXAMPLE");
  const queryNames = collectPlaceholderNames(template, "QUERY");

  for (const name of queryNames) {
    if (!exampleNames.includes(name)) {
      throw new Error(`{{QUERY:${name}}} has no matching {{EXAMPLE:${name}}} placeholder in README_TEMPLATE.md`);
    }
  }
  for (const file of readdirSync(join(rootDir, "examples", "readme"))) {
    const name = file.replace(/\.ts$/, "");
    if (file.endsWith(".ts") && !exampleNames.includes(name)) {
      throw new Error(`examples/readme/${file} is not referenced by any {{EXAMPLE:...}} placeholder`);
    }
  }

  let readme = template;

  // Placeholders are substituted with replacer functions rather than strings so
  // `$` sequences in the inserted content (e.g. GraphQL variables like `$id`,
  // or the literal `` `$` ``) are inserted verbatim instead of being interpreted
  // as `String.prototype.replace` special patterns such as `` $` `` (which would
  // splice in the surrounding template).
  for (const name of exampleNames) {
    const source = readFileSync(join(rootDir, "examples", "readme", `${name}.ts`), "utf-8").trim();
    readme = readme.replaceAll(`{{EXAMPLE:${name}}}`, () => codeBlock("typescript", source));
  }

  const queryStrings = compileExampleQueries(rootDir, queryNames);
  for (const name of queryNames) {
    readme = readme.replaceAll(`{{QUERY:${name}}}`, () => codeBlock("graphql", queryStrings[name]));
  }

  console.log("Generating API documentation...");
  const apiDocs = generateApiDocs(rootDir);

  return readme.replace("{{API_DOCS}}", () => apiDocs);
}

function collectPlaceholderNames(template, kind) {
  const names = new Set();
  for (const match of template.matchAll(new RegExp(`\\{\\{${kind}:([\\w-]+)\\}\\}`, "g"))) {
    names.add(match[1]);
  }
  return [...names];
}

function codeBlock(language, content) {
  return `\`\`\`${language}\n${content.trim()}\n\`\`\``;
}

// Imports each named example from examples/readme/ and returns a map from
// example name to the query string of its exported compiled query. Runs through
// tsx with the examples tsconfig so `@mattiasahlsen/zodql` resolves to the
// library source (no prior build needed).
function compileExampleQueries(rootDir, names) {
  if (names.length === 0) return {};
  console.log("Compiling example queries...");
  const stdout = execFileSync(
    "npx",
    [
      "--no-install",
      "tsx",
      "--tsconfig",
      "examples/tsconfig.json",
      "examples/print-readme-queries.ts",
      ...names,
    ],
    { cwd: rootDir, encoding: "utf-8" }
  );
  return JSON.parse(stdout);
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
