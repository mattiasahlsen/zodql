import { fileURLToPath } from "node:url";
import { buildSchema } from "graphql";
import { buildIr, describeType } from "./ir.js";
import { loadSchema } from "./load-schema.js";
import type { TypeIr } from "./types.js";

const fixtureSdl = fileURLToPath(
  new URL("../../../examples/github-repo-overview/alternatives/schema.graphql", import.meta.url)
);

function fieldsOf(types: readonly TypeIr[], name: string) {
  const type = types.find((candidate) => candidate.name === name);
  if (!type || type.kind === "enum") throw new Error(`No object/abstract type ${name}`);
  return Object.fromEntries(type.fields.map((field) => [field.name, field]));
}

describe("describeType", () => {
  // Wrappers are outermost-first; see the runtime fold in applyWrappers.
  it.each([
    { sdl: "String!", wrappers: [] },
    { sdl: "String", wrappers: ["nullable"] },
    { sdl: "[String!]!", wrappers: ["array"] },
    { sdl: "[String!]", wrappers: ["nullable", "array"] },
    { sdl: "[String]!", wrappers: ["array", "nullable"] },
    { sdl: "[String]", wrappers: ["nullable", "array", "nullable"] },
    { sdl: "[[String!]!]!", wrappers: ["array", "array"] },
  ])("maps $sdl to $wrappers", ({ sdl, wrappers }) => {
    const schema = buildSchema(`type Query { field: ${sdl} }`);
    const field = schema.getQueryType()?.getFields()["field"];
    const described = describeType(field!.type);
    expect(described.namedType).toBe("String");
    expect(described.wrappers).toEqual(wrappers);
  });
});

describe("buildIr", () => {
  it("extracts every scalar, including built-ins", async () => {
    const ir = buildIr(await loadSchema([fixtureSdl]));
    expect(ir.scalars.map((scalar) => scalar.name)).toEqual([
      "Boolean",
      "DateTime",
      "Float",
      "ID",
      "Int",
      "String",
      "URI",
    ]);
  });

  it("classifies fields and records their modifiers", async () => {
    const repository = fieldsOf(buildIr(await loadSchema([fixtureSdl])).types, "Repository");

    expect(repository["name"]).toMatchObject({ namedType: "String", kind: "scalar", wrappers: [] });
    expect(repository["description"]).toMatchObject({ namedType: "String", wrappers: ["nullable"] });
    expect(repository["url"]).toMatchObject({ namedType: "URI", kind: "scalar", wrappers: [] });
    expect(repository["primaryLanguage"]).toMatchObject({
      namedType: "Language",
      kind: "object",
      wrappers: ["nullable"],
    });
    expect(repository["issues"]).toMatchObject({ namedType: "IssueConnection", kind: "object", wrappers: [] });
  });

  it("records field arguments rendered back to SDL", async () => {
    const ir = buildIr(await loadSchema([fixtureSdl]));
    expect(fieldsOf(ir.types, "Repository")["issues"]?.args).toEqual([{ name: "states", type: "[IssueState!]" }]);
    expect(fieldsOf(ir.types, "Query")["repository"]?.args).toEqual([
      { name: "owner", type: "String!" },
      { name: "name", type: "String!" },
    ]);
  });

  it("keeps descriptions and skips introspection types", async () => {
    const ir = buildIr(await loadSchema([fixtureSdl]));
    const repository = ir.types.find((type) => type.name === "Repository");
    expect(repository?.description).toBe("A repository contains the content for a project.");
    expect(ir.types.some((type) => type.name.startsWith("__"))).toBe(false);
  });

  it("reads enum values", async () => {
    const ir = buildIr(await loadSchema([fixtureSdl]));
    const issueState = ir.types.find((type) => type.name === "IssueState");
    expect(issueState?.kind).toBe("enum");
    expect(issueState?.kind === "enum" && issueState.values.map((value) => value.name)).toEqual(["OPEN", "CLOSED"]);
  });

  it("skips input object types, which selections can never reference", () => {
    const ir = buildIr(
      buildSchema(`
        input Filter { term: String }
        type Query { search(filter: Filter): String }
      `)
    );
    expect(ir.types.map((type) => type.name)).not.toContain("Filter");
  });

  it("resolves interface and union implementors", () => {
    const ir = buildIr(
      buildSchema(`
        interface Owner { login: String! }
        type User implements Owner { login: String!, bio: String }
        type Organization implements Owner { login: String!, description: String }
        union SearchResult = User | Organization
        type Query { owner: Owner, result: SearchResult }
      `)
    );

    const owner = ir.types.find((type) => type.name === "Owner");
    expect(owner?.kind).toBe("abstract");
    expect(owner?.kind === "abstract" && owner.implementors).toEqual(["Organization", "User"]);
    // An interface has common fields; a union has none.
    expect(owner?.kind === "abstract" && owner.fields.map((field) => field.name)).toEqual(["login"]);

    const result = ir.types.find((type) => type.name === "SearchResult");
    expect(result?.kind === "abstract" && result.fields).toEqual([]);
    expect(result?.kind === "abstract" && result.implementors).toEqual(["Organization", "User"]);

    expect(fieldsOf(ir.types, "Query")["owner"]).toMatchObject({ kind: "abstract", namedType: "Owner" });
  });

  it("reads an introspection JSON payload as well as SDL", async () => {
    const { graphqlSync, getIntrospectionQuery } = await import("graphql");
    const sdlSchema = buildSchema(`type Query { hello: String! }`);
    const introspection = graphqlSync({ schema: sdlSchema, source: getIntrospectionQuery() });

    const { writeFile, mkdtemp } = await import("node:fs/promises");
    const { tmpdir } = await import("node:os");
    const { join } = await import("node:path");
    const dir = await mkdtemp(join(tmpdir(), "zodql-codegen-"));
    const path = join(dir, "introspection.json");
    await writeFile(path, JSON.stringify(introspection), "utf8");

    const ir = buildIr(await loadSchema([path]));
    expect(ir.types.find((type) => type.name === "Query")).toBeDefined();
  });
});
