import { vi, beforeEach, afterEach } from "vitest";
import http from "node:http";
import https from "node:https";

// Fail fast instead of hitting the network if a test forgets to mock its HTTP client.
// Patches the shared `http`/`https` module objects directly (rather than `vi.mock`) so this
// also catches calls made by third-party libraries like axios, which aren't routed through
// Vitest's module graph.
function blockExternalHttpCalls(): never {
  throw new Error("External HTTP calls are disabled in tests — mock the HTTP client instead.");
}

beforeEach(() => {
  vi.spyOn(http, "request").mockImplementation(blockExternalHttpCalls as unknown as typeof http.request);
  vi.spyOn(http, "get").mockImplementation(blockExternalHttpCalls as unknown as typeof http.get);
  vi.spyOn(https, "request").mockImplementation(blockExternalHttpCalls as unknown as typeof https.request);
  vi.spyOn(https, "get").mockImplementation(blockExternalHttpCalls as unknown as typeof https.get);
  vi.stubGlobal("fetch", vi.fn(blockExternalHttpCalls));
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.clearAllMocks();
});
