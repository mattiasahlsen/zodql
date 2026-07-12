# zodql

A utility library for integrating Zod schemas with GraphQL in TypeScript projects.

## Features

- 🔒 **Type-safe GraphQL queries** - Build GraphQL queries with full TypeScript type inference
- ✅ **Runtime validation** - Validate GraphQL responses using Zod schemas
- 🧩 **Fragment support** - Reuse common field selections with GraphQL fragments
- 🎯 **Builder pattern** - Fluent API for constructing complex queries
- 🔌 **Bring your own HTTP client** - Works with `fetch` or any client whose response exposes a `.json()` method, with no hard dependency on a particular HTTP library

## Installation

```bash
npm install zodql zod
```

```bash
pnpm add zodql zod
```

## Quick Start

The example below uses the global `fetch`, but any client whose `post` method resolves to `{ response, json }` works, where `json()` returns the already-parsed response body:

```typescript
import { zodql, buildZodqlClient } from "zodql";
import { z } from "zod";

// Define your schema
const userSchema = z.object({
  user: z.object({
    id: z.string(),
    name: z.string(),
    email: z.string(),
  }),
});

// Create a query
const query = zodql("query", userSchema)
  .defineVariables({ userId: { typeName: "ID!", schema: z.string() } })
  .compile();

// Create a client
const client = buildZodqlClient({
  post: async (url, data) => {
    const response = await fetch("https://api.example.com/graphql", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: "Bearer token" },
      body: JSON.stringify(data),
    });
    const body = await response.json();
    return { response, json: () => body };
  },
});

// Execute the query
const { parseResponse } = await client.request(query, { userId: "123" });
const { data } = parseResponse();
```

## API Documentation

## Interfaces

### GraphqlQuerySegment

A partial GraphQL query/mutation selection: the lines of one document segment
plus the fragments it uses. Currently unused by the builder itself (queries
are assembled and emitted as a whole), but available for callers composing
query text from smaller pieces.

#### Properties

##### queryLines

> **queryLines**: `string`[]

The selection's GraphQL source lines, one array entry per line, unindented relative to the document root.

##### usedFragments

