import { relative } from "node:path";
import { buildIr } from "./ir.js";
import { filterIr } from "./filter.js";
import { loadSchema } from "./load-schema.js";
import { assignFileNames, builderName } from "./filenames.js";
import { emitObjectType, moduleSpecifier, type EmitContext } from "./emit-object-type.js";
import { emitAbstractType } from "./emit-abstract-type.js";
import { emitEnum } from "./emit-enum.js";
import { emitScalarNames, emitScalarsSeed } from "./emit-scalars.js";
import { createFormatter } from "./format.js";
import { banner } from "./emit-shared.js";
import type { CodegenOptions, GeneratedFile } from "./types.js";

export const SCALARS_SEED_FILE = "scalars.ts";
export const SCALARS_GENERATED_FILE = "scalars.generated.ts";

/**
 * Produce every file the output directory should contain.
 *
 * Nothing is written here — {@link writeFiles} decides what lands on disk, so
 * the same code path serves both generation and the `--check` drift test.
 */
export async function generate(options: CodegenOptions): Promise<GeneratedFile[]> {
  const schema = await loadSchema(options.schema);
  const ir = filterIr(buildIr(schema), options);

  const typeNames = ir.types.map((type) => type.name);
  const fileNames = assignFileNames(typeNames);
  const context: EmitContext = {
    schemaSource: describeSource(options),
    fileNames,
    emitted: new Set(typeNames),
    brandNamespace: options.brandNamespace,
  };

  const files: GeneratedFile[] = [
    { path: SCALARS_GENERATED_FILE, contents: emitScalarNames(ir, context.schemaSource) },
    {
      path: SCALARS_SEED_FILE,
      contents: emitScalarsSeed(ir, options.defaultScalar ?? "string"),
      seeded: true,
    },
  ];

  for (const type of ir.types) {
    const path = fileNames.get(type.name);
    if (path === undefined) continue;

    const contents =
      type.kind === "object"
        ? emitObjectType(type, context)
        : type.kind === "abstract"
          ? emitAbstractType(type, context)
          : emitEnum(type, context.schemaSource);

    files.push({ path, contents });
  }

  if (options.barrel) {
    files.push({
      path: "index.ts",
      contents: emitBarrel(
        ir.types.map((type) => type.name),
        context
      ),
    });
  }

  const format = await createFormatter(options.out, options.format ?? true);
  return Promise.all(files.map(async (file) => ({ ...file, contents: await format(file.contents, file.path) })));
}

/**
 * Off by default: a barrel re-exporting 1,100 modules would undo the main
 * reason generated files import nothing from each other — that `tsc` only loads
 * what you actually use.
 */
function emitBarrel(typeNames: readonly string[], context: EmitContext): string {
  const lines = typeNames.map((name) => `export * from "./${moduleSpecifier(context, name)}";`);
  return [banner(context.schemaSource), "", ...lines, ""].join("\n");
}

function describeSource(options: CodegenOptions): string {
  return options.schema.map((path) => relative(options.out, path) || path).join(", ");
}

export { builderName };
