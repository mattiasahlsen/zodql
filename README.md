# zodql

Describe your GraphQL operations with [Zod](https://zod.dev) schemas and use a single schema as the source of truth for the query string, the inferred TypeScript response type, and runtime validation of the data you get back.

zodql compiles a Zod schema into a GraphQL query, sends it through the HTTP client of your choice, and validates the response against that same schema. Because a query is just a schema, you can reshape it at runtime with Zod's own combinators (`.pick`, `.omit`, `.extend`, …) and enforce validation rules that a GraphQL schema can't express.

## Why do I need this library

- **One source of truth** — The same Zod schema defines the GraphQL query, the TypeScript type of the response, and the runtime validation applied to it. There's no separate query string to keep in sync with your types, and no codegen step to run: change the schema and the query, the types, and the validation all move together.
- **Dynamic queries, modifiable at runtime** — A query is a Zod schema, so you can build and adapt it with ordinary Zod combinators. Use `.pick()` / `.omit()` to trim a shared schema down to the fields a given screen needs, `.extend()` to add more, or compose schemas conditionally — all at runtime, without templating GraphQL strings by hand.
- **Validation beyond the GraphQL schema** — GraphQL's type system only knows scalars like `String` and `Int`. With Zod you can assert much more about the data you receive: non-empty strings, arrays with at least one item, emails, URLs, numeric ranges, enums, and any other refinement Zod supports — and have responses that violate those rules rejected at parse time.

## Features

- 🔒 **Type-safe GraphQL queries** - Build GraphQL queries with full TypeScript type inference
- ✅ **Runtime validation** - Validate GraphQL responses using Zod schemas
- 🎯 **Builder pattern** - Fluent API for constructing complex queries
- 🔌 **Bring your own HTTP client** - Works with `fetch` or any client whose response exposes a `.json()` method, with no hard dependency on a particular HTTP library

All examples in this README are complete, compiling TypeScript files from [`examples/readme/`](./examples/readme), and every GraphQL snippet is generated from the corresponding example's actual compiled query.

## Supported GraphQL Features

zodql covers the parts of the GraphQL query language you reach for most:

- **Queries and mutations** - Compile either operation type with `zodql("query", …)` or `zodql("mutation", …)`
- **Named operations** - Emit a named operation (e.g. `query GetUser { … }`) via the `operationName` option for easier server-side logging and tracing
- **Query variables** - Declare typed variables with `defineVariables()`, each backed by a Zod schema that validates the values you pass
- **Field arguments** - Attach arguments to any field with `withArguments()`, referencing variables or literals
- **Field aliases** - Query the same field multiple times under different aliases with `asAliasFor()`
- **Nested selection sets** - Arbitrarily nested object selections, expressed as nested Zod object schemas
- **Fragments** - Reuse common field selections with GraphQL fragments, either as standalone named fragments or spread inline
- **Inline fragments** - Select type-specific fields with `... on Type { … }`
- **Unions and interfaces** - Model a union or interface field as a discriminated union on `__typename` with `withUnionFragments()`
- **`__typename`** - Automatically added where it's needed to discriminate union and interface results

## Installation

```bash
npm install @mattiasahlsen/zodql zod
```

```bash
pnpm add @mattiasahlsen/zodql zod
```

## Quick Start

Describe your query with a Zod schema, compile it to GraphQL, and execute it through a client built on any HTTP transport:

```typescript
import { zodql, zodqlField, buildZodqlClient } from "@mattiasahlsen/zodql";
import { z } from "zod";

// Describe the query with a Zod schema
const userSchema = z.object({
  user: zodqlField()
    .withArguments({ id: "$userId" })
    .toSchema(
      z.object({
        id: z.string(),
        name: z.string(),
        email: z.string(),
      })
    ),
});

// Compile it to a GraphQL query
const userQuery = zodql("query", userSchema)
  .defineVariables({ userId: { typeName: "ID!", schema: z.string() } })
  .compile();
export default userQuery;

// Create a client from any HTTP transport whose `post` resolves to `{ response, json }`
const client = buildZodqlClient({
  post: async (_url, data) => {
    const response = await fetch("https://api.example.com/graphql", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: "Bearer token" },
      body: JSON.stringify(data),
    });
    return { response, json: () => response.json() };
  },
});

// Execute the query; the response is validated against the schema
export async function fetchUser() {
  const { parseResponse } = await client.request(userQuery, { userId: "123" });
  const { data } = await parseResponse();
  return data.user; // Typed as { id: string; name: string; email: string }
}
```

The compiled GraphQL query:

```graphql
query ($userId: ID!) {
  user (id: $userId) {
    id
    name
    email
  }
}
```

## Client

`buildZodqlClient()` has no hard dependency on an HTTP library: it wraps any transport whose `post` method resolves to `{ response, json }`, where `json()` returns the already-parsed response body (directly or as a promise).

### Fetch-based client

```typescript
import { zodql, buildZodqlClient } from "@mattiasahlsen/zodql";
import { z } from "zod";

// Wrap `fetch` in the transport contract: `post` resolves to `{ response, json }`,
// where `json()` returns the parsed response body.
export const client = buildZodqlClient({
  post: async (_url, data) => {
    const response = await fetch("https://api.example.com/graphql", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: "Bearer token" },
      body: JSON.stringify(data),
    });
    return { response, json: () => response.json() };
  },
});

const viewerQuery = zodql("query", z.object({ viewer: z.object({ id: z.string(), name: z.string() }) })).compile();

export async function fetchViewer() {
  const { parseResponse } = await client.request(viewerQuery, {});
  const { data } = await parseResponse();
  return data.viewer;
}
```

### Axios-based client

Type the transport as `ZodqlHttpClient<Response, RequestConfig>` to keep the raw response and per-request config fully typed:

```typescript
import { zodql, buildZodqlClient, type ZodqlHttpClient } from "@mattiasahlsen/zodql";
import axios, { type AxiosRequestConfig, type AxiosResponse } from "axios";
import { z } from "zod";

const axiosInstance = axios.create({
  baseURL: "https://api.example.com/graphql",
  headers: { Authorization: "Bearer token" },
});

// Axios parses the response body itself, so `json()` just returns `response.data`
const httpClient: ZodqlHttpClient<AxiosResponse, AxiosRequestConfig> = {
  post: async (url, data, config) => {
    const response = await axiosInstance.post(url, data, config);
    return { response, json: () => response.data };
  },
};

export const client = buildZodqlClient(httpClient);

const viewerQuery = zodql("query", z.object({ viewer: z.object({ id: z.string(), name: z.string() }) })).compile();

export async function fetchViewer() {
  // The third argument is passed through to the transport as its request config
  const { parseResponse } = await client.request(viewerQuery, {}, { timeout: 5000 });
  const { data } = await parseResponse();
  return data.viewer;
}
```

## Fragments

Fragments let you reuse common field selections. Define one with `zodqlFragment()` (or pass an object literal directly) and attach it to a field with `withFragment()`, `withRequiredFragment()`, or `withUnionFragments()`.

### withFragment

`withFragment()` attaches an optional fragment: the fragment may target a type the actual response doesn't match, so its fields are made optional on the parsed result and are simply absent when the type doesn't match:

```typescript
import { zodql, zodqlField, zodqlFragment } from "@mattiasahlsen/zodql";
import { z } from "zod";

const imageFragment = zodqlFragment({
  name: "ImageFields",
  on: "Image",
  schema: z.object({
    url: z.string(),
    width: z.number(),
  }),
  inline: false,
});

const mediaQuery = zodql(
  "query",
  z.object({
    media: zodqlField()
      .withFragment(imageFragment)
      .toSchema(z.object({ id: z.string() })),
  })
).compile();
export default mediaQuery;

// The fragment's fields are optional on the parsed result
export type Media = z.infer<typeof mediaQuery.schema>["media"];
```

Compiled query:

```graphql
query {
  media {
    id
    ...ImageFields
  }
}

fragment ImageFields on Image {
  url
  width
}
```

### withRequiredFragment

`withRequiredFragment()` is for fragments the field is guaranteed to resolve to: the fragment's fields are merged into the parsed schema as-is and are always expected in the response:

```typescript
import { zodql, zodqlField, zodqlFragment } from "@mattiasahlsen/zodql";
import { z } from "zod";

const auditFragment = zodqlFragment({
  name: "AuditFields",
  on: "Node",
  schema: z.object({
    createdAt: z.string(),
    updatedAt: z.string(),
  }),
  inline: false,
});

const nodeQuery = zodql(
  "query",
  z.object({
    node: zodqlField()
      .withRequiredFragment(auditFragment)
      .toSchema(z.object({ id: z.string() })),
  })
).compile();
export default nodeQuery;

// The fragment's fields are required on the parsed result
export type Node = z.infer<typeof nodeQuery.schema>["node"];
```

Compiled query:

```graphql
query {
  node {
    id
    ...AuditFields
  }
}

fragment AuditFields on Node {
  createdAt
  updatedAt
}
```

### withUnionFragments

`withUnionFragments()` models a union or interface field as a discriminated union. A `__typename` selection is added to the query, and at parse time its value decides which fragment schema applies — fields belonging to non-matching fragments are stripped. With `requireOne: true`, parsing fails when `__typename` matches none of the fragments; with `requireOne: false`, unknown typenames are accepted with only the base fields:

```typescript
import { zodql, zodqlField, zodqlFragment } from "@mattiasahlsen/zodql";
import { z } from "zod";

const imageFragment = zodqlFragment({
  name: "ImageFields",
  on: "Image",
  schema: z.object({ url: z.string(), width: z.number() }),
  inline: false,
});

const videoFragment = zodqlFragment({
  name: "VideoFields",
  on: "Video",
  schema: z.object({ url: z.string(), duration: z.number() }),
  inline: false,
});

const mediaQuery = zodql(
  "query",
  z.object({
    media: zodqlField()
      .withUnionFragments([imageFragment, videoFragment], { requireOne: true })
      .toSchema(z.object({ id: z.string() })),
  })
).compile();
export default mediaQuery;

// The parsed result is a discriminated union on `__typename`
export type Media = z.infer<typeof mediaQuery.schema>["media"];
```

Compiled query:

```graphql
query {
  media {
    id
    __typename
    ...ImageFields
    ...VideoFields
  }
}

fragment ImageFields on Image {
  url
  width
}

fragment VideoFields on Video {
  url
  duration
}
```

### Inline Fragment

A fragment marked `inline: true` is spread directly into the parent selection as `... on Type { ... }`, with no standalone fragment definition:

```typescript
import { zodql, zodqlField } from "@mattiasahlsen/zodql";
import { z } from "zod";

export default zodql(
  "query",
  z.object({
    node: zodqlField()
      .withFragment({
        on: "User",
        inline: true,
        schema: z.object({ name: z.string(), email: z.string() }),
      })
      .toSchema(z.object({ id: z.string() })),
  })
).compile();
```

Compiled query:

```graphql
query {
  node {
    id
    ... on User {
      name
      email
    }
  }
}
```

### Non-Inline Fragment

A named fragment (`inline: false`) is emitted once as a standalone `fragment ... on ...` definition and referenced via `...FragmentName` wherever it's attached:

```typescript
import { zodql, zodqlField, zodqlFragment } from "@mattiasahlsen/zodql";
import { z } from "zod";

// The fragment is emitted once and referenced from both fields below
const userFragment = zodqlFragment({
  name: "UserFields",
  on: "User",
  schema: z.object({ id: z.string(), name: z.string() }),
  inline: false,
});

export default zodql(
  "query",
  z.object({
    post: z.object({
      title: z.string(),
      author: zodqlField().withRequiredFragment(userFragment).toSchema(z.object({})),
      reviewer: zodqlField().withRequiredFragment(userFragment).toSchema(z.object({})),
    }),
  })
).compile();
```

Compiled query:

```graphql
query {
  post {
    title
    author {
      ...UserFields
    }
    reviewer {
      ...UserFields
    }
  }
}

fragment UserFields on User {
  id
  name
}
```

## Field Arguments

`withArguments()` adds GraphQL arguments to a field. Argument values are raw GraphQL source: reference a query variable with `"$variableName"`, or pass literals like `"10"` or `'"active"'`:

```typescript
import { zodql, zodqlField } from "@mattiasahlsen/zodql";
import { z } from "zod";

export default zodql(
  "query",
  z.object({
    users: z.array(
      zodqlField()
        .withArguments({ status: '"active"', first: "10" })
        .toSchema(z.object({ id: z.string(), name: z.string() }))
    ),
  })
).compile();
```

Compiled query:

```graphql
query {
  users (status: "active", first: 10) {
    id
    name
  }
}
```

## Query Variables

Declare variables with `defineVariables()`: each variable gets a GraphQL type name and a Zod schema, which can be arbitrarily complex (e.g. a nested input object). Values passed to `request()` are validated and parsed by their schemas before the request is sent — defaults, coercion, and transforms all apply, and a variable that parses to `undefined` is omitted from the request body entirely:

```typescript
import { zodql, zodqlField, buildZodqlClient } from "@mattiasahlsen/zodql";
import { z } from "zod";

const createUserInputSchema = z.object({
  name: z.string(),
  email: z.email(),
  address: z.object({ city: z.string(), country: z.string() }),
  tags: z.array(z.string()),
});

const createUserMutation = zodql(
  "mutation",
  z.object({
    createUser: zodqlField()
      .withArguments({ input: "$input" })
      .toSchema(z.object({ id: z.string(), name: z.string() })),
  })
)
  .defineVariables({ input: { typeName: "CreateUserInput!", schema: createUserInputSchema } })
  .compile();
export default createUserMutation;

const client = buildZodqlClient({
  post: async (_url, data) => {
    const response = await fetch("https://api.example.com/graphql", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    return { response, json: () => response.json() };
  },
});

export async function createUser() {
  // The variable values are type-checked and validated against their schemas
  const { parseResponse } = await client.request(createUserMutation, {
    input: {
      name: "John Doe",
      email: "john@example.com",
      address: { city: "Stockholm", country: "Sweden" },
      tags: ["developer", "typescript"],
    },
  });
  const { data } = await parseResponse();
  return data.createUser;
}
```

Compiled query:

```graphql
mutation ($input: CreateUserInput!) {
  createUser (input: $input) {
    id
    name
  }
}
```

## Response Validation

`parseResponse()` validates the response's `data` field against the query's schema and resolves to `{ data, extensions?, errors? }`. `extensions` and `errors` are passed through unvalidated, so GraphQL errors returned in a 200 response are never thrown automatically — check them yourself:

```typescript
import { zodql, buildZodqlClient } from "@mattiasahlsen/zodql";
import { z } from "zod";

const viewerQuery = zodql("query", z.object({ viewer: z.object({ id: z.string(), name: z.string() }) })).compile();

const client = buildZodqlClient({
  post: async (_url, data) => {
    const response = await fetch("https://api.example.com/graphql", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    return { response, json: () => response.json() };
  },
});

export async function fetchViewer() {
  const { parseResponse } = await client.request(viewerQuery, {});

  // GraphQL errors arrive in a 200 response body and are never thrown — check them yourself
  const { data, errors } = await parseResponse();

  if (errors) {
    throw new Error(`GraphQL errors: ${JSON.stringify(errors)}`);
  }

  return data.viewer; // Validated: { id: string; name: string }
}
```

## Field Aliases

`asAliasFor()` queries the same field multiple times under different aliases, e.g. with different arguments:

```typescript
import { zodql, zodqlField } from "@mattiasahlsen/zodql";
import { z } from "zod";

const userFields = z.object({ id: z.string(), name: z.string() });

export default zodql(
  "query",
  z.object({
    activeUsers: z.array(zodqlField().asAliasFor("users").withArguments({ status: '"active"' }).toSchema(userFields)),
    inactiveUsers: z.array(
      zodqlField().asAliasFor("users").withArguments({ status: '"inactive"' }).toSchema(userFields)
    ),
  })
).compile();
```

Compiled query:

```graphql
query {
  activeUsers: users (status: "active") {
    id
    name
  }
  inactiveUsers: users (status: "inactive") {
    id
    name
  }
}
```

## TypeScript Support

This library is written in TypeScript and provides full type inference for all operations — the response type is inferred from the query's Zod schema, and `client.request()` type-checks the variable values you pass:

```typescript
import { zodql, zodqlField } from "@mattiasahlsen/zodql";
import { z } from "zod";

const userQuery = zodql(
  "query",
  z.object({
    user: zodqlField()
      .withArguments({ id: "$userId" })
      .toSchema(z.object({ id: z.string(), name: z.string() })),
  })
)
  .defineVariables({ userId: { typeName: "ID!", schema: z.string() } })
  .compile();

// The compiled query carries its GraphQL source as a plain string...
export const queryString: string = userQuery.queryString;

// ...and the response type is inferred straight from the query's schema
export type UserResponse = z.infer<typeof userQuery.schema>;
// => { user: { id: string; name: string } }
```

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

MIT

## Author

Mattias Ahlsén - mattias.ahlsen@gmail.com

## API Documentation

## Query Building

### zodql()

> **zodql**\<`Schema`\>(`operation`, `documentSchema`, `options?`): `ZodqlBuilder`\<`Schema`, \{ \}\>

Create a ZodqlBuilder for building GraphQL queries or mutations from Zod schemas.

This function initializes a builder that can be used to define variables and compile
GraphQL query strings with associated Zod schemas for type-safe GraphQL operations.

The returned builder is immutable: `defineVariables()` returns a new builder
with the added variables rather than mutating this one, so it's safe to chain
or to branch off a shared base builder. Call `compile()` last to produce the
final query string, variables, and schema.

#### Type Parameters

##### Schema

`Schema` *extends* `ZodObject`\<`$ZodLooseShape`, `$strip`\>

#### Parameters

##### operation

`Operation`

The GraphQL operation type, either "query" or "mutation"

##### documentSchema

`Schema`

Zod schema (built from plain fields and/or `zodqlField()`
  fields) representing the GraphQL document's root selection set

##### options?

[`ZodqlOptions`](#zodqloptions) = `{}`

Optional settings for the operation. See [ZodqlOptions](#zodqloptions) for the available fields.

#### Returns

`ZodqlBuilder`\<`Schema`, \{ \}\>

A ZodqlBuilder instance for chaining operations

#### Example

```typescript
import { zodql, zodqlField } from '@mattiasahlsen/zodql';
import { z } from 'zod';

const userSchema = z.object({
  user: zodqlField().withArguments({ id: "$userId" }).toSchema(
    z.object({
      id: z.string(),
      name: z.string(),
    })
  ),
});

const query = zodql('query', userSchema, { operationName: 'GetUser' })
  .defineVariables({ userId: { typeName: 'ID!', schema: z.string() } })
  .compile();
```

***

### zodqlField()

> **zodqlField**(): `ZodqlFieldBuilder`

Create a ZodqlFieldBuilder for building GraphQL fields with arguments, fragments, and aliases.

This builder provides a fluent interface to configure GraphQL fields with:
- Arguments for parameterized queries
- Optional or required fragments for type-specific field selection
- Discriminated union fragments, selected by `__typename` at parse time
- Aliases to query the same field multiple times with different arguments

Each `with*` method returns a new builder rather than mutating the current
one, so calls can be chained freely. Call `toSchema()` last to produce the
finished schema for use as a field's value in a document schema.

#### Returns

`ZodqlFieldBuilder`

A new ZodqlFieldBuilder instance for configuring field properties

#### Example

```typescript
import { zodqlField } from '@mattiasahlsen/zodql';
import { z } from 'zod';

const userField = zodqlField()
  .withArguments({ id: '$userId' })
  .withFragment({
    name: 'UserFields',
    on: 'User',
    schema: z.object({
      id: z.string(),
      name: z.string(),
    }),
  })
  .toSchema(z.object({
    id: z.string(),
    name: z.string(),
  }));
```

***

### zodqlFragment()

> **zodqlFragment**\<`Shape`, `On`\>(`fragmentParam`): [`ZodqlQueryFragment`](#zodqlqueryfragment)\<`Shape`, `On`\>

Define a GraphQL fragment from a Zod schema.

Fragments allow you to reuse common field selections across multiple queries.
This function validates and returns a fragment definition that can be used with
zodqlField's withFragment(), withRequiredFragment(), or withUnionFragments() methods.

A fragment must either be given a `name` (emitted as a standalone named
fragment, e.g. `...UserFields`, referenced wherever it's attached) or marked
`inline: true` (its fields are spread directly into the parent selection
instead, with no separate fragment definition). Union fragments (used with
`withUnionFragments()`) must use `name`, since inline fragments have nothing
for the `...FragmentName` reference to resolve to. This is enforced at the
type level; at runtime, the fragment's schema shape is checked and rejected
if empty, since an empty selection set is not valid GraphQL.

#### Type Parameters

##### Shape

`Shape` *extends* `Readonly`\<\{\[`k`: `string`\]: `$ZodType`\<`unknown`, `unknown`, `$ZodTypeInternals`\<`unknown`, `unknown`\>\>; \}\>

##### On

`On` *extends* `string`

#### Parameters

##### fragmentParam

`object` *extends* `NoInfer`\<`Shape`\> ? `"Error: Fragment shape can not be an empty object"` : [`ZodqlQueryFragment`](#zodqlqueryfragment)\<`Shape`, `On`\>

Fragment definition containing name, on (type), schema, and inline flag

#### Returns

[`ZodqlQueryFragment`](#zodqlqueryfragment)\<`Shape`, `On`\>

The validated fragment definition for use in queries

#### Throws

If the fragment's schema shape is an empty object

#### Example

```typescript
import { zodqlFragment } from '@mattiasahlsen/zodql';
import { z } from 'zod';

const userFragment = zodqlFragment({
  name: 'UserFields',
  on: 'User',
  schema: z.object({
    id: z.string(),
    name: z.string(),
    email: z.string(),
  }),
  inline: false,
});
```

## Functions

### buildZodqlClient()

> **buildZodqlClient**\<`Response`, `RequestConfig`\>(`baseClient`): [`ZodqlClient`](#zodqlclient)\<`Response`, `RequestConfig`\>

Build a Zod GraphQL client using the given HTTP client as the transport.

This function creates a GraphQL client that validates and parses variables
using their Zod schemas before sending requests, so a variable's runtime
value can differ from its wire value (e.g. defaults, coercion, transforms).
Any variable that parses to `undefined` is omitted from the request body
entirely, rather than being sent as `undefined` or `null`. `baseClient`'s
configured `baseURL` and headers (e.g. auth) are used as-is; every request
is a `POST` with a `{ query, variables }` JSON body. `parseResponse()` parses the
response body as `{ data, extensions?, errors? }`, validating `data` against the
query's schema; `extensions` and `errors` are returned as-is, unvalidated, if present.
GraphQL errors returned in a 200 response body are therefore not thrown — the caller
must check `parseResponse().errors` themselves. The returned promise rejects (without
making a request) if a variable's value fails its Zod schema, e.g. a required variable
that was omitted.

`baseClient` only needs to satisfy [ZodqlHttpClient](#zodqlhttpclient): a `post` method that resolves to
`{ response, json }`, where `json()` returns the parsed response body, either directly or
as a promise.

#### Type Parameters

##### Response

`Response` = `unknown`

##### RequestConfig

`RequestConfig` = `unknown`

#### Parameters

##### baseClient

[`ZodqlHttpClient`](#zodqlhttpclient)\<`Response`, `RequestConfig`\>

An HTTP client to use for GraphQL requests

#### Returns

[`ZodqlClient`](#zodqlclient)\<`Response`, `RequestConfig`\>

A ZodqlClient instance that executes GraphQL operations

#### Example

```typescript
import { buildZodqlClient } from '@mattiasahlsen/zodql';

const client = buildZodqlClient({
  post: async (url, data) => {
    const response = await fetch('https://api.example.com/graphql', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer token123' },
      body: JSON.stringify(data),
    });
    return { response, json: () => response.json() };
  },
});

const { parseResponse } = await client.request(query, { userId: '123' });
const { data, errors } = await parseResponse();
```

***

### hasTypename()

> **hasTypename**\<`T`, `Obj`\>(`obj`, `typename`): `obj is Extract<Obj, { __typename: T }>`

Type guard that checks whether an object's `__typename` field matches a
given GraphQL type name, narrowing the input union to the matching member(s).

Safely handles `null` and `undefined` inputs by returning `false`, which is
useful for nullable GraphQL union/interface fields.

#### Type Parameters

##### T

`T` *extends* `string`

The string literal type of the expected `__typename` value.

##### Obj

`Obj` *extends* `object`

The object (or union of objects) to narrow.

#### Parameters

##### obj

`Obj` \| `null` \| `undefined`

The object to check. May be `null` or `undefined`.

##### typename

`T`

The expected `__typename` string to match against.

#### Returns

`obj is Extract<Obj, { __typename: T }>`

`true` if `obj` has a `__typename` field equal to `typename`,
  narrowing the type to the matching union member.

#### Example

```typescript
type AdminUser = { __typename: "AdminUser"; adminId: string };
type GuestUser = { __typename: "GuestUser"; guestId: string };
type User = AdminUser | GuestUser;

const user: User = getUser();

if (hasTypename(user, "AdminUser")) {
  // user is narrowed to AdminUser
  console.log(user.adminId);
}

// Safe with nullable values
const maybeUser: User | null = getNullableUser();
if (hasTypename(maybeUser, "GuestUser")) {
  console.log(maybeUser.guestId);
}
```

## Interfaces

### ZodqlClient

A GraphQL client that executes compiled operations against an [ZodqlHttpClient](#zodqlhttpclient)
transport.

#### Type Parameters

##### Response

`Response` = `unknown`

##### RequestConfig

`RequestConfig` = `unknown`

#### Methods

##### request()

> **request**\<`Schema`, `Variables`\>(`query`, `args`, `requestConfig?`): `Promise`\<\{ `parseResponse`: () => `Promise`\<\{ \[K in string \| number \| symbol\]: (\{ -readonly \[k in "errors" \| "data" \| "extensions" as \{ data: ...; errors: ...; extensions: ... \}\[k\] extends OptionalOutSchema ? never : k\]: (...)\[(...)\]\["\_zod"\]\["output"\] \} & \{ -readonly \[k in "errors" \| "data" \| "extensions" as \{ data: ...; errors: ...; extensions: ... \}\[k\] extends OptionalOutSchema ? k : never\]?: (...)\[(...)\]\["output"\] \})\[K\] \}\>; `response`: `Response`; \}\>

Sends a compiled query/mutation. Takes the compiled query
(`{ queryString, variables, schema }`), an `args` object supplying a value
for each declared variable (validated and parsed by its Zod schema before
the request is sent), and an optional transport-specific request config;
resolves to `{ response, parseResponse }`, where `parseResponse()` validates
and returns a promise for the response body (see [ZodqlResponseData](#zodqlresponsedata)).

###### Type Parameters

###### Schema

`Schema` *extends* `ZodObject`\<`$ZodLooseShape`, `$strip`\>

###### Variables

`Variables` *extends* `Record`\<`string`, [`ZodqlQueryVariable`](#zodqlqueryvariable)\>

###### Parameters

###### query

[`ZodqlQuery`](#zodqlquery)\<`Schema`, `Variables`\>

###### args

`MakeUndefinableFieldsOptional`\<\{ \[Key in string \| number \| symbol\]: input\<Variables\[Key\]\["schema"\]\> \}\>

###### requestConfig?

`RequestConfig`

###### Returns

`Promise`\<\{ `parseResponse`: () => `Promise`\<\{ \[K in string \| number \| symbol\]: (\{ -readonly \[k in "errors" \| "data" \| "extensions" as \{ data: ...; errors: ...; extensions: ... \}\[k\] extends OptionalOutSchema ? never : k\]: (...)\[(...)\]\["\_zod"\]\["output"\] \} & \{ -readonly \[k in "errors" \| "data" \| "extensions" as \{ data: ...; errors: ...; extensions: ... \}\[k\] extends OptionalOutSchema ? k : never\]?: (...)\[(...)\]\["output"\] \})\[K\] \}\>; `response`: `Response`; \}\>

***

### ZodqlHttpClient

An HTTP client exposing a Promise-based `post` method, used as the transport
for a `ZodqlClient`, e.g. a thin wrapper around `fetch`. It resolves to both
the raw response and a `json()` accessor for its parsed body, which may return
the body directly or as a promise.

#### Type Parameters

##### Response

`Response` = `unknown`

##### RequestConfig

`RequestConfig` = `unknown`

#### Methods

##### post()

> **post**(`url`, `data`, `config?`): `Promise`\<\{ `json`: () => `unknown`; `response`: `Response`; \}\>

Sends a `POST` request. Takes the URL, the request body, and an optional
transport-specific config, and resolves to `{ response, json }`, where
`json()` returns the parsed response body, either directly or as a promise.

###### Parameters

###### url

`string`

###### data

`unknown`

###### config?

`RequestConfig`

###### Returns

`Promise`\<\{ `json`: () => `unknown`; `response`: `Response`; \}\>

***

### ZodqlQueryVariable

A GraphQL operation variable, declared via `ZodqlBuilder.defineVariables()`.

#### Properties

##### schema

> **schema**: `ZodType`

The Zod schema used to validate/parse the value passed for this variable at request time.

##### typeName

> **typeName**: `string`

The GraphQL type of the variable as it appears in the operation signature, e.g. `"ID!"` or `"[String!]"`.

## Type Aliases

### ZodqlClientBuilder

> **ZodqlClientBuilder**\<`Response`, `RequestConfig`\> = (`baseClient`) => [`ZodqlClient`](#zodqlclient)\<`Response`, `RequestConfig`\>

A factory that wraps an [ZodqlHttpClient](#zodqlhttpclient) transport in a `ZodqlClient`.

#### Type Parameters

##### Response

`Response` = `unknown`

##### RequestConfig

`RequestConfig` = `unknown`

#### Parameters

##### baseClient

[`ZodqlHttpClient`](#zodqlhttpclient)\<`Response`, `RequestConfig`\>

#### Returns

[`ZodqlClient`](#zodqlclient)\<`Response`, `RequestConfig`\>

***

### ZodqlOptions

> **ZodqlOptions** = `object`

Optional settings for a `zodql` operation.

#### Properties

##### operationName?

> `optional` **operationName?**: `string`

Optional name for the GraphQL operation. When provided, the compiled
operation is emitted with this name (e.g. `query myRootQuery { ... }`),
which is useful for server-side logging, tracing, and debugging. When
omitted, an anonymous operation is emitted (e.g. `query { ... }`). The value
must be a valid GraphQL `Name` (a letter or underscore followed by letters,
digits, or underscores); otherwise `compile()` throws.
See https://spec.graphql.org/October2021/#sec-Names

***

### ZodqlQuery

> **ZodqlQuery**\<`Schema`, `Variables`\> = `object`

The output of `ZodqlBuilder.compile()`: a ready-to-send GraphQL operation
paired with everything needed to use it — the variables to pass to a
`ZodqlClient`, and the schema to parse/type the response's `data` field with.

#### Type Parameters

##### Schema

`Schema` *extends* `z.ZodObject`

##### Variables

`Variables` *extends* `Record`\<`string`, [`ZodqlQueryVariable`](#zodqlqueryvariable)\>

#### Properties

##### queryString

> **queryString**: `string`

The full GraphQL document source: the operation plus any fragment definitions it uses.

##### schema

> **schema**: `Schema`

The document's root selection schema, e.g. for `z.infer<Schema>` to type the response's `data` field.

##### variables

> **variables**: `Variables`

The variable declarations passed to `defineVariables()`, keyed by variable name (without the leading `$`).

***

### ZodqlQueryFragment

> **ZodqlQueryFragment**\<`Shape`, `On`\> = `object` & \{ `name`: `string`; \} \| \{ `inline`: `true`; \}

A GraphQL fragment definition, created with `zodqlFragment()` and attached to
a field via `withFragment()`, `withRequiredFragment()`, or `withUnionFragments()`.

Must be either named or inline, not both:
- `{ name: string }` — emitted once as a standalone `fragment Name on Type { ... }`
  definition and referenced from attachment points as `...Name`. Required for
  fragments passed to `withUnionFragments()`.
- `{ inline: true }` — has no `name` and no standalone definition; its fields
  are spread directly into the parent selection as an inline fragment
  (`... on Type { ... }`) wherever it's attached.

#### Type Declaration

##### inline?

> `optional` **inline?**: `boolean`

When `true`, the fragment is spread inline instead of emitted as a named definition.

##### name?

> `optional` **name?**: `string`

The fragment's name, required unless `inline` is `true`.

##### on

> **on**: `On`

The GraphQL type this fragment applies to, e.g. `... on User`.

##### schema

> **schema**: `z.ZodObject`\<`Shape`\>

The fragment's field selection and, for parsing, its Zod schema.

#### Type Parameters

##### Shape

`Shape` *extends* `z.ZodRawShape` = `z.ZodRawShape`

##### On

`On` *extends* `string` = `string`

***

### ZodqlResponseData

> **ZodqlResponseData**\<`Schema`\> = `z.infer`\<`ReturnType`\<*typeof* `createResponseDataSchema`\>\>

The parsed body of a GraphQL response — `{ data, extensions?, errors? }` — as
resolved by `parseResponse()`. `data` is validated against the query's schema;
`extensions` and `errors` are returned as-is (unvalidated) when present.

#### Type Parameters

##### Schema

`Schema` *extends* `z.ZodObject`
