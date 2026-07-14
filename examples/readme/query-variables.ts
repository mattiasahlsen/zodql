import { zodql, zodqlField, buildZodqlClient } from "@mattiasahlsen/zodql";
import { z } from "zod";

const createUserInputSchema = z.object({
  name: z.string(),
  email: z.email(),
  address: z.object({ city: z.string(), country: z.string() }),
  tags: z.array(z.string()),
});

export const createUserMutation = zodql(
  "mutation",
  z.object({
    createUser: zodqlField()
      .withArguments({ input: "$input" })
      .toSchema(z.object({ id: z.string(), name: z.string() })),
  })
)
  .defineVariables({ input: { typeName: "CreateUserInput!", schema: createUserInputSchema } })
  .compile();

const client = buildZodqlClient({
  post: async (_url, data) => {
    const response = await fetch("https://api.example.com/graphql", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    return { response, json: () => response.json() };
  },
});

export async function createUser() {
  // The variable values are type-checked and validated against their schemas
  const { parseResponse } = await client.request(createUserMutation, {
    input: {
      name: "John Doe",
      email: "john@example.com",
      address: { city: "Stockholm", country: "Sweden" },
      tags: ["developer", "typescript"],
    },
  });
  const { data } = await parseResponse();
  return data.createUser;
}
