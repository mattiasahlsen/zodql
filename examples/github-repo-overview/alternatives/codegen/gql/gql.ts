/* eslint-disable */
import * as types from './graphql';
import { TypedDocumentNode as DocumentNode } from '@graphql-typed-document-node/core';

/**
 * Map of all GraphQL operations in the project.
 *
 * This map has several performance disadvantages:
 * 1. It is not tree-shakeable, so it will include all operations in the project.
 * 2. It is not minifiable, so the string of a GraphQL query will be multiple times inside the bundle.
 * 3. It does not support dead code elimination, so it will add unused operations.
 *
 * Therefore it is highly recommended to use the babel or swc plugin for production.
 * Learn more about it here: https://the-guild.dev/graphql/codegen/plugins/presets/preset-client#reducing-bundle-size
 */
type Documents = {
    "\n  query RepositoryOverview($owner: String!, $name: String!) {\n    repository(owner: $owner, name: $name) {\n      name\n      nameWithOwner\n      description\n      url\n      isPrivate\n      stargazerCount\n      forkCount\n      primaryLanguage {\n        name\n      }\n      licenseInfo {\n        name\n        spdxId\n      }\n      openIssues: issues(states: OPEN) {\n        totalCount\n      }\n      closedIssues: issues(states: CLOSED) {\n        totalCount\n      }\n      latestRelease {\n        name\n        tagName\n        url\n        publishedAt\n      }\n    }\n  }\n": typeof types.RepositoryOverviewDocument,
};
const documents: Documents = {
    "\n  query RepositoryOverview($owner: String!, $name: String!) {\n    repository(owner: $owner, name: $name) {\n      name\n      nameWithOwner\n      description\n      url\n      isPrivate\n      stargazerCount\n      forkCount\n      primaryLanguage {\n        name\n      }\n      licenseInfo {\n        name\n        spdxId\n      }\n      openIssues: issues(states: OPEN) {\n        totalCount\n      }\n      closedIssues: issues(states: CLOSED) {\n        totalCount\n      }\n      latestRelease {\n        name\n        tagName\n        url\n        publishedAt\n      }\n    }\n  }\n": types.RepositoryOverviewDocument,
};

/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 *
 *
 * @example
 * ```ts
 * const query = graphql(`query GetUser($id: ID!) { user(id: $id) { name } }`);
 * ```
 *
 * The query argument is unknown!
 * Please regenerate the types.
 */
export function graphql(source: string): unknown;

/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  query RepositoryOverview($owner: String!, $name: String!) {\n    repository(owner: $owner, name: $name) {\n      name\n      nameWithOwner\n      description\n      url\n      isPrivate\n      stargazerCount\n      forkCount\n      primaryLanguage {\n        name\n      }\n      licenseInfo {\n        name\n        spdxId\n      }\n      openIssues: issues(states: OPEN) {\n        totalCount\n      }\n      closedIssues: issues(states: CLOSED) {\n        totalCount\n      }\n      latestRelease {\n        name\n        tagName\n        url\n        publishedAt\n      }\n    }\n  }\n"): (typeof documents)["\n  query RepositoryOverview($owner: String!, $name: String!) {\n    repository(owner: $owner, name: $name) {\n      name\n      nameWithOwner\n      description\n      url\n      isPrivate\n      stargazerCount\n      forkCount\n      primaryLanguage {\n        name\n      }\n      licenseInfo {\n        name\n        spdxId\n      }\n      openIssues: issues(states: OPEN) {\n        totalCount\n      }\n      closedIssues: issues(states: CLOSED) {\n        totalCount\n      }\n      latestRelease {\n        name\n        tagName\n        url\n        publishedAt\n      }\n    }\n  }\n"];

export function graphql(source: string) {
  return (documents as any)[source] ?? {};
}

export type DocumentType<TDocumentNode extends DocumentNode<any, any>> = TDocumentNode extends DocumentNode<  infer TType,  any>  ? TType  : never;