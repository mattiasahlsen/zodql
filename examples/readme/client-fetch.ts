import { zodql, buildZodqlClient } from "@mattiasahlsen/zodql";
import { z } from "zod";

// Wrap `fetch` in the transport contract: `post` resolves to `{ response, json }`,
// where `json()` returns the parsed response body.
export const client = buildZodqlClient({
  post: async (_url, data) => {
    const response = await fetch("https://api.example.com/graphql", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: "Bearer token" },
      body: JSON.stringify(data),
    });
    return { response, json: () => response.json() };
  },
});

const viewerQuery = zodql("query", z.object({ viewer: z.object({ id: z.string(), name: z.string() }) })).compile();

export async function fetchViewer() {
  const { parseResponse } = await client.request(viewerQuery, {});
  const { data } = await parseResponse();
  return data.viewer;
}
