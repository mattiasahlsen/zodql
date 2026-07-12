import { z } from "zod";
import { buildZodqlClient, createResponseSchema, type HttpClient } from "./client.js";
import { zodql } from "./ZodqlBuilder.js";
import { zodqlField } from "./ZodqlFieldBuilder.js";
import { vi } from "vitest";

describe("createResponseSchema", () => {
  const dataSchema = z.object({
    user: z.object({
      id: z.string(),
    }),
  });

  describe("data field only", () => {
    it("parses a response with only the data field", () => {
      const schema = createResponseSchema(dataSchema);

      const exampleValue: z.infer<typeof schema> = {
        data: { user: { id: "user-1" } },
      };

      expect(schema.parse(exampleValue)).toEqual(exampleValue);
    });

    it("allows extensions and errors to be explicitly undefined", () => {
      const schema = createResponseSchema(dataSchema);

      const exampleValue: z.infer<typeof schema> = {
        data: { user: { id: "user-1" } },
        extensions: undefined,
        errors: undefined,
      };

      expect(schema.parse(exampleValue)).toEqual(exampleValue);
    });

    it("throws for an invalid data field", () => {
      const schema = createResponseSchema(dataSchema);

      const invalidValue = { data: { user: { id: 123 } } };

      expect(() => schema.parse(invalidValue)).toThrow();
    });

    it("supports deeply nested data schemas", () => {
      const nestedDataSchema = z.object({
        users: z.array(
          z.object({
            id: z.string(),
            profile: z.object({ name: z.string(), email: z.string() }),
            posts: z.array(z.object({ id: z.number(), title: z.string() })),
          })
        ),
      });

      const schema = createResponseSchema(nestedDataSchema);

      const exampleValue: z.infer<typeof schema> = {
        data: {
          users: [
            {
              id: "user-1",
              profile: { name: "John Doe", email: "john@example.com" },
              posts: [
                { id: 1, title: "First Post" },
                { id: 2, title: "Second Post" },
              ],
            },
          ],
        },
      };

      expect(schema.parse(exampleValue)).toEqual(exampleValue);
    });
  });

  describe("default extensions schema", () => {
    it("accepts any loose object when no extensionSchema is provided", () => {
      const schema = createResponseSchema(dataSchema);

      const exampleValue = {
        data: { user: { id: "user-1" } },
        extensions: { customField: "value", anotherField: 123, nested: { a: 1 } },
      };

      expect(schema.parse(exampleValue)).toEqual(exampleValue);
    });
  });

  describe("custom extensions schema", () => {
    it("parses a response with data and extensions", () => {
      const extensionSchema = z.object({
        requestId: z.string(),
        executionTime: z.number(),
      });

      const schema = createResponseSchema(dataSchema, { extensionSchema });

      const exampleValue: z.infer<typeof schema> = {
        data: { user: { id: "user-1" } },
        extensions: { requestId: "req-123", executionTime: 42 },
      };

      expect(schema.parse(exampleValue)).toEqual(exampleValue);
    });

    it("throws for an invalid extensions field", () => {
      const extensionSchema = z.object({ requestId: z.string() });
      const schema = createResponseSchema(dataSchema, { extensionSchema });

      const invalidValue = {
        data: { user: { id: "user-1" } },
        extensions: { requestId: 456 },
      };

      expect(() => schema.parse(invalidValue)).toThrow();
    });
  });

  describe("default errors schema", () => {
    it("accepts any array when no errorsSchema is provided", () => {
      const schema = createResponseSchema(dataSchema);

      const exampleValue: z.infer<typeof schema> = {
        data: { user: { id: "user-1" } },
        errors: [{ message: "Error 1" }, { code: 500, details: "Internal error" }, "string error"],
      };

      expect(schema.parse(exampleValue)).toEqual(exampleValue);
    });
  });

  describe("custom errors schema", () => {
    it("parses a response with data and errors", () => {
      const errorsSchema = z.array(z.object({ message: z.string(), path: z.array(z.string()) }));
      const schema = createResponseSchema(dataSchema, { errorsSchema });

      const exampleValue: z.infer<typeof schema> = {
        data: { user: { id: "user-1" } },
        errors: [{ message: "Field deprecated", path: ["user", "name"] }],
      };

      expect(schema.parse(exampleValue)).toEqual(exampleValue);
    });

    it("throws for an invalid errors field", () => {
      const errorsSchema = z.array(z.object({ message: z.string() }));
      const schema = createResponseSchema(dataSchema, { errorsSchema });

      const invalidValue = {
        data: { user: { id: "user-1" } },
        errors: [{ message: "Valid error" }, { msg: "Invalid error" }],
      };

      expect(() => schema.parse(invalidValue)).toThrow();
    });

    it("parses a response combining data, extensions and errors", () => {
      const extensionSchema = z.object({ requestId: z.string() });
      const errorsSchema = z.array(z.object({ message: z.string() }));

      const schema = createResponseSchema(dataSchema, { extensionSchema, errorsSchema });

      const exampleValue: z.infer<typeof schema> = {
        data: { user: { id: "user-1" } },
        extensions: { requestId: "req-123" },
        errors: [{ message: "Deprecated field used" }],
      };

      expect(schema.parse(exampleValue)).toEqual(exampleValue);
    });
  });
});

