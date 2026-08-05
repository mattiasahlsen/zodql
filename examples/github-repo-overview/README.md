# Repository overview (GitHub GraphQL API)

Fetches an overview of a single GitHub repository — description, stars, forks,
primary language, license, open/closed issue counts, and latest release — with
a single type-safe [`zodql`](../../README.md) query against the
[GitHub GraphQL API](https://docs.github.com/en/graphql).

The code is split by concern:

| File                                | Contents                                                              |
| ------------------------------------ | ----------------------------------------------------------------------- |
| [`schema.ts`](./schema.ts)           | The Zod schemas describing the data, including the `openIssues`/`closedIssues` field aliases. |
| [`query.ts`](./query.ts)             | The compiled `zodql` query, built from the schemas.                     |
| [`client.ts`](./client.ts)           | A `ZodqlClient` backed by `fetch`, with GitHub auth headers.             |
| [`main.ts`](./main.ts)               | The CLI: argument parsing, running the query, and printing the result.  |

It demonstrates a realistic zodql workflow:

- building a query with **field arguments** (`repository(owner:, name:)`) and
  **query variables**,
- **field aliases** (`openIssues`/`closedIssues` both alias the `issues` field,
  queried once per state with `asAliasFor()`),
- **nullable and nested fields** (a repo may have no language, license, or
  releases),
- backing a `ZodqlClient` with a plain `fetch` transport (including auth headers),
- **validating** the GraphQL response against the query's Zod schema, and
- handling GraphQL errors, which are returned in the response body rather than thrown.

## How this looks without zodql

Curious how you'd write the same query with the mainstream GraphQL + TypeScript
tooling? [`COMPARISON.md`](./COMPARISON.md) re-implements this exact operation
three more ways — **GraphQL Code Generator** (`client-preset`), **gql.tada**, and
**GraphQL Zeus** — and lays them out side by side with a trade-offs table. All
four are runnable ([`alternatives/`](./alternatives/)) and compile to the same
GraphQL; the comparison focuses on what differs, especially runtime validation.

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
GITHUB_TOKEN=<your token> pnpm example:github-repo-overview <owner>/<repo>
```

Example:

```bash
GITHUB_TOKEN=ghp_xxx pnpm example:github-repo-overview facebook/react
```

which prints something like:

```
facebook/react
https://github.com/facebook/react

The library for web and native user interfaces.

Language: JavaScript
License:  MIT License (MIT)
Stars:    227000
Forks:    46700
Issues:   900 open / 11000 closed
Latest release: v18.3.1 — React v18.3.1
  https://github.com/facebook/react/releases/tag/v18.3.1
```

### Options

| Argument / env    | Default | Description                                                 |
| ----------------- | ------- | ------------------------------------------------------------ |
| `<owner>/<repo>`  | —       | Repository to inspect, e.g. `facebook/react` (required).     |
| `GITHUB_TOKEN`    | —       | Token with read access to the repository (required).         |
| `--print-query`   | —       | Print the compiled GraphQL query and exit. Needs no token.   |

To see the GraphQL that zodql compiles, without hitting the API:

```bash
pnpm example:github-repo-overview --print-query
```
