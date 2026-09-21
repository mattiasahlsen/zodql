import { mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { main, resolveOptions } from "./cli.js";

const SDL = `
  type Query { repository: Repository }
  type Repository { name: String! }
`;

async function fixture(): Promise<{ schema: string; out: string }> {
  const dir = await mkdtemp(join(tmpdir(), "zodql-cli-"));
  const schema = join(dir, "schema.graphql");
  await writeFile(schema, SDL, "utf8");
  return { schema, out: join(dir, "out") };
}

describe("resolveOptions", () => {
  /**
   * Left unvalidated, `Number("abc")` is NaN and `depth <= NaN` is false on the
   * first iteration of the closure walk, so `--include X --max-depth abc` used
   * to emit nothing but scalars.ts and exit 0 — and `--check` would then call
   * that empty directory up to date.
   */
  // Passed as `--max-depth=<v>`: `parseArgs` rejects a bare leading dash itself,
  // with its own (already clear) message.
  it.each(["abc", "1.5", "-1", "Infinity"])("rejects --max-depth %s", async (value) => {
    await expect(resolveOptions(["--schema", "s.graphql", "--out", "o", `--max-depth=${value}`])).rejects.toThrow(
      `--max-depth must be a non-negative integer, got "${value}".`
    );
  });

  it("accepts a non-negative integer --max-depth", async () => {
    const options = await resolveOptions(["--schema", "s.graphql", "--out", "o", "--max-depth", "0"]);
    expect(options).toMatchObject({ maxDepth: 0 });
  });
});

describe("main", () => {
  it("reports a schema that isn't there as a message, not a stack trace", async () => {
    const errors: unknown[] = [];
    const spy = vi.spyOn(console, "error").mockImplementation((...args) => void errors.push(args.join(" ")));

    const code = await main(["--schema", join(tmpdir(), "definitely-not-here.graphql"), "--out", tmpdir()]);

    spy.mockRestore();
    expect(code).toBe(1);
    expect(errors).toHaveLength(1);
    expect(String(errors[0])).not.toContain("    at ");
  });

  it("refuses a non-empty output directory it didn't create, without throwing", async () => {
    const { schema } = await fixture();
    const out = await mkdtemp(join(tmpdir(), "zodql-cli-occupied-"));
    await writeFile(join(out, "index.ts"), "export const mine = 1;\n", "utf8");

    const errors: string[] = [];
    const spy = vi.spyOn(console, "error").mockImplementation((...args) => void errors.push(args.join(" ")));

    const code = await main(["--schema", schema, "--out", out]);

    spy.mockRestore();
    expect(code).toBe(1);
    expect(errors[0]).toContain("wasn't written by zodql codegen");
  });

  it("generates and then reports itself up to date under --check", async () => {
    const { schema, out } = await fixture();
    const logged: string[] = [];
    const log = (...args: unknown[]): void => void logged.push(args.join(" "));

    expect(await main(["--schema", schema, "--out", out], log)).toBe(0);
    expect(await main(["--schema", schema, "--out", out, "--check"], log)).toBe(0);
    expect(logged.at(-1)).toContain("up to date");
  });
});
