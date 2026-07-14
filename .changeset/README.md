# Changesets

This directory is managed by [Changesets](https://github.com/changesets/changesets).

When you make a change that should be released, run:

```bash
pnpm changeset
```

Follow the prompts to describe the change and pick a semver bump (patch/minor/major). Commit the generated file in `.changeset/` alongside your PR.

On merge to `main`, CI opens or updates a "Version Packages" PR that bundles all pending changesets into a version bump and changelog entry. Merging that PR triggers the actual npm publish.

See the [Changesets documentation](https://github.com/changesets/changesets/tree/main/docs) for more information.
