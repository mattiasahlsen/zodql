/**
 * The `RepositoryOverview` operation, written as a GraphQL string wrapped in the
 * generated `graphql()` function. Codegen scans this file, and the result is a
 * `TypedDocumentNode` whose result/variable types are inferred from the schema —
 * so the string below is the single place the fields are declared.
 *
 * Compare with the zodql version, where the same selection is expressed as a Zod
 * schema (../../schema.ts) that *also* validates the response at runtime.
 */
import { graphql } from "./gql/index.js";

export const RepositoryOverviewQuery = graphql(`
  query RepositoryOverview($owner: String!, $name: String!) {
    repository(owner: $owner, name: $name) {
      name
      nameWithOwner
      description
      url
      isPrivate
      stargazerCount
      forkCount
      primaryLanguage {
        name
      }
      licenseInfo {
        name
        spdxId
      }
      openIssues: issues(states: OPEN) {
        totalCount
      }
      closedIssues: issues(states: CLOSED) {
        totalCount
      }
      latestRelease {
        name
        tagName
        url
        publishedAt
      }
    }
  }
`);
