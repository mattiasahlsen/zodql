import type { z } from "zod";

/**
 * Phantom key used to tag a selection schema with the name of the GraphQL type
 * it selects on. It only ever exists in the type system — no runtime value is
 * ever created for it.
 */
declare const SELECTION_BRAND: unique symbol;

/**
 * A Zod object `Config` carrying the GraphQL type name.
 *
 * This is structurally `z.core.$strip` (what a plain `z.object()` gets) plus one
 * phantom property. Two things follow, and both are load-bearing:
 *
 * - `ZodObject` threads `Config` through `.extend()`, `.pick()`, `.omit()`,
 *   `.partial()` and `.required()`, so the brand survives those.
 * - `z.infer` reads only `Config["out"]`, so the brand never appears in the
 *   inferred output type.
 */
export type GqlObjectConfig<Name extends string> = {
  out: {};
  in: {};
  readonly [SELECTION_BRAND]: Name;
};

/**
 * A selection on a GraphQL object type `Name`.
 *
 * This is a real `ZodObject`, so everything Zod can do to an object schema
 * works here — notably `.extend()`, which is how aliased and argument-carrying
 * fields are added to a generated selection.
 *
 * Because `Config` is covariant, a selection on one type is not assignable to a
 * selection on another; a plain `z.object()` (which gets `z.core.$strip`) is not
 * assignable to either. The reverse *is* allowed: a branded selection can be
 * passed anywhere a plain `ZodObject` is expected, which is what lets it flow
 * into `zodql()` and `zodqlField().toSchema()`.
 */
export type ObjectSelection<Name extends string, Shape extends z.core.$ZodShape = z.core.$ZodLooseShape> = z.ZodObject<
  Shape,
  GqlObjectConfig<Name>
>;

/**
 * A selection on a GraphQL union or interface type `Name`.
 *
 * Unlike {@link ObjectSelection} this is not a `ZodObject` — a union selection
 * parses through a discriminated union on `__typename`, so `.extend()` and the
 * other object combinators are unavailable on it.
 */
export type AbstractSelection<Name extends string, Output = any> = z.ZodType<Output> & {
  readonly [SELECTION_BRAND]: Name;
};

/**
 * Adopt a hand-written schema as a selection on `Name`.
 *
 * The deliberate escape hatch for the cases the generated builders can't
 * express. Nothing checks that `schema` actually matches the shape of `Name` —
 * that is the caller's responsibility.
 */
export function asSelectionOf<Name extends string, Schema extends z.ZodObject>(
  schema: Schema
): ObjectSelection<Name, Schema["shape"]> {
  return schema as unknown as ObjectSelection<Name, Schema["shape"]>;
}
