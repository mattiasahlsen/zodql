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
