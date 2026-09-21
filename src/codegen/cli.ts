import { parseArgs } from "node:util";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { generate } from "./generator/generate.js";
import { checkFiles, writeFiles } from "./generator/write.js";
import type { CodegenOptions } from "./generator/types.js";

const USAGE = `zodql-codegen — generate Zod selection builders from a GraphQL schema

Usage:
  zodql-codegen --schema <path> --out <dir> [options]

Options:
  --schema <path>      SDL file or introspection JSON. Repeatable.
  --out <dir>          Output directory. One directory per schema.
  --include <name>     Root type to keep; everything reachable from it is kept.
                       Repeatable. Supports "*". Default: every type.
  --exclude <name>     Drop a type after the reachable set is computed. Repeatable.
  --max-depth <n>      Cap how far --include follows references.
  --default-scalar <s> "string" (default) or "unknown", for the scalars.ts seed.
  --brand-namespace <s>  Prefix type-name brands, for two schemas in one project.
  --barrel             Also emit an index.ts re-exporting every module.
  --no-format          Skip Prettier.
  --force              Write into a non-empty directory this tool didn't create.
  --check              Report drift and exit 1 instead of writing.
  --config <path>      JSON config; command-line flags win.
  --help
`;

interface CliOptions extends CodegenOptions {
  readonly check: boolean;
  readonly force: boolean;
}

export async function resolveOptions(argv: readonly string[]): Promise<CliOptions | "help"> {
  const { values } = parseArgs({
    args: [...argv],
    options: {
      schema: { type: "string", multiple: true },
      out: { type: "string" },
      include: { type: "string", multiple: true },
      exclude: { type: "string", multiple: true },
      "max-depth": { type: "string" },
      "default-scalar": { type: "string" },
      "brand-namespace": { type: "string" },
      barrel: { type: "boolean" },
      format: { type: "boolean", default: true },
      force: { type: "boolean" },
      check: { type: "boolean" },
      config: { type: "string" },
      help: { type: "boolean" },
    },
    strict: true,
    allowNegative: true,
  });

  if (values.help) return "help";

  const fromFile = values.config === undefined ? {} : await readConfig(values.config);
  const schema = values.schema ?? asStringArray(fromFile["schema"]);
  const out = values.out ?? asString(fromFile["out"]);

  if (schema.length === 0) throw new Error("Missing --schema. See --help.");
  if (out === undefined) throw new Error("Missing --out. See --help.");

  const defaultScalar = values["default-scalar"] ?? asString(fromFile["defaultScalar"]);
  if (defaultScalar !== undefined && defaultScalar !== "string" && defaultScalar !== "unknown") {
    throw new Error(`--default-scalar must be "string" or "unknown", got "${defaultScalar}".`);
  }

  // Unvalidated, `Number("abc")` is NaN, and `depth <= NaN` is false on the
  // first iteration of the closure walk in `filterIr` — so a typo here would
  // silently emit nothing but `scalars.ts` and exit 0.
  const maxDepth = values["max-depth"] ?? asString(fromFile["maxDepth"]);
  if (maxDepth !== undefined && (!Number.isInteger(Number(maxDepth)) || Number(maxDepth) < 0)) {
    throw new Error(`--max-depth must be a non-negative integer, got "${maxDepth}".`);
  }

  return {
    schema: schema.map((path) => resolve(path)),
    out: resolve(out),
    include: values.include ?? asStringArray(fromFile["include"]),
    exclude: values.exclude ?? asStringArray(fromFile["exclude"]),
    ...(maxDepth === undefined ? {} : { maxDepth: Number(maxDepth) }),
    ...(defaultScalar === undefined ? {} : { defaultScalar }),
    ...(asString(fromFile["brandNamespace"]) === undefined && values["brand-namespace"] === undefined
      ? {}
      : { brandNamespace: values["brand-namespace"] ?? asString(fromFile["brandNamespace"])! }),
    barrel: values.barrel ?? Boolean(fromFile["barrel"]),
    format: values.format,
    check: values.check ?? false,
    force: values.force ?? false,
  };
}

async function readConfig(path: string): Promise<Record<string, unknown>> {
  const parsed: unknown = JSON.parse(await readFile(path, "utf8"));
  if (typeof parsed !== "object" || parsed === null) {
    throw new Error(`${path} must contain a JSON object.`);
  }
  return parsed as Record<string, unknown>;
}

function asString(value: unknown): string | undefined {
  return typeof value === "string" ? value : typeof value === "number" ? String(value) : undefined;
}

function asStringArray(value: unknown): string[] {
  if (typeof value === "string") return [value];
  return Array.isArray(value) ? value.filter((entry): entry is string => typeof entry === "string") : [];
}

/**
 * Run the CLI, reporting anything that goes wrong as a message rather than a
 * stack trace.
 *
 * Everything the user can get wrong — a missing flag, an unreadable schema, a
 * syntax error in SDL, an output directory this tool didn't create — surfaces
 * as a thrown `Error` with a message written for them, so the whole run is
 * wrapped rather than just option parsing.
 */
export async function main(argv: readonly string[], log = console.log): Promise<number> {
  try {
    return await run(argv, log);
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    return 1;
  }
}

async function run(argv: readonly string[], log: typeof console.log): Promise<number> {
  const options = await resolveOptions(argv);

  if (options === "help") {
    log(USAGE);
    return 0;
  }

  const files = await generate(options);

  if (options.check) {
    const result = await checkFiles(options.out, files);
    if (result.ok) {
      log(`zodql codegen: ${files.length} files up to date.`);
      return 0;
    }
    for (const path of result.added) log(`  added:   ${path}`);
    for (const path of result.changed) log(`  changed: ${path}`);
    for (const path of result.removed) log(`  removed: ${path}`);
    console.error("zodql codegen: generated output is out of date. Re-run without --check.");
    return 1;
  }

  const result = await writeFiles(options.out, files, { force: options.force });
  log(
    `zodql codegen: ${result.written.length} written, ${result.unchanged.length} unchanged` +
      (result.deleted.length > 0 ? `, ${result.deleted.length} stale removed` : "") +
      (result.skipped.length > 0 ? `, ${result.skipped.length} user-owned left alone` : "")
  );
  return 0;
}
