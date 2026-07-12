// Main builder functions
export { zodql, zodqlFragment, type ZodqlOptions } from "./ZodqlBuilder.js";
export { zodqlField } from "./ZodqlFieldBuilder.js";

// Client exports
export {
  buildAxiosZodqlClient,
  createResponseSchema,
  type ZodqlClient,
  type ZodqlClientBuildOptions,
  type AxiosZodqlClientBuilder,
} from "./client.js";

// Utility exports
export { hasTypename } from "./utils/hasTypename.js";

// Type exports
export type { QueryFragment, QueryVariable, GraphqlQuerySegment, GraphqlQuery } from "./types.js";
