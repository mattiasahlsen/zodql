import z from "zod";
import { zodqlField } from "../ZodqlFieldBuilder.js";
import { zodql } from "../ZodqlBuilder.js";
import { normalizeIndentation } from "../testing/normalizeIndentation.js";
import { expectTypeof } from "../testing/assertType.js";

describe("field arguments", () => {
  it("supports a variable-backed argument", () => {
    const query = zodql(
      "query",
      z.object({
        widget: zodqlField()
          .withArguments({ id: "$widgetId" })
          .toSchema(z.object({ id: z.string(), name: z.string() })),
      })
    ).defineVariables({
      widgetId: { schema: z.string(), typeName: "String!" },
    });

    const { queryString, variables, schema } = query.compile();

    expect(queryString).toBe(
      normalizeIndentation(`
        query ($widgetId: String!) {
          widget (id: $widgetId) {
            id
            name
          }
        }
      `)
    );

    expect(variables).toMatchObject({ widgetId: { typeName: "String!" } });

    const exampleValue: z.infer<typeof schema> = {
      widget: { id: "widget-1", name: "Sample Widget" },
    };
    expect(exampleValue).toEqual(schema.parse(exampleValue));

    expectTypeof(exampleValue).toBe<{ widget: { id: string; name: string } }>();
  });

  it("allows the same variable to back multiple arguments across fields", () => {
    const query = zodql(
      "query",
      z.object({
        widget: zodqlField()
          .withArguments({ id: "$widgetId" })
          .toSchema(
            z.object({
              id: z.string(),
              name: z.string(),
              relatedWidget: zodqlField()
                .withArguments({ highlightId: "$widgetId" })
                .toSchema(z.object({ id: z.string(), name: z.string() })),
            })
          ),
      })
    ).defineVariables({
      widgetId: { schema: z.string(), typeName: "String!" },
    });

    const { queryString, variables, schema } = query.compile();

    expect(queryString).toBe(
      normalizeIndentation(`
        query ($widgetId: String!) {
          widget (id: $widgetId) {
            id
            name
            relatedWidget (highlightId: $widgetId) {
              id
              name
            }
          }
        }
      `)
    );

    expect(variables).toMatchObject({ widgetId: { typeName: "String!" } });

    const exampleValue: z.infer<typeof schema> = {
      widget: {
        id: "widget-1",
        name: "Sample Widget",
        relatedWidget: { id: "widget-2", name: "Related Widget" },
      },
    };
    expect(exampleValue).toEqual(schema.parse(exampleValue));
  });

  it("supports multiple arguments on a single field", () => {
    const query = zodql(
      "query",
      z.object({
        widgets: zodqlField()
          .withArguments({ where: "$where", page: "$page", limit: "$limit" })
          .toSchema(z.object({ list: z.array(z.object({ id: z.number() })) })),
      })
    ).defineVariables({
      where: { schema: z.string(), typeName: "WidgetFilter!" },
      page: { schema: z.number(), typeName: "Int!" },
      limit: { schema: z.number(), typeName: "Int!" },
    });

    const { queryString, variables, schema } = query.compile();

    expect(queryString).toBe(
      normalizeIndentation(`
        query ($where: WidgetFilter!, $page: Int!, $limit: Int!) {
          widgets (where: $where, page: $page, limit: $limit) {
            list {
              id
            }
          }
        }
      `)
    );

    expect(variables).toMatchObject({
      where: { typeName: "WidgetFilter!" },
      page: { typeName: "Int!" },
      limit: { typeName: "Int!" },
    });

    const exampleValue: z.infer<typeof schema> = {
      widgets: { list: [{ id: 1 }, { id: 2 }] },
    };
    expect(exampleValue).toEqual(schema.parse(exampleValue));
  });

  it("merges arguments accumulated across multiple withArguments calls on the same field", () => {
    const query = zodql(
      "query",
      z.object({
        widgets: zodqlField()
          .withArguments({ page: "$page" })
          .withArguments({ limit: "$limit" })
          .toSchema(z.object({ list: z.array(z.object({ id: z.number() })) })),
      })
    ).defineVariables({
      page: { schema: z.number(), typeName: "Int!" },
      limit: { schema: z.number(), typeName: "Int!" },
    });

    const { queryString } = query.compile();

    expect(queryString).toBe(
      normalizeIndentation(`
        query ($page: Int!, $limit: Int!) {
          widgets (page: $page, limit: $limit) {
            list {
              id
            }
          }
        }
      `)
    );
  });

  it("supports arguments on nested fields", () => {
    const query = zodql(
      "query",
      z.object({
        widgets: zodqlField()
          .withArguments({ page: "$page" })
          .toSchema(
            z.object({
              list: zodqlField()
                .withArguments({ limit: "$limit" })
                .toSchema(z.object({ id: z.number() }))
                .array(),
            })
          ),
      })
    ).defineVariables({
      page: { schema: z.number(), typeName: "Int!" },
      limit: { schema: z.number(), typeName: "Int!" },
    });

    const { queryString, variables, schema } = query.compile();

    expect(queryString).toBe(
      normalizeIndentation(`
        query ($page: Int!, $limit: Int!) {
          widgets (page: $page) {
            list (limit: $limit) {
              id
            }
          }
        }
      `)
    );

    expect(variables).toMatchObject({
      page: { typeName: "Int!" },
      limit: { typeName: "Int!" },
    });

    const exampleValue: z.infer<typeof schema> = {
      widgets: { list: [{ id: 1 }] },
    };
    expect(exampleValue).toEqual(schema.parse(exampleValue));
  });

  it("supports arguments with literal values and no variables", () => {
    const query = zodql(
      "query",
      z.object({
        widgets: zodqlField()
          .withArguments({ limit: "10", sortBy: '"name"' })
          .toSchema(z.object({ list: z.array(z.object({ id: z.number() })) })),
      })
    );

    const { queryString, variables, schema } = query.compile();

    expect(queryString).toBe(
      normalizeIndentation(`
        query {
          widgets (limit: 10, sortBy: "name") {
            list {
              id
            }
          }
        }
      `)
    );

    expect(variables).toEqual({});

    const exampleValue: z.infer<typeof schema> = {
      widgets: { list: [{ id: 1 }, { id: 2 }] },
    };
    expect(exampleValue).toEqual(schema.parse(exampleValue));
  });

  it("omits parentheses when a field has no arguments", () => {
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
