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

{{API_DOCS}}

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
