/**
 * The "RepositoryOverview" query itself: fetch a single repository by
 * `owner`/`name`, built from the schemas in ./schema.ts.
 *
 * Demonstrates:
 *  - field arguments and query variables (`repository(owner:, name:)`)
 *  - field aliases (`openIssues`/`closedIssues`, see ./schema.ts)
 *  - nullable and nested fields
 */
import { zodql, zodqlField } from "@mattiasahlsen/zodql";
import { z } from "zod";
import { repositoryOverviewSchema } from "./schema.js";

export const repositoryOverviewQuery = zodql(
  "query",
  z.object({
    repository: zodqlField()
      .withArguments({ owner: "$owner", name: "$name" })
      .toSchema(repositoryOverviewSchema)
      // `repository` is null if it doesn't exist or the token can't see it.
      .nullable(),
  }),
  { operationName: "RepositoryOverview" }
)
  .defineVariables({
    owner: { typeName: "String!", schema: z.string() },
    name: { typeName: "String!", schema: z.string() },
  })
  .compile();
