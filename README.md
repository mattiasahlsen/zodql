# zodql

A utility library for integrating Zod schemas with GraphQL in TypeScript projects.

## Features

- 🔒 **Type-safe GraphQL queries** - Build GraphQL queries with full TypeScript type inference
- ✅ **Runtime validation** - Validate GraphQL responses using Zod schemas
- 🧩 **Fragment support** - Reuse common field selections with GraphQL fragments
- 🎯 **Builder pattern** - Fluent API for constructing complex queries
- 🔌 **Axios integration** - Built-in support for Axios HTTP client

## Installation

```bash
npm install zodql zod axios
```

```bash
pnpm add zodql zod axios
```

## Quick Start

```typescript
import { zodql, buildAxiosZodqlClient } from "zodql";
import { z } from "zod";
import axios from "axios";

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
const axiosInstance = axios.create({
  baseURL: "https://api.example.com/graphql",
  headers: { Authorization: "Bearer token" },
});

const client = buildAxiosZodqlClient(axiosInstance);

// Execute the query
const response = await client.request(query, { userId: "123" });
```

## API Documentation

## Functions

<dl>
<dt><a href="#zodql">zodql(operation, documentSchema, [options])</a> ⇒ <code>ZodqlBuilder</code></dt>
<dd><p>Create a ZodqlBuilder for building GraphQL queries or mutations from Zod schemas.</p>
<p>This function initializes a builder that can be used to define variables and compile
GraphQL query strings with associated Zod schemas for type-safe GraphQL operations.</p>
<p>The returned builder is immutable: <code>defineVariables()</code> returns a new builder
with the added variables rather than mutating this one, so it&#39;s safe to chain
or to branch off a shared base builder. Call <code>compile()</code> last to produce the
final query string, variables, and schema.</p>
</dd>
<dt><a href="#zodqlFragment">zodqlFragment(fragmentParam)</a> ⇒ <code>QueryFragment</code></dt>
<dd><p>Define a GraphQL fragment from a Zod schema.</p>
<p>Fragments allow you to reuse common field selections across multiple queries.
This function validates and returns a fragment definition that can be used with
zodqlField&#39;s withFragment(), withRequiredFragment(), or withUnionFragments() methods.</p>
<p>A fragment must either be given a <code>name</code> (emitted as a standalone named
fragment, e.g. <code>...UserFields</code>, referenced wherever it&#39;s attached) or marked
<code>inline: true</code> (its fields are spread directly into the parent selection
instead, with no separate fragment definition). Union fragments (used with
<code>withUnionFragments()</code>) must use <code>name</code>, since inline fragments have nothing
for the <code>...FragmentName</code> reference to resolve to. This is enforced at the
type level; at runtime, the fragment&#39;s schema shape is checked and rejected
if empty, since an empty selection set is not valid GraphQL.</p>
</dd>
<dt><a href="#zodqlField">zodqlField()</a> ⇒ <code>ZodqlFieldBuilder</code></dt>
<dd><p>Create a ZodqlFieldBuilder for building GraphQL fields with arguments, fragments, and aliases.</p>
<p>This builder provides a fluent interface to configure GraphQL fields with:</p>
<ul>
<li>Arguments for parameterized queries</li>
<li>Optional or required fragments for type-specific field selection</li>
<li>Discriminated union fragments, selected by <code>__typename</code> at parse time</li>
<li>Aliases to query the same field multiple times with different arguments</li>
</ul>
<p>Each <code>with*</code> method returns a new builder rather than mutating the current
one, so calls can be chained freely. Call <code>toSchema()</code> last to produce the
finished schema for use as a field&#39;s value in a document schema.</p>
</dd>
<dt><a href="#buildAxiosZodqlClient">buildAxiosZodqlClient(baseClient)</a> ⇒ <code>ZodqlClient.&lt;AxiosResponse, AxiosRequestConfig&gt;</code></dt>
<dd><p>Build a Zod GraphQL client using Axios as the HTTP transport.</p>
<p>This function creates a GraphQL client that validates and parses variables
using their Zod schemas before sending requests, so a variable&#39;s runtime
value can differ from its wire value (e.g. defaults, coercion, transforms).
Any variable that parses to <code>undefined</code> is omitted from the request body
entirely, rather than being sent as <code>undefined</code> or <code>null</code>. <code>baseClient</code>&#39;s
configured <code>baseURL</code> and headers (e.g. auth) are used as-is; every request
is a <code>POST</code> with a <code>{ query, variables }</code> JSON body. The client does not
inspect the response — GraphQL errors returned in a 200 response body are
not thrown and must be checked by the caller (see <a href="#createResponseSchema">createResponseSchema</a>).
The returned promise rejects (without making a request) if a variable&#39;s
value fails its Zod schema, e.g. a required variable that was omitted.</p>
</dd>
<dt><a href="#createResponseSchema">createResponseSchema(dataSchema, options)</a> ⇒</dt>
<dd><p>Creates a Zod schema for a GraphQL response, i.e. <code>{ data, extensions?, errors? }</code>
as returned by a spec-compliant GraphQL server.</p>
<p><code>data</code> is required on the resulting schema and validated with <code>dataSchema</code>.
<code>extensions</code> and <code>errors</code> are always optional — they may be absent or
<code>undefined</code> regardless of whether <code>extensionSchema</code>/<code>errorsSchema</code> were
provided — but are validated against those schemas when present. When
<code>extensionSchema</code>/<code>errorsSchema</code> aren&#39;t provided, any loose object /
any array is accepted, respectively, i.e. present but unvalidated.</p>
</dd>
<dt><a href="#hasTypename">hasTypename(obj, typename)</a> ⇒</dt>
<dd><p>Type guard that checks whether an object&#39;s <code>__typename</code> field matches a
given GraphQL type name, narrowing the input union to the matching member(s).</p>
<p>Safely handles <code>null</code> and <code>undefined</code> inputs by returning <code>false</code>, which is
useful for nullable GraphQL union/interface fields.</p>
</dd>
</dl>

## Typedefs

<dl>
<dt><a href="#ZodqlOptions">ZodqlOptions</a> : <code>Object</code></dt>
<dd><p>Optional settings for a <code>zodql</code> operation.</p>
</dd>
</dl>

<a name="zodql"></a>

## zodql(operation, documentSchema, [options]) ⇒ <code>ZodqlBuilder</code>
Create a ZodqlBuilder for building GraphQL queries or mutations from Zod schemas.

This function initializes a builder that can be used to define variables and compile
GraphQL query strings with associated Zod schemas for type-safe GraphQL operations.

The returned builder is immutable: `defineVariables()` returns a new builder
with the added variables rather than mutating this one, so it's safe to chain
or to branch off a shared base builder. Call `compile()` last to produce the
final query string, variables, and schema.

**Kind**: global function  
**Returns**: <code>ZodqlBuilder</code> - A ZodqlBuilder instance for chaining operations  

| Param | Type | Description |
| --- | --- | --- |
| operation | <code>&quot;query&quot;</code> \| <code>&quot;mutation&quot;</code> | The GraphQL operation type, either "query" or "mutation" |
| documentSchema | <code>z.ZodObject</code> | Zod schema (built from plain fields and/or `zodqlField()`   fields) representing the GraphQL document's root selection set |
| [options] | [<code>ZodqlOptions</code>](#ZodqlOptions) | Optional settings for the operation. See [ZodqlOptions](#ZodqlOptions) for the available fields. |

**Example**  
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
<a name="zodqlFragment"></a>

## zodqlFragment(fragmentParam) ⇒ <code>QueryFragment</code>
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

**Kind**: global function  
**Returns**: <code>QueryFragment</code> - The validated fragment definition for use in queries  
**Throws**:

- <code>Error</code> If the fragment's schema shape is an empty object


| Param | Type | Description |
| --- | --- | --- |
| fragmentParam | <code>QueryFragment</code> | Fragment definition containing name, on (type), schema, and inline flag |

**Example**  
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
<a name="zodqlField"></a>

## zodqlField() ⇒ <code>ZodqlFieldBuilder</code>
Create a ZodqlFieldBuilder for building GraphQL fields with arguments, fragments, and aliases.

This builder provides a fluent interface to configure GraphQL fields with:
- Arguments for parameterized queries
- Optional or required fragments for type-specific field selection
- Discriminated union fragments, selected by `__typename` at parse time
- Aliases to query the same field multiple times with different arguments

Each `with*` method returns a new builder rather than mutating the current
one, so calls can be chained freely. Call `toSchema()` last to produce the
finished schema for use as a field's value in a document schema.

**Kind**: global function  
**Returns**: <code>ZodqlFieldBuilder</code> - A new ZodqlFieldBuilder instance for configuring field properties  
**Example**  
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
<a name="buildAxiosZodqlClient"></a>

## buildAxiosZodqlClient(baseClient) ⇒ <code>ZodqlClient.&lt;AxiosResponse, AxiosRequestConfig&gt;</code>
Build a Zod GraphQL client using Axios as the HTTP transport.

This function creates a GraphQL client that validates and parses variables
using their Zod schemas before sending requests, so a variable's runtime
value can differ from its wire value (e.g. defaults, coercion, transforms).
Any variable that parses to `undefined` is omitted from the request body
entirely, rather than being sent as `undefined` or `null`. `baseClient`'s
configured `baseURL` and headers (e.g. auth) are used as-is; every request
is a `POST` with a `{ query, variables }` JSON body. The client does not
inspect the response — GraphQL errors returned in a 200 response body are
not thrown and must be checked by the caller (see [createResponseSchema](#createResponseSchema)).
The returned promise rejects (without making a request) if a variable's
value fails its Zod schema, e.g. a required variable that was omitted.

**Kind**: global function  
**Returns**: <code>ZodqlClient.&lt;AxiosResponse, AxiosRequestConfig&gt;</code> - A ZodqlClient instance that executes GraphQL operations  

| Param | Type | Description |
| --- | --- | --- |
| baseClient | <code>AxiosInstance</code> | A configured Axios instance to use for GraphQL requests |

**Example**  
```typescript
import axios from 'axios';
import { buildAxiosZodqlClient } from 'zodql';

const axiosInstance = axios.create({
  baseURL: 'https://api.example.com/graphql',
  headers: {
    'Authorization': 'Bearer token123',
  },
});

const client = buildAxiosZodqlClient(axiosInstance);

const response = await client.request(query, { userId: '123' });
```
<a name="createResponseSchema"></a>

## createResponseSchema(dataSchema, options) ⇒
Creates a Zod schema for a GraphQL response, i.e. `{ data, extensions?, errors? }`
as returned by a spec-compliant GraphQL server.

`data` is required on the resulting schema and validated with `dataSchema`.
`extensions` and `errors` are always optional — they may be absent or
`undefined` regardless of whether `extensionSchema`/`errorsSchema` were
provided — but are validated against those schemas when present. When
`extensionSchema`/`errorsSchema` aren't provided, any loose object /
any array is accepted, respectively, i.e. present but unvalidated.

**Kind**: global function  
**Returns**: A Zod object schema representing the GraphQL response structure.  

| Param | Description |
| --- | --- |
| dataSchema | A Zod schema for the `data` field. |
| options | Configuration options. |
| options.extensionSchema | (Optional) A Zod schema for the `extensions` field. Defaults to a loose object schema. |
| options.errorsSchema | (Optional) A Zod schema for the `errors` field. Defaults to an array of any type. |

**Example**  
```ts
const userSchema = z.object({
  id: z.string(),
  name: z.string(),
});
const responseSchema = createResponseSchema(userSchema, {
 extensionSchema: z.object({ traceId: z.string() }),
});

const parsedResponse = responseSchema.parse({
  data: { id: "1", name: "Alice" },
  extensions: { traceId: "abc-123" },
});
```
<a name="hasTypename"></a>

## hasTypename(obj, typename) ⇒
Type guard that checks whether an object's `__typename` field matches a
given GraphQL type name, narrowing the input union to the matching member(s).

Safely handles `null` and `undefined` inputs by returning `false`, which is
useful for nullable GraphQL union/interface fields.

**Kind**: global function  
**Returns**: `true` if `obj` has a `__typename` field equal to `typename`,
  narrowing the type to the matching union member.  
**Typeparam**: T - The string literal type of the expected `__typename` value.  
**Typeparam**: Obj - The object (or union of objects) to narrow.  

| Param | Description |
| --- | --- |
| obj | The object to check. May be `null` or `undefined`. |
| typename | The expected `__typename` string to match against. |

**Example**  
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
<a name="ZodqlOptions"></a>

## ZodqlOptions : <code>Object</code>
Optional settings for a `zodql` operation.

**Kind**: global typedef  
**Properties**

| Name | Type | Description |
| --- | --- | --- |
| [operationName] | <code>string</code> | Optional name for the GraphQL operation.   When provided, the compiled operation is emitted with this name   (e.g. `query myRootQuery { ... }`), which is useful for server-side logging,   tracing, and debugging. When omitted, an anonymous operation is emitted   (e.g. `query { ... }`). The value must be a valid GraphQL `Name` (a letter   or underscore followed by letters, digits, or underscores); otherwise   `compile()` throws. See https://spec.graphql.org/October2021/#sec-Names |

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
const response = await client.request(mutation, {
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

Validate GraphQL responses with custom error handling:

```typescript
import { createResponseSchema } from "zodql";
import { z } from "zod";

const userSchema = z.object({
  id: z.string(),
  name: z.string(),
});

const responseSchema = createResponseSchema(userSchema, {
  extensionSchema: z.object({ traceId: z.string() }),
  errorsSchema: z
    .object({
      message: z.string(),
      locations: z.array(z.object({ line: z.number(), column: z.number() })),
    })
    .array(),
});

// Parse and validate the response
const validatedResponse = responseSchema.parse(apiResponse);
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
