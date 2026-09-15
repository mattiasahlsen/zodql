/**
 * The same "RepositoryOverview" query as ./query.ts, but built from generated
 * builders instead of hand-written Zod schemas.
 *
 * The difference is what the compiler knows: every field name, scalar type and
 * nullability here comes from the GraphQL schema, so a typo or a missing
 * `.nullable()` is a type error rather than a runtime parse failure.
 *
 * It also shows the two escape hatches, and why they are where they are:
 *  - **arguments** on a real field go inside the pick, wrapped in `zodqlField()`
 *  - **aliases** go in `.extend()`, because an alias key (`openIssues`) is
 *    invented and so cannot be checked against the schema by construction
 */
import { zodqlField } from "@mattiasahlsen/zodql";
import { zodql } from "@mattiasahlsen/zodql";
import { z } from "zod";
import { buildQueryField } from "./generated/Query.js";
import { buildRepositoryField } from "./generated/Repository.js";
import { buildLanguageField } from "./generated/Language.js";
import { buildLicenseField } from "./generated/License.js";
import { buildReleaseField } from "./generated/Release.js";
import { buildIssueConnectionField } from "./generated/IssueConnection.js";
import { IssueState } from "./generated/IssueState.js";

/** `issues(states: …)` under a distinct alias, so both counts come back at once. */
const issueCountField = (state: IssueState) =>
  zodqlField()
    .asAliasFor("issues")
    .withArguments({ states: state })
    .toSchema(buildIssueConnectionField({ totalCount: true }));

const repositoryOverview = buildRepositoryField({
  name: true,
  nameWithOwner: true,
  description: true,
  url: true,
  isPrivate: true,
  stargazerCount: true,
  forkCount: true,
  primaryLanguage: buildLanguageField({ name: true }),
  licenseInfo: buildLicenseField({ name: true, spdxId: true }),
  latestRelease: buildReleaseField({ name: true, tagName: true, url: true, publishedAt: true }),
}).extend({
  openIssues: issueCountField("OPEN"),
  closedIssues: issueCountField("CLOSED"),
});

export const repositoryOverviewQuery = zodql(
  "query",
  buildQueryField({
    repository: zodqlField().withArguments({ owner: "$owner", name: "$name" }).toSchema(repositoryOverview),
  }),
  { operationName: "RepositoryOverview" }
)
  .defineVariables({
    owner: { typeName: "String!", schema: z.string() },
    name: { typeName: "String!", schema: z.string() },
  })
  .compile();

export type RepositoryOverview = z.infer<typeof repositoryOverviewQuery.schema>;
