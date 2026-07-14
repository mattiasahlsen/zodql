import { zodql, zodqlField, zodqlFragment } from "@mattiasahlsen/zodql";
import { z } from "zod";

const auditFragment = zodqlFragment({
  name: "AuditFields",
  on: "Node",
  schema: z.object({
    createdAt: z.string(),
    updatedAt: z.string(),
  }),
  inline: false,
});

const nodeQuery = zodql(
  "query",
  z.object({
    node: zodqlField()
      .withRequiredFragment(auditFragment)
      .toSchema(z.object({ id: z.string() })),
  })
).compile();
export default nodeQuery;

// The fragment's fields are required on the parsed result
export type Node = z.infer<typeof nodeQuery.schema>["node"];
