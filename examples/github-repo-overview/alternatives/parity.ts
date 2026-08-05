/**
 * Test helper: the parity target and a normalizer, shared by each alternative's
 * `operation.test.ts`. The point these tests make is that codegen, gql.tada, and
 * Zeus all emit the *same* GraphQL the zodql version compiles to — so they diff
 * against `../query.snapshot.graphql` after normalizing both sides through
 * `graphql`'s `parse` + `print` (which erases whitespace/formatting differences).
 */
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { type DocumentNode, parse, print, visit } from "graphql";

const here = dirname(fileURLToPath(import.meta.url));

/** The GraphQL the zodql version compiles to — the parity target for every approach. */
export const zodqlQuery: string = readFileSync(resolve(here, "../query.snapshot.graphql"), "utf8");

/**
 * Canonicalize a query (given as source or as an AST) for comparison. Beyond the
 * whitespace normalization `print` gives us, single-element list argument values
 * are unwrapped to the bare value — because GraphQL input coercion treats
 * `states: OPEN` and `states: [OPEN]` as identical, but the two spellings parse
 * to different ASTs. zodql/codegen/gql.tada emit the former; Zeus, which types
 * the argument as a list, emits the latter. Both mean the same query.
 */
export function normalize(query: string | DocumentNode): string {
  const ast = typeof query === "string" ? parse(query) : query;
  const unwrapped = visit(ast, {
    ListValue(node) {
      return node.values.length === 1 ? node.values[0] : undefined;
    },
  });
  return print(unwrapped);
}
