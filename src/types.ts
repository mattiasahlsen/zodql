import type z from "zod";

/**
 * A fragment that can be added to a GraphQL query.
 */
export type QueryFragment<Shape extends z.ZodRawShape = z.ZodRawShape, On extends string = string> = {
  on: On;
  schema: z.ZodObject<Shape>;
  inline?: boolean;
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
 * A variable used in a GraphQL query.
 */
export interface QueryVariable {
  typeName: string;
  schema: z.ZodType;
}

/**
 * The result of building a GraphQL query segment.
 */
export interface GraphqlQuerySegment {
  queryLines: string[];
  usedFragments: QueryFragment[];
}

/**
 * The complete GraphQL query including the query string, variables, and schema.
 */
export type GraphqlQuery<Schema extends z.ZodObject, Variables extends Record<string, QueryVariable>> = {
  queryString: string;
  variables: Variables;
  schema: Schema;
};
