import { mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { generate } from "./generate.js";

/**
 * An interface's common fields are ordinary fields, so they can be enum- or
 * object-typed just like an object type's.
 *
 * The emitter used to assume they were always scalars and emit
 * `scalars.<EnumName>` / `(typeof scalars)["<ObjectType>"]` for them — names
 * that don't exist in the scalars table, so the generated module didn't
 * compile. The committed fixture now covers this too (`RepositoryOwner.status`
 * and `.pinnedRepository` in examples/codegen-abstract), which is what proves
 * the output type-checks; this pins the emitted shape directly.
 */
async function generateFrom(sdl: string): Promise<Map<string, string>> {
  const dir = await mkdtemp(join(tmpdir(), "zodql-abstract-"));
  const schemaPath = join(dir, "schema.graphql");
  await writeFile(schemaPath, sdl, "utf8");

  const files = await generate({ schema: [schemaPath], out: join(dir, "out"), format: false });
  return new Map(files.map((file) => [file.path, file.contents]));
}

const SDL = `
  enum Status { ACTIVE SUSPENDED }
  type Profile { bio: String! }
  interface Node {
    id: ID!
    status: Status!
    profile: Profile
  }
  type User implements Node {
    id: ID!
    status: Status!
    profile: Profile
    name: String!
  }
  type Query { node: Node }
`;

describe("emitAbstractType with non-scalar common fields", () => {
  it("routes an enum common field through its own module, not the scalars table", async () => {
    const node = (await generateFrom(SDL)).get("Node.ts")!;

    expect(node).toContain('import { Status } from "./Status.js";');
    expect(node).toContain("status: typeof Status;");
    expect(node).toContain('status: { kind: "leaf", schema: () => Status, wrappers: [] },');
    expect(node).not.toContain("scalars.Status");
    expect(node).not.toContain('(typeof scalars)["Status"]');
  });

  it("gives an object common field a builder-shaped pick slot", async () => {
    const node = (await generateFrom(SDL)).get("Node.ts")!;

    expect(node).toContain('readonly profile?: ObjectSelection<"Profile">;');
    expect(node).toContain("profile: never;");
    expect(node).toContain('profile: { kind: "object", wrappers: ["nullable"] },');
    expect(node).not.toContain("scalars.Profile");
  });

  it("imports the scalars table only for the fields that actually use it", async () => {
    const files = await generateFrom(SDL);

    // `id` is an ID, so Node still needs it…
    expect(files.get("Node.ts")).toContain('import { scalars } from "./scalars.js";');
    // …but a union has no common fields at all, so it must not import it.
    const unionOnly = await generateFrom(`
      type A { a: String! }
      type B { b: String! }
      union Either = A | B
      type Query { either: Either }
    `);
    expect(unionOnly.get("Either.ts")).not.toContain("./scalars.js");
  });
});
