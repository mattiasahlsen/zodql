/**
 * Zod schemas for the "repository overview" query. Kept separate from the
 * query itself so the shape of the data and the shape of the request can be
 * read independently.
 */
import { zodqlField } from "@mattiasahlsen/zodql";
import { z } from "zod";

export const languageSchema = z.object({
  name: z.string(),
});

export const licenseSchema = z.object({
  name: z.string(),
  spdxId: z.string().nullable(),
});

export const releaseSchema = z.object({
  name: z.string().nullable(),
  tagName: z.string(),
  url: z.string(),
  publishedAt: z.string().nullable(),
});

const issueCountSchema = z.object({ totalCount: z.number() });

/**
 * `issues(states: …)` queried once per state under a distinct alias, via
 * `asAliasFor()`, so both counts come back in a single request.
 */
function issueCountField(state: "OPEN" | "CLOSED") {
  return zodqlField().asAliasFor("issues").withArguments({ states: state }).toSchema(issueCountSchema);
}

export const repositoryOverviewSchema = z.object({
  name: z.string(),
  nameWithOwner: z.string(),
  description: z.string().nullable(),
  url: z.string(),
  isPrivate: z.boolean(),
  stargazerCount: z.number(),
  forkCount: z.number(),
  // Absent for repositories GitHub couldn't detect a dominant language for.
  primaryLanguage: languageSchema.nullable(),
  // Absent for repositories with no recognized license.
  licenseInfo: licenseSchema.nullable(),
  openIssues: issueCountField("OPEN"),
  closedIssues: issueCountField("CLOSED"),
  // Absent for repositories that have never published a release.
  latestRelease: releaseSchema.nullable(),
});

export type RepositoryOverview = z.infer<typeof repositoryOverviewSchema>;
