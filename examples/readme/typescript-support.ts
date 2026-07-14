import { zodql, zodqlField } from "@mattiasahlsen/zodql";
import { z } from "zod";

const userQuery = zodql(
  "query",
  z.object({
    user: zodqlField()
      .withArguments({ id: "$userId" })
      .toSchema(z.object({ id: z.string(), name: z.string() })),
  })
)
  .defineVariables({ userId: { typeName: "ID!", schema: z.string() } })
  .compile();

// The compiled query carries its GraphQL source as a plain string...
export const queryString: string = userQuery.queryString;

// ...and the response type is inferred straight from the query's schema
export type UserResponse = z.infer<typeof userQuery.schema>;
// => { user: { id: string; name: string } }
