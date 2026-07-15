---
"@mattiasahlsen/zodql": minor
---

Replace the auto-generated TypeDoc dump in the README with a compact, verified API Reference table. Each export links to the guide sections that use it (most relevant first) and to its source (pinned to the release tag), and every README example now links to the TypeScript file it is generated from. A build/verify check keeps the table in sync with the package's public exports.

Stop exporting the `ZodqlClientBuilder` type. It was only used internally to type-check `buildZodqlClient`'s signature and is no longer part of the public API.
