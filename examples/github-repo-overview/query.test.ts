import { repositoryOverviewQuery } from "./query.js";

describe("repositoryOverviewQuery", () => {
  it("compiles to the expected GraphQL", async () => {
    await expect(repositoryOverviewQuery.queryString).toMatchFileSnapshot("./query.snapshot.graphql");
  });
});
