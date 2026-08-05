/**
 * The "repository overview" example, implemented with **GraphQL Code Generator**
 * (the `client-preset`) — the mainstream, industry-standard approach.
 *
 * The operation is a plain GraphQL string wrapped in the generated `graphql()`
 * function (./operation.ts). A `pnpm gen:codegen` build step reads the schema
 * and that string and emits a `TypedDocumentNode` into ./gql/, from which the
 * result and variable types are inferred. `graphql-request` consumes the typed
 * document, so `data` below is fully typed — but nothing validates at runtime
 * that the server actually returned that shape.
 *
 * Run it with:
 *
 *   GITHUB_TOKEN=<your token> pnpm example:github-repo-overview:codegen <owner>/<repo>
 *
 * Pass `--print-query` to print the GraphQL and exit without a token.
 */
import { print } from "graphql";
import { ClientError, GraphQLClient } from "graphql-request";
import { RepositoryOverviewQuery } from "./operation.js";
import { GITHUB_GRAPHQL_ENDPOINT, USER_AGENT, formatOverview, parseCliArgs, requireToken } from "../shared.js";

const SCRIPT = "example:github-repo-overview:codegen";

async function main(): Promise<void> {
  const cli = parseCliArgs(SCRIPT);

  if (cli.printQuery) {
    // `RepositoryOverviewQuery` is a `TypedDocumentNode` (an AST); print it back
    // to GraphQL source.
    console.log(print(RepositoryOverviewQuery));
    return;
  }

  const { owner, name } = cli;
  const token = requireToken(SCRIPT);

  const client = new GraphQLClient(GITHUB_GRAPHQL_ENDPOINT, {
    headers: { authorization: `bearer ${token}`, "User-Agent": USER_AGENT },
  });

  console.error(`Fetching overview for ${owner}/${name}...`);

  // `data` is typed from the generated document; variables are required and
  // type-checked. Unlike zodql, graphql-request *throws* a `ClientError` when
  // the response carries GraphQL errors, so we catch it below rather than
  // inspecting an `errors` field ourselves.
  let data;
  try {
    data = await client.request(RepositoryOverviewQuery, { owner, name });
  } catch (error) {
    if (error instanceof ClientError) {
      console.error("GitHub returned GraphQL errors:");
      for (const gqlError of error.response.errors ?? []) {
        console.error(`  - ${gqlError.message}`);
      }
      process.exit(1);
    }
    throw error;
  }

  if (!data.repository) {
    throw new Error(`Repository ${owner}/${name} was not found (or the token can't access it).`);
  }

  console.log(formatOverview(data.repository));
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
