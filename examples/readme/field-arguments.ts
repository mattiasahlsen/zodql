import { zodql, zodqlField } from "@mattiasahlsen/zodql";
import { z } from "zod";

export const usersQuery = zodql(
  "query",
  z.object({
    users: z.array(
      zodqlField()
        .withArguments({ status: '"active"', first: "10" })
        .toSchema(z.object({ id: z.string(), name: z.string() }))
    ),
  })
).compile();
