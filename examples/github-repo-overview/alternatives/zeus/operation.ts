/**
 * The `RepositoryOverview` operation expressed as a **GraphQL Zeus** selection —
 * a typed TypeScript object rather than a GraphQL string. This is the approach
 * structurally closest to zodql: you build the query in TS and get a typed
 * result. It still requires a codegen step (`pnpm gen:zeus` regenerates ./zeus/
 * from the schema) and, like the other alternatives, performs no runtime
 * validation of the response.
 *
 * Two Zeus-specific wrinkles the comparison highlights:
 *  - Variables use Zeus's `$(...)` helper so the compiled query references
 *    `$owner`/`$name` instead of inlining literals.
 *  - The two issue counts are the same `issues` field under different aliases,
 *    expressed with Zeus's `__alias` mechanism.
 *  - Custom scalars (`URI`, `DateTime`) are `unknown` unless you register
 *    decoders; `scalars` below maps them to `string`, mirroring codegen's scalar
 *    config and zodql's `z.string()`.
 */
import { $, IssueState, Selector, Zeus, ZeusScalars } from "./zeus/index.js";

export const scalars = ZeusScalars({
  URI: { decode: (value: unknown) => value as string },
  DateTime: { decode: (value: unknown) => value as string },
});

export const repositoryOverviewSelection = Selector("Query")({
  repository: [
    { owner: $("owner", "String!"), name: $("name", "String!") },
    {
      name: true,
      nameWithOwner: true,
      description: true,
      url: true,
      isPrivate: true,
      stargazerCount: true,
      forkCount: true,
      primaryLanguage: { name: true },
      licenseInfo: { name: true, spdxId: true },
      __alias: {
        openIssues: { issues: [{ states: [IssueState.OPEN] }, { totalCount: true }] },
        closedIssues: { issues: [{ states: [IssueState.CLOSED] }, { totalCount: true }] },
      },
      latestRelease: { name: true, tagName: true, url: true, publishedAt: true },
    },
  ],
});

/** The compiled GraphQL string (variables preserved via `$`, not inlined). */
export const repositoryOverviewQueryString = Zeus("query", repositoryOverviewSelection, {
  operationOptions: { operationName: "RepositoryOverview" },
});
