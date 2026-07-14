import { zodql, buildZodqlClient, type ZodqlHttpClient } from "@mattiasahlsen/zodql";
import axios, { type AxiosRequestConfig, type AxiosResponse } from "axios";
import { z } from "zod";

const axiosInstance = axios.create({
  baseURL: "https://api.example.com/graphql",
  headers: { Authorization: "Bearer token" },
});

// Axios parses the response body itself, so `json()` just returns `response.data`
const httpClient: ZodqlHttpClient<AxiosResponse, AxiosRequestConfig> = {
  post: async (url, data, config) => {
    const response = await axiosInstance.post(url, data, config);
    return { response, json: () => response.data };
  },
};

export const client = buildZodqlClient(httpClient);

const viewerQuery = zodql("query", z.object({ viewer: z.object({ id: z.string(), name: z.string() }) })).compile();

export async function fetchViewer() {
  // The third argument is passed through to the transport as its request config
  const { parseResponse } = await client.request(viewerQuery, {}, { timeout: 5000 });
  const { data } = await parseResponse();
  return data.viewer;
}
