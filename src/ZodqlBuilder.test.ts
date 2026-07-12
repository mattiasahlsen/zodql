import z from "zod";
import { zodql, zodqlFragment } from "./ZodqlBuilder.js";
import { zodqlField } from "./ZodqlFieldBuilder.js";
import { normalizeIndentation } from "./testing/normalizeIndentation.js";

describe("zodql", () => {
  describe("basic field shapes", () => {
    it("converts a schema with primitive fields to a graphql query", () => {
      const userSchema = z.object({
        id: z.string(),
        name: z.string(),
        age: z.number(),
      });

      const result = zodql("query", z.object({ user: userSchema })).compile();

      expect(result.queryString).toBe(
        normalizeIndentation(`
          query {
            user {
              id
              name
              age
            }
          }
        `)
      );
      expect(result.variables).toEqual({});

      const exampleValue: z.infer<typeof result.schema> = {
        user: { id: "user-1", name: "John Doe", age: 30 },
      };
      expect(exampleValue).toEqual(result.schema.parse(exampleValue));
    });

    it("converts a schema with a nested object to a graphql query", () => {
      const userSchema = z.object({
        id: z.string(),
        details: z.object({
          name: z.string(),
          mail: z.string(),
        }),
      });

      const result = zodql("query", z.object({ user: userSchema })).compile();

      expect(result.queryString).toBe(
        normalizeIndentation(`
          query {
            user {
              id
              details {
                name
                mail
              }
            }
          }
        `)
      );

      const exampleValue: z.infer<typeof result.schema> = {
        user: { id: "user-1", details: { name: "John Doe", mail: "john.doe@example.com" } },
      };
      expect(exampleValue).toEqual(result.schema.parse(exampleValue));
    });

    it("converts a schema with an array of objects to a graphql query", () => {
      const containerSchema = z.object({
        id: z.string(),
        entries: z.array(z.object({ code: z.string(), quantity: z.number() })),
      });

      const result = zodql("query", z.object({ container: containerSchema })).compile();

      expect(result.queryString).toBe(
        normalizeIndentation(`
          query {
            container {
              id
              entries {
                code
                quantity
              }
            }
          }
        `)
      );

      const exampleValue: z.infer<typeof result.schema> = {
        container: {
          id: "container-1",
          entries: [
            { code: "code-1", quantity: 2 },
            { code: "code-2", quantity: 5 },
          ],
        },
      };
      expect(exampleValue).toEqual(result.schema.parse(exampleValue));
    });

    it("handles an array of primitives as a simple field", () => {
      const itemSchema = z.object({
        id: z.string(),
        tags: z.array(z.string()),
      });

      const result = zodql("query", z.object({ item: itemSchema })).compile();

      expect(result.queryString).toBe(
        normalizeIndentation(`
          query {
            item {
              id
              tags
            }
          }
        `)
      );

      const exampleValue: z.infer<typeof result.schema> = {
        item: { id: "item-1", tags: ["tag1", "tag2", "tag3"] },
      };
      expect(exampleValue).toEqual(result.schema.parse(exampleValue));
    });

    it("supports an array type on a root field", () => {
      const usersSchema = z.array(z.object({ id: z.string(), name: z.string() }));

      const { queryString, schema } = zodql("query", z.object({ users: usersSchema })).compile();

      expect(queryString).toBe(
        normalizeIndentation(`
          query {
            users {
              id
              name
            }
          }
        `)
      );

      const exampleValue: z.infer<typeof schema> = {
        users: [
          { id: "user-1", name: "User One" },
          { id: "user-2", name: "User Two" },
        ],
      };
      expect(exampleValue).toEqual(schema.parse(exampleValue));
    });
  });

  describe("deep and mixed nesting", () => {
    it("converts deeply nested objects to a graphql query", () => {
      const recordSchema = z.object({
        id: z.string(),
        detail: z.object({
          owner: z.object({ name: z.string(), mail: z.string() }),
          amount: z.number(),
        }),
      });

      const result = zodql("query", z.object({ record: recordSchema })).compile();

      expect(result.queryString).toBe(
        normalizeIndentation(`
          query {
            record {
              id
              detail {
                owner {
                  name
                  mail
                }
                amount
              }
            }
          }
        `)
      );

      const exampleValue: z.infer<typeof result.schema> = {
        record: {
          id: "record-1",
          detail: { owner: { name: "Jane Smith", mail: "jane.smith@example.com" }, amount: 99.99 },
        },
      };
      expect(exampleValue).toEqual(result.schema.parse(exampleValue));
    });

    it("converts mixed array/object nesting to a graphql query", () => {
      const groupSchema = z.object({
        id: z.string(),
        entries: z.array(
          z.object({
            name: z.string(),
            type: z.object({ id: z.string(), name: z.string() }),
          })
        ),
        status: z.string(),
      });

      const result = zodql("query", z.object({ group: groupSchema })).compile();

      expect(result.queryString).toBe(
        normalizeIndentation(`
          query {
            group {
              id
              entries {
                name
                type {
                  id
                  name
                }
              }
              status
            }
          }
        `)
      );

      const exampleValue: z.infer<typeof result.schema> = {
        group: {
          id: "group-1",
          entries: [
            { name: "Entry A", type: { id: "type-1", name: "Type One" } },
            { name: "Entry B", type: { id: "type-2", name: "Type Two" } },
          ],
          status: "done",
        },
      };
      expect(exampleValue).toEqual(result.schema.parse(exampleValue));
    });
  });

  describe("wrapper schemas", () => {
    it("unwraps optional, nullable and default fields without affecting the query", () => {
      const profileSchema = z.object({
        id: z.string(),
        nickname: z.string().optional(),
        bio: z.string().nullable(),
        age: z.number().default(18),
        fullName: z.object({ first: z.string(), last: z.string() }).optional().nullable(),
      });

      const result = zodql("query", z.object({ profile: profileSchema })).compile();

      expect(result.queryString).toBe(
        normalizeIndentation(`
          query {
            profile {
              id
              nickname
              bio
              age
              fullName {
                first
                last
              }
            }
          }
        `)
      );

      const exampleValue: z.infer<typeof result.schema> = {
        profile: {
          id: "profile-1",
          nickname: undefined,
          bio: null,
          age: 25,
          fullName: { first: "Cool", last: "User" },
        },
      };
      expect(exampleValue).toEqual(result.schema.parse(exampleValue));
    });
  });

  describe("operations", () => {
    it("compiles a mutation", () => {
      const schema = z.object({ success: z.boolean(), message: z.string() });

      const result = zodql("mutation", z.object({ updateUser: schema })).compile();

      expect(result.queryString).toBe(
        normalizeIndentation(`
          mutation {
            updateUser {
              success
              message
            }
          }
        `)
      );

      const exampleValue: z.infer<typeof result.schema> = {
        updateUser: { success: true, message: "User updated successfully" },
      };
      expect(exampleValue).toEqual(result.schema.parse(exampleValue));
    });
  });

  describe("variables", () => {
    it("accumulates variables across multiple defineVariables calls", () => {
      const query = zodql("query", z.object({ user: z.object({ id: z.string() }) }))
        .defineVariables({ a: { schema: z.string(), typeName: "String!" } })
        .defineVariables({ b: { schema: z.number(), typeName: "Int!" } });

      const { queryString, variables } = query.compile();

      expect(queryString.startsWith("query ($a: String!, $b: Int!) {")).toBe(true);
      expect(variables).toMatchObject({
        a: { typeName: "String!" },
        b: { typeName: "Int!" },
      });
    });

    it("lets a later defineVariables call override an earlier variable of the same name", () => {
      const query = zodql("query", z.object({ user: z.object({ id: z.string() }) }))
        .defineVariables({ a: { schema: z.string(), typeName: "String!" } })
        .defineVariables({ a: { schema: z.number(), typeName: "Int!" } });

      const { variables } = query.compile();

      expect(variables).toMatchObject({ a: { typeName: "Int!" } });
    });
  });

  describe("named operations", () => {
    it("emits a named query when operationName is provided", () => {
      const userSchema = z.object({ id: z.string(), name: z.string() });

      const result = zodql("query", z.object({ user: userSchema }), { operationName: "myRootQuery" }).compile();

      expect(result.queryString).toBe(
        normalizeIndentation(`
          query myRootQuery {
            user {
              id
              name
            }
          }
        `)
      );
    });

    it("emits a named mutation when operationName is provided", () => {
      const schema = z.object({ success: z.boolean() });

      const result = zodql("mutation", z.object({ updateUser: schema }), { operationName: "UpdateUser" }).compile();

      expect(result.queryString).toBe(
        normalizeIndentation(`
          mutation UpdateUser {
            updateUser {
              success
            }
          }
        `)
      );
    });

    it("places the operation name before variable definitions", () => {
      const userSchema = z.object({ id: z.string(), name: z.string() });

      const result = zodql("query", z.object({ user: userSchema }), { operationName: "GetUser" })
        .defineVariables({ userId: { typeName: "ID!", schema: z.string() } })
        .compile();

      expect(result.queryString).toBe(
        normalizeIndentation(`
          query GetUser ($userId: ID!) {
            user {
              id
              name
            }
          }
        `)
      );
    });

    it("preserves existing behaviour when no options are provided", () => {
      const result = zodql("query", z.object({ user: z.object({ id: z.string() }) })).compile();

      expect(result.queryString).toBe(
        normalizeIndentation(`
          query {
            user {
              id
            }
          }
        `)
      );
    });

    it("preserves existing behaviour when an empty options object is provided", () => {
      const result = zodql("query", z.object({ user: z.object({ id: z.string() }) }), {}).compile();

      expect(result.queryString).toBe(
        normalizeIndentation(`
          query {
            user {
              id
            }
          }
        `)
      );
    });

    it.each(["my query", "1query", "my-query", "my.query", "query{", ""])(
      "throws a clear error when operationName %p is not a valid GraphQL name",
      (operationName) => {
        const builder = zodql("query", z.object({ user: z.object({ id: z.string() }) }), { operationName });

        expect(() => builder.compile()).toThrow(/Invalid operationName/);
      }
    );

    it.each(["myRootQuery", "_private", "Query1", "a_b_c"])("accepts valid GraphQL name %p", (operationName) => {
      const result = zodql("query", z.object({ user: z.object({ id: z.string() }) }), { operationName }).compile();

      expect(result.queryString.startsWith(`query ${operationName} {`)).toBe(true);
    });
  });
});

describe("zodqlFragment", () => {
  it("returns the fragment definition unchanged", () => {
    const fragment = zodqlFragment({
      name: "UserFields",
      on: "User",
      schema: z.object({ id: z.string(), name: z.string() }),
    });

    expect(fragment).toEqual({
      name: "UserFields",
      on: "User",
      schema: expect.any(z.ZodObject),
    });
  });

  it("throws when the fragment schema shape is an empty object", () => {
    expect(() =>
      zodqlFragment({
        name: "Empty",
        on: "User",
        schema: z.object({}),
      } as any)
    ).toThrow("Fragment shape can not be an empty object");
  });
});

describe("zodqlField, used standalone", () => {
  it("omits parentheses when there are no arguments", () => {
    const query = zodql(
      "query",
      z.object({
        widgets: zodqlField().toSchema(z.object({ list: z.array(z.object({ id: z.number() })) })),
      })
    );

    const { queryString } = query.compile();

    expect(queryString).toBe(
      normalizeIndentation(`
        query {
          widgets {
            list {
              id
            }
          }
        }
      `)
    );
  });
});
