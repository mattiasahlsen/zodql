/**
 * The `RepositoryOverview` operation as a gql.tada document. It looks like a
 * plain GraphQL string, but `graphql()` infers the fully typed result and
 * variables from it against the schema introspection — with no generated file to
 * import and no codegen step. Like the codegen version (and unlike zodql), the
 * inferred type is a *compile-time* promise only; nothing checks the response at
 * runtime.
 */
import { graphql } from "./graphql.js";

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
