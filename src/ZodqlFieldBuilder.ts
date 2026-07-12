import z from "zod";
import type { QueryFragment } from "./types.js";
import { ALIAS_TARGET_KEY, FRAGMENTS_KEY, QUERY_ARGUMENTS_KEY, ZODQL_FIELD_CORE_SHAPE_KEY } from "./constants.js";
import type { Merge, ObjectMerge } from "type-fest";

type AsObject<T> = T extends {} ? T : never;

interface ZodqlFieldBuilder<FragmentsType extends {} = {}> {
  /**
   * Add arguments to the field.
   *
   * @param args - Record of argument names and their values.
   * @returns New ZodqlFieldBuilder instance with added arguments.
   */
  withArguments(args: Record<string, string>): ZodqlFieldBuilder<FragmentsType>;

  /**
   * Set the field as an alias for another field.
   *
   * @param fieldName - The name of the field to alias.
   * @returns New ZodqlFieldBuilder instance with the alias source set.
   */
  asAliasFor(fieldName: string): ZodqlFieldBuilder<FragmentsType>;

  /**
   * Add a fragment to the field.
   *
   * @param fragment - The QueryFragment to add.
   * @returns New ZodqlFieldBuilder instance with the added fragment.
   */
  withFragment: <NewFragmentShape extends z.ZodRawShape>(
    fragment: {} extends NoInfer<NewFragmentShape>
      ? "Error: Fragment shape can not be an empty object"
      : QueryFragment<NewFragmentShape>
  ) => ZodqlFieldBuilder<FragmentsType | AsObject<ObjectMerge<FragmentsType, z.infer<z.ZodObject<NewFragmentShape>>>>>;

  /**
   * Add a required fragment to the field.
   *
   * @param fragment - The required QueryFragment to add.
   * @returns New ZodqlFieldBuilder instance with the added required fragment.
   */
  withRequiredFragment: <NewFragmentShape extends z.ZodRawShape>(
    fragment: {} extends NoInfer<NewFragmentShape>
      ? "Error: Fragment shape can not be an empty object"
      : QueryFragment<NewFragmentShape>
  ) => ZodqlFieldBuilder<AsObject<ObjectMerge<FragmentsType, z.infer<z.ZodObject<NewFragmentShape>>>>>;

  /**
   * Add discriminated union fragments to the field, using `__typename` as the discriminator.
   *
   * Each fragment targets a specific GraphQL type. At parse time, the `__typename` field
   * determines which fragment schema is applied.
   *
   * @param fragments - A non-empty array of QueryFragments, each targeting a different type via `on`.
   * @param options - Configuration options.
   * @param options.requireOne - If `true`, parsing fails when `__typename` doesn't match any fragment.
   *   If `false`, unknown typenames are accepted with only the base schema fields.
   *   Known typenames must still satisfy their fragment's required fields.
   * @returns New ZodqlFieldBuilder instance with the union fragment schemas applied.
   */
  withUnionFragments: <Fragments extends [QueryFragment, ...QueryFragment[]], RequireOne extends boolean>(
    fragments: {
      [K in keyof Fragments]: {} extends NoInfer<Fragments[K]["schema"]["shape"]>
        ? "Error: Fragment shape can not be an empty object"
        : Fragments[K];
    },
    options: { requireOne: RequireOne }
  ) => RequireOne extends true
    ? ZodqlFieldBuilder<
        AsObject<
          ObjectMerge<
            Merge<{ __typename: string }, FragmentsType>,
            { [K in keyof Fragments]: z.infer<Fragments[K]["schema"]> & { __typename: Fragments[K]["on"] } }[number]
          >
        >
      >
    : ZodqlFieldBuilder<
        | FragmentsType
        | AsObject<
            ObjectMerge<
              Merge<{ __typename: string }, FragmentsType>,
              z.infer<z.ZodUnion<{ [K in keyof Fragments]: z.ZodObject<Fragments[K]["schema"]["shape"]> }>>
            >
          >
      >;

  /**
   * Apply to a Zod object schema.
   *
   * @param rawSchema - The base Zod object schema to apply the field to.
   * @returns The modified Zod schema with field metadata attached and fragment schemas merged.
   */
  toSchema<Schema extends z.ZodObject>(
    rawSchema: Schema
  ): undefined extends FragmentsType
    ? Schema | z.ZodType<ObjectMerge<z.infer<Schema>, FragmentsType>>
    : z.ZodType<ObjectMerge<z.infer<Schema>, FragmentsType>>;
}

