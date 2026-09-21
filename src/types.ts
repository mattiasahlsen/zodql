import type z from "zod";

/**
 * A GraphQL fragment definition, created with `zodqlFragment()` and attached to
 * a field via `withFragment()`, `withRequiredFragment()`, or `withUnionFragments()`.
 *
 * Must be either named or inline, not both:
 * - `{ name: string }` — emitted once as a standalone `fragment Name on Type { ... }`
 *   definition and referenced from attachment points as `...Name`. Because the
 *   definition is keyed by name document-wide, attaching two *different*
 *   selections under one name emits only the first.
 * - `{ inline: true }` — has no `name` and no standalone definition; its fields
 *   are spread directly into the parent selection as an inline fragment
 *   (`... on Type { ... }`) wherever it's attached.
 *
 * Both forms work everywhere a fragment is accepted, `withUnionFragments()`
 * included.
 */
export type ZodqlQueryFragment<Shape extends z.ZodRawShape = z.ZodRawShape, On extends string = string> = {
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
export interface ZodqlQueryVariable {
  /** The GraphQL type of the variable as it appears in the operation signature, e.g. `"ID!"` or `"[String!]"`. */
  typeName: string;
  /** The Zod schema used to validate/parse the value passed for this variable at request time. */
  schema: z.ZodType;
}

/**
 * The output of `ZodqlBuilder.compile()`: a ready-to-send GraphQL operation
 * paired with everything needed to use it — the variables to pass to a
 * `ZodqlClient`, and the schema to parse/type the response's `data` field with.
 */
export type ZodqlQuery<Schema extends z.ZodObject, Variables extends Record<string, ZodqlQueryVariable>> = {
  /** The full GraphQL document source: the operation plus any fragment definitions it uses. */
  queryString: string;
  /** The variable declarations passed to `defineVariables()`, keyed by variable name (without the leading `$`). */
  variables: Variables;
  /** The document's root selection schema, e.g. for `z.infer<Schema>` to type the response's `data` field. */
  schema: Schema;
};
