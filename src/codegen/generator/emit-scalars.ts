import type { SchemaIr } from "./types.js";
import { banner, quote } from "./emit-shared.js";

/** Zod schemas for GraphQL's built-in scalars. Everything else defaults per `defaultScalar`. */
const BUILT_IN_SCHEMAS: Record<string, string> = {
  Boolean: "z.boolean()",
  Float: "z.number()",
  ID: "z.string()",
  Int: "z.number().int()",
  String: "z.string()",
};

/**
 * The managed half of the scalar mapping: the set of names `scalars.ts` must
 * cover. A scalar added to the schema therefore becomes a compile error in
 * `scalars.ts` rather than silently parsing as a string.
 */
export function emitScalarNames(ir: SchemaIr, schemaSource: string): string {
  const names = ir.scalars.map((scalar) => quote(scalar.name)).join(" | ");
  return [
    banner(schemaSource),
    "",
    "/**",
    " * Every scalar in the schema. `scalars.ts` is checked against this with",
    " * `satisfies`, so a scalar added to the schema becomes a compile error there",
    " * rather than silently parsing as a string.",
    " */",
    `export type ScalarName = ${names};`,
    "",
  ].join("\n");
}

/**
 * The seeded half: written once, then owned by the user.
 *
 * Never overwritten, never deleted, and excluded from the drift check — this is
 * where "validation beyond the GraphQL schema" lives, so the generator must not
 * clobber a `z.string().url()` someone wrote here.
 */
export function emitScalarsSeed(ir: SchemaIr, defaultScalar: "string" | "unknown"): string {
  const fallback = defaultScalar === "unknown" ? "z.unknown()" : "z.string()";

  const entries = ir.scalars.map((scalar) => {
    const builtIn = BUILT_IN_SCHEMAS[scalar.name];
    // The spec's own descriptions for Int/String/Boolean are long and say
    // nothing a reader of this file needs; a custom scalar's description is
    // exactly the context someone needs to refine its schema.
    const description = builtIn === undefined ? scalar.description : undefined;
    const comment = description === undefined ? "" : `  // ${description.replaceAll("\n", " ")}\n`;
    return `${comment}  ${scalar.name}: ${builtIn ?? fallback},`;
  });

  return [
    "// Seeded once by @mattiasahlsen/zodql codegen, then yours to edit.",
    "// Regenerating never overwrites this file.",
    "//",
    "// Each entry is the Zod schema a GraphQL scalar parses to. Refine them freely —",
    '// this is where "validation beyond the GraphQL schema" lives.',
    'import { z } from "zod";',
    'import type { ScalarName } from "./scalars.generated.js";',
    "",
    "export const scalars = {",
    ...entries,
    "} as const satisfies Record<ScalarName, z.ZodType>;",
    "",
  ].join("\n");
}
