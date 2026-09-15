// Seeded once by @mattiasahlsen/zodql codegen, then yours to edit.
// Regenerating never overwrites this file.
//
// Each entry is the Zod schema a GraphQL scalar parses to. Refine them freely —
// this is where "validation beyond the GraphQL schema" lives.
import { z } from "zod";
import type { ScalarName } from "./scalars.generated.js";

export const scalars = {
  Boolean: z.boolean(),
  // An ISO-8601 encoded UTC date string.
  DateTime: z.string(),
  Float: z.number(),
  ID: z.string(),
  Int: z.number().int(),
  String: z.string(),
} as const satisfies Record<ScalarName, z.ZodType>;
