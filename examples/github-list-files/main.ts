/**
 * Example: list the files on a branch of a GitHub repository using zodql and
 * the GitHub GraphQL API.
 *
 * It builds a single, type-safe GraphQL query that walks the repository's Git
 * tree, sends it through a `zodql` client backed by `fetch`, validates the
 * response with the query's Zod schema, and prints every file path it found.
 *
 * Run it with:
 *
 *   GITHUB_TOKEN=<your token> pnpm example:github-list-files <owner>/<repo> [ref]
 *
 * For example:
 *
 *   GITHUB_TOKEN=ghp_xxx pnpm example:github-list-files facebook/react
 *   GITHUB_TOKEN=ghp_xxx pnpm example:github-list-files facebook/react main
 *
 * Pass `--print-query` to print the compiled GraphQL document and exit without
 * contacting the API (no token required) — handy for seeing what zodql emits.
 *
 * See ./README.md for details, including how to create a token.
 */
import { zodql, zodqlField, buildZodqlClient } from "@mattiasahlsen/zodql";
import { z } from "zod";

const GITHUB_GRAPHQL_ENDPOINT = "https://api.github.com/graphql";

// The GitHub GraphQL API resolves a Git tree from an "expression" of the form
// `<ref>:<path>`. `HEAD:` is the root tree of the repository's default branch;
// `main:` would be the root of the `main` branch specifically.
const DEFAULT_REF = "HEAD";

// GraphQL can't express unbounded recursion, so we unroll the tree traversal to
// a fixed depth. Directories deeper than this are reported as truncated rather
// than silently dropped. Raise it (at the cost of a larger query) to reach
// deeper trees. Configurable via the MAX_DEPTH environment variable.
const DEFAULT_MAX_DEPTH = 10;

/**
 * One entry in a Git tree: a file (`type: "blob"`) or a directory
 * (`type: "tree"`). For directory entries we recurse into `object.entries` to
 * read their contents. `object` is:
 *   - absent (`undefined`) when we stopped recursing at MAX_DEPTH,
 *   - `null` for blobs (a file has no child entries),
 *   - `{ entries }` for directories we did descend into.
 */
interface TreeEntry {
  name: string;
  type: string;
  path: string;
  object?: { entries?: TreeEntry[] | null } | null;
}

/**
 * Build the Zod schema for a tree entry, unrolled to `depth` levels. Each level
 * selects the entry's own fields plus, for directory entries, a nested `object`
 * whose `... on Tree` fragment pulls in the next level of entries.
 */
function buildTreeEntrySchema(depth: number): z.ZodType<TreeEntry> {
  const ownFields = {
    name: z.string(),
    type: z.string(),
    path: z.string(),
  };

  // Deepest level: stop recursing. We don't select `object` here, so any
  // directory at this depth comes back with `object: undefined` (truncated).
  if (depth <= 1) {
    return z.object(ownFields);
  }

  // A TreeEntry's `object` is a `GitObject` interface; only when it's a `Tree`
  // (i.e. a directory) does it have `entries`. An inline `... on Tree` fragment
  // selects them and makes them optional at parse time, since blobs won't match.
  const object = zodqlField()
    .withFragment({
      on: "Tree",
      inline: true,
      schema: z.object({ entries: z.array(buildTreeEntrySchema(depth - 1)).nullable() }),
    })
    .toSchema(z.object({}))
    .nullable();

  return z.object({ ...ownFields, object });
}

/** Build the full "list files" query, unrolled to `maxDepth` levels. */
function buildListFilesQuery(maxDepth: number) {
  return zodql(
    "query",
    z.object({
      repository: zodqlField()
        .withArguments({ owner: "$owner", name: "$name" })
        .toSchema(
          z.object({
            // `object(expression: "<ref>:")` resolves the branch's root tree.
            object: zodqlField()
              .withArguments({ expression: "$expression" })
              .withFragment({
                on: "Tree",
                inline: true,
                schema: z.object({ entries: z.array(buildTreeEntrySchema(maxDepth)).nullable() }),
              })
              .toSchema(z.object({}))
              .nullable(),
          })
        )
        // `repository` is null if the repo doesn't exist or the token can't see it.
        .nullable(),
    }),
    { operationName: "ListRepositoryFiles" }
  ).defineVariables({
    owner: { typeName: "String!", schema: z.string() },
    name: { typeName: "String!", schema: z.string() },
    expression: { typeName: "String!", schema: z.string() },
  });
}

/** The shape of a GraphQL response body, before zodql validates `data`. */
interface GraphQLBody {
  data?: unknown;
  errors?: Array<{ message: string }>;
}