describe("buildZodqlClient", () => {
  const mockedClient = vi.mocked<HttpClient>({
    post: vi.fn(),
  } as any);
  const client = buildZodqlClient(mockedClient);

  const buildQuery = <VariableSchema extends z.ZodType>(variableSchema: VariableSchema) =>
    zodql(
      "query",
      z.object({
        myQuery: zodqlField()
          .withArguments({ id: "$id" })
          .toSchema(
            z.object({
              id: z.string(),
              name: z.string(),
            })
          ),
      })
    )
      .defineVariables({
        id: {
          schema: variableSchema,
          typeName: "String",
        },
      })
      .compile();

  it("posts the compiled query string and parsed variables", async () => {
    const query = buildQuery(z.string());

    await client.request(query, { id: "123" });

    expect(mockedClient.post).toHaveBeenCalledWith(
      "",
      { query: query.queryString, variables: { id: "123" } },
      undefined
    );
  });

  it("posts an empty variables object when no variables are defined", async () => {
    const query = zodql(
      "query",
      z.object({
        myQuery: zodqlField().toSchema(z.object({ id: z.string() })),
      })
    ).compile();

    await client.request(query, {});

    expect(mockedClient.post).toHaveBeenCalledWith("", { query: query.queryString, variables: {} }, undefined);
  });

  it("allows omitting optional variables", async () => {
    const query = buildQuery(z.string().optional());

    await client.request(query, {});

    expect(mockedClient.post).toHaveBeenCalledWith("", { query: query.queryString, variables: {} }, undefined);
  });

  it("omits variables that are explicitly undefined", async () => {
    const query = buildQuery(z.string().optional());

    await client.request(query, { id: undefined });

    expect(mockedClient.post).toHaveBeenCalledWith("", { query: query.queryString, variables: {} }, undefined);
  });

  it("rejects when a required variable is missing", async () => {
    const query = buildQuery(z.string());

    await expect(
      // @ts-expect-error - id is required but not provided
      client.request(query, {})
    ).rejects.toThrow("Invalid input");
  });

  it("ignores arguments that are not defined as variables", async () => {
    const query = buildQuery(z.string());

    await client.request(query, { id: "123", extraArg: "should be ignored" } as any);

    expect(mockedClient.post).toHaveBeenCalledWith(
      "",
      { query: query.queryString, variables: { id: "123" } },
      undefined
    );
  });

  it("forwards requestConfig to the underlying HTTP client", async () => {
    const query = buildQuery(z.string());

    const requestConfig = {
      headers: { "X-Custom-Header": "custom-value" },
      timeout: 5000,
    };

    await client.request(query, { id: "123" }, requestConfig);

    expect(mockedClient.post).toHaveBeenCalledWith(
      "",
      { query: query.queryString, variables: { id: "123" } },
      requestConfig
    );
  });

  describe("parseResponse", () => {
    it("parses the response's data field against the query's schema", async () => {
      const query = buildQuery(z.string());
      const fakeResponse = {
        json: () => ({ data: { myQuery: { id: "1", name: "Alice" } } }),
      };
      mockedClient.post.mockResolvedValueOnce(fakeResponse);

      const { response, parseResponse } = await client.request(query, { id: "123" });

      expect(response).toBe(fakeResponse);
      expect(parseResponse()).toEqual({ myQuery: { id: "1", name: "Alice" } });
    });

    it("throws when the response's data field doesn't match the query's schema", async () => {
      const query = buildQuery(z.string());
      const fakeResponse = {
        json: () => ({ data: { myQuery: { id: "1" } } }),
      };
      mockedClient.post.mockResolvedValueOnce(fakeResponse);

      const { parseResponse } = await client.request(query, { id: "123" });

      expect(() => parseResponse()).toThrow();
    });
  });
});
