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

## Functions

<dl>
<dt><a href="#unwrapSchema">unwrapSchema()</a></dt>
<dd><p>Strip the wrapper schemas (optional / nullable / default / array) that don&#39;t
affect the emitted GraphQL selection, returning the inner schema.</p>
<p>Wrapper layers can be nested in any combination (e.g. an optional array of
nullable objects), so this walks inward until it hits a schema that isn&#39;t
one of the recognized wrapper types.</p>
</dd>
<dt><a href="#getFieldInfo">getFieldInfo()</a></dt>
<dd><p>Read the field metadata off a schema, or fall back to a plain object&#39;s shape.</p>
<p>Fields built with <code>zodqlField().toSchema(...)</code> carry their selection metadata
(core shape, arguments, alias, fragments) under symbol keys on the (unwrapped)
schema; this reads it back out. A plain <code>z.object(...)</code> schema with no such
metadata is still treated as a selection, using its own shape and no
arguments/alias/fragments. Anything else (string, number, enum, etc.) is a
GraphQL scalar/leaf field, for which this returns <code>null</code>.</p>
</dd>
<dt><a href="#buildFieldLines">buildFieldLines()</a></dt>
<dd><p>Emit the selection lines for a single field, recursing into its children.</p>
<p>Leaf/scalar fields (where <a href="#getFieldInfo">getFieldInfo</a> returns <code>null</code>) are emitted as
a bare field name. Fields with metadata are emitted as <code>name { ... }</code>,
optionally rewritten to <code>alias: name { ... }</code> when the field was built with
<code>asAliasFor()</code>, and with <code>(arg: value, ...)</code> appended when arguments were
attached via <code>withArguments()</code>. Inside the block:</p>
<ul>
<li>Child fields from the field&#39;s own core shape are emitted first.</li>
<li>If the field has union fragments, a <code>__typename</code> selection is added so the
response can be discriminated at parse time.</li>
<li>Inline regular fragments (<code>inline: true</code>) have their fields spread directly
into the block; named regular fragments are referenced via <code>...FragmentName</code>.</li>
<li>Union fragments are always referenced via <code>...FragmentName</code>; they must be
given a <code>name</code> (rather than <code>inline: true</code>) or the reference won&#39;t resolve
to an emitted fragment definition.</li>
</ul>
</dd>
<dt><a href="#collectFragments">collectFragments()</a></dt>
<dd><p>Collect the named fragments reachable from a document, in the order they
should be emitted (depth-first, own fragments before nested selections).</p>
<p>Only fragments with a <code>name</code> are collected here — inline fragments (<code>inline: true</code>) have no standalone definition to emit, since their fields are spread
directly into the parent selection by <a href="#buildFieldLines">buildFieldLines</a>. Each named
fragment is emitted at most once, keyed by name, even if it&#39;s attached to
multiple fields (regular fragment) or reused across separate <code>withUnionFragments</code>
calls. A fragment&#39;s own selection is walked recursively so fragments nested
inside another fragment&#39;s schema (including inline ones) are also collected.</p>
</dd>
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
<dt><a href="#buildZodqlClient">buildZodqlClient(baseClient)</a> ⇒ <code>ZodqlClient.&lt;Response, RequestConfig&gt;</code></dt>
<dd><p>Build a Zod GraphQL client using the given HTTP client as the transport.</p>
<p>This function creates a GraphQL client that validates and parses variables
using their Zod schemas before sending requests, so a variable&#39;s runtime
value can differ from its wire value (e.g. defaults, coercion, transforms).
Any variable that parses to <code>undefined</code> is omitted from the request body
entirely, rather than being sent as <code>undefined</code> or <code>null</code>. <code>baseClient</code>&#39;s
configured <code>baseURL</code> and headers (e.g. auth) are used as-is; every request
is a <code>POST</code> with a <code>{ query, variables }</code> JSON body. <code>parseResponse()</code> parses the
response body as <code>{ data, extensions?, errors? }</code>, validating <code>data</code> against the
query&#39;s schema; <code>extensions</code> and <code>errors</code> are returned as-is, unvalidated, if present.
GraphQL errors returned in a 200 response body are therefore not thrown — the caller
must check <code>parseResponse().errors</code> themselves. The returned promise rejects (without
making a request) if a variable&#39;s value fails its Zod schema, e.g. a required variable
that was omitted.</p>
<p><code>baseClient</code> only needs to satisfy <a href="HttpClient">HttpClient</a>: a <code>post</code> method that resolves to
<code>{ response, json }</code>, where <code>json()</code> returns the already-parsed response body.</p>
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

