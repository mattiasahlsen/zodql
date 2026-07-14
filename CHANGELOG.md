# @mattiasahlsen/zodql

## 0.2.0

### Minor Changes

- [#17](https://github.com/mattiasahlsen/zodql/pull/17) [`3930a85`](https://github.com/mattiasahlsen/zodql/commit/3930a856cec3bcd99c9b3a7fd7742e04e7b1bab7) Thanks [@mattiasahlsen](https://github.com/mattiasahlsen)! - Support asynchronous response parsing in the HTTP client transport. A `ZodqlHttpClient`'s `json()` may now return `unknown | Promise<unknown>`, and `ZodqlClient.request`'s `parseResponse()` now returns a `Promise`. This lets a fetch-based transport defer parsing with `json: () => response.json()` instead of awaiting the body up front. Callers must now `await parseResponse()`.

## 0.1.0

### Minor Changes

- [#12](https://github.com/mattiasahlsen/zodql/pull/12) [`87484a3`](https://github.com/mattiasahlsen/zodql/commit/87484a3a813c71816879ad0ad85e3207facfd026) Thanks [@mattiasahlsen](https://github.com/mattiasahlsen)! - Initial public release.
