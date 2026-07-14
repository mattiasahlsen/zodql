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

| Example                                            | Description                                                            | Run                                                              |
| -------------------------------------------------- | --------------------------------------------------------------------- | --------------------------------------------------------------- |
| [github-list-files](./github-list-files/README.md) | List every file on a branch of a GitHub repository via GraphQL.       | `GITHUB_TOKEN=… pnpm example:github-list-files <owner>/<repo>`   |

See each example's README for prerequisites (such as API tokens) and usage.

## README snippets

The [`readme/`](./readme) folder holds the small, compile-checked examples that
`pnpm build:docs` embeds verbatim into the root [README](../README.md); their
exported compiled queries are also imported (via
[`print-readme-queries.ts`](./print-readme-queries.ts)) to generate the GraphQL
snippets shown alongside them. They are type-checked together with the other
examples but aren't meant to be run.

## Type-checking the examples

The examples aren't part of the library's build, but they have their own
`tsconfig.json` so editors and CI can check them (after `pnpm build`):

```bash
pnpm exec tsc -p examples/tsconfig.json
```