/**
 * Runtime metadata attached (via symbol keys) to the Zod schema returned by
 * `toSchema`. The query compiler reads these to reconstruct the GraphQL query
 * without re-deriving anything from the parse schema.
 */
type RegularFragment = QueryFragment & { isRequired: boolean };
type UnionFragmentsMeta = { fragments: QueryFragment[]; requireOne: boolean } | null;

function attachFieldMetadata(
  schema: object,
  coreShape: z.ZodRawShape,
  args: Record<string, string>,
  fragments: RegularFragment[],
  unionFragments: UnionFragmentsMeta,
  aliasFor: string | undefined
): void {
  const target = schema as Record<symbol, unknown>;
  target[ZODQL_FIELD_CORE_SHAPE_KEY] = coreShape;
  target[QUERY_ARGUMENTS_KEY] = args;
  target[FRAGMENTS_KEY] = { fragments, unionFragments };
  target[ALIAS_TARGET_KEY] = aliasFor;
}

class ZodqlFieldBuilderImplementation<FragmentsType extends {} = {}> implements ZodqlFieldBuilder<FragmentsType> {
  constructor(
    private readonly args: Record<string, string> = {},
    private readonly fragments: RegularFragment[] = [],
    private readonly unionFragments: { fragments: QueryFragment[]; requireOne: boolean } | null = null,
    private readonly aliasFor?: string
  ) {}

  private clone(overrides: {
    args?: Record<string, string>;
    fragments?: RegularFragment[];
    unionFragments?: { fragments: QueryFragment[]; requireOne: boolean } | null;
    aliasFor?: string;
  }): any {
    return new ZodqlFieldBuilderImplementation(
      overrides.args ?? this.args,
      overrides.fragments ?? this.fragments,
      "unionFragments" in overrides ? (overrides.unionFragments ?? null) : this.unionFragments,
      overrides.aliasFor ?? this.aliasFor
    );
  }

  withArguments(args: Record<string, string>) {
    return this.clone({ args: { ...this.args, ...args } });
  }

  asAliasFor(fieldName: string) {
    return this.clone({ aliasFor: fieldName });
  }

  withFragment<NewFragmentShape extends z.ZodRawShape>(
    fragment: {} extends NoInfer<NewFragmentShape>
      ? "Error: Fragment shape can not be an empty object"
      : QueryFragment<NewFragmentShape>
  ): ZodqlFieldBuilder<FragmentsType | AsObject<ObjectMerge<FragmentsType, z.infer<z.ZodObject<NewFragmentShape>>>>> {
    return this.clone({ fragments: [...this.fragments, { ...(fragment as QueryFragment), isRequired: false }] });
  }

  withRequiredFragment<NewFragmentShape extends z.ZodRawShape>(
    fragment: {} extends NoInfer<NewFragmentShape>
      ? "Error: Fragment shape can not be an empty object"
      : QueryFragment<NewFragmentShape>
  ): ZodqlFieldBuilder<AsObject<ObjectMerge<FragmentsType, z.infer<z.ZodObject<NewFragmentShape>>>>> {
    return this.clone({ fragments: [...this.fragments, { ...(fragment as QueryFragment), isRequired: true }] });
  }

  withUnionFragments<Fragments extends [QueryFragment, ...QueryFragment[]], RequireOne extends boolean>(
    unionFragments: {
      [K in keyof Fragments]: {} extends NoInfer<Fragments[K]["schema"]["shape"]>
        ? "Error: Fragment shape can not be an empty object"
        : Fragments[K];
    },
    { requireOne }: { requireOne: RequireOne }
  ): RequireOne extends true
    ? ZodqlFieldBuilder<
        AsObject<
          ObjectMerge<
            Merge<{ __typename: string }, FragmentsType>,
            { [K in keyof Fragments]: z.infer<Fragments[K]["schema"]> & { __typename: Fragments[K]["on"] } }[number]
          >
        >
      >
    : ZodqlFieldBuilder<
        | FragmentsType
        | AsObject<
            ObjectMerge<
              Merge<{ __typename: string }, FragmentsType>,
              z.infer<z.ZodUnion<{ [K in keyof Fragments]: z.ZodObject<Fragments[K]["schema"]["shape"]> }>>
            >
          >
      > {
    const fragments = unionFragments as unknown as QueryFragment[];
    if (fragments.length === 0) {
      throw new Error("Union fragments array can not be empty");
    }
    return this.clone({ unionFragments: { fragments: [...fragments], requireOne } });
  }

