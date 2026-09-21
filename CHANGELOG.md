# @mattiasahlsen/zodql

## 0.4.0

### Minor Changes

- [#30](https://github.com/mattiasahlsen/zodql/pull/30) [`fd35a3b`](https://github.com/mattiasahlsen/zodql/commit/fd35a3b85fd64368d58876bac83568421186bd75) Thanks [@mattiasahlsen](https://github.com/mattiasahlsen)! - Support `.transform()` and `z.preprocess()` on field schemas: the query is now compiled from the underlying object's fields instead of the field being misdetected as a scalar. `.refine()`/`.superRefine()` already worked when applied before `toSchema()`.

## 0.3.0

### Minor Changes

- [#24](https://github.com/mattiasahlsen/zodql/pull/24) [`3f1f0af`](https://github.com/mattiasahlsen/zodql/commit/3f1f0af215dc4ca1601e32a25b211cb9a3ec9e4a) Thanks [@mattiasahlsen](https://github.com/mattiasahlsen)! - Replace the auto-generated TypeDoc dump in the README with a compact, verified API Reference table. Each export links to the guide sections that use it (most relevant first). A build/verify check keeps the table in sync with the package's public exports.

  Stop exporting the `ZodqlClientBuilder` type. It was only used internally to type-check `buildZodqlClient`'s signature and is no longer part of the public API.

- [#26](https://github.com/mattiasahlsen/zodql/pull/26) [`4ddea19`](https://github.com/mattiasahlsen/zodql/commit/4ddea19d9a24a82781836236b1c9f5245faf64a6) Thanks [@mattiasahlsen](https://github.com/mattiasahlsen)! - Move `zod` from a direct dependency to a peer dependency (`^4.0.0`).

  zodql accepts and returns zod schemas across its public API, so it must use the
  same zod instance as the consuming project. As a direct dependency, a package
  manager could resolve a second copy of zod alongside the one in your project,
  producing confusing "two different types with this name exist" errors at compile
  time and cross-instance mismatches at runtime.

  Most consumers need no action: zod is almost certainly already a direct
  dependency of your project, and modern package managers install peer
  dependencies automatically. If you were relying on zod being installed
  transitively via zodql, add it explicitly:

  ```sh
  npm install zod
  ```

  The supported range is `zod@^4.0.0`, verified against 4.0.0.

### Patch Changes

- [#20](https://github.com/mattiasahlsen/zodql/pull/20) [`e31d528`](https://github.com/mattiasahlsen/zodql/commit/e31d5280dbf9792c44c5b5b53355fafc4f94fe08) Thanks [@mattiasahlsen](https://github.com/mattiasahlsen)! - Fix JSDoc code examples to import from "@mattiasahlsen/zodql" instead of "zodql".

## 0.2.0

### Minor Changes

- [#17](https://github.com/mattiasahlsen/zodql/pull/17) [`3930a85`](https://github.com/mattiasahlsen/zodql/commit/3930a856cec3bcd99c9b3a7fd7742e04e7b1bab7) Thanks [@mattiasahlsen](https://github.com/mattiasahlsen)! - Support asynchronous response parsing in the HTTP client transport. A `ZodqlHttpClient`'s `json()` may now return `unknown | Promise<unknown>`, and `ZodqlClient.request`'s `parseResponse()` now returns a `Promise`. This lets a fetch-based transport defer parsing with `json: () => response.json()` instead of awaiting the body up front. Callers must now `await parseResponse()`.

## 0.1.0

### Minor Changes

- [#12](https://github.com/mattiasahlsen/zodql/pull/12) [`87484a3`](https://github.com/mattiasahlsen/zodql/commit/87484a3a813c71816879ad0ad85e3207facfd026) Thanks [@mattiasahlsen](https://github.com/mattiasahlsen)! - Initial public release.
