import z from "zod";
import type { ZodqlQueryVariable, ZodqlQuery } from "./types.js";
import type { SetOptional } from "type-fest";

/**
 * An HTTP client exposing a Promise-based `post` method, used as the transport
 * for a `ZodqlClient`, e.g. a thin wrapper around `fetch`. It resolves to both
 * the raw response and a `json()` accessor for its parsed body, which may return
 * the body directly or as a promise.
 */
export interface ZodqlHttpClient<Response = unknown, RequestConfig = unknown> {
  /**
   * Sends a `POST` request. Takes the URL, the request body, and an optional
   * transport-specific config, and resolves to `{ response, json }`, where
   * `json()` returns the parsed response body, either directly or as a promise.
   */
  post(
    url: string,
    data: unknown,
    config?: RequestConfig
  ): Promise<{ response: Response; json: () => unknown | Promise<unknown> }>;
}

/**
 * A GraphQL client that executes compiled operations against an {@link ZodqlHttpClient}
 * transport.
 */
export interface ZodqlClient<Response = unknown, RequestConfig = unknown> {
  /**
   * Sends a compiled query/mutation. Takes the compiled query
   * (`{ queryString, variables, schema }`), an `args` object supplying a value
   * for each declared variable (validated and parsed by its Zod schema before
   * the request is sent), and an optional transport-specific request config;
   * resolves to `{ response, parseResponse }`, where `parseResponse()` validates
   * and returns a promise for the response body (see {@link ZodqlResponseData}).
   */
  request<Schema extends z.ZodObject, Variables extends Record<string, ZodqlQueryVariable>>(
    query: ZodqlQuery<Schema, Variables>,
    args: MakeUndefinableFieldsOptional<{ [Key in keyof Variables]: z.input<Variables[Key]["schema"]> }>,
    requestConfig?: RequestConfig
  ): Promise<{
    response: Response;
    parseResponse: () => Promise<ZodqlResponseData<Schema>>;
  }>;
}

/**
 * A factory that wraps an {@link ZodqlHttpClient} transport in a `ZodqlClient`.
 * Internal: used only to type-check `buildZodqlClient`'s signature, not exported.
 */
type ZodqlClientBuilder<Response = unknown, RequestConfig = unknown> = (
  baseClient: ZodqlHttpClient<Response, RequestConfig>
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
 * `baseClient` only needs to satisfy {@link ZodqlHttpClient}: a `post` method that resolves to
 * `{ response, json }`, where `json()` returns the parsed response body, either directly or
 * as a promise.
 *
 * @param baseClient - An HTTP client to use for GraphQL requests
 * @returns A ZodqlClient instance that executes GraphQL operations
 *
 * @example
 * ```typescript
 * import { buildZodqlClient } from '@mattiasahlsen/zodql';
 *
 * const client = buildZodqlClient({
 *   post: async (url, data) => {
 *     const response = await fetch('https://api.example.com/graphql', {
 *       method: 'POST',
 *       headers: { 'Content-Type': 'application/json', Authorization: 'Bearer token123' },
 *       body: JSON.stringify(data),
 *     });
 *     return { response, json: () => response.json() };
 *   },
 * });
 *
 * const { parseResponse } = await client.request(query, { userId: '123' });
 * const { data, errors } = await parseResponse();
 * ```
 */
export function buildZodqlClient<Response = unknown, RequestConfig = unknown>(
  baseClient: ZodqlHttpClient<Response, RequestConfig>
): ZodqlClient<Response, RequestConfig> {
  return new ZodqlClientImplementation<Response, RequestConfig>(baseClient);
}
buildZodqlClient satisfies ZodqlClientBuilder; // ensure the function signature matches the builder type

class ZodqlClientImplementation<Response = unknown, RequestConfig = unknown> implements ZodqlClient<
  Response,
  RequestConfig
> {
  private readonly baseClient: ZodqlHttpClient<Response, RequestConfig>;
  constructor(baseClient: ZodqlHttpClient<Response, RequestConfig>) {
    this.baseClient = baseClient;
  }

  async request<Schema extends z.ZodObject, Variables extends Record<string, ZodqlQueryVariable>>(
    { queryString, variables, schema }: ZodqlQuery<Schema, Variables>,
    args: MakeUndefinableFieldsOptional<{ [Key in keyof Variables]: z.input<Variables[Key]["schema"]> }>,
    requestConfig?: RequestConfig
  ): Promise<{ response: Response; parseResponse: () => Promise<ZodqlResponseData<Schema>> }> {
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
      parseResponse: async () => {
        const responseSchema = createResponseDataSchema(schema);
        const data = await json();
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
/**
 * The parsed body of a GraphQL response — `{ data, extensions?, errors? }` — as
 * resolved by `parseResponse()`. `data` is validated against the query's schema;
 * `extensions` and `errors` are returned as-is (unvalidated) when present.
 */
export type ZodqlResponseData<Schema extends z.ZodObject> = z.infer<
  ReturnType<typeof createResponseDataSchema<Schema>>
>;

type MakeUndefinableFieldsOptional<T extends object> = SetOptional<
  T,
  {
    [Key in keyof T]: undefined extends T[Key] ? Key : never;
  }[keyof T]
>;
