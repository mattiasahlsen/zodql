import { readFile } from "node:fs/promises";
import type * as GraphqlModule from "graphql";
import type { GraphQLSchema, IntrospectionQuery } from "graphql";

/**
 * `graphql` is an optional peer: it is only needed at generation time, and
 * pulling it into every runtime consumer of the main entry point would be
 * several hundred kilobytes nobody asked for.
 */
async function loadGraphql(): Promise<typeof GraphqlModule> {
  try {
    return await import("graphql");
  } catch {
    throw new Error(
      "zodql codegen needs the `graphql` package to read a schema.\n" +
        "Install it as a dev dependency:\n\n  npm install --save-dev graphql\n"
    );
  }
}

function looksLikeIntrospection(source: string): boolean {
  return source.trimStart().startsWith("{");
}

/**
 * Read a schema from SDL or from the JSON result of an introspection query.
 *
 * Introspection JSON is accepted both as the raw `{ "__schema": … }` payload and
 * as a full GraphQL response (`{ "data": { "__schema": … } }`), because both are
 * what people actually have on disk.
 */
export async function loadSchema(paths: readonly string[]): Promise<GraphQLSchema> {
  if (paths.length === 0) {
    throw new Error("No schema given. Pass at least one SDL file or introspection JSON with --schema.");
  }

  const graphql = await loadGraphql();
  const sources = await Promise.all(paths.map(async (path) => ({ path, contents: await readFile(path, "utf8") })));

  const introspection = sources.find((source) => looksLikeIntrospection(source.contents));
  if (introspection) {
    if (sources.length > 1) {
      throw new Error("An introspection JSON schema can't be combined with other --schema sources.");
    }
    const parsed: unknown = JSON.parse(introspection.contents);
    const result = extractIntrospection(parsed);
    if (!result) {
      throw new Error(
        `${introspection.path} is JSON but has no \`__schema\` key — expected the result of an introspection query.`
      );
    }
    return graphql.buildClientSchema(result);
  }

  // Several SDL files are concatenated so a schema split across files works.
  return graphql.buildSchema(sources.map((source) => source.contents).join("\n"));
}

function extractIntrospection(parsed: unknown): IntrospectionQuery | null {
  if (typeof parsed !== "object" || parsed === null) return null;
  const record = parsed as Record<string, unknown>;
  if ("__schema" in record) return record as unknown as IntrospectionQuery;
  const data = record["data"];
  if (typeof data === "object" && data !== null && "__schema" in data) {
    return data as unknown as IntrospectionQuery;
  }
  return null;
}
