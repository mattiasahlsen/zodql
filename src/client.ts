import z from "zod";
import type { QueryVariable, GraphqlQuery } from "./types.js";
import type { SetOptional } from "type-fest";

type MakeUndefinableFieldsOptional<T extends object> = SetOptional<
  T,
  {
    [Key in keyof T]: undefined extends T[Key] ? Key : never;
  }[keyof T]
>;

/**
 * An HTTP client exposing a Promise-based `post` method whose resolved response
 * exposes a `.json()` method to read the parsed response body, e.g. the global `fetch`.
 */
export interface HttpClient<
  Response extends { json: () => unknown } = { json: () => unknown },
  RequestConfig = unknown,
> {
  post(url: string, data: unknown, config?: RequestConfig): Promise<Response>;
}

export interface ZodqlClient<
  Response extends { json: () => unknown } = { json: () => unknown },
  RequestConfig = unknown,
> {
  request<Schema extends z.ZodObject, Variables extends Record<string, QueryVariable>>(
    query: GraphqlQuery<Schema, Variables>,
    args: MakeUndefinableFieldsOptional<{ [Key in keyof Variables]: z.input<Variables[Key]["schema"]> }>,
    requestConfig?: RequestConfig
  ): Promise<{
    response: Response;
    parseResponse: () => z.output<Schema>;
  }>;
}

export type ZodqlClientBuilder<
  Response extends { json: () => unknown } = { json: () => unknown },
  RequestConfig = unknown,
> = (baseClient: HttpClient<Response, RequestConfig>) => ZodqlClient<Response, RequestConfig>;

/**
 * Build a Zod GraphQL client using the given HTTP client as the transport.
 *
 * This function creates a GraphQL client that validates and parses variables
 * using their Zod schemas before sending requests, so a variable's runtime
 * value can differ from its wire value (e.g. defaults, coercion, transforms).
 * Any variable that parses to `undefined` is omitted from the request body
 * entirely, rather than being sent as `undefined` or `null`. `baseClient`'s
 * configured `baseURL` and headers (e.g. auth) are used as-is; every request
 * is a `POST` with a `{ query, variables }` JSON body. `parseResponse()` only
 * parses and returns the response's `data` field against the query's schema —
 * GraphQL errors returned in a 200 response body are not thrown and must be
 * checked by the caller by reading `response.json()` directly (see {@link createResponseSchema}).
 * The returned promise rejects (without making a request) if a variable's
 * value fails its Zod schema, e.g. a required variable that was omitted.
 *
 * `baseClient` only needs to satisfy {@link HttpClient}: a `post` method whose
 * resolved response exposes a `.json()` method to read the parsed response body.
 *
 * @param {HttpClient<Response, RequestConfig>} baseClient - An HTTP client to use for GraphQL requests
 * @returns {ZodqlClient<Response, RequestConfig>} A ZodqlClient instance that executes GraphQL operations
 *
 * @example
 * ```typescript
 * import { buildZodqlClient } from 'zodql';
 *
 * const client = buildZodqlClient({
 *   post: (url, data) =>
 *     fetch('https://api.example.com/graphql', {
 *       method: 'POST',
 *       headers: { 'Content-Type': 'application/json', Authorization: 'Bearer token123' },
 *       body: JSON.stringify(data),
 *     }),
 * });
 *
 * const { parseResponse } = await client.request(query, { userId: '123' });
 * const data = parseResponse();
 * ```
 */
export function buildZodqlClient<
  Response extends { json: () => unknown } = { json: () => unknown },
  RequestConfig = unknown,
>(baseClient: HttpClient<Response, RequestConfig>): ZodqlClient<Response, RequestConfig> {
  return new ZodqlClientImplementation<Response, RequestConfig>(baseClient);
}

export class ZodqlClientImplementation<
  Response extends { json: () => unknown } = { json: () => unknown },
  RequestConfig = unknown,
> implements ZodqlClient<Response, RequestConfig> {
  private readonly baseClient: HttpClient<Response, RequestConfig>;
  constructor(baseClient: HttpClient<Response, RequestConfig>) {
    this.baseClient = baseClient;
  }

  async request<Schema extends z.ZodObject, Variables extends Record<string, QueryVariable>>(
    { queryString, variables, schema }: GraphqlQuery<Schema, Variables>,
    args: MakeUndefinableFieldsOptional<{ [Key in keyof Variables]: z.input<Variables[Key]["schema"]> }>,
    requestConfig?: RequestConfig
  ): Promise<{ response: Response; parseResponse: () => z.output<Schema> }> {
    const providedArgs = args as Record<string, unknown>;
    const parsedVariables: Record<string, unknown> = {};

    for (const [name, variable] of Object.entries(variables)) {
      const parsed = variable.schema.parse(providedArgs[name]);
      if (parsed !== undefined) {
        parsedVariables[name] = parsed;
      }
    }

    const response = await this.baseClient.post(
      "",
      {
        query: queryString,
        variables: parsedVariables,
      },
      requestConfig
    );

    return {
      response,
      parseResponse: () => schema.parse((response.json() as { data: unknown }).data),
    };
  }
}

/**
 * Creates a Zod schema for a GraphQL response, i.e. `{ data, extensions?, errors? }`
 * as returned by a spec-compliant GraphQL server.
 *
 * `data` is required on the resulting schema and validated with `dataSchema`.
 * `extensions` and `errors` are always optional — they may be absent or
 * `undefined` regardless of whether `extensionSchema`/`errorsSchema` were
 * provided — but are validated against those schemas when present. When
 * `extensionSchema`/`errorsSchema` aren't provided, any loose object /
 * any array is accepted, respectively, i.e. present but unvalidated.
 *
 * @template Data - The type of the `data` field in the response.
 * @template Extensions - The type of the `extensions` field in the response.
 * @template Errors - The type of the `errors` field in the response.
 *
 * @param dataSchema - A Zod schema for the `data` field.
 * @param options - Configuration options.
 * @param options.extensionSchema - (Optional) A Zod schema for the `extensions` field. Defaults to a loose object schema.
 * @param options.errorsSchema - (Optional) A Zod schema for the `errors` field. Defaults to an array of any type.
 *
 * @returns A Zod object schema representing the GraphQL response structure.
 *
 * @example
 * ```ts
 * const userSchema = z.object({
 *   id: z.string(),
 *   name: z.string(),
 * });
 * const responseSchema = createResponseSchema(userSchema, {
 *  extensionSchema: z.object({ traceId: z.string() }),
 * });
 *
 * const parsedResponse = responseSchema.parse({
 *   data: { id: "1", name: "Alice" },
 *   extensions: { traceId: "abc-123" },
 * });
 * ```
 */
export function createResponseSchema<
  Data,
  Extensions extends Record<string, unknown> = Record<string, unknown>,
  Errors extends Array<unknown> = Array<unknown>,
>(
  dataSchema: z.ZodType<Data>,
  {
    extensionSchema = z.looseObject({}) as z.ZodType<Extensions>,
    errorsSchema = z.any().array() as unknown as z.ZodType<Errors>,
  }: { extensionSchema?: z.ZodType<Extensions>; errorsSchema?: z.ZodType<Errors> } = {}
): z.ZodObject<{
  data: z.ZodType<Data>;
  extensions: z.ZodOptional<z.ZodType<Extensions>>;
  errors: z.ZodOptional<z.ZodType<Errors>>;
}> {
  return z.object({
    data: dataSchema,
    extensions: extensionSchema.optional(),
    errors: errorsSchema.optional(),
  });
}
