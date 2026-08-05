# The same query, four ways: zodql vs. the state of the art

This folder implements one realistic operation — a GitHub **repository
overview** (description, stars, forks, primary language, license, open/closed
issue counts, latest release) — and then re-implements the *exact same query*
three more times using the mainstream best-practice tools for GraphQL +
TypeScript, so you can compare them side by side on identical ground.

All four produce the **same GraphQL document** (a snapshot test in each
alternative asserts this against [`query.snapshot.graphql`](./query.snapshot.graphql)),
and all four give you a **fully typed result**. Where they differ is *how* you
get there — codegen step or not, static string or runtime-built query, and
crucially whether anything checks the response **at runtime**.

| Approach | Where it lives | Query authored as |
| --- | --- | --- |
| **zodql** (this example) | [`schema.ts`](./schema.ts) · [`query.ts`](./query.ts) · [`main.ts`](./main.ts) | a Zod schema |
| **GraphQL Code Generator** (`client-preset`) | [`alternatives/codegen/`](./alternatives/codegen/) | a GraphQL string + codegen |
| **gql.tada** | [`alternatives/gql-tada/`](./alternatives/gql-tada/) | a GraphQL string (types inferred) |
| **GraphQL Zeus** | [`alternatives/zeus/`](./alternatives/zeus/) | a typed TS selection object |

Run any of them (they behave identically):

```bash
pnpm build            # build zodql itself, which the example imports
GITHUB_TOKEN=… pnpm example:github-repo-overview          <owner>/<repo>   # zodql
GITHUB_TOKEN=… pnpm example:github-repo-overview:codegen  <owner>/<repo>
GITHUB_TOKEN=… pnpm example:github-repo-overview:gql-tada <owner>/<repo>
GITHUB_TOKEN=… pnpm example:github-repo-overview:zeus     <owner>/<repo>
```

Add `--print-query` to any of them to print the compiled GraphQL and exit
(no token needed).

---

## 1. zodql

One Zod schema is the source of truth for the query string, the response type,
**and** runtime validation. There is no codegen step and no separate query
document to keep in sync.

```ts
// schema.ts — the shape of the data *and* the request
export const repositoryOverviewSchema = z.object({
  name: z.string(),
  description: z.string().nullable(),
  stargazerCount: z.number(),
  primaryLanguage: languageSchema.nullable(),
  openIssues: issueCountField("OPEN"), // issues(states:) under an alias
  closedIssues: issueCountField("CLOSED"),
  // …
});

// query.ts — compile the schema to a query
export const repositoryOverviewQuery = zodql("query", z.object({ repository: /* … */ }))
  .defineVariables({ owner: { typeName: "String!", schema: z.string() }, name: /* … */ })
  .compile();

// main.ts — validate the response against that same schema
const { parseResponse } = await client.request(repositoryOverviewQuery, { owner, name });
const { data } = await parseResponse(); // ← throws if the server's data doesn't match
```

**You get:** end-to-end types with no build step, a query you can reshape at
runtime with `.pick()`/`.omit()`/`.extend()`, validation rules richer than
GraphQL's type system (e.g. `z.string().url()`, non-empty, ranges), and an
actual runtime guarantee that the response matches.
**You give up:** the enormous surrounding ecosystem the codegen tools have, and
editor tooling as polished as gql.tada's inline diagnostics.

## 2. GraphQL Code Generator (`client-preset`) — the industry default

Write the operation as a GraphQL string wrapped in a generated `graphql()`
function; a codegen build step turns it into a `TypedDocumentNode`, and
`graphql-request` (or urql/Apollo/TanStack Query) consumes that for typed
variables and results.

```ts
// alternatives/codegen/operation.ts
export const RepositoryOverviewQuery = graphql(`
  query RepositoryOverview($owner: String!, $name: String!) {
    repository(owner: $owner, name: $name) { name description stargazerCount /* … */ }
  }
`);

// alternatives/codegen/main.ts
const data = await client.request(RepositoryOverviewQuery, { owner, name }); // typed
```

