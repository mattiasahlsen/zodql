import type z from "zod";
import type { ZodqlQueryVariable, ZodqlQuery, ZodqlQueryFragment } from "./types.js";
import type { EmptyObject } from "type-fest";
import { ALIAS_TARGET_KEY, FRAGMENTS_KEY, QUERY_ARGUMENTS_KEY, ZODQL_FIELD_CORE_SHAPE_KEY } from "./constants.js";

type Operation = "query" | "mutation";

// The GraphQL `Name` token: a letter or underscore followed by any number of
// letters, digits, or underscores. See https://spec.graphql.org/October2021/#sec-Names
const GRAPHQL_NAME_REGEX = /^[_A-Za-z][_0-9A-Za-z]*$/;

const INDENT_UNIT = "  ";

type RegularFragment = ZodqlQueryFragment & { isRequired: boolean };

type FieldInfo = {
  coreShape: z.ZodRawShape;
  args: Record<string, string>;
  aliasFor: string | undefined;
  regularFragments: RegularFragment[];
  unionFragments: { fragments: ZodqlQueryFragment[]; requireOne: boolean } | null;
};

/**
 * Strip the wrapper schemas (optional / nullable / default / array / pipe)
 * that don't affect the emitted GraphQL selection, returning the inner schema.
 *
 * Wrapper layers can be nested in any combination (e.g. an optional array of
 * nullable objects), so this walks inward until it hits a schema that isn't
 * one of the recognized wrapper types.
 *
 * Before unwrapping any layer, this checks whether zodql's own field metadata
 * (attached by `zodqlField().toSchema(...)`) lives directly on it and stops
 * there if so — `toSchema()` can attach metadata to a `pipe`/`transform` node
 * itself (its union-fragment support does so internally, via `.transform()`),
 * so unwrapping past it unconditionally would lose that metadata.
 *
 * `.transform()` and `z.preprocess()` both desugar to a `pipe` node in Zod 4
 * (`def.in`/`def.out`), but in opposite arrangements: `.transform()` puts the
 * meaningful schema in `def.in` (with a dead-end `transform` leaf in
 * `def.out`), while `z.preprocess()` puts it in `def.out` (with the dead-end
 * leaf in `def.in`). This resolves `def.out` first and falls back to `def.in`
 * when that bottoms out at a `transform` leaf, which handles both cases (and
 * arbitrary chains of either) while still preferring a plain `.pipe(a, b)`'s
 * output schema, matching `parse()` semantics. `.refine()`/`.superRefine()`
 * need no special handling here: they don't change `def.type`, so a refined
 * object still falls through to the plain-object case in {@link getFieldInfo}.
 *
 * @private
 */
function unwrapSchema(schema: any): any {
  let current = schema;
  while (current && current.def) {
    if (current[ZODQL_FIELD_CORE_SHAPE_KEY] !== undefined) break;

    const type = current.def.type;
    if (type === "optional" || type === "nullable" || type === "default") {
      current = current.def.innerType;
    } else if (type === "array") {
      current = current.def.element;
    } else if (type === "pipe") {
      const out = unwrapSchema(current.def.out);
      current = out?.def?.type === "transform" ? unwrapSchema(current.def.in) : out;
    } else {
      break;
    }
  }
  return current;
}

/**
 * Read the field metadata off a schema, or fall back to a plain object's shape.
 *
 * Fields built with `zodqlField().toSchema(...)` carry their selection metadata
 * (core shape, arguments, alias, fragments) under symbol keys on the (unwrapped)
 * schema; this reads it back out. A plain `z.object(...)` schema with no such
 * metadata is still treated as a selection, using its own shape and no
 * arguments/alias/fragments. Anything else (string, number, enum, etc.) is a
 * GraphQL scalar/leaf field, for which this returns `null`.
 *
 * @private
 */