> **usedFragments**: [`QueryFragment`](#queryfragment)\<`Readonly`\<\{\[`k`: `string`\]: `$ZodType`\<`unknown`, `unknown`, `$ZodTypeInternals`\<`unknown`, `unknown`\>\>; \}\>, `string`\>[]

The named fragments referenced by `queryLines`, so their definitions can be appended alongside it.

***

### HttpClient

An HTTP client exposing a Promise-based `post` method, used as the transport
for a `ZodqlClient`, e.g. a thin wrapper around `fetch`. It resolves to both
the raw response and a `json()` accessor for its already-parsed body.

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
`json()` returns the already-parsed response body.

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

### QueryVariable

A GraphQL operation variable, declared via `ZodqlBuilder.defineVariables()`.

#### Properties

##### schema

> **schema**: `ZodType`

The Zod schema used to validate/parse the value passed for this variable at request time.

##### typeName

> **typeName**: `string`

The GraphQL type of the variable as it appears in the operation signature, e.g. `"ID!"` or `"[String!]"`.

***

### ZodqlClient

A GraphQL client that executes compiled operations against an [HttpClient](#httpclient)
transport.

#### Type Parameters

##### Response

`Response` = `unknown`

##### RequestConfig

`RequestConfig` = `unknown`

#### Methods

##### request()

> **request**\<`Schema`, `Variables`\>(`query`, `args`, `requestConfig?`): `Promise`\<\{ `parseResponse`: () => \{ \[K in string \| number \| symbol\]: (\{ -readonly \[k in "errors" \| "data" \| "extensions" as \{ data: Schema; errors: ZodOptional\<(...)\>; extensions: ZodOptional\<(...)\> \}\[k\] extends OptionalOutSchema ? never : k\]: \{ data: ...; errors: ...; extensions: ... \}\[k\]\["\_zod"\]\["output"\] \} & \{ -readonly \[k in "errors" \| "data" \| "extensions" as \{ data: Schema; errors: ZodOptional\<(...)\>; extensions: ZodOptional\<(...)\> \}\[k\] extends OptionalOutSchema ? k : never\]?: (...)\[(...)\]\["\_zod"\]\["output"\] \})\[K\] \}; `response`: `Response`; \}\>

Sends a compiled query/mutation. Takes the compiled query
(`{ queryString, variables, schema }`), an `args` object supplying a value
for each declared variable (validated and parsed by its Zod schema before
the request is sent), and an optional transport-specific request config;
resolves to `{ response, parseResponse }`, where `parseResponse()` validates
and returns the response body (see [ResponseData](#responsedata)).

###### Type Parameters

###### Schema

`Schema` *extends* `ZodObject`\<`$ZodLooseShape`, `$strip`\>

###### Variables

`Variables` *extends* `Record`\<`string`, [`QueryVariable`](#queryvariable)\>

###### Parameters

###### query

[`GraphqlQuery`](#graphqlquery)\<`Schema`, `Variables`\>

###### args

`MakeUndefinableFieldsOptional`\<\{ \[Key in string \| number \| symbol\]: input\<Variables\[Key\]\["schema"\]\> \}\>

###### requestConfig?

`RequestConfig`

###### Returns

`Promise`\<\{ `parseResponse`: () => \{ \[K in string \| number \| symbol\]: (\{ -readonly \[k in "errors" \| "data" \| "extensions" as \{ data: Schema; errors: ZodOptional\<(...)\>; extensions: ZodOptional\<(...)\> \}\[k\] extends OptionalOutSchema ? never : k\]: \{ data: ...; errors: ...; extensions: ... \}\[k\]\["\_zod"\]\["output"\] \} & \{ -readonly \[k in "errors" \| "data" \| "extensions" as \{ data: Schema; errors: ZodOptional\<(...)\>; extensions: ZodOptional\<(...)\> \}\[k\] extends OptionalOutSchema ? k : never\]?: (...)\[(...)\]\["\_zod"\]\["output"\] \})\[K\] \}; `response`: `Response`; \}\>

## Type Aliases

### GraphqlQuery

> **GraphqlQuery**\<`Schema`, `Variables`\> = `object`

The output of `ZodqlBuilder.compile()`: a ready-to-send GraphQL operation
paired with everything needed to use it — the variables to pass to a
`ZodqlClient`, and the schema to parse/type the response's `data` field with.

#### Type Parameters

##### Schema

`Schema` *extends* `z.ZodObject`

##### Variables

`Variables` *extends* `Record`\<`string`, [`QueryVariable`](#queryvariable)\>

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

### QueryFragment

> **QueryFragment**\<`Shape`, `On`\> = `object` & \{ `name`: `string`; \} \| \{ `inline`: `true`; \}

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

### ResponseData

> **ResponseData**\<`Schema`\> = `z.infer`\<`ReturnType`\<*typeof* `createResponseDataSchema`\>\>

The parsed body of a GraphQL response — `{ data, extensions?, errors? }` — as
returned by `parseResponse()`. `data` is validated against the query's schema;
`extensions` and `errors` are returned as-is (unvalidated) when present.

#### Type Parameters

##### Schema

`Schema` *extends* `z.ZodObject`

***

### ZodqlClientBuilder

> **ZodqlClientBuilder**\<`Response`, `RequestConfig`\> = (`baseClient`) => [`ZodqlClient`](#zodqlclient)\<`Response`, `RequestConfig`\>

A factory that wraps an [HttpClient](#httpclient) transport in a `ZodqlClient`.

#### Type Parameters

##### Response

`Response` = `unknown`

##### RequestConfig

`RequestConfig` = `unknown`

#### Parameters

##### baseClient

[`HttpClient`](#httpclient)\<`Response`, `RequestConfig`\>

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

`baseClient` only needs to satisfy [HttpClient](#httpclient): a `post` method that resolves to
`{ response, json }`, where `json()` returns the already-parsed response body.

#### Type Parameters

##### Response

`Response` = `unknown`

##### RequestConfig

`RequestConfig` = `unknown`

#### Parameters

##### baseClient

[`HttpClient`](#httpclient)\<`Response`, `RequestConfig`\>

An HTTP client to use for GraphQL requests

#### Returns

[`ZodqlClient`](#zodqlclient)\<`Response`, `RequestConfig`\>

A ZodqlClient instance that executes GraphQL operations

#### Example

```typescript
import { buildZodqlClient } from 'zodql';

const client = buildZodqlClient({
  post: async (url, data) => {
    const response = await fetch('https://api.example.com/graphql', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer token123' },
      body: JSON.stringify(data),
    });
    const body = await response.json();
    return { response, json: () => body };
  },
});

const { parseResponse } = await client.request(query, { userId: '123' });
const { data, errors } = parseResponse();
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

***

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
import { zodql, zodqlField } from 'zodql';
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
import { zodqlField } from 'zodql';
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

> **zodqlFragment**\<`Shape`, `On`\>(`fragmentParam`): [`QueryFragment`](#queryfragment)\<`Shape`, `On`\>

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

`object` *extends* `NoInfer`\<`Shape`\> ? `"Error: Fragment shape can not be an empty object"` : [`QueryFragment`](#queryfragment)\<`Shape`, `On`\>

Fragment definition containing name, on (type), schema, and inline flag

#### Returns

[`QueryFragment`](#queryfragment)\<`Shape`, `On`\>

The validated fragment definition for use in queries

#### Throws

If the fragment's schema shape is an empty object

#### Example

```typescript
import { zodqlFragment } from 'zodql';
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

## Advanced Usage

### Complex Input Types

Build queries or mutations with complex input types:

```typescript
import { zodql, zodqlField } from "zodql";
import { z } from "zod";

// Define complex input schema
const createUserInputSchema = z.object({
  name: z.string(),
  email: z.string().email(),
  age: z.number().optional(),
  address: z.object({
    street: z.string(),
    city: z.string(),
    country: z.string(),
  }),
  tags: z.array(z.string()),
});

// Create mutation with complex input
const createUserSchema = z.object({
  createUser: zodqlField()
    .withArguments({ input: "$input" })
    .toSchema(
      z.object({
        id: z.string(),
        name: z.string(),
        email: z.string(),
      })
    ),
});

const mutation = zodql("mutation", createUserSchema)
  .defineVariables({
    input: {
      typeName: "CreateUserInput!",
      schema: createUserInputSchema,
    },
  })
  .compile();

// Execute with complex input
const { parseResponse } = await client.request(mutation, {
  input: {
    name: "John Doe",
    email: "john@example.com",
    age: 30,
    address: {
      street: "123 Main St",
      city: "Stockholm",
      country: "Sweden",
    },
    tags: ["developer", "typescript"],
  },
});
const { data } = parseResponse();
```

### Using Fragments

Fragments allow you to reuse common field selections:

```typescript
import { zodqlFragment, zodqlField } from "zodql";
import { z } from "zod";

const userFragment = zodqlFragment({
  name: "UserFields",
  on: "User",
  schema: z.object({
    id: z.string(),
    name: z.string(),
    email: z.string(),
  }),
  inline: false,
});

const postSchema = z.object({
  post: zodqlField()
    .withFragment(userFragment)
    .toSchema(
      z.object({
        id: z.string(),
        title: z.string(),
        author: z.object({}), // Fragment fields will be added
      })
    ),
});
```

### Optional vs Required Fragments

Use `withFragment()` for optional fragments and `withRequiredFragment()` for required ones:

```typescript
import { zodqlFragment, zodqlField } from "zodql";
import { z } from "zod";

// Define fragments for different node types
const imageFragment = zodqlFragment({
  name: "ImageFields",
  on: "Image",
  schema: z.object({
    url: z.string(),
    width: z.number(),
    height: z.number(),
  }),
  inline: false,
});

const videoFragment = zodqlFragment({
  name: "VideoFields",
  on: "Video",
  schema: z.object({
    url: z.string(),
    duration: z.number(),
  }),
  inline: false,
});

const baseNodeFragment = zodqlFragment({
  name: "BaseNodeFields",
  on: "Node",
  schema: z.object({
    __typename: z.string(),
    createdAt: z.string(),
  }),
  inline: false,
});

const mediaQuerySchema = z.object({
  // Field with multiple OPTIONAL fragments - tries to parse each, fields only present if type matches
  media: zodqlField()
    .withFragment(imageFragment) // Optional: only parsed if media is an Image
    .withFragment(videoFragment) // Optional: only parsed if media is a Video
    .toSchema(
      z.object({
        id: z.string(),
        title: z.string(),
        // imageFragment fields (url, width, height) will be present if media is Image type
        // videoFragment fields (url, duration) will be present if media is Video type
      })
    ),

  // Field with REQUIRED fragment - fields are always expected
  node: zodqlField()
    .withRequiredFragment(baseNodeFragment) // Required: these fields must always be present
    .toSchema(
      z.object({
        id: z.string(),
        // baseNodeFragment fields (__typename, createdAt) are REQUIRED and always present
      })
    ),
});

// The difference:
// - withFragment(): Fields are conditionally added based on the actual GraphQL type returned
// - withRequiredFragment(): Fields are merged into the base schema and always expected
```

### Field Arguments

Add arguments to GraphQL fields:

```typescript
import { zodqlField } from "zodql";
import { z } from "zod";

const userField = zodqlField()
  .withArguments({ id: "$userId" })
  .toSchema(
    z.object({
      id: z.string(),
      name: z.string(),
    })
  );
```

### Field Aliases

Query the same field multiple times with different arguments:

```typescript
import { zodqlField } from "zodql";
import { z } from "zod";

const schema = z.object({
  activeUsers: zodqlField()
    .asAliasFor("users")
    .withArguments({ status: '"active"' })
    .toSchema(
      z.object({
        id: z.string(),
        name: z.string(),
      })
    ),
  inactiveUsers: zodqlField()
    .asAliasFor("users")
    .withArguments({ status: '"inactive"' })
    .toSchema(
      z.object({
        id: z.string(),
        name: z.string(),
      })
    ),
});
```

### Response Validation

`parseResponse()` validates the response's `data` field against the query's schema and
returns `{ data, extensions?, errors? }`. `extensions` and `errors` are passed through
unvalidated, so GraphQL errors returned in a 200 response are never thrown automatically
— check them yourself:

```typescript
const { parseResponse } = await client.request(query, { userId: "123" });
const { data, errors } = parseResponse();

if (errors) {
  // handle GraphQL errors returned alongside `data`
}
```

## TypeScript Support

This library is written in TypeScript and provides full type inference for all operations:

```typescript
const query = zodql("query", userSchema).compile();

// queryString is typed as string
const { queryString, schema, variables } = query;

// Inferred response type based on schema
type UserResponse = z.infer<typeof schema>;
```

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

ISC

## Author

Mattias Ahlsén - mattias.ahlsen@gmail.com
