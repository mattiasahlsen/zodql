import z from "zod";
import type { QueryVariable, GraphqlQuery } from "./types.js";
import type { SetOptional } from "type-fest";

/**
 * An HTTP client exposing a Promise-based `post` method that resolves to both the raw
 * response and a `json()` accessor for its already-parsed body, e.g. a thin wrapper around `fetch`.
 */
export interface HttpClient<Response = unknown, RequestConfig = unknown> {
  post(url: string, data: unknown, config?: RequestConfig): Promise<{ response: Response; json: () => unknown }>;
}

export interface ZodqlClient<Response = unknown, RequestConfig = unknown> {
  request<Schema extends z.ZodObject, Variables extends Record<string, QueryVariable>>(
    query: GraphqlQuery<Schema, Variables>,
    args: MakeUndefinableFieldsOptional<{ [Key in keyof Variables]: z.input<Variables[Key]["schema"]> }>,
    requestConfig?: RequestConfig
  ): Promise<{
    response: Response;
    parseResponse: () => ResponseData<Schema>;
  }>;
}

export type ZodqlClientBuilder<Response = unknown, RequestConfig = unknown> = (
  baseClient: HttpClient<Response, RequestConfig>
) => ZodqlClient<Response, RequestConfig>;

/**
 * Build a Zod GraphQL client using the given HTTP client as the transport.
 *
 * This function creates a GraphQL client that validates and parses variables
 * using their Zod schemas before sending requests, so a variable's runtime
 * value can differ from its wire value (e.g. defaults, coercion, transforms).
 * Any variable that parses to `undefined` is omitted from the request body
 * entirely, rather than being sent as `undefined` or `null`. `baseClient`'s
 * configured `baseURL` and headers (e.g. auth) are used as-is; every request
 * is a `POST` with a `{ query, variables }` JSON body. `parseResponse()` parses the
 * response body as `{ data, extensions?, errors? }`, validating `data` against the
 * query's schema; `extensions` and `errors` are returned as-is, unvalidated, if present.
 * GraphQL errors returned in a 200 response body are therefore not thrown — the caller
 * must check `parseResponse().errors` themselves. The returned promise rejects (without
 * making a request) if a variable's value fails its Zod schema, e.g. a required variable
 * that was omitted.
 *
 * `baseClient` only needs to satisfy {@link HttpClient}: a `post` method that resolves to
 * `{ response, json }`, where `json()` returns the already-parsed response body.
 *
 * @param {HttpClient<Response, RequestConfig>} baseClient - An HTTP client to use for GraphQL requests
 * @returns {ZodqlClient<Response, RequestConfig>} A ZodqlClient instance that executes GraphQL operations
 *
 * @example
 * ```typescript
 * import { buildZodqlClient } from 'zodql';
 *
 * const client = buildZodqlClient({
 *   post: async (url, data) => {
 *     const response = await fetch('https://api.example.com/graphql', {
 *       method: 'POST',
 *       headers: { 'Content-Type': 'application/json', Authorization: 'Bearer token123' },
 *       body: JSON.stringify(data),
 *     });
 *     const body = await response.json();
 *     return { response, json: () => body };
 *   },
 * });
 *
 * const { parseResponse } = await client.request(query, { userId: '123' });
 * const { data, errors } = parseResponse();
 * ```
 */
export function buildZodqlClient<Response = unknown, RequestConfig = unknown>(
  baseClient: HttpClient<Response, RequestConfig>
): ZodqlClient<Response, RequestConfig> {
  return new ZodqlClientImplementation<Response, RequestConfig>(baseClient);
}
buildZodqlClient satisfies ZodqlClientBuilder; // ensure the function signature matches the builder type

class ZodqlClientImplementation<Response = unknown, RequestConfig = unknown> implements ZodqlClient<
  Response,
  RequestConfig
> {
  private readonly baseClient: HttpClient<Response, RequestConfig>;
  constructor(baseClient: HttpClient<Response, RequestConfig>) {
    this.baseClient = baseClient;
  }

  async request<Schema extends z.ZodObject, Variables extends Record<string, QueryVariable>>(
    { queryString, variables, schema }: GraphqlQuery<Schema, Variables>,
    args: MakeUndefinableFieldsOptional<{ [Key in keyof Variables]: z.input<Variables[Key]["schema"]> }>,
    requestConfig?: RequestConfig
  ): Promise<{ response: Response; parseResponse: () => ResponseData<Schema> }> {
    const providedArgs = args as Record<string, unknown>;
    const parsedVariables: Record<string, unknown> = {};

    for (const [name, variable] of Object.entries(variables)) {
      const parsed = variable.schema.parse(providedArgs[name]);
      if (parsed !== undefined) {
        parsedVariables[name] = parsed;
      }
    }

    const { response, json } = await this.baseClient.post(
      "",
      {
        query: queryString,
        variables: parsedVariables,
      },
      requestConfig
    );

    return {
      response,
      parseResponse: () => {
        const responseSchema = createResponseDataSchema(schema);
        const data = json();
        const parsedData = responseSchema.parse(data);
        return parsedData;
      },
    };
  }
}

function createResponseDataSchema<Schema extends z.ZodObject>(dataSchema: Schema) {
  return z.object({
    data: dataSchema,
    extensions: z.unknown().optional(),
    errors: z.unknown().optional(),
  });
}
export type ResponseData<Schema extends z.ZodObject> = z.infer<ReturnType<typeof createResponseDataSchema<Schema>>>;

type MakeUndefinableFieldsOptional<T extends object> = SetOptional<
  T,
  {
    [Key in keyof T]: undefined extends T[Key] ? Key : never;
  }[keyof T]
>;
