import z from "zod";
import { zodqlField } from "../ZodqlFieldBuilder.js";
import { zodql, zodqlFragment } from "../ZodqlBuilder.js";
import { normalizeIndentation } from "../testing/normalizeIndentation.js";
import { expectTypeof } from "../testing/assertType.js";

describe("union fragments", () => {
  const userFragment = zodqlFragment({
    name: "UserFragment",
    on: "User",
    schema: z.object({
      email: z.string(),
    }),
  });

  const adminFragment = zodqlFragment({
    name: "AdminFragment",
    on: "Admin",
    schema: z.object({
      adminLevel: z.number(),
    }),
  });

  const oneFragmentQueryString = normalizeIndentation(`
    query {
      node {
        item {
          id
          __typename
          ...UserFragment
        }
      }
    }

    fragment UserFragment on User {
      email
    }
  `);

  const twoFragmentQueryString = normalizeIndentation(`
    query {
      node {
        item {
          id
          __typename
          ...UserFragment
          ...AdminFragment
        }
      }
    }

    fragment UserFragment on User {
      email
    }

    fragment AdminFragment on Admin {
      adminLevel
    }
  `);

  function buildOneFragmentQuery(requireOne: true): ReturnType<typeof buildOneFragmentQueryRequired>;
  function buildOneFragmentQuery(requireOne: false): ReturnType<typeof buildOneFragmentQueryOptional>;
  function buildOneFragmentQuery(requireOne: boolean) {
    return requireOne ? buildOneFragmentQueryRequired() : buildOneFragmentQueryOptional();
  }
  const buildOneFragmentQueryRequired = () =>
    zodql(
      "query",
      z.object({
        node: z.object({
          item: zodqlField()
            .withUnionFragments([userFragment], { requireOne: true })
            .toSchema(z.object({ id: z.string() })),
        }),
      })
    ).compile();
  const buildOneFragmentQueryOptional = () =>
    zodql(
      "query",
      z.object({
        node: z.object({
          item: zodqlField()
            .withUnionFragments([userFragment], { requireOne: false })
            .toSchema(z.object({ id: z.string() })),
        }),
      })
    ).compile();

  function buildTwoFragmentQuery(requireOne: true): ReturnType<typeof buildTwoFragmentQueryRequired>;
  function buildTwoFragmentQuery(requireOne: false): ReturnType<typeof buildTwoFragmentQueryOptional>;
  function buildTwoFragmentQuery(requireOne: boolean) {
    return requireOne ? buildTwoFragmentQueryRequired() : buildTwoFragmentQueryOptional();
  }
  const buildTwoFragmentQueryRequired = () =>
    zodql(
      "query",
      z.object({
        node: z.object({
          item: zodqlField()
            .withUnionFragments([userFragment, adminFragment], { requireOne: true })
            .toSchema(z.object({ id: z.string() })),
        }),
      })
    ).compile();
  const buildTwoFragmentQueryOptional = () =>
    zodql(
      "query",
      z.object({
        node: z.object({
          item: zodqlField()
            .withUnionFragments([userFragment, adminFragment], { requireOne: false })
            .toSchema(z.object({ id: z.string() })),
        }),
      })
    ).compile();

  describe("requireOne: true", () => {
    it("fails parsing when __typename matches none of the fragments (one fragment)", () => {
      const { schema, queryString } = buildOneFragmentQuery(true);
      expect(queryString).toBe(oneFragmentQueryString);
      expect(() => schema.parse({ node: { item: { id: "1", __typename: "Other" } } })).toThrow(z.ZodError);
    });

    it("includes the matching fragment's data when __typename matches (one fragment)", () => {
      const { schema, queryString } = buildOneFragmentQuery(true);
      expect(queryString).toBe(oneFragmentQueryString);

      const input = {
        node: { item: { id: "1", __typename: "User" as const, email: "a@b.com" } },
      } satisfies z.infer<typeof schema>;

      expect(schema.parse(input)).toEqual(input);
    });

    it("fails parsing when __typename matches none of the fragments (two fragments)", () => {
      const { schema, queryString } = buildTwoFragmentQuery(true);
      expect(queryString).toBe(twoFragmentQueryString);
      expect(() => schema.parse({ node: { item: { id: "1", __typename: "Other" } } })).toThrow(z.ZodError);
    });

    it("applies the correct fragment's schema by __typename (two fragments)", () => {
      const { schema, queryString } = buildTwoFragmentQuery(true);
      expect(queryString).toBe(twoFragmentQueryString);

      const userInput = {
        node: { item: { id: "1", __typename: "User" as const, email: "a@b.com" } },
      } satisfies z.infer<typeof schema>;
      expect(schema.parse(userInput)).toEqual(userInput);

      const adminInput = {
        node: { item: { id: "2", __typename: "Admin" as const, adminLevel: 10 } },
      } satisfies z.infer<typeof schema>;
      expect(schema.parse(adminInput)).toEqual(adminInput);
    });

    it("fails parsing when the matched fragment is missing a required field", () => {
      const { schema, queryString } = buildOneFragmentQuery(true);
      expect(queryString).toBe(oneFragmentQueryString);
      expect(
        () => schema.parse({ node: { item: { id: "1", __typename: "User" } } }) // missing email
      ).toThrow(z.ZodError);
    });

    it("strips data belonging to the non-matching fragment", () => {
      const { schema, queryString } = buildTwoFragmentQuery(true);
      expect(queryString).toBe(twoFragmentQueryString);

      const result = schema.parse({
        node: { item: { id: "1", __typename: "User", email: "a@b.com", adminLevel: 99 } },
      });

      const expected = {
        node: { item: { id: "1", __typename: "User" as const, email: "a@b.com" } },
      } satisfies z.infer<typeof schema>;

      expect(result).toEqual(expected);
      expect(result.node.item).not.toHaveProperty("adminLevel");
    });

    it("narrows the parsed result's type via __typename", () => {
      const { schema, queryString } = buildTwoFragmentQuery(true);
      expect(queryString).toBe(twoFragmentQueryString);

      const input = {
        node: { item: { id: "1", __typename: "User" as const, email: "a@b.com" } },
      } satisfies z.infer<typeof schema>;

      const result = schema.parse(input);
      expect(result).toEqual(input);

      const item = result.node.item;
      if (item.__typename === "User") {
        expectTypeof(item.email).toBe<string>();
      } else if (item.__typename === "Admin") {
        expectTypeof(item.adminLevel).toBe<number>();
      }
    });
  });

  describe("requireOne: false", () => {
    it("parses successfully when __typename matches none of the fragments, omitting fragment data (one fragment)", () => {
      const { schema, queryString } = buildOneFragmentQuery(false);
      expect(queryString).toBe(oneFragmentQueryString);

      const input = {
        node: { item: { id: "1", __typename: "Other" } },
      } satisfies z.infer<typeof schema>;

      const result = schema.parse(input);
      expect(result).toEqual(input);
      expect(result.node.item).not.toHaveProperty("email");
    });

    it("includes the matching fragment's data when __typename matches (one fragment)", () => {
      const { schema, queryString } = buildOneFragmentQuery(false);
      expect(queryString).toBe(oneFragmentQueryString);

      const input = {
        node: { item: { id: "1", __typename: "User" as const, email: "a@b.com" } },
      } satisfies z.infer<typeof schema>;

      expect(schema.parse(input)).toEqual(input);
    });

    it("parses successfully when __typename matches none of the fragments, omitting fragment data (two fragments)", () => {
      const { schema, queryString } = buildTwoFragmentQuery(false);
      expect(queryString).toBe(twoFragmentQueryString);

      const input = {
        node: { item: { id: "1", __typename: "Other" } },
      } satisfies z.infer<typeof schema>;

      expect(schema.parse(input)).toEqual(input);
    });

    it("includes the matching fragment's data when one of two fragments matches", () => {
      const { schema, queryString } = buildTwoFragmentQuery(false);
      expect(queryString).toBe(twoFragmentQueryString);

      const input = {
        node: { item: { id: "1", __typename: "Admin" as const, adminLevel: 3 } },
      } satisfies z.infer<typeof schema>;

      expect(schema.parse(input)).toEqual(input);
    });

    it("strips data belonging to the non-matching fragment", () => {
      const { schema, queryString } = buildTwoFragmentQuery(false);
      expect(queryString).toBe(twoFragmentQueryString);

      const result = schema.parse({
        node: { item: { id: "1", __typename: "User", email: "a@b.com", adminLevel: 99 } },
      });

      const expected = {
        node: { item: { id: "1", __typename: "User" as const, email: "a@b.com" } },
      } satisfies z.infer<typeof schema>;

      expect(result).toEqual(expected);
      expect(result.node.item).not.toHaveProperty("adminLevel");
    });

    it("rejects a known __typename whose fragment fields are missing (one fragment)", () => {
      const { schema } = buildOneFragmentQuery(false);

      expect(() => schema.parse({ node: { item: { id: "1", __typename: "User" } } }))
        .toThrowErrorMatchingInlineSnapshot(`
          [ZodError: [
            {
              "code": "custom",
              "path": [
                "node",
                "item",
                "__typename"
              ],
              "message": "Invalid input"
            }
          ]]
        `);
    });

    it("rejects a known __typename whose fragment fields are missing (two fragments, either typename)", () => {
      const { schema } = buildTwoFragmentQuery(false);

      // __typename matches "Admin" but adminLevel is missing
      expect(() => schema.parse({ node: { item: { id: "1", __typename: "Admin" } } }))
        .toThrowErrorMatchingInlineSnapshot(`
          [ZodError: [
            {
              "code": "custom",
              "path": [
                "node",
                "item",
                "__typename"
              ],
              "message": "Invalid input"
            }
          ]]
        `);

      // __typename matches "User" but email is missing
      expect(() => schema.parse({ node: { item: { id: "1", __typename: "User" } } }))
        .toThrowErrorMatchingInlineSnapshot(`
          [ZodError: [
            {
              "code": "custom",
              "path": [
                "node",
                "item",
                "__typename"
              ],
              "message": "Invalid input"
            }
          ]]
        `);
    });

    it("produces the same query string as requireOne: true", () => {
      const requireOneTrue = buildTwoFragmentQuery(true).queryString;
      const requireOneFalse = buildTwoFragmentQuery(false).queryString;

      expect(requireOneFalse).toBe(requireOneTrue);
      expect(requireOneFalse).toBe(twoFragmentQueryString);
    });
  });

  describe("zero fragments", () => {
    it.each([true, false])("throws a runtime error when an empty array is passed (requireOne: %s)", (requireOne) => {
      expect(() =>
        zodqlField()
          .withUnionFragments([] as any, { requireOne })
          .toSchema(z.object({ id: z.string() }))
      ).toThrow("Union fragments array can not be empty");
    });
  });

  describe("combined with other field configuration", () => {
    it("emits both a required regular fragment and the union fragments on the same field", () => {
      const baseFragment = zodqlFragment({
        name: "BaseFragment",
        on: "Base",
        schema: z.object({ createdAt: z.string() }),
      });

      const { schema, queryString } = zodql(
        "query",
        z.object({
          node: z.object({
            item: zodqlField()
              .withRequiredFragment(baseFragment)
              .withUnionFragments([userFragment, adminFragment], { requireOne: true })
              .toSchema(z.object({ id: z.string() })),
          }),
        })
      ).compile();

      expect(queryString).toBe(
        normalizeIndentation(`
          query {
            node {
              item {
                id
                __typename
                ...BaseFragment
                ...UserFragment
                ...AdminFragment
              }
            }
          }

          fragment BaseFragment on Base {
            createdAt
          }

          fragment UserFragment on User {
            email
          }

          fragment AdminFragment on Admin {
            adminLevel
          }
        `)
      );

      const input = {
        node: {
          item: { id: "1", __typename: "User" as const, email: "a@b.com", createdAt: "2024-01-01" },
        },
      } satisfies z.infer<typeof schema>;

      expect(schema.parse(input)).toEqual(input);
    });

    it("works on an array field", () => {
      const { schema, queryString } = zodql(
        "query",
        z.object({
          nodes: z.object({
            items: zodqlField()
              .withUnionFragments([userFragment, adminFragment], { requireOne: true })
              .toSchema(z.object({ id: z.string() }))
              .array(),
          }),
        })
      ).compile();

      expect(queryString).toBe(
        normalizeIndentation(`
          query {
            nodes {
              items {
                id
                __typename
                ...UserFragment
                ...AdminFragment
              }
            }
          }

          fragment UserFragment on User {
            email
          }

          fragment AdminFragment on Admin {
            adminLevel
          }
        `)
      );

      const input = {
        nodes: {
          items: [
            { id: "1", __typename: "User" as const, email: "a@b.com" },
            { id: "2", __typename: "Admin" as const, adminLevel: 3 },
          ],
        },
      } satisfies z.infer<typeof schema>;

      expect(schema.parse(input)).toEqual(input);
    });

    it("works when the two union fragments target unrelated GraphQL types", () => {
      const userFrag = zodqlFragment({
        name: "UserFragment",
        on: "User",
        schema: z.object({ name: z.string() }),
      });

      const friendFragment = zodqlFragment({
        name: "FriendFragment",
        on: "Friend",
        schema: z.object({ name: z.string() }),
      });

      const userSchema = z.object({
        id: z.string(),
        friend: zodqlField()
          .withUnionFragments([userFrag, friendFragment], { requireOne: true })
          .toSchema(z.object({ id: z.string() })),
      });

      const { queryString, schema } = zodql("query", z.object({ user: userSchema })).compile();

      expect(queryString).toBe(
        normalizeIndentation(`
          query {
            user {
              id
              friend {
                id
                __typename
                ...UserFragment
                ...FriendFragment
              }
            }
          }

          fragment UserFragment on User {
            name
          }

          fragment FriendFragment on Friend {
            name
          }
        `)
      );

      const exampleValue: z.infer<typeof schema> = {
        user: {
          id: "user-1",
          friend: { id: "friend-1", name: "Friend Name", __typename: "Friend" },
        },
      };

      expect(exampleValue).toEqual(schema.parse(exampleValue));

      expectTypeof(exampleValue).toExtend<{
        user: {
          id: string;
          friend: { id: string; name: string; __typename: "User" | "Friend" };
        };
      }>();
    });
  });
});
