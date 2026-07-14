/**
 * Print the compiled GraphQL query exported by each given README example in
 * `./readme/`, as a JSON map from example name to query string. Used by
 * `scripts/generate-readme.js` to embed the compiled queries in `README.md`.
 *
 * Run via tsx with the examples tsconfig so `@mattiasahlsen/zodql` resolves to
 * the library source:
 *
 *   npx tsx --tsconfig examples/tsconfig.json examples/print-readme-queries.ts <name...>
 */

function isCompiledQuery(value: unknown): value is { queryString: string } {
  return (
    typeof value === "object" && value !== null && typeof (value as { queryString?: unknown }).queryString === "string"
  );
}

const names = process.argv.slice(2);
const queries: Record<string, string> = {};

for (const name of names) {
  const moduleUrl = new URL(`./readme/${name}.ts`, import.meta.url).href;
  const exampleModule = (await import(moduleUrl)) as Record<string, unknown>;

  const compiledQueries = Object.values(exampleModule).filter(isCompiledQuery);
  if (compiledQueries.length !== 1) {
    throw new Error(
      `Expected examples/readme/${name}.ts to export exactly one compiled query ` +
        `(an object with a \`queryString\` string), found ${compiledQueries.length}.`
    );
  }
  queries[name] = compiledQueries[0]!.queryString;
}

console.log(JSON.stringify(queries));
