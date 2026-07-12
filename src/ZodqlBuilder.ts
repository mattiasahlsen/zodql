import type z from "zod";
import type { QueryVariable, GraphqlQuery, QueryFragment } from "./types.js";
import type { EmptyObject } from "type-fest";
import { ALIAS_TARGET_KEY, FRAGMENTS_KEY, QUERY_ARGUMENTS_KEY, ZODQL_FIELD_CORE_SHAPE_KEY } from "./constants.js";

type Operation = "query" | "mutation";

// The GraphQL `Name` token: a letter or underscore followed by any number of
// letters, digits, or underscores. See https://spec.graphql.org/October2021/#sec-Names
const GRAPHQL_NAME_REGEX = /^[_A-Za-z][_0-9A-Za-z]*$/;

const INDENT_UNIT = "  ";

type RegularFragment = QueryFragment & { isRequired: boolean };

type FieldInfo = {
  coreShape: z.ZodRawShape;
  args: Record<string, string>;
  aliasFor: string | undefined;
  regularFragments: RegularFragment[];
  unionFragments: { fragments: QueryFragment[]; requireOne: boolean } | null;
};

/** Strip the wrapper schemas (optional / nullable / default / array) that don't
 * affect the emitted GraphQL selection, returning the inner schema. */
function unwrapSchema(schema: any): any {
  let current = schema;
  while (current && current.def) {
    const type = current.def.type;
    if (type === "optional" || type === "nullable" || type === "default") {
      current = current.def.innerType;
    } else if (type === "array") {
      current = current.def.element;
    } else {
      break;
    }
  }
  return current;
}

/** Read the field metadata off a schema, or fall back to a plain object's shape.
 * Returns `null` for leaf/scalar schemas that emit a single field name. */
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

/** Emit the selection lines for a single field (recursively). */
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

/** Collect the named fragments reachable from a document, in the order they
 * should be emitted (depth-first, own fragments before nested selections). */
function collectFragments(shape: z.ZodRawShape): QueryFragment[] {
  const ordered: QueryFragment[] = [];
  const seen = new Set<string>();

  const addFragment = (fragment: QueryFragment): void => {
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

function buildFragmentDefinition(fragment: QueryFragment): string[] {
  const lines = [`fragment ${fragment.name} on ${fragment.on} {`];
  for (const [fieldName, fieldSchema] of Object.entries(fragment.schema.shape)) {
    lines.push(...buildFieldLines(fieldName, fieldSchema, 1));
  }
  lines.push("}");
  return lines;
}

export type ZodqlOptions = {
  operationName?: string;
};

/**
 * Optional settings for a `zodql` operation.
 *
 * @typedef {Object} ZodqlOptions
 * @property {string} [operationName] - Optional name for the GraphQL operation.
 *   When provided, the compiled operation is emitted with this name
 *   (e.g. `query myRootQuery { ... }`), which is useful for server-side logging,
 *   tracing, and debugging. When omitted, an anonymous operation is emitted
 *   (e.g. `query { ... }`). The value must be a valid GraphQL `Name` (a letter
 *   or underscore followed by letters, digits, or underscores); otherwise
 *   `compile()` throws. See https://spec.graphql.org/October2021/#sec-Names
 */

/**
 * Create a ZodqlBuilder for building GraphQL queries or mutations from Zod schemas.
 *
 * This function initializes a builder that can be used to define variables and compile
 * GraphQL query strings with associated Zod schemas for type-safe GraphQL operations.
 *
 * @param {("query"|"mutation")} operation - The GraphQL operation type, either "query" or "mutation"
 * @param {z.ZodObject} documentSchema - Zod schema representing the GraphQL document structure
 * @param {ZodqlOptions} [options] - Optional settings for the operation. See {@link ZodqlOptions} for the available fields.
 * @returns {ZodqlBuilder} A ZodqlBuilder instance for chaining operations
 *
 * @example
 * ```typescript
 * import { zodql, zodqlField } from 'zodql';
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
 * zodqlField's withFragment() or withRequiredFragment() methods.
 *
 * @param {QueryFragment} fragmentParam - Fragment definition containing name, on (type), schema, and inline flag
 * @returns {QueryFragment} The validated fragment definition for use in queries
 * @throws {Error} If the fragment shape is an empty object
 *
 * @example
 * ```typescript
 * import { zodqlFragment } from 'zodql';
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
    : QueryFragment<Shape, On>
): QueryFragment<Shape, On> {
  const fragment = fragmentParam as QueryFragment<Shape, On>;
  if (Object.keys(fragment.schema.shape).length === 0) {
    throw new Error("Fragment shape can not be an empty object");
  }
  return fragment;
}

class ZodqlBuilder<Schema extends z.ZodObject, Variables extends Record<string, QueryVariable> = EmptyObject> {
  constructor(
    private readonly operation: Operation,
    private readonly schema: Schema,
    private readonly variables: Variables = {} as Variables,
    private readonly options: ZodqlOptions = {}
  ) {}

  defineVariables<NewVariables extends Record<string, QueryVariable>>(
    newVariables: NewVariables
  ): ZodqlBuilder<Schema, Variables & NewVariables> {
    return new ZodqlBuilder(this.operation, this.schema, { ...this.variables, ...newVariables }, this.options);
  }

  compile(): GraphqlQuery<Schema, Variables> {
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
