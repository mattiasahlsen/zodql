---
"@mattiasahlsen/zodql": minor
---

Add optional schema codegen: `zodql-codegen` generates one selection builder per GraphQL type.

zodql has always been schema-blind — `z.object({ name: z.string() })` compiles whether or not `name` exists on `Repository`. The new `zodql-codegen` CLI reads an SDL file or introspection JSON and emits one builder per type into a flat output directory, so field names, scalar types, nullability and list-ness all come from the schema and a mistake is a type error rather than a runtime parse failure.

```ts
const repository = buildRepositoryField({
  name: true,
  description: true, // String -> string | null, from the schema
  primaryLanguage: buildLanguageField({ name: true }),
});
```

A builder only ever builds its own type; nested fields take another builder's result. Generated modules import nothing from each other — a selection's type is identified by a string-literal brand — so cyclic schemas are fine and `tsc` only loads the types you actually use.

This is opt-in and composes with hand-written Zod. Arguments go inside the pick via `zodqlField().withArguments(...)`; aliases go through `.extend()`, which preserves the brand. A leaf may be `true` for the generated default or any Zod schema to replace it, and custom scalars map to schemas in a `scalars.ts` that is seeded once and then owned by you — so `z.string().url()` and friends still work.

Also supported: interfaces and unions (via a reserved `__on` key, compiled to inline fragments), enums as `z.enum`, JSDoc from schema descriptions, and a `--check` mode for CI drift detection. An interface's common fields are ordinary fields, so they can be enum- or object-typed just like an object type's.

A key the GraphQL type doesn't have is a compile error naming it, in the pick and under `__on` alike — neither `P extends XPick` nor excess-property checking catches that on its own, since every property of a pick is optional and `P` is inferred from the pick itself.

Two supporting changes to the core library:

- `withUnionFragments()` now accepts fragments marked `inline: true` and spreads them as `... on Type { … }` instead of requiring a name. Named fragments are de-duplicated by name across a document, so generated code must not invent names — the same union selected twice with different fields would otherwise emit the wrong selection for one of them.
- `toSchema()` now returns the input schema's own type when no fragments are attached, instead of widening to `z.ZodType`. The runtime already returned an equivalent `ZodObject`, so this is strictly more precise, and it keeps `.extend()` available on the result. It does not carry the input's catchall, so a `z.strictObject()` comes back typed as itself but still stripping unknown keys rather than rejecting them — unchanged behaviour that the old widened return type simply hid.

`graphql` and `prettier` are optional peer dependencies, needed only when generating.
