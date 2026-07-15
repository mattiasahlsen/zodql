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

{{EXAMPLE:quick-start}}

The compiled GraphQL query:

{{QUERY:quick-start}}

## Client

`buildZodqlClient()` has no hard dependency on an HTTP library: it wraps any transport whose `post` method resolves to `{ response, json }`, where `json()` returns the already-parsed response body (directly or as a promise).

### Fetch-based client

{{EXAMPLE:client-fetch}}

### Axios-based client

Type the transport as `ZodqlHttpClient<Response, RequestConfig>` to keep the raw response and per-request config fully typed:

{{EXAMPLE:client-axios}}

## Fragments

Fragments let you reuse common field selections. Define one with `zodqlFragment()` (or pass an object literal directly) and attach it to a field with `withFragment()`, `withRequiredFragment()`, or `withUnionFragments()`.

### withFragment

`withFragment()` attaches an optional fragment: the fragment may target a type the actual response doesn't match, so its fields are made optional on the parsed result and are simply absent when the type doesn't match:

{{EXAMPLE:with-fragment}}

Compiled query:

{{QUERY:with-fragment}}

### withRequiredFragment

`withRequiredFragment()` is for fragments the field is guaranteed to resolve to: the fragment's fields are merged into the parsed schema as-is and are always expected in the response:

{{EXAMPLE:with-required-fragment}}

Compiled query:

{{QUERY:with-required-fragment}}

### withUnionFragments

`withUnionFragments()` models a union or interface field as a discriminated union. A `__typename` selection is added to the query, and at parse time its value decides which fragment schema applies — fields belonging to non-matching fragments are stripped. With `requireOne: true`, parsing fails when `__typename` matches none of the fragments; with `requireOne: false`, unknown typenames are accepted with only the base fields:

{{EXAMPLE:with-union-fragments}}

Compiled query:

{{QUERY:with-union-fragments}}

### Inline Fragment

A fragment marked `inline: true` is spread directly into the parent selection as `... on Type { ... }`, with no standalone fragment definition:

{{EXAMPLE:inline-fragment}}

Compiled query:

{{QUERY:inline-fragment}}

### Non-Inline Fragment

A named fragment (`inline: false`) is emitted once as a standalone `fragment ... on ...` definition and referenced via `...FragmentName` wherever it's attached:

{{EXAMPLE:non-inline-fragment}}

Compiled query:

{{QUERY:non-inline-fragment}}

## Field Arguments

`withArguments()` adds GraphQL arguments to a field. Argument values are raw GraphQL source: reference a query variable with `"$variableName"`, or pass literals like `"10"` or `'"active"'`:

{{EXAMPLE:field-arguments}}

Compiled query:

{{QUERY:field-arguments}}

## Query Variables

Declare variables with `defineVariables()`: each variable gets a GraphQL type name and a Zod schema, which can be arbitrarily complex (e.g. a nested input object). Values passed to `request()` are validated and parsed by their schemas before the request is sent — defaults, coercion, and transforms all apply, and a variable that parses to `undefined` is omitted from the request body entirely:

{{EXAMPLE:query-variables}}

Compiled query:

{{QUERY:query-variables}}

## Response Validation

`parseResponse()` validates the response's `data` field against the query's schema and resolves to `{ data, extensions?, errors? }`. `extensions` and `errors` are passed through unvalidated, so GraphQL errors returned in a 200 response are never thrown automatically — check them yourself:

{{EXAMPLE:response-validation}}

## Field Aliases

`asAliasFor()` queries the same field multiple times under different aliases, e.g. with different arguments:

{{EXAMPLE:field-aliases}}

Compiled query:

{{QUERY:field-aliases}}

## TypeScript Support

This library is written in TypeScript and provides full type inference for all operations — the response type is inferred from the query's Zod schema, and `client.request()` type-checks the variable values you pass:

{{EXAMPLE:typescript-support}}

## API Reference

Every public export of the package, with links to the guide sections that use it (most relevant first). Full signatures and JSDoc are available in your editor via the bundled TypeScript declarations.

### Functions

| Export | Summary | Guide |
| --- | --- | --- |
| `zodql()` | Compile a Zod schema into a GraphQL query/mutation builder. | [Quick Start](#quick-start), [Query Variables](#query-variables), [Response Validation](#response-validation), [TypeScript Support](#typescript-support) |
| `zodqlField()` | Configure a field's arguments, fragments, and aliases. | [Field Arguments](#field-arguments), [Fragments](#fragments), [Field Aliases](#field-aliases), [Quick Start](#quick-start) |
| `zodqlFragment()` | Define a reusable named or inline fragment. | [Fragments](#fragments), [Non-Inline Fragment](#non-inline-fragment), [withUnionFragments](#withunionfragments) |
| `buildZodqlClient()` | Wrap an HTTP transport in a typed GraphQL client. | [Client](#client), [Fetch-based client](#fetch-based-client), [Axios-based client](#axios-based-client), [Response Validation](#response-validation) |
| `hasTypename()` | Narrow a union/interface result by its `__typename`. | [withUnionFragments](#withunionfragments), [Supported GraphQL Features](#supported-graphql-features) |

### Types

| Export | Summary | Guide |
| --- | --- | --- |
| `ZodqlOptions` | Options for `zodql()`, e.g. `operationName`. | [Supported GraphQL Features](#supported-graphql-features) |
| `ZodqlQuery` | Output of `compile()`: query string, variables, and response schema. | [Response Validation](#response-validation), [TypeScript Support](#typescript-support), [Quick Start](#quick-start) |
| `ZodqlQueryVariable` | A declared operation variable — GraphQL type name plus Zod schema. | [Query Variables](#query-variables) |
| `ZodqlQueryFragment` | A fragment definition created by `zodqlFragment()`. | [Fragments](#fragments) |
| `ZodqlClient` | Client returned by `buildZodqlClient()`; runs `request()`. | [Client](#client), [Axios-based client](#axios-based-client) |
| `ZodqlHttpClient` | The HTTP transport interface a client wraps. | [Client](#client), [Axios-based client](#axios-based-client) |
| `ZodqlResponseData` | Parsed response shape: `{ data, extensions?, errors? }`. | [Response Validation](#response-validation) |

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

MIT

## Author

Mattias Ahlsén - mattias.ahlsen@gmail.com
