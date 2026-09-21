import type { TypeIr } from "./types.js";
import { banner, fieldDoc, indent, jsDoc, quote, withDoc } from "./emit-shared.js";
import { builderName, fieldsConstName } from "./filenames.js";
import {
  brandOf,
  defaultSchemaType,
  fieldDefEntry,
  importsFor,
  pickType,
  selectableFields,
  type EmitContext,
} from "./emit-object-type.js";

/**
 * Emit a builder for a union or interface.
 *
 * Fields picked directly are the ones every implementor shares (an interface's
 * own fields; nothing, for a union). Per-implementor selections go under the
 * reserved `__on` key — reserved because GraphQL forbids `__` prefixes on real
 * field names, so it can never collide.
 *
 * A common field is an ordinary field, so it can be object- or enum-typed just
 * like an object type's — hence the shared `pickType` / `defaultSchemaType` /
 * `fieldDefEntry` helpers rather than a scalars-only shortcut.
 *
 * `__typename` is deliberately absent from the pick: the compiler always adds
 * it, and its value is the discriminator, so it appears in the output type
 * whether or not it was asked for.
 */
export function emitAbstractType(type: Extract<TypeIr, { kind: "abstract" }>, context: EmitContext): string {
  const { name } = type;
  const fields = selectableFields(type, context);
  const implementors = type.implementors.filter((implementor) => context.emitted.has(implementor));
  const doc = jsDoc([type.description]);

  const onMembers = implementors.map(
    (implementor) => `readonly ${implementor}?: ObjectSelection<${brandOf(context, implementor)}>;`
  );

  const pickMembers = [
    ...fields.map((field) => withDoc(fieldDoc(field), `readonly ${field.name}?: ${pickType(field, context)};`)),
    withDoc(
      jsDoc(["Per-implementor selections, spread as inline fragments."]),
      `readonly __on?: {\n${indent(onMembers.join("\n"))}\n};`
    ),
  ];

  const commonKeys = `Exclude<Extract<keyof P, keyof ${name}Pick>, "__on">`;

  const body = [
    banner(context.schemaSource),
    importsFor(fields, context, { typenameLiteral: false, abstract: true, hasImplementors: implementors.length > 0 }),
    "",
    withDoc(doc, `export type ${name}Pick = {\n${indent(pickMembers.join("\n"))}\n};`),
    "",
    `interface ${name}Defaults {\n${indent(fields.map((f) => `${f.name}: ${defaultSchemaType(f)};`).join("\n"))}\n}`,
    "",
    `interface ${name}Wrappers {\n${indent(fields.map((f) => `${f.name}: readonly [${f.wrappers.map(quote).join(", ")}];`).join("\n"))}\n}`,
    "",
    `type ${name}CommonShape<P extends ${name}Pick> = {\n` +
      `  [K in ${commonKeys}]: ApplyWrappers<${name}Wrappers[K], ResolveLeaf<P[K], ${name}Defaults[K]>>;\n};`,
    "",
    `const ${fieldsConstName(name)} = {\n${indent(
      fields.map(fieldDefEntry).join("\n")
    )}\n} as const satisfies Record<Exclude<keyof ${name}Pick, "__on">, FieldDef>;`,
    "",
    withDoc(
      doc,
      `export function ${builderName(name)}<const P extends ${name}Pick, RequireOne extends boolean = false>(\n` +
        `  pick: P &\n` +
        `    NonEmptyPick<P> &\n` +
        `    NoExcessPick<P, ${name}Pick> & {\n` +
        // `__on`'s members are a nested literal, which is contextually typed by
        // `P` — inferred from that same literal — so the outer guard can't see
        // them. Without this an unknown implementor compiles and silently emits
        // `... on Bogus { … }`.
        `      readonly __on?: NoExcessPick<P["__on"], NonNullable<${name}Pick["__on"]>>;\n` +
        `    },\n` +
        `  options?: {\n` +
        `    readonly requireOne?: RequireOne;\n` +
        `    readonly args?: Record<string, string>;\n` +
        `    readonly alias?: string;\n` +
        `  }\n` +
        `): AbstractSelection<${brandOf(context, name)}, AbstractOutput<${name}CommonShape<P>, P["__on"], RequireOne>> {\n` +
        `  return buildAbstractSelection(${fieldsConstName(name)}, pick as P, ${quote(name)}, {\n` +
        `    requireOne: options?.requireOne ?? false,\n` +
        `    ...(options?.args ? { args: options.args } : {}),\n` +
        `    ...(options?.alias === undefined ? {} : { alias: options.alias }),\n` +
        `  }) as never;\n}`
    ),
    "",
  ];

  return body.join("\n");
}
