/**
 * The assignability contract the generated builders rest on.
 *
 * Most of this file is asserted by `tsc`, not by vitest: the `typeContract()`
 * function below is never called, and exists only so its body is type-checked.
 * The `describe` block at the end covers the one thing types can't prove — that
 * `applyWrappers` folds the same way `ApplyWrappers` says it does.
 *
 * This doubles as a **zod-upgrade tripwire**. The selection brand lives in
 * `ZodObject`'s `Config` type parameter, so it depends on zod internals: the
 * shape of `z.core.$ZodObjectConfig`, the `out Config` variance annotation, and
 * `Config` being threaded through `.extend()` / `.pick()` / `.omit()` /
 * `.partial()`. `skipLibCheck: true` means a change to any of those inside zod
 * would otherwise pass silently. If this file starts failing after a zod bump,
 * the brand — not this file — is what needs revisiting.
 */
import { z } from "zod";
import { expectTypeof } from "../testing/assertType.js";
import { zodqlField } from "../zodql-field-builder.js";
import { applyWrappers } from "./build-selection.js";
import { asSelectionOf, type ObjectSelection } from "./brand.js";
import type { ApplyWrappers, LeafPick, NonEmptyPick, ResolveLeaf } from "./pick.js";

// Hand-written stands-in for what the generator will emit.
type LanguagePick = { readonly name?: LeafPick };
interface LanguageDefaults {
  name: z.ZodString;
}
interface LanguageWrappers {
  name: readonly [];
}
type LanguageShape<P extends LanguagePick> = {
  [K in Extract<keyof P, keyof LanguagePick>]: ApplyWrappers<
    LanguageWrappers[K],
    ResolveLeaf<P[K], LanguageDefaults[K]>
  >;
};
declare function buildLanguageField<const P extends LanguagePick>(
  pick: P & NonEmptyPick<P>
): ObjectSelection<"Language", LanguageShape<P>>;

type RepositoryPick = {
  readonly name?: LeafPick;
  readonly description?: LeafPick;
  readonly primaryLanguage?: ObjectSelection<"Language">;
};
interface RepositoryDefaults {
  name: z.ZodString;
  description: z.ZodString;
  primaryLanguage: never;
}
interface RepositoryWrappers {
  name: readonly [];
  description: readonly ["nullable"];
  primaryLanguage: readonly ["nullable"];
}
type RepositoryShape<P extends RepositoryPick> = {
  [K in Extract<keyof P, keyof RepositoryPick>]: ApplyWrappers<
    RepositoryWrappers[K],
    ResolveLeaf<P[K], RepositoryDefaults[K]>
  >;
};
declare function buildRepositoryField<const P extends RepositoryPick>(
  pick: P & NonEmptyPick<P>
): ObjectSelection<"Repository", RepositoryShape<P>>;

declare const languageSelection: ObjectSelection<"Language", { name: z.ZodString }>;
declare function inferOf<S extends z.ZodType>(schema: S): z.infer<S>;

