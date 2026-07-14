# CLAUDE.md

Always use the scripts defined in `package.json` (via `pnpm <script>`) instead of invoking tools like `tsc`, `eslint`, `prettier`, or `vitest` directly through `npx`.

Before committing changes, run:

- `pnpm build`
- `pnpm verify`
- `pnpm test`

To update test snapshots, run `pnpm test:updateSnapshots` (do not call `vitest -u` via `npx`).

## Multi-line shell text (commit messages, PR bodies, etc.)

Do not pass multi-line text (commit messages, PR descriptions, etc.) via a `$(cat <<'EOF' ... EOF)` heredoc in a Bash command. The command execution environment wraps the whole command in single quotes, so any literal apostrophe in the text (e.g. "project's") breaks the quoting and the command fails with an "unexpected EOF" / unmatched quote error.

Instead, write the text to a temporary file with the `Write` tool, then reference it:

- `git commit -F <file>` instead of `git commit -m "$(cat <<'EOF' ...)"`
- `gh pr create --body-file <file>` instead of `gh pr create --body "$(cat <<'EOF' ...)"`

## README.md

`README.md` is generated — do not edit it directly. Instead, edit `README_TEMPLATE.md` and run `pnpm build:docs` to regenerate `README.md`.

## Changesets

Any change that should be released needs a changeset, or it won't be published. `pnpm changeset` is interactive and can't be run non-interactively here, so add the file by hand: create `.changeset/<short-kebab-name>.md` with frontmatter naming the package and a semver bump, followed by a summary. This repo is pre-1.0, so breaking changes get a `minor` bump (not `major`); use `patch` for bug fixes.

```markdown
---
"@mattiasahlsen/zodql": minor
---

Short description of the change.
```

Commit the changeset alongside the PR. On merge to `main`, CI opens/updates a "Release" PR that bundles pending changesets; merging that publishes to npm.
