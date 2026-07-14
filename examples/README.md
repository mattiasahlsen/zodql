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

## Type-checking the examples

The examples aren't part of the library's build, but they have their own
`tsconfig.json` so editors and CI can check them (after `pnpm build`):

```bash
pnpm exec tsc -p examples/tsconfig.json
```
