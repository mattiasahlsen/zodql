/**
 * The "repository overview" example, implemented with **gql.tada** — the modern
 * codegen-*less* approach.
 *
 * Types are inferred from the GraphQL string in ./operation.ts entirely at the
 * type level (see ./graphql.ts), so there is no generated document to import in
 * the request path and no build step between editing the query and running it.
 * A one-time `pnpm gen:gql-tada` writes the schema introspection into
 * ./graphql-env.d.ts, which the types are derived from. As with codegen, the
 * inferred `data` is a compile-time guarantee only — nothing validates the
 * response at runtime.
 *
 * Run it with:
 *
 *   GITHUB_TOKEN=<your token> pnpm example:github-repo-overview:gql-tada <owner>/<repo>
 *
 * Pass `--print-query` to print the GraphQL and exit without a token.
 */
import { print } from "graphql";
import { ClientError, GraphQLClient } from "graphql-request";
import { RepositoryOverviewQuery } from "./operation.js";
import { GITHUB_GRAPHQL_ENDPOINT, USER_AGENT, formatOverview, parseCliArgs, requireToken } from "../shared.js";

const SCRIPT = "example:github-repo-overview:gql-tada";

async function main(): Promise<void> {
  const cli = parseCliArgs(SCRIPT);

  if (cli.printQuery) {
    // A gql.tada document is a real AST at runtime; print it back to source.
    console.log(print(RepositoryOverviewQuery));
    return;
  }

  const { owner, name } = cli;
  const token = requireToken(SCRIPT);

  const client = new GraphQLClient(GITHUB_GRAPHQL_ENDPOINT, {
    headers: { authorization: `bearer ${token}`, "User-Agent": USER_AGENT },
  });

  console.error(`Fetching overview for ${owner}/${name}...`);

  // `data` is inferred from the document; variables are required and typed.
  // graphql-request throws a `ClientError` on GraphQL errors (zodql instead
  // returns them for you to inspect).
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