  toSchema<Schema extends z.ZodObject>(
    schema: Schema
  ): undefined extends FragmentsType
    ? Schema | z.ZodType<ObjectMerge<z.infer<Schema>, FragmentsType>>
    : z.ZodType<ObjectMerge<z.infer<Schema>, FragmentsType>> {
    const coreShape = schema.shape;
    const parseSchema = this.unionFragments
      ? this.buildUnionParseSchema(schema, this.unionFragments)
      : this.buildRegularParseSchema(schema);

    attachFieldMetadata(
      parseSchema as object,
      coreShape,
      this.args,
      this.fragments,
      this.unionFragments,
      this.aliasFor
    );

    return parseSchema as any;
  }

  private mergeFragmentShape(fragment: RegularFragment): z.ZodRawShape {
    return fragment.isRequired ? fragment.schema.shape : fragment.schema.partial().shape;
  }

  private buildRegularParseSchema(schema: z.ZodObject): z.ZodType {
    // Build a fresh shape so per-field metadata is never written onto a schema
    // shared between multiple fields. When several fragments (on different
    // GraphQL types) define the same field with incompatible shapes, the field
    // is parsed as a union of the candidates.
    const merged: Record<string, z.ZodType> = { ...schema.shape } as Record<string, z.ZodType>;
    for (const fragment of this.fragments) {
      for (const [key, fieldSchema] of Object.entries(this.mergeFragmentShape(fragment))) {
        const existing = merged[key];
        merged[key] = existing ? z.union([existing, fieldSchema as z.ZodType]) : (fieldSchema as z.ZodType);
      }
    }
    return z.object(merged);
  }

  private buildUnionParseSchema(
    schema: z.ZodObject,
    union: { fragments: QueryFragment[]; requireOne: boolean }
  ): z.ZodType {
    const { fragments, requireOne } = union;

    // Fields shared by every branch (the field's own selection plus any regular
    // fragments), excluding the `__typename` discriminator.
    let baseShape: z.ZodRawShape = { ...schema.shape };
    for (const fragment of this.fragments) {
      baseShape = { ...baseShape, ...this.mergeFragmentShape(fragment) };
    }

    // One discriminated-union member per fragment, keyed on a literal
    // `__typename`. Zod validates the matching branch and strips fields that
    // belong to the other branches in a single pass.
    const members = fragments.map((fragment) =>
      z.object({ ...baseShape, __typename: z.literal(fragment.on), ...fragment.schema.shape })
    ) as unknown as [z.ZodObject, ...z.ZodObject[]];
    const discriminatedUnion = z.discriminatedUnion("__typename", members);

    if (requireOne) {
      // A non-matching `__typename` has no branch and fails automatically.
      return discriminatedUnion as unknown as z.ZodType;
    }

    // requireOne: false — an unknown `__typename` is accepted with only the base
    // fields, while a known `__typename` must still satisfy its branch. A failed
    // branch is reported as a single custom issue on `__typename`.
    const knownTypenames = new Set(fragments.map((fragment) => fragment.on));
    const baseFieldKeys = [...Object.keys(baseShape), "__typename"];

    return z
      .looseObject({ ...baseShape, __typename: z.string() })
      .transform((data: Record<string, unknown>, ctx: any) => {
        if (knownTypenames.has(data.__typename as string)) {
          const result = discriminatedUnion.safeParse(data);
          if (!result.success) {
            ctx.issues.push({ code: "custom", path: ["__typename"], message: "Invalid input", input: data });
            return z.NEVER;
          }
          return result.data;
        }
        const output: Record<string, unknown> = {};
        for (const key of baseFieldKeys) {
          output[key] = data[key];
        }
        return output;
      }) as unknown as z.ZodType;
  }
}

/**
 * Create a ZodqlFieldBuilder for building GraphQL fields with arguments, fragments, and aliases.
 *
 * This builder provides a fluent interface to configure GraphQL fields with:
 * - Arguments for parameterized queries
 * - Fragments for type-specific field selection
 * - Aliases to query the same field multiple times with different arguments
 *
 * @returns {ZodqlFieldBuilder} A new ZodqlFieldBuilder instance for configuring field properties
 *
 * @example
 * ```typescript
 * import { zodqlField } from 'zodql';
 * import { z } from 'zod';
 *
 * const userField = zodqlField()
 *   .withArguments({ id: '$userId' })
 *   .withFragment({
 *     name: 'UserFields',
 *     on: 'User',
 *     schema: z.object({
 *       id: z.string(),
 *       name: z.string(),
 *     }),
 *   })
 *   .toSchema(z.object({
 *     id: z.string(),
 *     name: z.string(),
 *   }));
 * ```
 */
export function zodqlField(): ZodqlFieldBuilder {
  return new ZodqlFieldBuilderImplementation() as any;
}
