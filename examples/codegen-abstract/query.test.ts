import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { buildSchema, parse, validate } from "graphql";
import { z } from "zod";
import { zodql, hasTypename } from "@mattiasahlsen/zodql";
import { expectTypeof } from "../../src/testing/assertType.js";
import { buildQueryField } from "./generated/Query.js";
import { buildRepositoryOwnerField } from "./generated/RepositoryOwner.js";
import { buildSearchResultField } from "./generated/SearchResult.js";
import { buildUserField } from "./generated/User.js";
import { buildOrganizationField } from "./generated/Organization.js";
import { buildRepositoryField } from "./generated/Repository.js";

const schema = buildSchema(readFileSync(fileURLToPath(new URL("./schema.graphql", import.meta.url)), "utf8"));

/** An interface: common fields picked directly, type-specific ones under `__on`. */
const ownerField = buildRepositoryOwnerField(
  {
    login: true,
    avatarUrl: true,
    // A common field is an ordinary field, so it can be any kind: `status` is an
    // enum and `pinnedRepository` an object type built by its own builder — not
    // only the scalars an interface's shared fields are easiest to imagine as.
    status: true,
    pinnedRepository: buildRepositoryField({ name: true }),
    __on: {
      User: buildUserField({ bio: true }),
      Organization: buildOrganizationField({ description: true }),
    },
  },
  // Arguments go here rather than through `zodqlField()`: an abstract selection
  // isn't a ZodObject, so it can't be re-wrapped the way an object field can.
  { args: { login: "$login" } }
);

/** A union: nothing in common, so everything lives under `__on`. */
const searchField = buildSearchResultField(
  {
    __on: {
      User: buildUserField({ login: true }),
      Repository: buildRepositoryField({ name: true }),
    },
  },
  { args: { term: "$term" } }
);

const query = zodql(
  "query",
  buildQueryField({
    owner: ownerField,
    search: searchField,
  }),
  { operationName: "OwnerAndSearch" }
)
  .defineVariables({
    login: { typeName: "String!", schema: z.string() },
    term: { typeName: "String!", schema: z.string() },
  })
  .compile();

describe("generated builders for interfaces and unions", () => {
  it("compiles inline fragments, never named ones", async () => {
    await expect(query.queryString).toMatchFileSnapshot("./query.snapshot.graphql");
    // Named fragments are de-duplicated by name document-wide, which is exactly
    // why codegen must not invent them.
    expect(query.queryString).not.toContain("fragment ");
  });

  it("is a valid document against the GraphQL schema", () => {
    expect(validate(schema, parse(query.queryString)).map((error) => error.message)).toEqual([]);
  });

  it("discriminates implementors on __typename at parse time", () => {
    const parsed = query.schema.parse({
      owner: {
        __typename: "User",
        login: "octocat",
        avatarUrl: "https://…",
        status: "ACTIVE",
        pinnedRepository: { name: "zodql" },
        bio: "hi",
      },
      search: [
        { __typename: "User", login: "octocat" },
        { __typename: "Repository", name: "zodql" },
      ],
    });

    expect(parsed.owner).toEqual({
      __typename: "User",
      login: "octocat",
      avatarUrl: "https://…",
      status: "ACTIVE",
      pinnedRepository: { name: "zodql" },
      bio: "hi",
    });
    expect(parsed.search).toHaveLength(2);
  });

  it("strips fields belonging to a different implementor", () => {
    const parsed = query.schema.parse({
      owner: {
        __typename: "Organization",
        login: "anthropics",
        avatarUrl: "https://…",
        status: "ACTIVE",
        pinnedRepository: null,
        description: "hi",
        // Belongs to the User branch — must not survive.
        bio: "leaked",
      },
      search: [],
    });

    expect(parsed.owner).not.toHaveProperty("bio");
    expect(parsed.owner).toMatchObject({ __typename: "Organization", description: "hi" });
  });

  it("accepts an unknown implementor with only the common fields (requireOne defaults to false)", () => {
    const parsed = query.schema.parse({
      owner: {
        __typename: "Bot",
        login: "dependabot",
        avatarUrl: "https://…",
        status: "ACTIVE",
        pinnedRepository: null,
      },
      search: [],
    });

    expect(parsed.owner).toEqual({
      __typename: "Bot",
      login: "dependabot",
      avatarUrl: "https://…",
      status: "ACTIVE",
      pinnedRepository: null,
    });
    expect(hasTypename(parsed.owner, "User")).toBe(false);
  });

  it("rejects a value that violates the schema's own types", () => {
    // `status` is AccountStatus! — the generated enum rejects anything else.
    expect(() =>
      query.schema.parse({
        owner: {
          __typename: "User",
          login: "octocat",
          avatarUrl: "x",
          status: "NOPE",
          pinnedRepository: null,
          bio: null,
        },
        search: [],
      })
    ).toThrow();
  });

  it("infers a discriminated union from the picked implementors", () => {
    // The common half carries the enum and object field types straight from the
    // schema, not the `string` a scalars-only emitter would have produced.
    type Common = {
      login: string;
      avatarUrl: string;
      status: "ACTIVE" | "SUSPENDED";
      pinnedRepository: { name: string } | null;
    };

    const owner = null as unknown as z.infer<typeof ownerField>;
    expectTypeof(owner).toBe<
      | (Common & { __typename: "Organization" } & { description: string | null })
      | (Common & { __typename: "User" } & { bio: string | null })
      | (Common & { __typename: string })
    >();
  });
});

/**
 * Mistakes the generated builders reject at compile time. Never called — `tsc -p
 * examples` is the assertion runner, so every `@ts-expect-error` below fails the
 * build if the error it names stops happening.
 */
export function typeContract() {
  // A typo among valid fields. `P extends RepositoryOwnerPick` can't catch this
  // on its own (every property is optional) and excess-property checking never
  // runs against `P`, since `P` is inferred from this same literal.
  // @ts-expect-error — `avatarUrlll` is not a field of RepositoryOwner
  const typo = buildRepositoryOwnerField({ login: true, avatarUrlll: true });

  // An object-typed common field needs its own builder's result.
  // @ts-expect-error — `pinnedRepository` selects an object type, not a leaf
  const objectAsLeaf = buildRepositoryOwnerField({ pinnedRepository: true });

  const wrongImplementor = buildRepositoryOwnerField({
    // @ts-expect-error — a Repository selection is not an Organization selection
    __on: { Organization: buildRepositoryField({ name: true }) },
  });

  // Unknown implementors are caught too: `__on`'s members are a nested literal,
  // so the outer excess-key guard can't see them and needs its own.
  const unknownImplementor = buildRepositoryOwnerField({
    // @ts-expect-error — `Bot` does not implement RepositoryOwner
    __on: { User: buildUserField({ bio: true }), Bot: buildUserField({ bio: true }) },
  });

  return { typo, objectAsLeaf, wrongImplementor, unknownImplementor };
}
