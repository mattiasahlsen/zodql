import { vi, afterEach, beforeAll, afterAll } from "vitest";
import nock from "nock";

beforeAll(() => {
  nock.disableNetConnect();
});

afterAll(() => {
  nock.enableNetConnect();
});

afterEach(() => {
  nock.cleanAll();
  vi.restoreAllMocks();
  vi.clearAllMocks();
});
