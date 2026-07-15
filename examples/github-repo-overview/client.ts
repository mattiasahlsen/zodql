/** A zodql client backed by `fetch`, authenticated against GitHub's GraphQL API. */
import { buildZodqlClient } from "@mattiasahlsen/zodql";

const GITHUB_GRAPHQL_ENDPOINT = "https://api.github.com/graphql";

/** The shape of a GraphQL response body, before zodql validates `data`. */
export interface GraphQLBody {
  data?: unknown;
  errors?: Array<{ message: string }>;
}

export function createGitHubClient(token: string) {
  return buildZodqlClient<GraphQLBody>({
    post: async (_url, body) => {
      const res = await fetch(GITHUB_GRAPHQL_ENDPOINT, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `bearer ${token}`,
          // GitHub requires a User-Agent header on every request.
          "User-Agent": "zodql-example-github-repo-overview",
        },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        throw new Error(`GitHub API returned HTTP ${res.status} ${res.statusText}: ${await res.text()}`);
      }

      const json = (await res.json()) as GraphQLBody;
      return { response: json, json: () => json };
    },
  });
}
