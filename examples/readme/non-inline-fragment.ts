import { zodql, zodqlField, zodqlFragment } from "@mattiasahlsen/zodql";
import { z } from "zod";

// The fragment is emitted once and referenced from both fields below
const userFragment = zodqlFragment({
  name: "UserFields",
  on: "User",
  schema: z.object({ id: z.string(), name: z.string() }),
  inline: false,
});

export const postQuery = zodql(
  "query",
  z.object({
    post: z.object({
      title: z.string(),
      author: zodqlField().withRequiredFragment(userFragment).toSchema(z.object({})),
      reviewer: zodqlField().withRequiredFragment(userFragment).toSchema(z.object({})),
    }),
  })
).compile();
