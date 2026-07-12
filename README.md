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
<dt><a href="#unwrapSchema">unwrapSchema()</a></dt>
<dd><p>Strip the wrapper schemas (optional / nullable / default / array) that don&#39;t
affect the emitted GraphQL selection, returning the inner schema.</p>
</dd>
<dt><a href="#getFieldInfo">getFieldInfo()</a></dt>
<dd><p>Read the field metadata off a schema, or fall back to a plain object&#39;s shape.
Returns <code>null</code> for leaf/scalar schemas that emit a single field name.</p>
</dd>
<dt><a href="#buildFieldLines">buildFieldLines()</a></dt>
<dd><p>Emit the selection lines for a single field (recursively).</p>
</dd>
<dt><a href="#collectFragments">collectFragments()</a></dt>
<dd><p>Collect the named fragments reachable from a document, in the order they
should be emitted (depth-first, own fragments before nested selections).</p>
</dd>
<dt><a href="#zodql">zodql(operation, documentSchema, [options])</a> ⇒ <code>ZodqlBuilder</code></dt>
<dd><p>Create a ZodqlBuilder for building GraphQL queries or mutations from Zod schemas.</p>
<p>This function initializes a builder that can be used to define variables and compile
GraphQL query strings with associated Zod schemas for type-safe GraphQL operations.</p>
</dd>
<dt><a href="#zodqlFragment">zodqlFragment(fragmentParam)</a> ⇒ <code>QueryFragment</code></dt>
<dd><p>Define a GraphQL fragment from a Zod schema.</p>
<p>Fragments allow you to reuse common field selections across multiple queries.
This function validates and returns a fragment definition that can be used with
zodqlField&#39;s withFragment() or withRequiredFragment() methods.</p>
</dd>
<dt><a href="#zodqlField">zodqlField()</a> ⇒ <code>ZodqlFieldBuilder</code></dt>
<dd><p>Create a ZodqlFieldBuilder for building GraphQL fields with arguments, fragments, and aliases.</p>
<p>This builder provides a fluent interface to configure GraphQL fields with:</p>
<ul>
<li>Arguments for parameterized queries</li>
<li>Fragments for type-specific field selection</li>
<li>Aliases to query the same field multiple times with different arguments</li>
</ul>
</dd>
<dt><a href="#buildAxiosZodqlClient">buildAxiosZodqlClient(baseClient)</a> ⇒ <code>ZodqlClient.&lt;AxiosResponse, AxiosRequestConfig&gt;</code></dt>
<dd><p>Build a Zod GraphQL client using Axios as the HTTP transport.</p>
<p>This function creates a GraphQL client that validates variables using Zod schemas
before sending requests. The client handles GraphQL query execution and returns
Axios responses for further processing.</p>
</dd>
<dt><a href="#createResponseSchema">createResponseSchema(dataSchema, extensionSchema, errorsSchema)</a> ⇒</dt>
<dd><p>Creates a Zod schema for a GraphQL response.</p>
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

**Kind**: global function  
<a name="getFieldInfo"></a>

## getFieldInfo()
Read the field metadata off a schema, or fall back to a plain object's shape.
Returns `null` for leaf/scalar schemas that emit a single field name.

**Kind**: global function  
<a name="buildFieldLines"></a>

## buildFieldLines()
Emit the selection lines for a single field (recursively).

**Kind**: global function  
<a name="collectFragments"></a>

## collectFragments()
Collect the named fragments reachable from a document, in the order they
should be emitted (depth-first, own fragments before nested selections).

**Kind**: global function  
<a name="zodql"></a>

## zodql(operation, documentSchema, [options]) ⇒ <code>ZodqlBuilder</code>
Create a ZodqlBuilder for building GraphQL queries or mutations from Zod schemas.

This function initializes a builder that can be used to define variables and compile
GraphQL query strings with associated Zod schemas for type-safe GraphQL operations.

**Kind**: global function  
**Returns**: <code>ZodqlBuilder</code> - A ZodqlBuilder instance for chaining operations  

| Param | Type | Description |
| --- | --- | --- |
| operation | <code>&quot;query&quot;</code> \| <code>&quot;mutation&quot;</code> | The GraphQL operation type, either "query" or "mutation" |
| documentSchema | <code>z.ZodObject</code> | Zod schema representing the GraphQL document structure |
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
zodqlField's withFragment() or withRequiredFragment() methods.

**Kind**: global function  
**Returns**: <code>QueryFragment</code> - The validated fragment definition for use in queries  
**Throws**:

- <code>Error</code> If the fragment shape is an empty object


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
- Fragments for type-specific field selection
- Aliases to query the same field multiple times with different arguments

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

This function creates a GraphQL client that validates variables using Zod schemas
before sending requests. The client handles GraphQL query execution and returns
Axios responses for further processing.

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

## createResponseSchema(dataSchema, extensionSchema, errorsSchema) ⇒
Creates a Zod schema for a GraphQL response.

**Kind**: global function  
**Returns**: A Zod object schema representing the GraphQL response structure.  

| Param | Description |
| --- | --- |
| dataSchema | A Zod schema for the `data` field. |
| extensionSchema | (Optional) A Zod schema for the `extensions` field. Defaults to a loose object schema. |
| errorsSchema | (Optional) A Zod schema for the `errors` field. Defaults to an array of any type. |

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
