import { readFileSync, readdirSync } from "fs";
import { join } from "path";
import { pathToFileURL } from "url";

export async function generateReadmeContent(rootDir: string): Promise<string> {
  const template = readFileSync(join(rootDir, "README_TEMPLATE.md"), "utf-8");

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

  validateApiReference(readme, rootDir);

  return readme;
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

// Keeps the hand-written "## API Reference" table honest without regenerating
// it: the table's rows must name exactly the public exports of `src/index.ts`
// (no missing or stale entries), and every in-page section link must resolve to
// a real heading.
function validateApiReference(readme: string, rootDir: string): void {
  const section = extractSection(readme, "API Reference");
  if (!section) {
    throw new Error("README_TEMPLATE.md must contain an `## API Reference` section");
  }

  const documented = new Set<string>();
  for (const row of section.split("\n")) {
    if (!row.startsWith("|")) continue;
    const firstCell = row.split("|")[1] ?? "";
    const match = firstCell.match(/`([A-Za-z_][\w]*)(?:\(\))?`/);
    if (match) documented.add(match[1]!);
  }

  const exported = collectExports(rootDir);

  const missing = [...exported].filter((name) => !documented.has(name));
  const stale = [...documented].filter((name) => !exported.has(name));
  if (missing.length > 0 || stale.length > 0) {
    const problems = [
      missing.length > 0 && `missing from the table: ${missing.join(", ")}`,
      stale.length > 0 && `in the table but not exported from src/index.ts: ${stale.join(", ")}`,
    ].filter(Boolean);
    throw new Error(`API Reference table is out of sync with src/index.ts — ${problems.join("; ")}`);
  }

  const headingSlugs = new Set<string>();
  for (const match of readme.matchAll(/^#{1,6}\s+(.*)$/gm)) {
    headingSlugs.add(slugify(match[1]!));
  }
  for (const match of section.matchAll(/\]\(#([\w-]+)\)/g)) {
    if (!headingSlugs.has(match[1]!)) {
      throw new Error(`API Reference links to #${match[1]} but no heading produces that anchor`);
    }
  }
}

// Reads the exported symbol names (values and types) from src/index.ts. The
// entry point re-exports everything through `export { … } from` / `export type
// { … } from` blocks, so the names can be read straight out of the braces.
function collectExports(rootDir: string): Set<string> {
  const source = readFileSync(join(rootDir, "src", "index.ts"), "utf-8");
  const names = new Set<string>();
  for (const match of source.matchAll(/export\s+(?:type\s+)?\{([^}]*)\}\s*from/g)) {
    for (const raw of match[1]!.split(",")) {
      const name = raw
        .trim()
        .replace(/^type\s+/, "")
        .split(/\s+as\s+/)
        .pop()!
        .trim();
      if (name) names.add(name);
    }
  }
  return names;
}

function extractSection(readme: string, heading: string): string | null {
  const start = readme.search(new RegExp(`^##\\s+${escapeRegExp(heading)}\\s*$`, "m"));
  if (start === -1) return null;
  const rest = readme.slice(start);
  const next = rest.slice(1).search(/^##\s+/m);
  return next === -1 ? rest : rest.slice(0, next + 1);
}

// Mirrors GitHub's heading-anchor slugging: lowercase, drop characters that are
// not word/space/hyphen, then turn runs of whitespace into single hyphens.
function slugify(heading: string): string {
  return heading
    .trim()
    .toLowerCase()
    .replace(/[^\w\s-]/g, "")
    .replace(/\s+/g, "-");
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
