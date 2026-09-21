// The builders below are generated from a GraphQL schema by `zodql-codegen`.
// They live wherever `--out` points; here that's the repository-overview
// example's output directory.
import { zodql, zodqlField } from "@mattiasahlsen/zodql";
import { z } from "zod";
import { buildQueryField } from "../github-repo-overview/generated/Query.js";
import { buildRepositoryField } from "../github-repo-overview/generated/Repository.js";
import { buildLanguageField } from "../github-repo-overview/generated/Language.js";
import { buildIssueConnectionField } from "../github-repo-overview/generated/IssueConnection.js";

const repository = buildRepositoryField({
  name: true,
  // `description` is `String` in the schema, so this is `string | null`.
  description: true,
  // Nested objects are built by their own builder and passed in.
  primaryLanguage: buildLanguageField({ name: true }),
  // A leaf can take any Zod schema instead of `true`, so validation beyond the
  // GraphQL type system still works.
  url: z.string().url(),
}).extend({
  // Aliases go through `.extend()`: the key is invented, so no generated type
  // could check it. Everything inside the pick above *is* checked.
  openIssues: zodqlField()
    .asAliasFor("issues")
    .withArguments({ states: "OPEN" })
    .toSchema(buildIssueConnectionField({ totalCount: true })),
});

const query = zodql(
  "query",
  buildQueryField({
    // Arguments on a real field stay inside the pick, so the field name is
    // still checked against the schema.
    repository: zodqlField().withArguments({ owner: "$owner", name: "$name" }).toSchema(repository),
  }),
  { operationName: "RepositoryOverview" }
)
  .defineVariables({
    owner: { typeName: "String!", schema: z.string() },
    name: { typeName: "String!", schema: z.string() },
  })
  .compile();

export default query;
