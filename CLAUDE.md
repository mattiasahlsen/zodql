# CLAUDE.md

Always use the scripts defined in `package.json` (via `pnpm <script>`) instead of invoking tools like `tsc`, `eslint`, `prettier`, or `vitest` directly through `npx`.

Before committing changes, run:

- `pnpm build`
- `pnpm verify`
- `pnpm test`

To update test snapshots, run `pnpm test:updateSnapshots` (do not call `vitest -u` via `npx`).
