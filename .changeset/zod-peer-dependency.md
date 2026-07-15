---
"@mattiasahlsen/zodql": minor
---

Move `zod` from a direct dependency to a peer dependency (`^4.0.0`).

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
