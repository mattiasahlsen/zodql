import z from "zod";
import { zodqlField } from "../zodql-field-builder.js";
import { zodql } from "../zodql-builder.js";
import { normalizeIndentation } from "../testing/normalizeIndentation.js";
import { expectTypeof } from "../testing/assertType.js";

describe("field aliases", () => {
  it("supports aliasing the same field multiple times with different arguments", () => {
    const friendSchema = z.object({
      id: z.string(),
      name: z.string(),
    });
    const userSchema = z.object({
      id: z.string(),
      name: z.string(),
      alice: zodqlField().asAliasFor("friend").withArguments({ name: '"Alice"' }).toSchema(friendSchema),
      bob: zodqlField().asAliasFor("friend").withArguments({ name: '"Bob"' }).toSchema(friendSchema),
    });

    const { queryString, schema } = zodql("query", z.object({ user: userSchema })).compile();

    expect(queryString).toBe(
      normalizeIndentation(`
        query {
          user {
            id
            name
            alice: friend (name: "Alice") {
              id
              name
            }
            bob: friend (name: "Bob") {
              id
              name
            }
          }
        }
      `)
    );

    const exampleValue: z.infer<typeof schema> = {
      user: {
        id: "user-1",
        name: "User One",
        alice: { id: "friend-1", name: "Alice" },
        bob: { id: "friend-2", name: "Bob" },
      },
    };

    expect(exampleValue).toEqual(schema.parse(exampleValue));

    expectTypeof(exampleValue).toBe<{
      user: {
        id: string;
        name: string;
        alice: { id: string; name: string };
        bob: { id: string; name: string };
      };
    }>();
  });

  it("supports an alias with no arguments", () => {
    const friendSchema = z.object({ id: z.string() });
    const userSchema = z.object({
      bestFriend: zodqlField().asAliasFor("friend").toSchema(friendSchema),
    });

    const { queryString, schema } = zodql("query", z.object({ user: userSchema })).compile();

    expect(queryString).toBe(
      normalizeIndentation(`
        query {
          user {
            bestFriend: friend {
              id
            }
          }
        }
      `)
    );

    const exampleValue: z.infer<typeof schema> = {
      user: { bestFriend: { id: "friend-1" } },
    };
    expect(exampleValue).toEqual(schema.parse(exampleValue));
  });
});
