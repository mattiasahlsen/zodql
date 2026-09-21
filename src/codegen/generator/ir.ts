import type { GraphQLField, GraphQLNamedType, GraphQLObjectType, GraphQLOutputType, GraphQLSchema } from "graphql";
import type { Wrapper } from "../pick.js";
import { isIntrospectionType } from "./filenames.js";
import type { EnumValueIr, FieldIr, FieldKind, SchemaIr, TypeIr } from "./types.js";

/** GraphQL's built-in scalars, always present in generated output. */
const BUILT_IN_SCALARS = ["Boolean", "Float", "ID", "Int", "String"] as const;

/**
 * A structural view of the bits of `graphql` we need, so this module can be
 * unit-tested and reasoned about without importing the package for values.
 */
interface TypeRef {
  readonly kind?: string;
  readonly ofType?: TypeRef;
  readonly name?: string;
}

/**
 * Peel a GraphQL type down to its named type, recording the modifiers on the
 * way as {@link Wrapper}s (outermost-first).
 *
 * `Foo!` -> `[]`, `Foo` -> `["nullable"]`, `[Foo!]` -> `["nullable", "array"]`,
 * `[Foo]!` -> `["array", "nullable"]`.
 */
export function describeType(type: GraphQLOutputType): { wrappers: Wrapper[]; namedType: string } {
  const wrappers: Wrapper[] = [];
  let current = type as unknown as TypeRef;

  for (;;) {
    if (isNonNull(current)) {
      current = current.ofType as TypeRef;
    } else {
      wrappers.push("nullable");
    }

    if (isList(current)) {
      wrappers.push("array");
      current = current.ofType as TypeRef;
      continue;
    }

    return { wrappers, namedType: String((current as { name?: string }).name ?? current) };
  }
}

function isNonNull(type: TypeRef): boolean {
  return type.constructor?.name === "GraphQLNonNull" || type.kind === "NON_NULL";
}

function isList(type: TypeRef): boolean {
  return type.constructor?.name === "GraphQLList" || type.kind === "LIST";
}

function classify(schema: GraphQLSchema, namedType: string): FieldKind {
  const type = schema.getType(namedType);
  if (!type) return "scalar";
  const constructorName = type.constructor.name;
  if (constructorName === "GraphQLEnumType") return "enum";
  if (constructorName === "GraphQLObjectType") return "object";
  if (constructorName === "GraphQLInterfaceType" || constructorName === "GraphQLUnionType") return "abstract";
  return "scalar";
}

/** Render an argument's type back to SDL, for the JSDoc hint on the pick property. */
function renderTypeRef(type: TypeRef): string {
  if (isNonNull(type)) return `${renderTypeRef(type.ofType as TypeRef)}!`;
  if (isList(type)) return `[${renderTypeRef(type.ofType as TypeRef)}]`;
  return String((type as { name?: string }).name ?? type);
}

function toFieldIr(schema: GraphQLSchema, field: GraphQLField<unknown, unknown>): FieldIr {
  const { wrappers, namedType } = describeType(field.type);
  return {
    name: field.name,
    description: field.description ?? undefined,
    deprecationReason: field.deprecationReason ?? undefined,
    wrappers,
    namedType,
    kind: classify(schema, namedType),
    args: field.args.map((arg) => ({ name: arg.name, type: renderTypeRef(arg.type as unknown as TypeRef) })),
  };
}

function fieldsOf(schema: GraphQLSchema, type: GraphQLNamedType): FieldIr[] {
  const withFields = type as unknown as { getFields?: () => Record<string, GraphQLField<unknown, unknown>> };
  if (typeof withFields.getFields !== "function") return [];
  return Object.values(withFields.getFields()).map((field) => toFieldIr(schema, field));
}

function enumValuesOf(type: GraphQLNamedType): EnumValueIr[] {
  const withValues = type as unknown as {
    getValues: () => { name: string; description?: string | null; deprecationReason?: string | null }[];
  };
  return withValues.getValues().map((value) => ({
    name: value.name,
    description: value.description ?? undefined,
    deprecationReason: value.deprecationReason ?? undefined,
  }));
}

/**
 * Reduce a GraphQL schema to the shape the emitters need.
 *
 * Input object types are skipped entirely: `withArguments()` takes raw GraphQL
 * value strings, so nothing in a generated builder ever refers to them.
 */
export function buildIr(schema: GraphQLSchema): SchemaIr {
  const types: TypeIr[] = [];
  // The built-ins are always emitted, whether or not this schema happens to use
  // them, so `scalars.ts` stays stable when a schema later gains a Float field.
  const scalars = new Map<string, string | undefined>(BUILT_IN_SCALARS.map((name) => [name, undefined] as const));

  for (const type of Object.values(schema.getTypeMap())) {
    if (isIntrospectionType(type.name)) continue;

    switch (type.constructor.name) {
      case "GraphQLScalarType":
        scalars.set(type.name, type.description ?? undefined);
        break;

      case "GraphQLObjectType":
        types.push({
          kind: "object",
          name: type.name,
          description: type.description ?? undefined,
          fields: fieldsOf(schema, type),
        });
        break;

      case "GraphQLInterfaceType":
      case "GraphQLUnionType":
        types.push({
          kind: "abstract",
          name: type.name,
          description: type.description ?? undefined,
          fields: fieldsOf(schema, type),
          implementors: schema
            .getPossibleTypes(type as GraphQLObjectType as never)
            .map((possible) => possible.name)
            .sort(),
        });
        break;

      case "GraphQLEnumType":
        types.push({
          kind: "enum",
          name: type.name,
          description: type.description ?? undefined,
          values: enumValuesOf(type),
        });
        break;

      default:
        // Input objects and anything else: not reachable from a selection.
        break;
    }
  }

  return {
    types: types.sort((a, b) => a.name.localeCompare(b.name)),
    scalars: [...scalars]
      .map(([name, description]) => ({ name, description }))
      .sort((a, b) => a.name.localeCompare(b.name)),
  };
}