/** Never called. Its body is the contract; `tsc` is the assertion runner. */
export function typeContract() {
  // -------------------------------------------------------------------------
  // 1. A selection on one type is not assignable to a selection on another.
  // -------------------------------------------------------------------------
  // @ts-expect-error — "Language" is not "Repository"
  const wrongBrand: ObjectSelection<"Repository", { name: z.ZodString }> = languageSelection;

  // A plain z.object() carries z.core.$strip, not a brand, so it is rejected too.
  // @ts-expect-error — an unbranded object is not a selection
  const unbranded: ObjectSelection<"Language", { name: z.ZodString }> = z.object({ name: z.string() });

  // -------------------------------------------------------------------------
  // 2. `.extend()` / `.pick()` preserve the brand.
  // -------------------------------------------------------------------------
  const extended = buildRepositoryField({ name: true }).extend({ openIssues: z.object({ totalCount: z.number() }) });
  const stillARepositorySelection: ObjectSelection<"Repository"> = extended;
  const stillASelectionAfterPick: ObjectSelection<"Repository"> = buildRepositoryField({
    name: true,
    description: true,
  }).pick({ name: true });

  // A branded selection still flows into anything expecting a plain ZodObject —
  // this is what lets it reach zodql() and zodqlField().toSchema().
  const asPlainObject: z.ZodObject = buildRepositoryField({ name: true });

  // -------------------------------------------------------------------------
  // 3. The brand is invisible to z.infer.
  // -------------------------------------------------------------------------
  expectTypeof(null as unknown as z.infer<ObjectSelection<"Language", { name: z.ZodString }>>).toBe<{ name: string }>();

  // -------------------------------------------------------------------------
  // 4. `const P` captures literal keys, child types and leaf overrides; an
  //    empty or malformed pick is rejected.
  // -------------------------------------------------------------------------
  const nested = buildRepositoryField({
    name: true,
    description: true,
    primaryLanguage: buildLanguageField({ name: true }),
  });
  expectTypeof(null as unknown as z.infer<typeof nested>).toBe<{
    name: string;
    description: string | null;
    primaryLanguage: { name: string } | null;
  }>();

  // A leaf override replaces the default schema but still gets the field's modifiers.
  const overridden = buildRepositoryField({ description: z.literal("fixed") });
  expectTypeof(null as unknown as z.infer<typeof overridden>).toBe<{ description: "fixed" | null }>();

  // @ts-expect-error — a selection must pick at least one field
  const emptyPick = buildRepositoryField({});
  // @ts-expect-error — unknown field
  const unknownField = buildRepositoryField({ nope: true });
  // @ts-expect-error — an object field needs a selection, not `true`
  const objectAsTrue = buildRepositoryField({ primaryLanguage: true });
  // @ts-expect-error — the wrong type's selection in an object slot
  const wrongChild = buildRepositoryField({ primaryLanguage: buildRepositoryField({ name: true }) });

  // -------------------------------------------------------------------------
  // 5. A concrete selection satisfies the bare `ObjectSelection<Name>` constraint.
  // -------------------------------------------------------------------------
  const asConstraint: ObjectSelection<"Language"> = buildLanguageField({ name: true });

  // -------------------------------------------------------------------------
  // 6. LeafPick accepts a refined scalar schema and rejects an object selection.
  // -------------------------------------------------------------------------
  const refinedLeaf: LeafPick = z.string().url();
  // @ts-expect-error — an object selection is not a leaf
  const objectAsLeaf: LeafPick = z.object({ name: z.string() });

  // -------------------------------------------------------------------------
  // 7. ApplyWrappers types every GraphQL type modifier correctly. The runtime
  //    half of this pairing is asserted in the `describe` block below.
  // -------------------------------------------------------------------------
  expectTypeof(inferOf(applyWrappers([], z.string()))).toBe<string>(); // String!
  expectTypeof(inferOf(applyWrappers(["nullable"], z.string()))).toBe<string | null>(); // String
  expectTypeof(inferOf(applyWrappers(["array"], z.string()))).toBe<string[]>(); // [String!]!
  expectTypeof(inferOf(applyWrappers(["nullable", "array"], z.string()))).toBe<string[] | null>(); // [String!]
  expectTypeof(inferOf(applyWrappers(["array", "nullable"], z.string()))).toBe<(string | null)[]>(); // [String]!
  expectTypeof(inferOf(applyWrappers(["nullable", "array", "nullable"], z.string()))).toBe<(string | null)[] | null>(); // [String]
  expectTypeof(inferOf(applyWrappers(["array", "array"], z.string()))).toBe<string[][]>(); // [[String!]!]!

  // -------------------------------------------------------------------------
  // 8. toSchema() keeps the schema a ZodObject when no fragments are attached,
  //    so an argument-carrying field still fits a nested pick slot...
  // -------------------------------------------------------------------------
  const withArgs: ObjectSelection<"Language"> = zodqlField()
    .withArguments({ first: "10" })
    .toSchema(buildLanguageField({ name: true }));

  // ...and the alias escape hatch keeps the parent's brand.
  const aliased = buildRepositoryField({ name: true }).extend({
    primaryLang: zodqlField()
      .asAliasFor("primaryLanguage")
      .toSchema(buildLanguageField({ name: true })),
  });
  expectTypeof(null as unknown as z.infer<typeof aliased>).toBe<{
    name: string;
    primaryLang: { name: string };
  }>();

  // NOTE: `ObjectSelection<Name>` defaults Shape to `$ZodLooseShape`, so it is
  // only ever correct in a *parameter* position — annotating a variable with it
  // erases the field types (z.infer collapses to Record<string, unknown>).
  const aliasedFitsSlot: ObjectSelection<"Repository"> = aliased;

  return {
    wrongBrand,
    unbranded,
    extended,
    stillARepositorySelection,
    stillASelectionAfterPick,
    asPlainObject,
    nested,
    overridden,
    emptyPick,
    unknownField,
    objectAsTrue,
    wrongChild,
    asConstraint,
    refinedLeaf,
    objectAsLeaf,
    withArgs,
    aliased,
    aliasedFitsSlot,
  };
}

describe("applyWrappers", () => {
  // Each case pairs a GraphQL type with the wrappers the generator emits for
  // it. The expected values are what the resulting schema must accept.
  it.each([
    { graphql: "String!", wrappers: [] as const, valid: ["a"], invalid: [null, ["a"]] },
    { graphql: "String", wrappers: ["nullable"] as const, valid: ["a", null], invalid: [["a"]] },
    { graphql: "[String!]!", wrappers: ["array"] as const, valid: [["a"], []], invalid: [null, ["a", null]] },
    { graphql: "[String!]", wrappers: ["nullable", "array"] as const, valid: [["a"], null], invalid: [["a", null]] },
    { graphql: "[String]!", wrappers: ["array", "nullable"] as const, valid: [["a", null]], invalid: [null] },
    {
      graphql: "[String]",
      wrappers: ["nullable", "array", "nullable"] as const,
      valid: [["a", null], null],
      invalid: ["a"],
    },
    { graphql: "[[String!]!]!", wrappers: ["array", "array"] as const, valid: [[["a"]], []], invalid: [["a"], null] },
  ])("folds $wrappers to match $graphql", ({ wrappers, valid, invalid }) => {
    const schema = applyWrappers(wrappers, z.string());
    for (const value of valid) {
      expect(schema.safeParse(value).success, `expected ${JSON.stringify(value)} to parse`).toBe(true);
    }
    for (const value of invalid) {
      expect(schema.safeParse(value).success, `expected ${JSON.stringify(value)} to be rejected`).toBe(false);
    }
  });

  it("asSelectionOf adopts a hand-written schema without changing it", () => {
    const schema = z.object({ name: z.string() });
    expect(asSelectionOf<"Language", typeof schema>(schema)).toBe(schema);
  });
});
