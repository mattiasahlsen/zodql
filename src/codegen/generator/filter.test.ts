import { buildSchema } from "graphql";
import { buildIr } from "./ir.js";
import { filterIr } from "./filter.js";

const schema = buildSchema(`
  type Query { repository: Repository, unrelated: Unrelated }
  type Repository { name: String!, owner: Owner!, language: Language }
  type Language { name: String! }
  interface Owner { login: String! }
  type User implements Owner { login: String! }
  type Unrelated { value: String! }
`);

const names = (types: readonly { name: string }[]) => types.map((type) => type.name).sort();

describe("filterIr", () => {
  const ir = buildIr(schema);

  it("keeps everything when no include is given", () => {
    expect(names(filterIr(ir, {}).types)).toEqual(["Language", "Owner", "Query", "Repository", "Unrelated", "User"]);
  });

  it("keeps the closure reachable from the included roots", () => {
    // A builder is useless if the types its fields select can't be built, so
    // reachability is followed automatically rather than left to the user.
    expect(names(filterIr(ir, { include: ["Repository"] }).types)).toEqual(["Language", "Owner", "Repository", "User"]);
  });

  it("follows an interface to its implementors", () => {
    expect(names(filterIr(ir, { include: ["Owner"] }).types)).toEqual(["Owner", "User"]);
  });

  it("applies exclusions after the closure, so --exclude always wins", () => {
    expect(names(filterIr(ir, { include: ["Repository"], exclude: ["Language"] }).types)).toEqual([
      "Owner",
      "Repository",
      "User",
    ]);
  });

  it("supports * in patterns", () => {
    expect(names(filterIr(ir, { include: ["Query"], exclude: ["Un*"] }).types)).not.toContain("Unrelated");
  });

  it("caps expansion with maxDepth", () => {
    const shallow = filterIr(ir, { include: ["Query"], maxDepth: 0 });
    expect(names(shallow.types)).toEqual(["Query"]);
  });
});
