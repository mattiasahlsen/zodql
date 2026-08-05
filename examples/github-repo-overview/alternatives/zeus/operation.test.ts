import { repositoryOverviewQueryString } from "./operation.js";
import { normalize, zodqlQuery } from "../parity.js";

describe("GraphQL Zeus operation", () => {
  it("emits the same GraphQL as the zodql version", () => {
    expect(normalize(repositoryOverviewQueryString)).toBe(normalize(zodqlQuery));
  });
});
