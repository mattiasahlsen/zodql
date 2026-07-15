/**
 * The "repository overview" example, implemented with **GraphQL Zeus** — a
 * schema-generated, typed *query builder*. The query is the TS selection object
 * in ./operation.ts, and the result type is inferred from it — the approach
 * structurally closest to zodql. Unlike zodql, it needs a codegen step
 * (`pnpm gen:zeus`) and does not validate the response at runtime.
 *
 * Run it with:
 *
 *   GITHUB_TOKEN=<your token> pnpm example:github-repo-overview:zeus <owner>/<repo>
 *
 * Pass `--print-query` to print the GraphQL and exit without a token.
 */
import { Thunder, apiFetch } from "./zeus/index.js";
import { repositoryOverviewQueryString, repositoryOverviewSelection, scalars } from "./operation.js";
import { GITHUB_GRAPHQL_ENDPOINT, USER_AGENT, formatOverview, parseCliArgs, requireToken } from "../shared.js";

const SCRIPT = "example:github-repo-overview:zeus";

async function main(): Promise<void> {
  const cli = parseCliArgs(SCRIPT);

  if (cli.printQuery) {
    console.log(repositoryOverviewQueryString);
    return;
  }

  const { owner, name } = cli;
  const token = requireToken(SCRIPT);

  // Build a client from a raw `fetch` transport with auth headers, and register
  // the scalar decoders so `URI`/`DateTime` come back as `string`.
  const thunder = Thunder(
    apiFetch([
      GITHUB_GRAPHQL_ENDPOINT,
      {
        headers: {
          "Content-Type": "application/json",
          authorization: `bearer ${token}`,
          "User-Agent": USER_AGENT,
        },
      },
    ]),
    { scalars }
  );

  console.error(`Fetching overview for ${owner}/${name}...`);

  // Zeus (like graphql-request, unlike zodql) throws when the response carries
  // GraphQL errors, so we catch rather than inspect an `errors` field.
  let data;
  try {
    data = await thunder("query")(repositoryOverviewSelection, {
      operationName: "RepositoryOverview",
      variables: { owner, name },
    });
  } catch (error) {
    console.error("GitHub returned GraphQL errors:");
    console.error(`  - ${error instanceof Error ? error.message : String(error)}`);
    process.exit(1);
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
