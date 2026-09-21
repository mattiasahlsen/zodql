import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { buildSchema, parse, validate } from "graphql";
import { expectTypeof } from "../../src/testing/assertType.js";
import { repositoryOverviewQuery, type RepositoryOverview } from "./query-generated.js";

const schema = buildSchema(
  readFileSync(fileURLToPath(new URL("./alternatives/schema.graphql", import.meta.url)), "utf8")
);

describe("repositoryOverviewQuery built from generated builders", () => {
  it("compiles to the expected GraphQL", async () => {
    await expect(repositoryOverviewQuery.queryString).toMatchFileSnapshot("./query-generated.snapshot.graphql");
  });

  /**
   * The check a snapshot can't make. `.extend()` is the alias escape hatch and
   * accepts any key, so it's the one place a generated builder can still emit a
   * field the schema doesn't have — validating the compiled document against
   * the SDL closes that gap, and catches missing required arguments too.
   */
  it("is a valid document against the GraphQL schema", () => {
    const errors = validate(schema, parse(repositoryOverviewQuery.queryString));
    expect(errors.map((error) => error.message)).toEqual([]);
  });

  it("infers the response type from the schema, with nullability applied", () => {
    expectTypeof(null as unknown as RepositoryOverview).toBe<{
      repository: {
        name: string;
        nameWithOwner: string;
        description: string | null;
        url: string;
        isPrivate: boolean;
        stargazerCount: number;
        forkCount: number;
        primaryLanguage: { name: string } | null;
        licenseInfo: { name: string; spdxId: string | null } | null;
        latestRelease: {
          name: string | null;
          tagName: string;
          url: string;
          publishedAt: string | null;
        } | null;
        openIssues: { totalCount: number };
        closedIssues: { totalCount: number };
      } | null;
    }>();
  });

  it("validates a response against the schema-derived types", () => {
    const response = {
      repository: {
        name: "zodql",
        nameWithOwner: "mattiasahlsen/zodql",
        description: null,
        url: "https://github.com/mattiasahlsen/zodql",
        isPrivate: false,
        stargazerCount: 1,
        forkCount: 0,
        primaryLanguage: { name: "TypeScript" },
        licenseInfo: { name: "MIT License", spdxId: "MIT" },
        latestRelease: null,
        openIssues: { totalCount: 2 },
        closedIssues: { totalCount: 3 },
      },
    };

    expect(repositoryOverviewQuery.schema.parse(response)).toEqual(response);

    // `stargazerCount` is Int! in the schema, so a string is rejected.
    expect(() =>
      repositoryOverviewQuery.schema.parse({
        ...response,
        repository: { ...response.repository, stargazerCount: "1" },
      })
    ).toThrow();

    // `name` is String! — null is rejected even though `description` allows it.
    expect(() =>
      repositoryOverviewQuery.schema.parse({
        ...response,
        repository: { ...response.repository, name: null },
      })
    ).toThrow();
  });
});
