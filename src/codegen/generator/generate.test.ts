import { readFile, readdir } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { generate } from "./generate.js";
import type { GeneratedFile } from "./types.js";

const generatedDir = fileURLToPath(new URL("../../../examples/github-repo-overview/generated/", import.meta.url));
const schemaPath = fileURLToPath(
  new URL("../../../examples/github-repo-overview/alternatives/schema.graphql", import.meta.url)
);

async function generateFixture(): Promise<GeneratedFile[]> {
  return generate({ schema: [schemaPath], out: generatedDir });
}

describe("generate", () => {
  /**
   * The committed output under examples/…/generated/ is the golden copy: it was
   * hand-written first, to settle the ergonomics before any emitter existed, and
   * the emitter has to reproduce it exactly. It's also type-checked and
   * format-checked by `pnpm verify`, so it can't silently rot.
   */
  it("reproduces the committed output byte for byte", async () => {
    const files = await generateFixture();

    for (const file of files) {
      const onDisk = await readFile(join(generatedDir, file.path), "utf8");
      expect(file.contents, `${file.path} differs from the committed output`).toBe(onDisk);
    }
  });

  it("emits exactly the committed set of files", async () => {
    const files = await generateFixture();
    const onDisk = (await readdir(generatedDir)).filter((name) => name.endsWith(".ts"));

    // Per-file comparison can't notice a stale extra file left behind.
    expect(files.map((file) => file.path).sort()).toEqual(onDisk.sort());
  });

  it("marks scalars.ts as seeded so regeneration never clobbers user edits", async () => {
    const files = await generateFixture();
    expect(files.find((file) => file.path === "scalars.ts")?.seeded).toBe(true);
    expect(files.find((file) => file.path === "scalars.generated.ts")?.seeded).toBeUndefined();
  });
});
