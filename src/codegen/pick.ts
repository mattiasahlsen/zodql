import type { z } from "zod";

/**
 * The value a pick object may carry for a scalar or enum field: `true` to take
 * the generated default schema, or any Zod schema to replace it.
 *
 * The `{ shape?: never }` half rejects an object selection in a scalar slot —
 * `ZodObject` declares a required `shape`, so it cannot satisfy it.
 */
export type LeafPick = true | (z.ZodType & { shape?: never });

/**
 * Rejects an empty pick, since a GraphQL selection set must select something.
 *
 * Note this cannot use the `{} extends Shape` trick that guards empty fragment
 * shapes in `zodql-field-builder.ts` — a pick object's properties are all
 * optional, so `{} extends { name?: true }` is *true* and that guard would
 * reject every valid pick.
 */
export type NonEmptyPick<P> = [keyof P] extends [never] ? "Error: a selection must pick at least one field" : unknown;

/**
 * Rejects keys the GraphQL type doesn't have, so a typo is a compile error
 * rather than a runtime throw out of `buildShape`.
 *
 * Neither guard a builder already has catches one. Excess-property checking
 * compares the argument against the parameter type, which is `P` — inferred
 * from that same argument — so nothing in it is ever "excess". And `P extends
 * XPick` doesn't reject a wider object either, since every property of `XPick`
 * is optional. The only thing that fires unaided is TypeScript's weak-type
 * rule, and that needs *zero* keys in common: `{ Login: true }` is caught,
 * `{ login: true, bioo: true }` is not.
 *
 * Intersecting this into the parameter closes the gap, the same way
 * {@link NonEmptyPick} does: with an excess key present this resolves to a
 * string, nothing satisfies `P & string`, and the offending key is named in the
 * message.
 *
 * It has to be a conditional rather than the more obvious mapped type
 * (`{ [K in Exclude<keyof P, keyof Pick_>]: never }`). That form works, but a
 * mapped type over `P` in a parameter position is an inference site, and with a
 * non-`never` property type it drags every key of `P` into the failure — a
 * one-key typo then reports an error on each valid field alongside it.
 */
export type NoExcessPick<P, Pick_> = [Exclude<keyof P, keyof Pick_>] extends [never]
  ? unknown
  : `Error: no such field on this type: ${Extract<Exclude<keyof P, keyof Pick_>, string>}`;

/** Resolve a pick value to a schema: `true` takes `Default`, a schema replaces it. */
export type ResolveLeaf<Value, Default extends z.ZodType> = [Exclude<Value, undefined>] extends [z.ZodType]
  ? Extract<Value, z.ZodType>
  : Default;

/**
 * A GraphQL type modifier, listed outermost-first:
 * `[Foo!]` is `["nullable", "array"]`, `[Foo]!` is `["array", "nullable"]`.
 */
export type Wrapper = "nullable" | "array";

/**
 * The output type of a selection's common fields.
 *
 * An empty shape has to become `unknown` rather than `z.infer<z.ZodObject<{}>>`:
 * zod infers the latter as `Record<string, never>`, which would poison every
 * intersection it takes part in. `unknown & T` is just `T`.
 */
type CommonOutput<Shape extends z.core.$ZodShape> = [keyof Shape] extends [never]
  ? unknown
  : z.infer<z.ZodObject<Shape>>;

type OutputOf<Schema> = Schema extends z.ZodType ? z.infer<Schema> : never;

/**
 * The parsed output of a union or interface selection: one branch per
 * implementor selected under `__on`, discriminated by `__typename`.
 *
 * When `RequireOne` is `false` an unknown `__typename` is still accepted, with
 * only the common fields — a server can add an implementor at any time.
 */
export type AbstractOutput<CommonShape extends z.core.$ZodShape, On, RequireOne extends boolean> =
  | {
      [K in keyof On & string]: CommonOutput<CommonShape> & { __typename: K } & OutputOf<On[K]>;
    }[keyof On & string]
  | (RequireOne extends true ? never : CommonOutput<CommonShape> & { __typename: string });

/** The type-level twin of `applyWrappers`. The two must stay in lockstep. */
export type ApplyWrappers<Wrappers extends readonly Wrapper[], Schema extends z.ZodType> = Wrappers extends readonly [
  infer Head extends Wrapper,
  ...infer Rest extends readonly Wrapper[],
]
  ? Head extends "nullable"
    ? z.ZodNullable<ApplyWrappers<Rest, Schema>>
    : z.ZodArray<ApplyWrappers<Rest, Schema>>
  : Schema;
