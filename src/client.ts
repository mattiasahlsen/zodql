import type { AxiosInstance, AxiosRequestConfig, AxiosResponse } from "axios";
import z from "zod";
import type { QueryVariable } from "./types.js";
import type { SetOptional } from "type-fest";

type MakeUndefinableFieldsOptional<T extends object> = SetOptional<
  T,
  {
    [Key in keyof T]: undefined extends T[Key] ? Key : never;
  }[keyof T]
>;

export interface ZodqlClient<Response = AxiosResponse, RequestConfig = AxiosRequestConfig> {
  request<Variables extends Record<string, QueryVariable>>(
    query: { variables: Variables; queryString: string },
    args: MakeUndefinableFieldsOptional<{ [Key in keyof Variables]: z.input<Variables[Key]["schema"]> }>,
    requestConfig?: RequestConfig
  ): Promise<Response>;
}

export type ZodqlClientBuildOptions = {
  url: string;
  headers?: Record<string, string>;
  token: string;
};

export type AxiosZodqlClientBuilder = (baseClient: AxiosInstance) => ZodqlClient<AxiosResponse, AxiosRequestConfig>;

/**
 * Build a Zod GraphQL client using Axios as the HTTP transport.
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
 * @param {AxiosInstance} baseClient - A configured Axios instance to use for GraphQL requests
 * @returns {ZodqlClient<AxiosResponse, AxiosRequestConfig>} A ZodqlClient instance that executes GraphQL operations
 *
 * @example
 * ```typescript
 * import axios from 'axios';
 * import { buildAxiosZodqlClient } from 'zodql';
 *
 * const axiosInstance = axios.create({
 *   baseURL: 'https://api.example.com/graphql',
 *   headers: {
 *     'Authorization': 'Bearer token123',
 *   },
 * });
 *
 * const client = buildAxiosZodqlClient(axiosInstance);
 *
 * const response = await client.request(query, { userId: '123' });
 * ```
 */
export function buildAxiosZodqlClient(baseClient: AxiosInstance): ZodqlClient<AxiosResponse, AxiosRequestConfig> {
  return new AxiosZodqlClient(baseClient);
}

class AxiosZodqlClient implements ZodqlClient<AxiosResponse, AxiosRequestConfig> {
  private readonly baseClient: AxiosInstance;
  constructor(baseClient: AxiosInstance) {
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
    requestConfig?: AxiosRequestConfig
  ) {
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