function getFieldInfo(schema: any): FieldInfo | null {
  const base = unwrapSchema(schema);
  if (!base) return null;

  const coreShape = base[ZODQL_FIELD_CORE_SHAPE_KEY] as z.ZodRawShape | undefined;
  if (coreShape !== undefined) {
    const fragmentMeta = (base[FRAGMENTS_KEY] as
      { fragments: RegularFragment[]; unionFragments: FieldInfo["unionFragments"] } | undefined) ?? {
      fragments: [],
      unionFragments: null,
    };
    return {
      coreShape,
      args: (base[QUERY_ARGUMENTS_KEY] as Record<string, string> | undefined) ?? {},
      aliasFor: base[ALIAS_TARGET_KEY] as string | undefined,
      regularFragments: fragmentMeta.fragments,
      unionFragments: fragmentMeta.unionFragments,
    };
  }

  if (base.def?.type === "object") {
    return {
      coreShape: base.shape as z.ZodRawShape,
      args: {},
      aliasFor: undefined,
      regularFragments: [],
      unionFragments: null,
    };
  }

  return null;
}

function formatArguments(args: Record<string, string>): string {
  const entries = Object.entries(args);
  if (entries.length === 0) return "";
  return ` (${entries.map(([key, value]) => `${key}: ${value}`).join(", ")})`;
}

/**
 * Emit the selection lines for a single field, recursing into its children.
 *
 * Leaf/scalar fields (where {@link getFieldInfo} returns `null`) are emitted as
 * a bare field name. Fields with metadata are emitted as `name { ... }`,
 * optionally rewritten to `alias: name { ... }` when the field was built with
 * `asAliasFor()`, and with `(arg: value, ...)` appended when arguments were
 * attached via `withArguments()`. Inside the block:
 * - Child fields from the field's own core shape are emitted first.
 * - If the field has union fragments, a `__typename` selection is added so the
 *   response can be discriminated at parse time.
 * - Inline regular fragments (`inline: true`) have their fields spread directly
 *   into the block; named regular fragments are referenced via `...FragmentName`.
 * - Union fragments are always referenced via `...FragmentName`; they must be
 *   given a `name` (rather than `inline: true`) or the reference won't resolve
 *   to an emitted fragment definition.
 *
 * @private
 */
function buildFieldLines(name: string, schema: any, indent: number): string[] {
  const info = getFieldInfo(schema);
  const pad = INDENT_UNIT.repeat(indent);

  if (!info) {
    return [`${pad}${name}`];
  }

  const namePart = info.aliasFor ? `${name}: ${info.aliasFor}` : name;
  const lines = [`${pad}${namePart}${formatArguments(info.args)} {`];

  const childIndent = indent + 1;
  const childPad = INDENT_UNIT.repeat(childIndent);

  for (const [fieldName, fieldSchema] of Object.entries(info.coreShape)) {
    lines.push(...buildFieldLines(fieldName, fieldSchema, childIndent));
  }

  if (info.unionFragments) {
    lines.push(`${childPad}__typename`);
  }

  for (const fragment of info.regularFragments) {
    if (fragment.inline) {
      lines.push(`${childPad}... on ${fragment.on} {`);
      for (const [fieldName, fieldSchema] of Object.entries(fragment.schema.shape)) {
        lines.push(...buildFieldLines(fieldName, fieldSchema, childIndent + 1));
      }
      lines.push(`${childPad}}`);
    } else {
      lines.push(`${childPad}...${fragment.name}`);
    }
  }

  if (info.unionFragments) {
    for (const fragment of info.unionFragments.fragments) {
      lines.push(`${childPad}...${fragment.name}`);
    }
  }

  lines.push(`${pad}}`);
  return lines;
}

/**
 * Collect the named fragments reachable from a document, in the order they
 * should be emitted (depth-first, own fragments before nested selections).
 *
 * Only fragments with a `name` are collected here — inline fragments (`inline:
 * true`) have no standalone definition to emit, since their fields are spread
 * directly into the parent selection by {@link buildFieldLines}. Each named
 * fragment is emitted at most once, keyed by name, even if it's attached to
 * multiple fields (regular fragment) or reused across separate `withUnionFragments`
 * calls. A fragment's own selection is walked recursively so fragments nested
 * inside another fragment's schema (including inline ones) are also collected.
 *
 * @private
 */
