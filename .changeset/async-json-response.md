---
"@mattiasahlsen/zodql": minor
---

Support asynchronous response parsing in the HTTP client transport. A `ZodqlHttpClient`'s `json()` may now return `unknown | Promise<unknown>`, and `ZodqlClient.request`'s `parseResponse()` now returns a `Promise`. This lets a fetch-based transport defer parsing with `json: () => response.json()` instead of awaiting the body up front. Callers must now `await parseResponse()`.
