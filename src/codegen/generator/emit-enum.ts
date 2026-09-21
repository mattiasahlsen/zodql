import type { TypeIr } from "./types.js";
import { banner, jsDoc, quote, withDoc } from "./emit-shared.js";

/**
 * Emit a GraphQL enum as a `z.enum`.
 *
 * This is the one place a generated module imports another: a consuming type
 * imports the enum for its runtime value. Enum modules are acyclic leaves, so
 * this can't reintroduce the circular-type problem that string-literal brands
 * exist to avoid.
 */
export function emitEnum(type: Extract<TypeIr, { kind: "enum" }>, schemaSource: string): string {
  const doc = jsDoc([type.description]);
  const values = type.values.map((value) => quote(value.name)).join(", ");

  const deprecated = type.values.filter((value) => value.deprecationReason !== undefined);
  const deprecationNote =
    deprecated.length > 0
      ? jsDoc([
          type.description,
          "",
          "@remarks Deprecated values still present in the schema: " +
            deprecated.map((value) => `\`${value.name}\` (${value.deprecationReason})`).join(", "),
        ])
      : doc;

  return [
    banner(schemaSource),
    'import { z } from "zod";',
    "",
    withDoc(deprecationNote, `export const ${type.name} = z.enum([${values}]);`),
    "",
    withDoc(doc, `export type ${type.name} = z.infer<typeof ${type.name}>;`),
    "",
  ].join("\n");
}
