import { assignFileNames, builderName, fieldsConstName, isIntrospectionType } from "./filenames.js";

describe("assignFileNames", () => {
  it("uses the type name verbatim when nothing collides", () => {
    expect(assignFileNames(["Repository", "Language"])).toEqual(
      new Map([
        ["Repository", "Repository.ts"],
        ["Language", "Language.ts"],
      ])
    );
  });

  it("disambiguates names that differ only by case", () => {
    // GraphQL names are case-sensitive; macOS and Windows filesystems are not.
    const assigned = assignFileNames(["Foo", "foo"]);
    expect(assigned.get("Foo")).not.toBe(assigned.get("foo"));
    // Both sides are suffixed, so the result can't depend on iteration order.
    expect(assigned.get("Foo")).toMatch(/^Foo\.[0-9a-f]{8}\.ts$/);
    expect(assigned.get("foo")).toMatch(/^foo\.[0-9a-f]{8}\.ts$/);
  });

  it("does not depend on input order", () => {
    const forwards = assignFileNames(["Foo", "foo", "Bar"]);
    const backwards = assignFileNames(["Bar", "foo", "Foo"]);
    expect([...forwards].sort()).toEqual([...backwards].sort());
  });

  it.each(["CON", "Aux", "nul", "COM1", "lpt9"])("disambiguates the Windows reserved name %s", (name) => {
    expect(assignFileNames([name]).get(name)).toMatch(/\.[0-9a-f]{8}\.ts$/);
  });

  it("leaves names that merely contain a reserved word alone", () => {
    expect(assignFileNames(["Console", "Auxiliary"])).toEqual(
      new Map([
        ["Console", "Console.ts"],
        ["Auxiliary", "Auxiliary.ts"],
      ])
    );
  });

  it("is stable across runs", () => {
    expect(assignFileNames(["Foo", "foo"])).toEqual(assignFileNames(["Foo", "foo"]));
  });
});

describe("isIntrospectionType", () => {
  it.each(["__Schema", "__Type", "__DirectiveLocation"])("skips %s", (name) => {
    expect(isIntrospectionType(name)).toBe(true);
  });

  it("keeps ordinary names", () => {
    expect(isIntrospectionType("Repository")).toBe(false);
  });
});

describe("naming helpers", () => {
  it("derives the builder name from the type name", () => {
    expect(builderName("Repository")).toBe("buildRepositoryField");
  });

  it("camel-cases the field table name, including leading acronyms", () => {
    expect(fieldsConstName("Repository")).toBe("repositoryFields");
    expect(fieldsConstName("IssueConnection")).toBe("issueConnectionFields");
    expect(fieldsConstName("URI")).toBe("uriFields");
    expect(fieldsConstName("URLTarget")).toBe("urlTargetFields");
  });
});
