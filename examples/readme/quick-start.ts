import { zodql, zodqlField, buildZodqlClient } from "@mattiasahlsen/zodql";
import { z } from "zod";

// Describe the query with a Zod schema
const userSchema = z.object({
  user: zodqlField()
    .withArguments({ id: "$userId" })
    .toSchema(
      z.object({
        id: z.string(),
        name: z.string(),
        email: z.string(),
      })
    ),
});

// Compile it to a GraphQL query
const userQuery = zodql("query", userSchema)
  .defineVariables({ userId: { typeName: "ID!", schema: z.string() } })
  .compile();
export default userQuery;

// Create a client from any HTTP transport whose `post` resolves to `{ response, json }`
const client = buildZodqlClient({
  post: async (_url, data) => {
    const response = await fetch("https://api.example.com/graphql", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: "Bearer token" },
      body: JSON.stringify(data),
    });
    return { response, json: () => response.json() };
  },
});

// Execute the query; the response is validated against the schema
export async function fetchUser() {
  const { parseResponse } = await client.request(userQuery, { userId: "123" });
  const { data } = await parseResponse();
  return data.user; // Typed as { id: string; name: string; email: string }
}
