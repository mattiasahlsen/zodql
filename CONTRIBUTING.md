# Contributing

Thanks for considering a contribution to zodql!

## Setup

This project uses [pnpm](https://pnpm.io/). With the Node version in [`.nvmrc`](.nvmrc) active:

```bash
pnpm install
```

## Development

Before committing, make sure the following all pass:

```bash
pnpm build
pnpm verify
pnpm test
```

- `pnpm build` regenerates generated files (lint/format fixes, TypeScript build output, README API docs).
- `pnpm verify` checks lint, formatting, types, and that the README is in sync with [`README_TEMPLATE.md`](README_TEMPLATE.md) without modifying anything.
- `pnpm test` runs the test suite with coverage.

If you need to update test snapshots, run `pnpm test:updateSnapshots`.

The public API documentation in `README.md` is generated from `README_TEMPLATE.md` plus TypeDoc output — edit `README_TEMPLATE.md`, not `README.md` directly, then run `pnpm run build:docs`.

## Submitting changes

1. Open a PR with your change.
2. If your change should be released (a bug fix, feature, or anything user-facing), add a changeset describing it:

   ```bash
   pnpm changeset
   ```

   Pick the appropriate semver bump (patch/minor/major) and describe the change from a consumer's perspective. Commit the generated file under `.changeset/` as part of your PR.

3. CI runs lint, formatting, type-checking, docs verification, and tests on every PR — make sure they're green.

Changes that don't affect the published package (docs typos, internal tooling, CI config) don't need a changeset.
