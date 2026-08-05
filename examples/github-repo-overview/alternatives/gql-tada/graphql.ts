/**
 * gql.tada setup. `initGraphQLTada` binds the `graphql()` function to our
 * schema's introspection (generated into ./graphql-env.d.ts by
 * `pnpm gen:gql-tada`) so that result and variable types are inferred from the
 * GraphQL string *at the type level* — no codegen output to import, and no build
 * step in the request path. Custom scalars are mapped to `string` here, the same
 * way codegen's config and the zodql schema's `z.string()` do.
 */
import { initGraphQLTada } from "gql.tada";
import type { introspection } from "./graphql-env.d.ts";

export const graphql = initGraphQLTada<{
  introspection: introspection;
  scalars: {
    URI: string;
    DateTime: string;
  };
}>();

export type { FragmentOf, ResultOf, VariablesOf } from "gql.tada";
