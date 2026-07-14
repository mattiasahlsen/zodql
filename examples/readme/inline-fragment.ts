import { zodql, zodqlField } from "@mattiasahlsen/zodql";
import { z } from "zod";

export default zodql(
  "query",
  z.object({
    node: zodqlField()
      .withFragment({
        on: "User",
        inline: true,
        schema: z.object({ name: z.string(), email: z.string() }),
      })
      .toSchema(z.object({ id: z.string() })),
  })
).compile();