function collectFragments(shape: z.ZodRawShape): ZodqlQueryFragment[] {
  const ordered: ZodqlQueryFragment[] = [];
  const seen = new Set<string>();

  const addFragment = (fragment: ZodqlQueryFragment): void => {
    const name = fragment.name;
    if (name === undefined || seen.has(name)) return;
    seen.add(name);
    ordered.push(fragment);
    visitShape(fragment.schema.shape);
  };

  const visitShape = (currentShape: z.ZodRawShape): void => {
    for (const fieldSchema of Object.values(currentShape)) {
      const info = getFieldInfo(fieldSchema);
      if (!info) continue;

      for (const fragment of info.regularFragments) {
        if (!fragment.inline) addFragment(fragment);
      }
      if (info.unionFragments) {
        for (const fragment of info.unionFragments.fragments) addFragment(fragment);
      }

      for (const fragment of info.regularFragments) {
        if (fragment.inline) visitShape(fragment.schema.shape);
      }

      visitShape(info.coreShape);
    }
  };

  visitShape(shape);
  return ordered;
}

function buildFragmentDefinition(fragment: ZodqlQueryFragment): string[] {
  const lines = [`fragment ${fragment.name} on ${fragment.on} {`];
  for (const [fieldName, fieldSchema] of Object.entries(fragment.schema.shape)) {
    lines.push(...buildFieldLines(fieldName, fieldSchema, 1));
  }
  lines.push("}");
  return lines;
}

/**
 * Optional settings for a `zodql` operation.
 */
export type ZodqlOptions = {
  /**
   * Optional name for the GraphQL operation. When provided, the compiled
   * operation is emitted with this name (e.g. `query myRootQuery { ... }`),
   * which is useful for server-side logging, tracing, and debugging. When
   * omitted, an anonymous operation is emitted (e.g. `query { ... }`). The value
   * must be a valid GraphQL `Name` (a letter or underscore followed by letters,
   * digits, or underscores); otherwise `compile()` throws.
   * See https://spec.graphql.org/October2021/#sec-Names
   */
  operationName?: string;
};

/**
 * Create a ZodqlBuilder for building GraphQL queries or mutations from Zod schemas.
 *
 * This function initializes a builder that can be used to define variables and compile
 * GraphQL query strings with associated Zod schemas for type-safe GraphQL operations.
 *
 * The returned builder is immutable: `defineVariables()` returns a new builder
 * with the added variables rather than mutating this one, so it's safe to chain
 * or to branch off a shared base builder. Call `compile()` last to produce the
 * final query string, variables, and schema.
 *
 * @param operation - The GraphQL operation type, either "query" or "mutation"
 * @param documentSchema - Zod schema (built from plain fields and/or `zodqlField()`
 *   fields) representing the GraphQL document's root selection set
 * @param options - Optional settings for the operation. See {@link ZodqlOptions} for the available fields.
 * @returns A ZodqlBuilder instance for chaining operations
 *
 * @group Query Building
 *
 * @example
 * ```typescript
 * import { zodql, zodqlField } from '@mattiasahlsen/zodql';
 * import { z } from 'zod';
 *
 * const userSchema = z.object({
 *   user: zodqlField().withArguments({ id: "$userId" }).toSchema(
 *     z.object({
 *       id: z.string(),
 *       name: z.string(),
 *     })
 *   ),
 * });
 *
 * const query = zodql('query', userSchema, { operationName: 'GetUser' })
 *   .defineVariables({ userId: { typeName: 'ID!', schema: z.string() } })
 *   .compile();
 * ```
 */
export function zodql<Schema extends z.ZodObject>(
  operation: Operation,
  documentSchema: Schema,
  options: ZodqlOptions = {}
) {
  return new ZodqlBuilder(operation, documentSchema, {}, options);
}