<a name="unwrapSchema"></a>

## unwrapSchema()
Strip the wrapper schemas (optional / nullable / default / array) that don't
affect the emitted GraphQL selection, returning the inner schema.

Wrapper layers can be nested in any combination (e.g. an optional array of
nullable objects), so this walks inward until it hits a schema that isn't
one of the recognized wrapper types.

**Kind**: global function  
<a name="getFieldInfo"></a>

## getFieldInfo()
Read the field metadata off a schema, or fall back to a plain object's shape.

Fields built with `zodqlField().toSchema(...)` carry their selection metadata
(core shape, arguments, alias, fragments) under symbol keys on the (unwrapped)
schema; this reads it back out. A plain `z.object(...)` schema with no such
metadata is still treated as a selection, using its own shape and no
arguments/alias/fragments. Anything else (string, number, enum, etc.) is a
GraphQL scalar/leaf field, for which this returns `null`.

**Kind**: global function  
<a name="buildFieldLines"></a>

## buildFieldLines()
Emit the selection lines for a single field, recursing into its children.

Leaf/scalar fields (where [getFieldInfo](#getFieldInfo) returns `null`) are emitted as
a bare field name. Fields with metadata are emitted as `name { ... }`,
optionally rewritten to `alias: name { ... }` when the field was built with
`asAliasFor()`, and with `(arg: value, ...)` appended when arguments were
attached via `withArguments()`. Inside the block:
- Child fields from the field's own core shape are emitted first.
- If the field has union fragments, a `__typename` selection is added so the
  response can be discriminated at parse time.
- Inline regular fragments (`inline: true`) have their fields spread directly
  into the block; named regular fragments are referenced via `...FragmentName`.
- Union fragments are always referenced via `...FragmentName`; they must be
  given a `name` (rather than `inline: true`) or the reference won't resolve
  to an emitted fragment definition.

**Kind**: global function  
<a name="collectFragments"></a>

## collectFragments()
Collect the named fragments reachable from a document, in the order they
should be emitted (depth-first, own fragments before nested selections).

Only fragments with a `name` are collected here — inline fragments (`inline:
true`) have no standalone definition to emit, since their fields are spread
directly into the parent selection by [buildFieldLines](#buildFieldLines). Each named
fragment is emitted at most once, keyed by name, even if it's attached to
multiple fields (regular fragment) or reused across separate `withUnionFragments`
calls. A fragment's own selection is walked recursively so fragments nested
inside another fragment's schema (including inline ones) are also collected.

**Kind**: global function  
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
<a name="buildZodqlClient"></a>

## buildZodqlClient(baseClient) ⇒ <code>ZodqlClient.&lt;Response, RequestConfig&gt;</code>
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

`baseClient` only needs to satisfy [HttpClient](HttpClient): a `post` method that resolves to
`{ response, json }`, where `json()` returns the already-parsed response body.

**Kind**: global function  
**Returns**: <code>ZodqlClient.&lt;Response, RequestConfig&gt;</code> - A ZodqlClient instance that executes GraphQL operations  

| Param | Type | Description |
| --- | --- | --- |
| baseClient | <code>HttpClient.&lt;Response, RequestConfig&gt;</code> | An HTTP client to use for GraphQL requests |

**Example**  
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
