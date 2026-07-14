# zodql

A utility library for integrating Zod schemas with GraphQL in TypeScript projects.

## Features

- 🔒 **Type-safe GraphQL queries** - Build GraphQL queries with full TypeScript type inference
- ✅ **Runtime validation** - Validate GraphQL responses using Zod schemas
- 🧩 **Fragment support** - Reuse common field selections with GraphQL fragments
- 🎯 **Builder pattern** - Fluent API for constructing complex queries
- 🔌 **Bring your own HTTP client** - Works with `fetch` or any client whose response exposes a `.json()` method, with no hard dependency on a particular HTTP library

All examples in this README are complete, compiling TypeScript files from [`examples/readme/`](./examples/readme), and every GraphQL snippet is generated from the corresponding example's actual compiled query.

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

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

MIT

## Author

Mattias Ahlsén - mattias.ahlsen@gmail.com

## API Documentation

{{API_DOCS}}
