# zodql

Describe your GraphQL operations with [Zod](https://zod.dev) schemas and use a single schema as the source of truth for the query string, the inferred TypeScript response type, and runtime validation of the data you get back.

zodql compiles a Zod schema into a GraphQL query, sends it through the HTTP client of your choice, and validates the response against that same schema. Because a query is just a schema, you can reshape it at runtime with Zod's own combinators (`.pick`, `.omit`, `.extend`, …) and enforce validation rules that a GraphQL schema can't express.

## Why do I need this library

- **One source of truth** — The same Zod schema defines the GraphQL query, the TypeScript type of the response, and the runtime validation applied to it. There's no separate query string to keep in sync with your types, and no codegen step to run: change the schema and the query, the types, and the validation all move together.
- **Dynamic queries, modifiable at runtime** — A query is a Zod schema, so you can build and adapt it with ordinary Zod combinators. Use `.pick()` / `.omit()` to trim a shared schema down to the fields a given screen needs, `.extend()` to add more, or compose schemas conditionally — all at runtime, without templating GraphQL strings by hand.
- **Validation beyond the GraphQL schema** — GraphQL's type system only knows scalars like `String` and `Int`. With Zod you can assert much more about the data you receive: non-empty strings, arrays with at least one item, emails, URLs, numeric ranges, enums, and any other refinement Zod supports — and have responses that violate those rules rejected at parse time.
- **Reusable query segments** — Fragments and schemas are ordinary runtime values, so you can define a field selection once and reuse it across many queries by importing and composing it — no duplicated selection sets, no generated fragment types to wire up. The result is less boilerplate and less verbose query code.

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

_Source: [examples/readme/quick-start.ts](https://github.com/mattiasahlsen/zodql/blob/main/examples/readme/quick-start.ts)_

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

_Source: [examples/readme/client-fetch.ts](https://github.com/mattiasahlsen/zodql/blob/main/examples/readme/client-fetch.ts)_

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

_Source: [examples/readme/client-axios.ts](https://github.com/mattiasahlsen/zodql/blob/main/examples/readme/client-axios.ts)_

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

_Source: [examples/readme/with-fragment.ts](https://github.com/mattiasahlsen/zodql/blob/main/examples/readme/with-fragment.ts)_

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

_Source: [examples/readme/with-required-fragment.ts](https://github.com/mattiasahlsen/zodql/blob/main/examples/readme/with-required-fragment.ts)_

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

_Source: [examples/readme/with-union-fragments.ts](https://github.com/mattiasahlsen/zodql/blob/main/examples/readme/with-union-fragments.ts)_

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

_Source: [examples/readme/inline-fragment.ts](https://github.com/mattiasahlsen/zodql/blob/main/examples/readme/inline-fragment.ts)_

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

_Source: [examples/readme/non-inline-fragment.ts](https://github.com/mattiasahlsen/zodql/blob/main/examples/readme/non-inline-fragment.ts)_

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

_Source: [examples/readme/field-arguments.ts](https://github.com/mattiasahlsen/zodql/blob/main/examples/readme/field-arguments.ts)_

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

_Source: [examples/readme/query-variables.ts](https://github.com/mattiasahlsen/zodql/blob/main/examples/readme/query-variables.ts)_

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

_Source: [examples/readme/response-validation.ts](https://github.com/mattiasahlsen/zodql/blob/main/examples/readme/response-validation.ts)_

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

_Source: [examples/readme/field-aliases.ts](https://github.com/mattiasahlsen/zodql/blob/main/examples/readme/field-aliases.ts)_

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

_Source: [examples/readme/typescript-support.ts](https://github.com/mattiasahlsen/zodql/blob/main/examples/readme/typescript-support.ts)_

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

MIT

## Author

Mattias Ahlsén - mattias.ahlsen@gmail.com

## API Reference

Every public export of the package, with links to the guide sections that use it (most relevant first) and to its source. Full signatures and JSDoc are available in your editor via the bundled TypeScript declarations.

### Functions

| Export | Summary | Guide | Source |
| --- | --- | --- | --- |
| `zodql()` | Compile a Zod schema into a GraphQL query/mutation builder. | [Quick Start](#quick-start), [Query Variables](#query-variables), [Response Validation](#response-validation), [TypeScript Support](#typescript-support) | [ZodqlBuilder.ts](https://github.com/mattiasahlsen/zodql/blob/main/src/ZodqlBuilder.ts) |
| `zodqlField()` | Configure a field's arguments, fragments, and aliases. | [Field Arguments](#field-arguments), [Fragments](#fragments), [Field Aliases](#field-aliases), [Quick Start](#quick-start) | [ZodqlFieldBuilder.ts](https://github.com/mattiasahlsen/zodql/blob/main/src/ZodqlFieldBuilder.ts) |
| `zodqlFragment()` | Define a reusable named or inline fragment. | [Fragments](#fragments), [Non-Inline Fragment](#non-inline-fragment), [withUnionFragments](#withunionfragments) | [ZodqlBuilder.ts](https://github.com/mattiasahlsen/zodql/blob/main/src/ZodqlBuilder.ts) |
| `buildZodqlClient()` | Wrap an HTTP transport in a typed GraphQL client. | [Client](#client), [Fetch-based client](#fetch-based-client), [Axios-based client](#axios-based-client), [Response Validation](#response-validation) | [client.ts](https://github.com/mattiasahlsen/zodql/blob/main/src/client.ts) |
| `hasTypename()` | Narrow a union/interface result by its `__typename`. | [withUnionFragments](#withunionfragments), [Supported GraphQL Features](#supported-graphql-features) | [hasTypename.ts](https://github.com/mattiasahlsen/zodql/blob/main/src/utils/hasTypename.ts) |

### Types

| Export | Summary | Guide | Source |
| --- | --- | --- | --- |
| `ZodqlOptions` | Options for `zodql()`, e.g. `operationName`. | [Supported GraphQL Features](#supported-graphql-features) | [ZodqlBuilder.ts](https://github.com/mattiasahlsen/zodql/blob/main/src/ZodqlBuilder.ts) |
| `ZodqlQuery` | Output of `compile()`: query string, variables, and response schema. | [Response Validation](#response-validation), [TypeScript Support](#typescript-support), [Quick Start](#quick-start) | [types.ts](https://github.com/mattiasahlsen/zodql/blob/main/src/types.ts) |
| `ZodqlQueryVariable` | A declared operation variable — GraphQL type name plus Zod schema. | [Query Variables](#query-variables) | [types.ts](https://github.com/mattiasahlsen/zodql/blob/main/src/types.ts) |
| `ZodqlQueryFragment` | A fragment definition created by `zodqlFragment()`. | [Fragments](#fragments) | [types.ts](https://github.com/mattiasahlsen/zodql/blob/main/src/types.ts) |
| `ZodqlClient` | Client returned by `buildZodqlClient()`; runs `request()`. | [Client](#client), [Axios-based client](#axios-based-client) | [client.ts](https://github.com/mattiasahlsen/zodql/blob/main/src/client.ts) |
| `ZodqlHttpClient` | The HTTP transport interface a client wraps. | [Client](#client), [Axios-based client](#axios-based-client) | [client.ts](https://github.com/mattiasahlsen/zodql/blob/main/src/client.ts) |
| `ZodqlClientBuilder` | Factory type: a `ZodqlHttpClient` transport in, a `ZodqlClient` out. | [Client](#client) | [client.ts](https://github.com/mattiasahlsen/zodql/blob/main/src/client.ts) |
| `ZodqlResponseData` | Parsed response shape: `{ data, extensions?, errors? }`. | [Response Validation](#response-validation) | [client.ts](https://github.com/mattiasahlsen/zodql/blob/main/src/client.ts) |
