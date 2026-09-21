#!/usr/bin/env tsx
/**
 * Measure codegen on a large synthetic schema.
 *
 * Not a PR test — run it by hand (`pnpm tsx scripts/benchmark-codegen.ts`) when
 * changing the emitters or the pick types, to check that generation stays fast
 * and, more importantly, that `tsc` cost for a consumer scales with the number
 * of types it *imports* rather than the number the schema *contains*.
 *
 * That second property is the whole reason generated modules import nothing
 * from each other.
 */
import { execFileSync } from "node:child_process";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { generate } from "../src/codegen/generator/generate.js";
import { writeFiles } from "../src/codegen/generator/write.js";

const TYPE_COUNTS = [100, 500, 1000];
/** How many of the generated types a single consumer file actually selects. */
const CONSUMER_TYPES = 30;

/** A schema with realistic fan-out: every type points at a few others. */
function syntheticSchema(typeCount: number): string {
  const types = Array.from({ length: typeCount }, (_, index) => {
    const refs = [1, 2, 3]
      .map((offset) => (index + offset * 7) % typeCount)
      .map((target, position) => `  ref${position}: Type${target}`)
      .join("\n");
    return [
      `type Type${index} {`,
      `  id: ID!`,
      `  name: String!`,
      `  description: String`,
      `  count: Int!`,
      `  tags: [String!]!`,
      refs,
      `}`,
    ].join("\n");
  });
  return [`type Query {\n  root: Type0\n}`, ...types].join("\n\n");
}

function consumerSource(typeCount: number): string {
  const used = Array.from({ length: Math.min(CONSUMER_TYPES, typeCount) }, (_, index) => index);
  const imports = used.map((index) => `import { buildType${index}Field } from "./Type${index}.js";`);
  const selections = used.map(
    (index) => `export const sel${index} = buildType${index}Field({ id: true, name: true, description: true });`
  );
  return [...imports, "", ...selections, ""].join("\n");
}

async function run(): Promise<void> {
  console.log(`types | files | output |  generate | tsc (consumer selecting ${CONSUMER_TYPES})`);
  console.log(`------|-------|--------|-----------|------------------------------`);

  for (const typeCount of TYPE_COUNTS) {
    const dir = await mkdtemp(join(tmpdir(), `zodql-bench-${typeCount}-`));
    const schemaPath = join(dir, "schema.graphql");
    await writeFile(schemaPath, syntheticSchema(typeCount), "utf8");

    const outDir = join(dir, "generated");
    const startedAt = performance.now();
    // Prettier dominates at this scale and isn't what's being measured.
    const files = await generate({ schema: [schemaPath], out: outDir, format: false });
    await writeFiles(outDir, files);
    const generateMs = performance.now() - startedAt;

    const bytes = files.reduce((total, file) => total + Buffer.byteLength(file.contents), 0);

    await writeFile(join(outDir, "consumer.ts"), consumerSource(typeCount), "utf8");
    await writeFile(
      join(outDir, "tsconfig.json"),
      JSON.stringify(
        {
          compilerOptions: {
            target: "es2022",
            lib: ["es2022"],
            module: "nodenext",
            moduleResolution: "nodenext",
            strict: true,
            noEmit: true,
            skipLibCheck: true,
            types: [],
            paths: {
              "@mattiasahlsen/zodql/codegen": [join(process.cwd(), "src/codegen/index.ts")],
              zod: [join(process.cwd(), "node_modules/zod")],
            },
          },
          include: ["consumer.ts"],
        },
        null,
        2
      ),
      "utf8"
    );

    const tscStartedAt = performance.now();
    let tscMs: number | null = null;
    try {
      execFileSync("npx", ["tsc", "-p", join(outDir, "tsconfig.json")], { stdio: "pipe" });
      tscMs = performance.now() - tscStartedAt;
    } catch {
      tscMs = performance.now() - tscStartedAt;
    }

    console.log(
      `${String(typeCount).padStart(5)} | ${String(files.length).padStart(5)} | ` +
        `${`${(bytes / 1024).toFixed(0)}KB`.padStart(6)} | ` +
        `${`${generateMs.toFixed(0)}ms`.padStart(9)} | ${`${tscMs.toFixed(0)}ms`.padStart(8)}`
    );

    await rm(dir, { recursive: true, force: true });
  }
}

await run();
