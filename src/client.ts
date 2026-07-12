import z from "zod";
import type { QueryVariable } from "./types.js";
import type { SetOptional } from "type-fest";

type MakeUndefinableFieldsOptional<T extends object> = SetOptional<
  T,
  {
    [Key in keyof T]: undefined extends T[Key] ? Key : never;
  }[keyof T]
>;

/**
 * An HTTP client exposing a Promise-based `post` method, e.g. a configured Axios instance.
 */
export interface HttpClient<Response = unknown, RequestConfig = unknown> {
  post(url: string, data: unknown, config?: RequestConfig): Promise<Response>;
}

export interface ZodqlClient<Response = unknown, RequestConfig = unknown> {
  request<Variables extends Record<string, QueryVariable>>(
    query: { variables: Variables; queryString: string },
    args: MakeUndefinableFieldsOptional<{ [Key in keyof Variables]: z.input<Variables[Key]["schema"]> }>,
    requestConfig?: RequestConfig
  ): Promise<Response>;
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
 * is a `POST` with a `{ query, variables }` JSON body. The client does not
 * inspect the response — GraphQL errors returned in a 200 response body are
 * not thrown and must be checked by the caller (see {@link createResponseSchema}).
 * The returned promise rejects (without making a request) if a variable's
 * value fails its Zod schema, e.g. a required variable that was omitted.
 *
 * `baseClient` only needs to satisfy {@link HttpClient} (a `post` method), so a
 * real Axios instance works without adding `axios` as a dependency of this library.
 *
 * @param {HttpClient<Response, RequestConfig>} baseClient - An HTTP client to use for GraphQL requests, e.g. a configured Axios instance
 * @returns {ZodqlClient<Response, RequestConfig>} A ZodqlClient instance that executes GraphQL operations
 *
 * @example
 * ```typescript
 * import axios from 'axios';
 * import { buildZodqlClient } from 'zodql';
 *
 * const axiosInstance = axios.create({
 *   baseURL: 'https://api.example.com/graphql',
 *   headers: {
 *     'Authorization': 'Bearer token123',
 *   },
 * });
 *
 * const client = buildZodqlClient(axiosInstance);
 *
 * const response = await client.request(query, { userId: '123' });
 * ```
 */
export function buildZodqlClient<Response = unknown, RequestConfig = unknown>(
  baseClient: HttpClient<Response, RequestConfig>
): ZodqlClient<Response, RequestConfig> {
  return new ZodqlClientImplementation<Response, RequestConfig>(baseClient);
}

export class ZodqlClientImplementation<Response = unknown, RequestConfig = unknown> implements ZodqlClient<
  Response,
  RequestConfig
> {
  private readonly baseClient: HttpClient<Response, RequestConfig>;
  constructor(baseClient: HttpClient<Response, RequestConfig>) {
    this.baseClient = baseClient;
  }

  async request<Variables extends Record<string, QueryVariable>>(
    {
      queryString,
      variables,
    }: {
      queryString: string;
      variables: Variables;
    },
    args: MakeUndefinableFieldsOptional<{ [Key in keyof Variables]: z.input<Variables[Key]["schema"]> }>,
    requestConfig?: RequestConfig
  ): Promise<Response> {
    const providedArgs = args as Record<string, unknown>;
    const parsedVariables: Record<string, unknown> = {};

    for (const [name, variable] of Object.entries(variables)) {
      const parsed = variable.schema.parse(providedArgs[name]);
      if (parsed !== undefined) {
        parsedVariables[name] = parsed;
      }
    }

    return this.baseClient.post(
      "",
      {
        query: queryString,
        variables: parsedVariables,
      },
      requestConfig
    );
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
