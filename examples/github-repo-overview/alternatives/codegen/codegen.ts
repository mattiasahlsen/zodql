/**
 * GraphQL Code Generator config for the `client-preset` approach.
 *
 * Reads the shared subset schema and the operation in ./operation.ts, and emits
 * a typed `graphql()` function plus `TypedDocumentNode`s into ./gql/. Custom
 * scalars are mapped to `string` to mirror the zodql version's `z.string()`.
 *
 * Regenerate with `pnpm gen:codegen` (paths are anchored to this file, so it
 * runs correctly regardless of the working directory).
 */
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import type { CodegenConfig } from "@graphql-codegen/cli";

const here = dirname(fileURLToPath(import.meta.url));

const config: CodegenConfig = {
  schema: resolve(here, "../schema.graphql"),
  documents: [resolve(here, "operation.ts")],
  generates: {
    [resolve(here, "gql") + "/"]: {
      preset: "client",
      config: {
        scalars: { URI: "string", DateTime: "string" },
      },
    },
  },
};

export default config;
