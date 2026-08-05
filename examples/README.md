# zodql examples

Real, runnable examples of using [`zodql`](../README.md) against live GraphQL APIs.

Each example is a standalone script run with [`tsx`](https://tsx.is/) via a
`pnpm example:*` shortcut, and imports `zodql` the same way a real consumer
would (by package name). Because of that, **build the library once first**:

```bash
pnpm install
pnpm build
```

## Available examples

| Example                                                   | Description                                                                   | Run                                                                |
| ----------------------------------------------------------- | -------------------------------------------------------------------------- | ------------------------------------------------------------------- |
| [github-repo-overview](./github-repo-overview/README.md) | Fetch a GitHub repository's overview (stars, license, issues, …) via GraphQL. Includes a [side-by-side comparison](./github-repo-overview/COMPARISON.md) with graphql-codegen, gql.tada, and Zeus. | `GITHUB_TOKEN=… pnpm example:github-repo-overview <owner>/<repo>` |

See each example's README for prerequisites (such as API tokens) and usage.

## README snippets

The [`readme/`](./readme) folder holds the small, compile-checked examples that
`pnpm build:docs` embeds verbatim into the root [README](../README.md). Examples
that showcase a compiled query default-export it, and the README generation
script imports them directly to embed the GraphQL they compile to. They are
type-checked together with the other examples but aren't meant to be run.

## Type-checking the examples

The examples aren't part of the library's build, but they have their own
`tsconfig.json` so editors and CI can check them (after `pnpm build`):

```bash
pnpm exec tsc -p examples/tsconfig.json
```
