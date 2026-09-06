---
"@mattiasahlsen/zodql": minor
---

Support `.transform()` and `z.preprocess()` on field schemas: the query is now compiled from the underlying object's fields instead of the field being misdetected as a scalar. `.refine()`/`.superRefine()` already worked when applied before `toSchema()`.
