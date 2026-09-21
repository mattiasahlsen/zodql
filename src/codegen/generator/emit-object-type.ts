import type { FieldIr, TypeIr } from "./types.js";
import { banner, fieldDoc, indent, jsDoc, quote, withDoc } from "./emit-shared.js";
import { builderName, fieldsConstName } from "./filenames.js";

export interface EmitContext {
  readonly schemaSource: string;
  /** GraphQL type name -> emitted filename, from `assignFileNames`. */
  readonly fileNames: ReadonlyMap<string, string>;
  /** Types being emitted; a field referencing anything else is dropped. */
  readonly emitted: ReadonlySet<string>;
  readonly brandNamespace: string | undefined;
}

export function brandOf(context: EmitContext, typeName: string): string {
  return quote(context.brandNamespace ? `${context.brandNamespace}:${typeName}` : typeName);
}

/** Drop fields whose named type was filtered out, so generated code always compiles. */
export function selectableFields(type: { fields: readonly FieldIr[] }, context: EmitContext): FieldIr[] {
  return type.fields.filter((field) => field.kind === "scalar" || context.emitted.has(field.namedType));
}

/**
 * The pick-property type for one field.
 *
 * Shared with {@link emitAbstractType}: an interface's common fields are just
 * fields, so they can be object- or enum-typed exactly like an object type's.
 */
export function pickType(field: FieldIr, context: EmitContext): string {
  if (field.kind === "object") return `ObjectSelection<${brandOf(context, field.namedType)}>`;
  if (field.kind === "abstract") return `AbstractSelection<${brandOf(context, field.namedType)}>`;
  return "LeafPick";
}

/** The default schema's *type*, used in the `Defaults` interface. */
export function defaultSchemaType(field: FieldIr): string {
  if (field.kind === "object" || field.kind === "abstract") return "never";
  if (field.kind === "enum") return `typeof ${field.namedType}`;
  return `(typeof scalars)[${quote(field.namedType)}]`;
}

/** The default schema's *value*, used in the runtime field table. */
function defaultSchemaValue(field: FieldIr): string {
  if (field.kind === "enum") return field.namedType;
  return `scalars.${field.namedType}`;
}

export function fieldDefEntry(field: FieldIr): string {
  const wrappers = `[${field.wrappers.map(quote).join(", ")}]`;
  if (field.kind === "object" || field.kind === "abstract") {
    return `${field.name}: { kind: "object", wrappers: ${wrappers} },`;
  }
  return `${field.name}: { kind: "leaf", schema: () => ${defaultSchemaValue(field)}, wrappers: ${wrappers} },`;
}

/**
 * Work out the imports a module needs.
 *
 * `noUnusedLocals` is on for the whole repo, so an import that isn't referenced
 * is a build error rather than a wart — this has to be exact.
 */
export function importsFor(
  fields: readonly FieldIr[],
  context: EmitContext,
  options: { typenameLiteral: boolean; abstract: boolean; hasImplementors?: boolean }
): string {
  const usesScalars = fields.some((field) => field.kind === "scalar");
  // `z` is referenced only by the `__typename` literal — scalars come through
  // the `scalars` table and enums through their own module.
  const usesZod = options.typenameLiteral;
  const enums = [...new Set(fields.filter((field) => field.kind === "enum").map((field) => field.namedType))].sort();

  const runtime = options.abstract ? "buildAbstractSelection" : "buildObjectSelection";
  const types = [
    "type ApplyWrappers",
    "type FieldDef",
    ...(fields.some((field) => field.kind === "abstract") || options.abstract ? ["type AbstractSelection"] : []),
    ...(options.abstract ? ["type AbstractOutput"] : []),
    ...(fields.some((field) => field.kind !== "object" && field.kind !== "abstract") || options.typenameLiteral
      ? ["type LeafPick"]
      : []),
    "type NoExcessPick",
    "type NonEmptyPick",
    // An abstract type needs ObjectSelection for its `__on` members even when
    // none of its own common fields are object-typed.
    ...(fields.some((field) => field.kind === "object") || !options.abstract || options.hasImplementors
      ? ["type ObjectSelection"]
      : []),
    "type ResolveLeaf",
  ].sort();

  const lines = [
    ...(usesZod ? ['import { z } from "zod";'] : []),
    `import {\n  ${runtime},\n${[...types].map((entry) => `  ${entry},`).join("\n")}\n} from "@mattiasahlsen/zodql/codegen";`,
    ...(usesScalars ? ['import { scalars } from "./scalars.js";'] : []),
    ...enums.map((name) => `import { ${name} } from "./${moduleSpecifier(context, name)}";`),
  ];
  return lines.join("\n");
}

/** Import specifier for a sibling generated module, honouring disambiguated filenames. */
export function moduleSpecifier(context: EmitContext, typeName: string): string {
  const fileName = context.fileNames.get(typeName) ?? `${typeName}.ts`;
  return fileName.replace(/\.ts$/, ".js");
}

export function emitObjectType(type: Extract<TypeIr, { kind: "object" }>, context: EmitContext): string {
  const { name } = type;
  const fields = selectableFields(type, context);
  const doc = jsDoc([type.description]);

  // `__typename` is selectable on every object type, and for a concrete type its
  // value is known exactly — more precise than the `string` a hand-written
  // schema would give you.
  const typenameDefault = `z.ZodLiteral<${quote(name)}>`;

  const pickMembers = [
    "readonly __typename?: LeafPick;",
    ...fields.map((field) => withDoc(fieldDoc(field), `readonly ${field.name}?: ${pickType(field, context)};`)),
  ];

  const defaults = [
    "__typename: " + typenameDefault + ";",
    ...fields.map((f) => `${f.name}: ${defaultSchemaType(f)};`),
  ];
  const wrappers = [
    "__typename: readonly [];",
    ...fields.map((f) => `${f.name}: readonly [${f.wrappers.map(quote).join(", ")}];`),
  ];
  const table = [
    `__typename: { kind: "leaf", schema: () => z.literal(${quote(name)}), wrappers: [] },`,
    ...fields.map(fieldDefEntry),
  ];

  return [
    banner(context.schemaSource),
    importsFor(fields, context, { typenameLiteral: true, abstract: false }),
    "",
    withDoc(doc, `export type ${name}Pick = {\n${indent(pickMembers.join("\n"))}\n};`),
    "",
    `interface ${name}Defaults {\n${indent(defaults.join("\n"))}\n}`,
    "",
    `interface ${name}Wrappers {\n${indent(wrappers.join("\n"))}\n}`,
    "",
    `type ${name}Shape<P extends ${name}Pick> = {\n` +
      `  [K in Extract<keyof P, keyof ${name}Pick>]: ApplyWrappers<${name}Wrappers[K], ResolveLeaf<P[K], ${name}Defaults[K]>>;\n};`,
    "",
    `const ${fieldsConstName(name)} = {\n${indent(table.join("\n"))}\n} as const satisfies Record<keyof ${name}Pick, FieldDef>;`,
    "",
    withDoc(
      doc,
      `export function ${builderName(name)}<const P extends ${name}Pick>(\n` +
        `  pick: P & NonEmptyPick<P> & NoExcessPick<P, ${name}Pick>\n` +
        `): ObjectSelection<${brandOf(context, name)}, ${name}Shape<P>> {\n` +
        `  return buildObjectSelection(${fieldsConstName(name)}, pick as P, ${quote(name)}) as never;\n}`
    ),
    "",
  ].join("\n");
}