/** Recursively collect file (blob) paths, counting directories we couldn't descend into. */
function collectFiles(
  entries: TreeEntry[] | null | undefined,
  result: { files: string[]; truncatedDirs: string[] }
): void {
  if (!entries) return;
  for (const entry of entries) {
    if (entry.type === "blob") {
      result.files.push(entry.path);
    } else if (entry.type === "tree") {
      if (entry.object === undefined) {
        // We hit MAX_DEPTH before reaching this directory's contents.
        result.truncatedDirs.push(entry.path);
      } else {
        collectFiles(entry.object?.entries, result);
      }
    }
  }
}

function parseRepoArg(arg: string | undefined): { owner: string; name: string } {
  const match = arg?.match(/^([^/\s]+)\/([^/\s]+)$/);
  if (!match) {
    throw new Error(`Expected a repository as "<owner>/<repo>", got: ${arg ?? "(nothing)"}`);
  }
  return { owner: match[1]!, name: match[2]! };
}

function printUsageAndExit(): never {
  console.error(
    [
      "Usage: pnpm example:github-list-files <owner>/<repo> [ref]",
      "",
      "  <owner>/<repo>   Repository to inspect, e.g. facebook/react",
      "  [ref]            Branch, tag, or commit to read (default: HEAD, the default branch)",
      "",
      "Environment:",
      "  GITHUB_TOKEN     GitHub token with read access to the repository (required)",
      "  MAX_DEPTH        Directory depth to traverse (default: 10)",
      "",
      "Flags:",
      "  --print-query    Print the compiled GraphQL query and exit (no token needed)",
    ].join("\n")
  );
  process.exit(1);
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const printQuery = args.includes("--print-query");
  const positional = args.filter((arg) => !arg.startsWith("--"));

  const maxDepth = Number(process.env.MAX_DEPTH ?? DEFAULT_MAX_DEPTH);
  if (!Number.isInteger(maxDepth) || maxDepth < 1) {
    throw new Error(`MAX_DEPTH must be a positive integer, got: ${process.env.MAX_DEPTH}`);
  }

  const query = buildListFilesQuery(maxDepth).compile();

  if (printQuery) {
    console.log(query.queryString);
    return;
  }

  const { owner, name } = positional.length > 0 ? parseRepoArg(positional[0]) : printUsageAndExit();
  const ref = positional[1] ?? DEFAULT_REF;
  const expression = `${ref}:`;

  const token = process.env.GITHUB_TOKEN;
  if (!token) {
    console.error("Missing GITHUB_TOKEN environment variable.\n");
    printUsageAndExit();
  }

  // A zodql client is just a thin wrapper around any HTTP transport. Here we use
  // the global `fetch`; the transport returns the parsed body as `response` (so
  // we can read GraphQL `errors`) and exposes it again via `json()` for zodql to
  // validate against the query's schema.
  const client = buildZodqlClient<GraphQLBody>({
    post: async (_url, body) => {
      const res = await fetch(GITHUB_GRAPHQL_ENDPOINT, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `bearer ${token}`,
          // GitHub requires a User-Agent header on every request.
          "User-Agent": "zodql-example-github-list-files",
        },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        throw new Error(`GitHub API returned HTTP ${res.status} ${res.statusText}: ${await res.text()}`);
      }

      const json = (await res.json()) as GraphQLBody;
      return { response: json, json: () => json };
    },
  });

  console.error(`Fetching files for ${owner}/${name} at ${ref} (depth ${maxDepth})...`);

  const { response, parseResponse } = await client.request(query, { owner, name, expression });

  // GraphQL errors are returned in a 200 response body, so zodql never throws
  // them for us — we check them ourselves before validating `data`.
  if (response.errors && response.errors.length > 0) {
    console.error("GitHub returned GraphQL errors:");
    for (const error of response.errors) {
      console.error(`  - ${error.message}`);
    }
    process.exit(1);
  }

  const { data } = await parseResponse();

  if (!data.repository) {
    throw new Error(`Repository ${owner}/${name} was not found (or the token can't access it).`);
  }
  if (!data.repository.object) {
    throw new Error(`No tree found at "${expression}" — is "${ref}" a valid branch/ref for ${owner}/${name}?`);
  }

  const result: { files: string[]; truncatedDirs: string[] } = { files: [], truncatedDirs: [] };
  collectFiles(data.repository.object.entries, result);
  result.files.sort();

  for (const file of result.files) {
    console.log(file);
  }

  console.error(`\n${result.files.length} file(s) found in ${owner}/${name} at ${ref}.`);
  if (result.truncatedDirs.length > 0) {
    console.error(
      `${result.truncatedDirs.length} director(y/ies) not traversed at depth ${maxDepth}; ` +
        `re-run with a larger MAX_DEPTH to include them, e.g.:\n` +
        result.truncatedDirs
          .slice(0, 5)
          .map((dir) => `  ${dir}/`)
          .join("\n")
    );
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
