import type z from "zod";

/**
 * A GraphQL fragment definition, created with `zodqlFragment()` and attached to
 * a field via `withFragment()`, `withRequiredFragment()`, or `withUnionFragments()`.
 *
 * Must be either named or inline, not both:
 * - `{ name: string }` — emitted once as a standalone `fragment Name on Type { ... }`
 *   definition and referenced from attachment points as `...Name`. Required for
 *   fragments passed to `withUnionFragments()`.
 * - `{ inline: true }` — has no `name` and no standalone definition; its fields
 *   are spread directly into the parent selection as an inline fragment
 *   (`... on Type { ... }`) wherever it's attached.
 */
export type QueryFragment<Shape extends z.ZodRawShape = z.ZodRawShape, On extends string = string> = {
  /** The GraphQL type this fragment applies to, e.g. `... on User`. */
  on: On;
  /** The fragment's field selection and, for parsing, its Zod schema. */
  schema: z.ZodObject<Shape>;
  /** When `true`, the fragment is spread inline instead of emitted as a named definition. */
  inline?: boolean;
  /** The fragment's name, required unless `inline` is `true`. */
  name?: string;
} & (
  | {
      name: string;
    }
  | {
      inline: true;
    }
);

/**
 * A GraphQL operation variable, declared via `ZodqlBuilder.defineVariables()`.
 */
export interface QueryVariable {
  /** The GraphQL type of the variable as it appears in the operation signature, e.g. `"ID!"` or `"[String!]"`. */
  typeName: string;
  /** The Zod schema used to validate/parse the value passed for this variable at request time. */
  schema: z.ZodType;
}

/**
 * A partial GraphQL query/mutation selection: the lines of one document segment
 * plus the fragments it uses. Currently unused by the builder itself (queries
 * are assembled and emitted as a whole), but available for callers composing
 * query text from smaller pieces.
 */
export interface GraphqlQuerySegment {
  /** The selection's GraphQL source lines, one array entry per line, unindented relative to the document root. */
  queryLines: string[];
  /** The named fragments referenced by `queryLines`, so their definitions can be appended alongside it. */
  usedFragments: QueryFragment[];
}

/**
 * The output of `ZodqlBuilder.compile()`: a ready-to-send GraphQL operation
 * paired with everything needed to use it — the variables to pass to a
 * `ZodqlClient`, and the schema to parse/type the response's `data` field with.
 */
export type GraphqlQuery<Schema extends z.ZodObject, Variables extends Record<string, QueryVariable>> = {
  /** The full GraphQL document source: the operation plus any fragment definitions it uses. */
  queryString: string;
  /** The variable declarations passed to `defineVariables()`, keyed by variable name (without the leading `$`). */
  variables: Variables;
  /** The document's root selection schema, e.g. for `z.infer<Schema>` to type the response's `data` field. */
  schema: Schema;
};

// The type declarations above are erased by the TypeScript compiler, taking any
// JSDoc attached to them with it. The standalone `@typedef` blocks below survive
// into the emitted `.js` (as trailing file comments) so `jsdoc2md` can pick them
// up for the generated README. Keep them in sync with the types above.

/**
 * A GraphQL fragment definition, created with `zodqlFragment()` and attached to
 * a field via `withFragment()`, `withRequiredFragment()`, or `withUnionFragments()`.
 *
 * Must be either named or inline, not both: a named fragment (`name` set) is
 * emitted once as a standalone `fragment Name on Type { ... }` and referenced as
 * `...Name` (required for `withUnionFragments()`), while an inline fragment
 * (`inline: true`, no `name`) has its fields spread directly into the parent
 * selection as `... on Type { ... }` wherever it's attached.
 *
 * @typedef {Object} QueryFragment
 * @property {string} on - The GraphQL type this fragment applies to, e.g. `... on User`.
 * @property {z.ZodObject} schema - The fragment's field selection and, for parsing, its Zod schema.
 * @property {boolean} [inline] - When `true`, the fragment is spread inline instead of emitted as a named definition.
 * @property {string} [name] - The fragment's name, required unless `inline` is `true`.
 */

/**
 * A GraphQL operation variable, declared via `ZodqlBuilder.defineVariables()`.
 *
 * @typedef {Object} QueryVariable
 * @property {string} typeName - The GraphQL type of the variable as it appears in the operation signature, e.g. `"ID!"` or `"[String!]"`.
 * @property {z.ZodType} schema - The Zod schema used to validate/parse the value passed for this variable at request time.
 */

/**
 * A partial GraphQL query/mutation selection: the lines of one document segment
 * plus the fragments it uses. Currently unused by the builder itself (queries
 * are assembled and emitted as a whole), but available for callers composing
 * query text from smaller pieces.
 *
 * @typedef {Object} GraphqlQuerySegment
 * @property {Array.<string>} queryLines - The selection's GraphQL source lines, one array entry per line, unindented relative to the document root.
 * @property {Array.<QueryFragment>} usedFragments - The named fragments referenced by `queryLines`, so their definitions can be appended alongside it.
 */

/**
 * The output of `ZodqlBuilder.compile()`: a ready-to-send GraphQL operation
 * paired with everything needed to use it — the variables to pass to a
 * `ZodqlClient`, and the schema to parse/type the response's `data` field with.
 *
 * @typedef {Object} GraphqlQuery
 * @property {string} queryString - The full GraphQL document source: the operation plus any fragment definitions it uses.
 * @property {Object.<string, QueryVariable>} variables - The variable declarations passed to `defineVariables()`, keyed by variable name (without the leading `$`).
 * @property {z.ZodObject} schema - The document's root selection schema, e.g. for `z.infer<Schema>` to type the response's `data` field.
 */
