import { z } from "zod";
import { buildZodqlClient, type ZodqlHttpClient } from "./client.js";
import { zodql } from "./ZodqlBuilder.js";
import { zodqlField } from "./ZodqlFieldBuilder.js";
import { vi } from "vitest";
import type { AxiosResponse } from "axios";
import axios, { type AxiosInstance, type AxiosRequestConfig } from "axios";
import fetch, { type Response as FetchResponse } from "node-fetch";
import nock from "nock";

describe("buildZodqlClient", () => {
  const mockedClient = vi.mocked<ZodqlHttpClient>({
    post: vi.fn(() => ({
      response: {},
      json: () => ({}),
    })),
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
        headers: { "content-type": "application/json" },
      };
      const fakeResult = {
        response: fakeResponse,
        json: () => ({ data: { myQuery: { id: "1", name: "Alice" } } }),
      };
      mockedClient.post.mockResolvedValueOnce(fakeResult);

      const { response, parseResponse } = await client.request(query, { id: "123" });

      expect(response).toBe(fakeResponse);
      expect(parseResponse()).toEqual({ data: { myQuery: { id: "1", name: "Alice" } } });
    });

    it("throws when the response's data field doesn't match the query's schema", async () => {
      const query = buildQuery(z.string());
      const fakeResult = {
        response: {},
        json: () => ({ data: { myQuery: { id: "1" } } }),
      };
      mockedClient.post.mockResolvedValueOnce(fakeResult);

      const { parseResponse } = await client.request(query, { id: "123" });

      expect(() => parseResponse()).toThrow(z.ZodError);
    });
  });
});

describe("axios integration", () => {
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

  const buildAxiosHttpClient = (axiosInstance: AxiosInstance): ZodqlHttpClient<AxiosResponse, AxiosRequestConfig> => ({
    post: async (url, data, config) => {
      const response = await axiosInstance.post(url, data, config);
      return { response, json: () => response.data };
    },
  });

  it("posts the compiled query string and parsed variables through axios", async () => {
    const axiosInstance = axios.create({ baseURL: "https://api.example.test/graphql" });
    const query = buildQuery(z.string());
    const scope = nock("https://api.example.test")
      .post("/graphql", { query: query.queryString, variables: { id: "123" } })
      .reply(200, { data: { myQuery: { id: "1", name: "Alice" } } });

    const client = buildZodqlClient(buildAxiosHttpClient(axiosInstance));
    const { parseResponse } = await client.request(query, { id: "123" });

    expect(parseResponse()).toEqual({ data: { myQuery: { id: "1", name: "Alice" } } });
    expect(scope.isDone()).toBe(true);
  });

  it("rejects instead of making a real HTTP call when the request isn't mocked", async () => {
    const axiosInstance = axios.create({ baseURL: "https://api.example.test/graphql" });
    const client = buildZodqlClient(buildAxiosHttpClient(axiosInstance));
    const query = buildQuery(z.string());

    await expect(client.request(query, { id: "123" })).rejects.toThrow(/disallowed net connect/i);
  });
});

describe("fetch integration", () => {
  const baseUrl = "https://api.example.test/graphql";

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

  const buildFetchHttpClient = (): ZodqlHttpClient<FetchResponse> => ({
    post: async (url, data) => {
      const response = await fetch(`${baseUrl}${url}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      const parsedBody = await response.json();
      return { response, json: () => parsedBody };
    },
  });

  it("posts the compiled query string and parsed variables through fetch", async () => {
    const query = buildQuery(z.string());
    const scope = nock("https://api.example.test")
      .post("/graphql", { query: query.queryString, variables: { id: "123" } })
      .reply(200, { data: { myQuery: { id: "1", name: "Alice" } } });

    const client = buildZodqlClient(buildFetchHttpClient());
    const { parseResponse } = await client.request(query, { id: "123" });

    expect(parseResponse()).toEqual({ data: { myQuery: { id: "1", name: "Alice" } } });
    expect(scope.isDone()).toBe(true);
  });

  it("rejects instead of making a real HTTP call when the request isn't mocked", async () => {
    const client = buildZodqlClient(buildFetchHttpClient());
    const query = buildQuery(z.string());

    await expect(client.request(query, { id: "123" })).rejects.toThrow(/disallowed net connect/i);
  });
});
