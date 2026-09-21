import z from "zod";
import { zodqlField } from "../zodql-field-builder.js";
import { zodql, zodqlFragment } from "../zodql-builder.js";
import { normalizeIndentation } from "../testing/normalizeIndentation.js";
import { hasTypename } from "../utils/hasTypename.js";

/**
 * Union fragments passed with `inline: true` are spread directly into the
 * parent selection instead of being emitted as standalone definitions.
 *
 * This is what codegen relies on: a generated builder can't invent fragment
 * names safely, because `collectFragments` de-duplicates by name and keeps the
 * first one it sees — so the same union selected twice in one document with
 * different picks would silently emit the wrong selection for one of them.
 */
describe("inline union fragments", () => {
  const userFragment = { on: "User", inline: true, schema: z.object({ email: z.string() }) } as const;
  const adminFragment = { on: "Admin", inline: true, schema: z.object({ adminLevel: z.number() }) } as const;

  const buildQuery = (requireOne: boolean) =>
    zodql(
      "query",
      z.object({
        item: zodqlField()
          .withUnionFragments([userFragment, adminFragment], { requireOne })
          .toSchema(z.object({ id: z.string() })),
      })
    ).compile();

  it("spreads the fragments inline and emits no fragment definitions", () => {
    expect(buildQuery(true).queryString).toBe(
      normalizeIndentation(`
        query {
          item {
            id
            __typename
            ... on User {
              email
            }
            ... on Admin {
              adminLevel
            }
          }
        }
      `)
    );
  });

  it("selects the matching branch at parse time", () => {
    const { schema } = buildQuery(true);

    expect(schema.parse({ item: { id: "1", __typename: "User", email: "a@b.c" } })).toEqual({
      item: { id: "1", __typename: "User", email: "a@b.c" },
    });

    // Fields belonging to the other branch are stripped.
    expect(schema.parse({ item: { id: "1", __typename: "Admin", adminLevel: 3, email: "a@b.c" } })).toEqual({
      item: { id: "1", __typename: "Admin", adminLevel: 3 },
    });

    // requireOne: true rejects a typename with no branch.
    expect(() => schema.parse({ item: { id: "1", __typename: "Ghost" } })).toThrow();
  });

  it("accepts an unknown typename with only the base fields when requireOne is false", () => {
    const parsed = buildQuery(false).schema.parse({ item: { id: "1", __typename: "Ghost", email: "a@b.c" } });
    expect(parsed).toEqual({ item: { id: "1", __typename: "Ghost" } });

    const { item } = parsed;
    expect(hasTypename(item, "User")).toBe(false);
  });

  it("still collects named fragments nested inside an inline union fragment", () => {
    const addressFragment = zodqlFragment({
      name: "AddressFragment",
      on: "Address",
      schema: z.object({ city: z.string() }),
    });

    const query = zodql(
      "query",
      z.object({
        item: zodqlField()
          .withUnionFragments(
            [
              {
                on: "User",
                inline: true,
                schema: z.object({
                  address: zodqlField()
                    .withRequiredFragment(addressFragment)
                    .toSchema(z.object({ id: z.string() })),
                }),
              },
            ],
            { requireOne: true }
          )
          .toSchema(z.object({ id: z.string() })),
      })
    ).compile();

    expect(query.queryString).toBe(
      normalizeIndentation(`
        query {
          item {
            id
            __typename
            ... on User {
              address {
                id
                ...AddressFragment
              }
            }
          }
        }

        fragment AddressFragment on Address {
          city
        }
      `)
    );
  });

  it("can mix an inline union fragment with a named one", () => {
    const adminNamed = zodqlFragment({
      name: "AdminFragment",
      on: "Admin",
      schema: z.object({ adminLevel: z.number() }),
    });

    const query = zodql(
      "query",
      z.object({
        item: zodqlField()
          .withUnionFragments([userFragment, adminNamed], { requireOne: true })
          .toSchema(z.object({ id: z.string() })),
      })
    ).compile();

    expect(query.queryString).toBe(
      normalizeIndentation(`
        query {
          item {
            id
            __typename
            ... on User {
              email
            }
            ...AdminFragment
          }
        }

        fragment AdminFragment on Admin {
          adminLevel
        }
      `)
    );
  });
});
