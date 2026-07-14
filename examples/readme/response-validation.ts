import { zodql, buildZodqlClient } from "@mattiasahlsen/zodql";
import { z } from "zod";

const viewerQuery = zodql("query", z.object({ viewer: z.object({ id: z.string(), name: z.string() }) })).compile();

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

export async function fetchViewer() {
  const { parseResponse } = await client.request(viewerQuery, {});

  // GraphQL errors arrive in a 200 response body and are never thrown — check them yourself
  const { data, errors } = await parseResponse();

  if (errors) {
    throw new Error(`GraphQL errors: ${JSON.stringify(errors)}`);
  }

  return data.viewer; // Validated: { id: string; name: string }
}