Regenerate types with `pnpm gen:codegen`. **You get:** the most mature,
best-supported approach, fragment colocation/masking, and integrations with
every major client. **You give up:** a build step in the loop (edit query →
run codegen → types update), and any runtime guarantee — `data` is typed but
nothing verifies the server actually returned that shape.

## 3. gql.tada — codegen-*less* types

Types are inferred from the GraphQL string entirely at the type level, so there
is no generated document to import. A one-time `pnpm gen:gql-tada` writes the
schema introspection into a `.d.ts`, and a TypeScript plugin gives inline
editor diagnostics.

```ts
// alternatives/gql-tada/operation.ts — looks like a string, infers like codegen
export const RepositoryOverviewQuery = graphql(`
  query RepositoryOverview($owner: String!, $name: String!) {
    repository(owner: $owner, name: $name) { name description stargazerCount /* … */ }
  }
`);
```

**You get:** no per-edit codegen step (closest of the three to zodql on that
axis) and excellent editor ergonomics. **You give up:** still no runtime
validation, and the types live in the type system rather than as values you can
reshape at runtime.

## 4. GraphQL Zeus — a typed query builder

The query is a TypeScript object rather than a string, and the result type is
inferred from it — structurally the closest of the three to zodql's "build the
query in TS" model. A `pnpm gen:zeus` step generates the typed SDK from the
schema.

```ts
// alternatives/zeus/operation.ts
export const repositoryOverviewSelection = Selector("Query")({
  repository: [
    { owner: $("owner", "String!"), name: $("name", "String!") },
    {
      name: true,
      description: true,
      stargazerCount: true,
      __alias: {
        openIssues: { issues: [{ states: [IssueState.OPEN] }, { totalCount: true }] },
        closedIssues: { issues: [{ states: [IssueState.CLOSED] }, { totalCount: true }] },
      },
      // …
    },
  ],
});
```

**You get:** a query built from composable, typed TS values (no string), which
is genuinely dynamic. **You give up:** a codegen step, still no runtime
validation, and some rough edges — custom scalars are `unknown` until you
register decoders, and nullables are modeled as `T | null | undefined`.

---

## Trade-offs at a glance

| | **zodql** | **codegen** (client-preset) | **gql.tada** | **Zeus** |
| --- | :---: | :---: | :---: | :---: |
| Build/codegen step | **None** | Per-edit codegen | One-time schema gen¹ | Per-edit codegen |
| Runtime response validation | **✅ Zod** | ❌ | ❌ | ❌ |
| Validation beyond GraphQL types² | **✅** | ❌ | ❌ | ❌ |
| Query is a runtime value (composable) | **✅** | ❌ static string | ❌ static string | ✅ |
| Reshape with `.pick`/`.omit`/`.extend` | **✅** | ❌ | ❌ | partial |
| Fully typed result & variables | ✅ | ✅ | ✅ | ✅ |
| Fragment reuse | ✅ | ✅ (+ masking) | ✅ | ✅ |
| Editor/IDE tooling | basic | good | **excellent** | good |
| Ecosystem & maturity | new/small | **very mature** | growing | mature |
| Runtime dependencies | `zod` | `graphql` + client | `gql.tada` + `graphql` + client | generated client³ |

¹ gql.tada needs no codegen for the *types*, but it does read a generated schema
introspection file (regenerated when the schema changes) and a TS plugin for
editor diagnostics.
² Non-empty strings, URLs, emails, numeric ranges, enums, and arbitrary
refinements — things GraphQL's `String`/`Int` type system can't express.
³ Zeus emits a self-contained client; `graphql` is only needed at generation
time.

## How to read this

If you want the **safest, most battle-tested** setup and don't mind a codegen
step, **GraphQL Code Generator** is the default answer. If you want the same
type safety **without a per-edit codegen step** and great editor support,
**gql.tada** is the modern pick. If you like **building queries as typed TS
objects**, **Zeus** does that well.

What none of them do is **validate the response at runtime** or let you treat
the query as an ordinary runtime value you reshape with schema combinators.
That — not raw type inference, which every option here delivers — is what zodql
adds. If your data crosses a trust boundary (a third-party API, a service you
don't control, a schema that drifts), the codegen tools give you types that
*assume* the server is correct; zodql gives you types **and** a check that it
was.
