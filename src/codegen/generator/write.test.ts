import { mkdir, mkdtemp, readFile, readdir, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { MANIFEST_FILE, checkFiles, writeFiles } from "./write.js";
import type { GeneratedFile } from "./types.js";

const files: GeneratedFile[] = [
  { path: "A.ts", contents: "export const a = 1;\n" },
  { path: "B.ts", contents: "export const b = 2;\n" },
  { path: "scalars.ts", contents: "export const scalars = {};\n", seeded: true },
];

const freshDir = () => mkdtemp(join(tmpdir(), "zodql-write-"));

describe("writeFiles", () => {
  it("writes everything on a first run and records a manifest", async () => {
    const dir = await freshDir();
    const result = await writeFiles(dir, files);

    expect(result.written.sort()).toEqual(["A.ts", "B.ts", "scalars.ts"]);
    expect((await readdir(dir)).sort()).toEqual([MANIFEST_FILE, "A.ts", "B.ts", "scalars.ts"].sort());

    // The seeded file is not managed, so it can never be deleted later.
    const manifest = JSON.parse(await readFile(join(dir, MANIFEST_FILE), "utf8"));
    expect(manifest.files).toEqual(["A.ts", "B.ts"]);
  });

  it("leaves a seeded file alone once it exists", async () => {
    const dir = await freshDir();
    await writeFiles(dir, files);
    await writeFile(join(dir, "scalars.ts"), "export const scalars = { URI: 'edited' };\n", "utf8");

    const result = await writeFiles(dir, files);
    expect(result.skipped).toEqual(["scalars.ts"]);
    expect(await readFile(join(dir, "scalars.ts"), "utf8")).toContain("edited");
  });

  it("reports unchanged files instead of rewriting them", async () => {
    const dir = await freshDir();
    await writeFiles(dir, files);
    const result = await writeFiles(dir, files);
    expect(result.written).toEqual([]);
    expect(result.unchanged.sort()).toEqual(["A.ts", "B.ts"]);
  });

  it("deletes only files a previous run wrote", async () => {
    const dir = await freshDir();
    await writeFiles(dir, files);
    await writeFile(join(dir, "handwritten.ts"), "// mine\n", "utf8");

    const result = await writeFiles(dir, [files[0]!, files[2]!]);

    expect(result.deleted).toEqual(["B.ts"]);
    // Something this generator never wrote is never removed.
    expect(await readFile(join(dir, "handwritten.ts"), "utf8")).toBe("// mine\n");
  });

  it("refuses a non-empty directory it did not create, unless forced", async () => {
    const dir = await freshDir();
    await writeFile(join(dir, "important.ts"), "// mine\n", "utf8");

    await expect(writeFiles(dir, files)).rejects.toThrow(/not empty and has no/);
    await expect(writeFiles(dir, files, { force: true })).resolves.toBeDefined();
  });

  /**
   * The manifest drives `rm`, so a hand-edited or merge-mangled entry is the one
   * way stale-file cleanup could reach outside `--out` — exactly what the
   * non-empty-directory guard above exists to prevent.
   */
  it("ignores manifest entries that point outside the output directory", async () => {
    const parent = await freshDir();
    const dir = join(parent, "out");
    await mkdir(dir);
    await writeFile(join(parent, "victim.ts"), "// precious\n", "utf8");
    await writeFile(
      join(dir, MANIFEST_FILE),
      JSON.stringify({ version: 1, files: ["../victim.ts", "/etc/passwd", "A.ts", 42, ""] }),
      "utf8"
    );

    const result = await writeFiles(dir, [files[2]!]);

    expect(result.deleted).toEqual(["A.ts"]);
    expect(await readFile(join(parent, "victim.ts"), "utf8")).toBe("// precious\n");
  });

  it("keeps a manifest entry in a subdirectory of the output directory", async () => {
    const dir = await freshDir();
    await writeFile(join(dir, MANIFEST_FILE), JSON.stringify({ version: 1, files: ["nested/A.ts"] }), "utf8");

    const result = await writeFiles(dir, [files[2]!]);
    expect(result.deleted).toEqual(["nested/A.ts"]);
  });
});

describe("checkFiles", () => {
  it("passes when the output is up to date", async () => {
    const dir = await freshDir();
    await writeFiles(dir, files);
    expect(await checkFiles(dir, files)).toMatchObject({ ok: true, added: [], changed: [], removed: [] });
  });

  it("reports a changed file", async () => {
    const dir = await freshDir();
    await writeFiles(dir, files);
    await writeFile(join(dir, "A.ts"), "export const a = 99;\n", "utf8");

    expect(await checkFiles(dir, files)).toMatchObject({ ok: false, changed: ["A.ts"] });
  });

  it("reports files that would be added or removed", async () => {
    const dir = await freshDir();
    await writeFiles(dir, [files[0]!, files[2]!]);

    const result = await checkFiles(dir, files);
    expect(result).toMatchObject({ ok: false, added: ["B.ts"] });
  });

  it("ignores an edited seeded file, which is expected to diverge", async () => {
    const dir = await freshDir();
    await writeFiles(dir, files);
    await writeFile(join(dir, "scalars.ts"), "export const scalars = { URI: 'edited' };\n", "utf8");

    expect(await checkFiles(dir, files)).toMatchObject({ ok: true });
  });
});
