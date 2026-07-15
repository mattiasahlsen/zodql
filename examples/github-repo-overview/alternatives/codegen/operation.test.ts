import { RepositoryOverviewQuery } from "./operation.js";
import { normalize, zodqlQuery } from "../parity.js";

describe("graphql-codegen operation", () => {
  it("emits the same GraphQL as the zodql version", () => {
    expect(normalize(RepositoryOverviewQuery)).toBe(normalize(zodqlQuery));
  });
});
