# List repository files (GitHub GraphQL API)

Lists every file on a branch of a GitHub repository by walking its Git tree with
a single type-safe [`zodql`](../../README.md) query against the
[GitHub GraphQL API](https://docs.github.com/en/graphql).

It demonstrates a realistic zodql workflow:

- building a nested query with **field arguments** (`repository(owner:, name:)`,
  `object(expression:)`) and **inline fragments** (`... on Tree`),
- backing a `ZodqlClient` with a plain `fetch` transport (including auth headers),
- **validating** the GraphQL response against the query's Zod schema, and
- handling GraphQL errors, which are returned in the response body rather than thrown.

## Prerequisites

1. **Build the library** (the example imports `zodql`, which resolves to the
   built `dist/`):

   ```bash
   pnpm install
   pnpm build
   ```

2. **Create a GitHub token.** A [fine-grained personal access token](https://github.com/settings/personal-access-tokens/new)
   with read-only "Contents" access (or a classic token with the `repo` scope for
   private repositories) is enough. Public repositories only need any valid token.

## Running

```bash
GITHUB_TOKEN=<your token> pnpm example:github-list-files <owner>/<repo> [ref]
```

Examples:

```bash
# Files on the default branch (HEAD)
GITHUB_TOKEN=ghp_xxx pnpm example:github-list-files facebook/react

# Files on a specific branch, tag, or commit
GITHUB_TOKEN=ghp_xxx pnpm example:github-list-files facebook/react main
```

File paths are printed to stdout (one per line), and a summary is printed to
stderr, so you can pipe the file list cleanly:

```bash
GITHUB_TOKEN=ghp_xxx pnpm example:github-list-files facebook/react > files.txt
```

### Options

| Argument / env      | Default | Description                                                                 |
| ------------------- | ------- | --------------------------------------------------------------------------- |
| `<owner>/<repo>`    | —       | Repository to inspect, e.g. `facebook/react` (required).                    |
| `[ref]`             | `HEAD`  | Branch, tag, or commit to read. `HEAD` is the repository's default branch.  |
| `GITHUB_TOKEN`      | —       | Token with read access to the repository (required).                        |
| `MAX_DEPTH`         | `10`    | Directory depth to traverse (see below).                                    |
| `--print-query`     | —       | Print the compiled GraphQL query and exit. Needs no token.                  |

To see the GraphQL that zodql compiles, without hitting the API:

```bash
pnpm example:github-list-files --print-query
```

## A note on depth

GraphQL can't express unbounded recursion, so the query unrolls the tree
traversal to a fixed number of levels (`MAX_DEPTH`, default `10`). Directories
deeper than that are reported as "not traversed" rather than silently dropped —
re-run with a larger `MAX_DEPTH` to reach them:

```bash
MAX_DEPTH=25 GITHUB_TOKEN=ghp_xxx pnpm example:github-list-files torvalds/linux
```

A larger depth means a larger query document, so pick the smallest value that
covers the repository you care about.
