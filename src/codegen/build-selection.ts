import { z } from "zod";
import { zodqlField } from "../zodql-field-builder.js";
import type { ZodqlQueryFragment } from "../types.js";
import type { ApplyWrappers, Wrapper } from "./pick.js";

/**
 * What a generated module knows about one field: how to build its base schema
 * and which GraphQL type modifiers to wrap it in.
 *
 * An `"object"` field has no base schema of its own — the caller supplies the
 * child selection, which is the whole point of one-builder-per-type.
 */
export type FieldDef =
  | { readonly kind: "leaf"; readonly schema: () => z.ZodType; readonly wrappers: readonly Wrapper[] }
  | { readonly kind: "object"; readonly wrappers: readonly Wrapper[] };

/** The reserved key carrying per-implementor selections on a union or interface. */
export const ON_KEY = "__on";

/**
 * Apply a field's GraphQL type modifiers to its base schema.
 *
 * Wrappers are listed outermost-first, so this folds from the right: for
 * `["nullable", "array"]` (`[Foo!]`) it builds `z.array(base).nullable()`.
 *
 * The type-level twin is {@link ApplyWrappers}; the two must stay in lockstep.
 */
export function applyWrappers<const Wrappers extends readonly Wrapper[], Schema extends z.ZodType>(
  wrappers: Wrappers,
  schema: Schema
): ApplyWrappers<Wrappers, Schema> {
  return wrappers.reduceRight<z.ZodType>(
    (acc, wrapper) => (wrapper === "nullable" ? acc.nullable() : z.array(acc)),
    schema
  ) as ApplyWrappers<Wrappers, Schema>;
}

/**
 * Turn a pick object into the Zod shape for one field's selection.
 *
 * The type system already rejects the mistakes this guards against; the runtime
 * checks exist so a JavaScript caller — or a pick built dynamically — fails with
 * something readable instead of producing a malformed query.
 */
function buildShape(defs: Record<string, FieldDef>, pick: object, typeName: string): Record<string, z.ZodType> {
  // Mutable: `z.ZodRawShape` is Readonly, so it can only be the input type.
  const shape: Record<string, z.ZodType> = {};

  for (const [fieldName, value] of Object.entries(pick)) {
    if (fieldName === ON_KEY || value === undefined || value === false) continue;

    const def = defs[fieldName];
    if (!def) {
      throw new Error(`Unknown field "${fieldName}" on type "${typeName}".`);
    }

    if (def.kind === "object") {
      if (value === true) {
        throw new Error(
          `Field "${fieldName}" on type "${typeName}" selects an object type, so it needs a selection ` +
            `built with that type's builder rather than \`true\`.`
        );
      }
      shape[fieldName] = applyWrappers(def.wrappers, value as z.ZodType);
      continue;
    }

    shape[fieldName] = applyWrappers(def.wrappers, value === true ? def.schema() : (value as z.ZodType));
  }

  if (Object.keys(shape).length === 0) {
    throw new Error(`A selection on type "${typeName}" must pick at least one field.`);
  }

  return shape;
}

/**
 * Build a selection on a GraphQL object type from a pick object.
 *
 * The result is a plain `z.object()` — the brand that distinguishes one type's
 * selection from another's is purely type-level, so nothing is attached here.
 */
export function buildObjectSelection(defs: Record<string, FieldDef>, pick: object, typeName: string): z.ZodObject {
  return z.object(buildShape(defs, pick, typeName));
}

/**
 * Build a selection on a GraphQL union or interface type.
 *
 * Fields picked directly are the ones every implementor shares (an interface's
 * own fields; for a union, nothing but `__typename`). Entries under `__on` are
 * per-implementor selections, attached as **inline** fragments.
 *
 * Inline rather than named is deliberate: named fragments are de-duplicated by
 * name across a document, so a generator that synthesised names would silently
 * emit the wrong selection when the same union is picked twice with different
 * fields.
 */
export function buildAbstractSelection(
  defs: Record<string, FieldDef>,
  pick: object & { [ON_KEY]?: Record<string, z.ZodObject> },
  typeName: string,
  options: { requireOne: boolean; args?: Record<string, string>; alias?: string }
): z.ZodType {
  const on = pick[ON_KEY] ?? {};
  const fragments: ZodqlQueryFragment[] = Object.entries(on).map(([implementor, schema]) => ({
    on: implementor,
    inline: true,
    schema,
  }));

  // Only the common fields form the base object; `__on` is handled by the
  // fragments. An abstract selection with no common fields is legitimate (a
  // bare union), and `__typename` is added by the compiler in that case.
  const commonShape: Record<string, z.ZodType> = hasSelectableFields(pick) ? buildShape(defs, pick, typeName) : {};

  if (fragments.length === 0) {
    throw new Error(
      `A selection on abstract type "${typeName}" must select at least one implementor under \`${ON_KEY}\`.`
    );
  }

  // The non-empty-shape guard on `withUnionFragments` can't see through a
  // fragment list built at runtime, so it collapses to its error branch. The
  // generator guarantees every implementor selection is non-empty.
  // Arguments and aliases are taken here rather than by wrapping the result in
  // `zodqlField().toSchema()`, the way object selections do it: an abstract
  // selection parses through a discriminated union, so it is not a ZodObject
  // and re-wrapping it would silently discard the union metadata.
  let builder = zodqlField();
  if (options.args) builder = builder.withArguments(options.args);
  if (options.alias !== undefined) builder = builder.asAliasFor(options.alias);

  const withUnion = builder as unknown as {
    withUnionFragments: (
      fragments: ZodqlQueryFragment[],
      unionOptions: { requireOne: boolean }
    ) => { toSchema: (schema: z.ZodObject) => z.ZodType };
  };

  return withUnion.withUnionFragments(fragments, { requireOne: options.requireOne }).toSchema(z.object(commonShape));
}

function hasSelectableFields(pick: object): boolean {
  return Object.entries(pick).some(([key, value]) => key !== ON_KEY && value !== undefined && value !== false);
}
