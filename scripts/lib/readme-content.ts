import { readFileSync, readdirSync, mkdtempSync, rmSync } from "fs";
import { execSync } from "child_process";
import { tmpdir } from "os";
import { join } from "path";
import { pathToFileURL } from "url";

export async function generateReadmeContent(rootDir: string): Promise<string> {
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
    const source = readFileSync(join(rootDir, "examples", "readme", `${name}.ts`), "utf-8");
    readme = readme.replaceAll(`{{EXAMPLE:${name}}}`, () => codeBlock("typescript", source));
  }

  for (const name of queryNames) {
    const queryString = await importExampleQuery(rootDir, name);
    readme = readme.replaceAll(`{{QUERY:${name}}}`, () => codeBlock("graphql", queryString));
  }

  console.log("Generating API documentation...");
  const apiDocs = generateApiDocs(rootDir);

  return readme.replace("{{API_DOCS}}", () => apiDocs);
}

function collectPlaceholderNames(template: string, kind: "EXAMPLE" | "QUERY"): string[] {
  const names = new Set<string>();
  for (const match of template.matchAll(new RegExp(`\\{\\{${kind}:([\\w-]+)\\}\\}`, "g"))) {
    names.add(match[1]!);
  }
  return [...names];
}

function codeBlock(language: string, content: string): string {
  return `\`\`\`${language}\n${content.trim()}\n\`\`\``;
}

// Imports the example module and returns the query string of its
// default-exported compiled query. This file must be run through tsx with the
// examples tsconfig (see the build:docs / verify:docs scripts) so the example's
// `@mattiasahlsen/zodql` import resolves to the library source.
async function importExampleQuery(rootDir: string, name: string): Promise<string> {
  const moduleUrl = pathToFileURL(join(rootDir, "examples", "readme", `${name}.ts`)).href;
  const exampleModule = (await import(moduleUrl)) as { default?: unknown };

  const compiledQuery = exampleModule.default;
  if (
    typeof compiledQuery !== "object" ||
    compiledQuery === null ||
    typeof (compiledQuery as { queryString?: unknown }).queryString !== "string"
  ) {
    throw new Error(
      `examples/readme/${name}.ts is referenced by {{QUERY:${name}}}, so it must ` +
        `default-export its compiled query (an object with a \`queryString\` string).`
    );
  }
  return (compiledQuery as { queryString: string }).queryString;
}

// Runs TypeDoc (configured by `typedoc.json`) into a throwaway directory and
// returns the generated Markdown. TypeDoc only writes to disk, so it's pointed
// at a temp dir that is read back and removed rather than left in the tree.
function generateApiDocs(rootDir: string): string {
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
