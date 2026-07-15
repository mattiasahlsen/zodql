/* eslint-disable */
/* prettier-ignore */

export type introspection_types = {
    'Boolean': unknown;
    'DateTime': unknown;
    'Int': unknown;
    'IssueConnection': { kind: 'OBJECT'; name: 'IssueConnection'; fields: { 'totalCount': { name: 'totalCount'; type: { kind: 'NON_NULL'; name: never; ofType: { kind: 'SCALAR'; name: 'Int'; ofType: null; }; } }; }; };
    'IssueState': { name: 'IssueState'; enumValues: 'OPEN' | 'CLOSED'; };
    'Language': { kind: 'OBJECT'; name: 'Language'; fields: { 'name': { name: 'name'; type: { kind: 'NON_NULL'; name: never; ofType: { kind: 'SCALAR'; name: 'String'; ofType: null; }; } }; }; };
    'License': { kind: 'OBJECT'; name: 'License'; fields: { 'name': { name: 'name'; type: { kind: 'NON_NULL'; name: never; ofType: { kind: 'SCALAR'; name: 'String'; ofType: null; }; } }; 'spdxId': { name: 'spdxId'; type: { kind: 'SCALAR'; name: 'String'; ofType: null; } }; }; };
    'Query': { kind: 'OBJECT'; name: 'Query'; fields: { 'repository': { name: 'repository'; type: { kind: 'OBJECT'; name: 'Repository'; ofType: null; } }; }; };
    'Release': { kind: 'OBJECT'; name: 'Release'; fields: { 'name': { name: 'name'; type: { kind: 'SCALAR'; name: 'String'; ofType: null; } }; 'publishedAt': { name: 'publishedAt'; type: { kind: 'SCALAR'; name: 'DateTime'; ofType: null; } }; 'tagName': { name: 'tagName'; type: { kind: 'NON_NULL'; name: never; ofType: { kind: 'SCALAR'; name: 'String'; ofType: null; }; } }; 'url': { name: 'url'; type: { kind: 'NON_NULL'; name: never; ofType: { kind: 'SCALAR'; name: 'URI'; ofType: null; }; } }; }; };
    'Repository': { kind: 'OBJECT'; name: 'Repository'; fields: { 'description': { name: 'description'; type: { kind: 'SCALAR'; name: 'String'; ofType: null; } }; 'forkCount': { name: 'forkCount'; type: { kind: 'NON_NULL'; name: never; ofType: { kind: 'SCALAR'; name: 'Int'; ofType: null; }; } }; 'isPrivate': { name: 'isPrivate'; type: { kind: 'NON_NULL'; name: never; ofType: { kind: 'SCALAR'; name: 'Boolean'; ofType: null; }; } }; 'issues': { name: 'issues'; type: { kind: 'NON_NULL'; name: never; ofType: { kind: 'OBJECT'; name: 'IssueConnection'; ofType: null; }; } }; 'latestRelease': { name: 'latestRelease'; type: { kind: 'OBJECT'; name: 'Release'; ofType: null; } }; 'licenseInfo': { name: 'licenseInfo'; type: { kind: 'OBJECT'; name: 'License'; ofType: null; } }; 'name': { name: 'name'; type: { kind: 'NON_NULL'; name: never; ofType: { kind: 'SCALAR'; name: 'String'; ofType: null; }; } }; 'nameWithOwner': { name: 'nameWithOwner'; type: { kind: 'NON_NULL'; name: never; ofType: { kind: 'SCALAR'; name: 'String'; ofType: null; }; } }; 'primaryLanguage': { name: 'primaryLanguage'; type: { kind: 'OBJECT'; name: 'Language'; ofType: null; } }; 'stargazerCount': { name: 'stargazerCount'; type: { kind: 'NON_NULL'; name: never; ofType: { kind: 'SCALAR'; name: 'Int'; ofType: null; }; } }; 'url': { name: 'url'; type: { kind: 'NON_NULL'; name: never; ofType: { kind: 'SCALAR'; name: 'URI'; ofType: null; }; } }; }; };
    'String': unknown;
    'URI': unknown;
};

/** An IntrospectionQuery representation of your schema.
 *
 * @remarks
 * This is an introspection of your schema saved as a file by GraphQLSP.
 * It will automatically be used by `gql.tada` to infer the types of your GraphQL documents.
 * If you need to reuse this data or update your `scalars`, update `tadaOutputLocation` to
 * instead save to a .ts instead of a .d.ts file.
 */
export type introspection = {
  name: never;
  query: 'Query';
  mutation: never;
  subscription: never;
  types: introspection_types;
};

import * as gqlTada from 'gql.tada';

declare module 'gql.tada' {
  interface setupSchema {
    introspection: introspection
  }
}