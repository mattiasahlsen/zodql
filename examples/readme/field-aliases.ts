import { zodql, zodqlField } from "@mattiasahlsen/zodql";
import { z } from "zod";

const userFields = z.object({ id: z.string(), name: z.string() });

export const usersQuery = zodql(
  "query",
  z.object({
    activeUsers: z.array(zodqlField().asAliasFor("users").withArguments({ status: '"active"' }).toSchema(userFields)),
    inactiveUsers: z.array(
      zodqlField().asAliasFor("users").withArguments({ status: '"inactive"' }).toSchema(userFields)
    ),
  })
).compile();