/**
 * Define a GraphQL fragment from a Zod schema.
 *
 * Fragments allow you to reuse common field selections across multiple queries.
 * This function validates and returns a fragment definition that can be used with
 * zodqlField's withFragment(), withRequiredFragment(), or withUnionFragments() methods.
 *
 * A fragment must either be given a `name` (emitted as a standalone named
 * fragment, e.g. `...UserFields`, referenced wherever it's attached) or marked
 * `inline: true` (its fields are spread directly into the parent selection
 * instead, with no separate fragment definition). Union fragments (used with
 * `withUnionFragments()`) must use `name`, since inline fragments have nothing
 * for the `...FragmentName` reference to resolve to. This is enforced at the
 * type level; at runtime, the fragment's schema shape is checked and rejected
 * if empty, since an empty selection set is not valid GraphQL.
 *
 * @param fragmentParam - Fragment definition containing name, on (type), schema, and inline flag
 * @returns The validated fragment definition for use in queries
 * @throws If the fragment's schema shape is an empty object
 *
 * @group Query Building
 *
 * @example
 * ```typescript
 * import { zodqlFragment } from '@mattiasahlsen/zodql';
 * import { z } from 'zod';
 *
 * const userFragment = zodqlFragment({
 *   name: 'UserFields',
 *   on: 'User',
 *   schema: z.object({
 *     id: z.string(),
 *     name: z.string(),
 *     email: z.string(),
 *   }),
 *   inline: false,
 * });
 * ```
 */
export function zodqlFragment<Shape extends z.ZodRawShape, On extends string>(
  fragmentParam: {} extends NoInfer<Shape>
    ? "Error: Fragment shape can not be an empty object"
    : ZodqlQueryFragment<Shape, On>
): ZodqlQueryFragment<Shape, On> {
  const fragment = fragmentParam as ZodqlQueryFragment<Shape, On>;
  if (Object.keys(fragment.schema.shape).length === 0) {
    throw new Error("Fragment shape can not be an empty object");
  }
  return fragment;
}

class ZodqlBuilder<Schema extends z.ZodObject, Variables extends Record<string, ZodqlQueryVariable> = EmptyObject> {
  constructor(
    private readonly operation: Operation,
    private readonly schema: Schema,
    private readonly variables: Variables = {} as Variables,
    private readonly options: ZodqlOptions = {}
  ) {}

  // Returns a new builder with `newVariables` merged in; does not mutate this
  // one. Later calls win on name collisions, since object spread is last-wins.
  defineVariables<NewVariables extends Record<string, ZodqlQueryVariable>>(
    newVariables: NewVariables
  ): ZodqlBuilder<Schema, Variables & NewVariables> {
    return new ZodqlBuilder(this.operation, this.schema, { ...this.variables, ...newVariables }, this.options);
  }

  // Renders the document schema (and any fragments it reaches) into GraphQL
  // source text. Throws only if `options.operationName` was set to an invalid
  // GraphQL name.
  compile(): ZodqlQuery<Schema, Variables> {
    const { operationName } = this.options;
    if (operationName !== undefined && !GRAPHQL_NAME_REGEX.test(operationName)) {
      throw new Error(
        `Invalid operationName "${operationName}": must be a valid GraphQL name (see https://spec.graphql.org/October2021/#sec-Names).`
      );
    }

    const headerParts: string[] = [this.operation];
    if (operationName) headerParts.push(operationName);

    const variableEntries = Object.entries(this.variables);
    if (variableEntries.length > 0) {
      const definitions = variableEntries.map(([name, variable]) => `$${name}: ${variable.typeName}`).join(", ");
      headerParts.push(`(${definitions})`);
    }

    const documentShape = this.schema.shape as z.ZodRawShape;

    const lines: string[] = [`${headerParts.join(" ")} {`];
    for (const [fieldName, fieldSchema] of Object.entries(documentShape)) {
      lines.push(...buildFieldLines(fieldName, fieldSchema, 1));
    }
    lines.push("}");

    for (const fragment of collectFragments(documentShape)) {
      lines.push("");
      lines.push(...buildFragmentDefinition(fragment));
    }

    return {
      queryString: lines.join("\n"),
      variables: this.variables,
      schema: this.schema,
    };
  }
}
