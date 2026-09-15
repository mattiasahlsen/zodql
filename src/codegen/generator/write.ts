import { createHash } from "node:crypto";
import { mkdir, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import type { GeneratedFile } from "./types.js";

export const MANIFEST_FILE = ".zodql-codegen.json";

interface Manifest {
  readonly version: 1;
  /** Files this generator wrote last time, so stale ones can be removed safely. */
  readonly files: readonly string[];
}

export interface WriteResult {
  readonly written: string[];
  readonly unchanged: string[];
  readonly deleted: string[];
  readonly skipped: string[];
}

export interface CheckResult {
  readonly added: string[];
  readonly changed: string[];
  readonly removed: string[];
  readonly ok: boolean;
}

function hash(contents: string): string {
  return createHash("sha256").update(contents).digest("hex");
}

async function readIfPresent(path: string): Promise<string | null> {
  try {
    return await readFile(path, "utf8");
  } catch {
    return null;
  }
}

async function readManifest(outDir: string): Promise<Manifest | null> {
  const raw = await readIfPresent(join(outDir, MANIFEST_FILE));
  if (raw === null) return null;
  try {
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed === "object" && parsed !== null && Array.isArray((parsed as Manifest).files)) {
      return parsed as Manifest;
    }
  } catch {
    // A corrupt manifest is treated as absent; the guard below still applies.
  }
  return null;
}

/**
 * Refuse to take over a directory this generator didn't create.
 *
 * Stale-file deletion is driven by the manifest, so writing into a directory
 * that has other content in it — someone's `src/`, say — would be the one way
 * to lose work.
 */
async function assertSafeOutputDir(outDir: string, force: boolean): Promise<void> {
  if (force) return;
  const existing = await readdir(outDir).catch(() => null);
  if (existing === null || existing.length === 0) return;
  if (existing.includes(MANIFEST_FILE)) return;
  throw new Error(
    `${outDir} is not empty and has no ${MANIFEST_FILE}, so it wasn't written by zodql codegen.\n` +
      `Point --out at a directory of its own, or pass --force to write into this one anyway.`
  );
}

/**
 * Write the generated files, removing only what a previous run put there.
 *
 * Seeded files (`scalars.ts`) are written once and then left alone forever —
 * they belong to the user after the first run.
 */
export async function writeFiles(
  outDir: string,
  files: readonly GeneratedFile[],
  options: { force?: boolean } = {}
): Promise<WriteResult> {
  await mkdir(outDir, { recursive: true });
  await assertSafeOutputDir(outDir, options.force ?? false);

  const previous = await readManifest(outDir);
  const result: WriteResult = { written: [], unchanged: [], deleted: [], skipped: [] };

  for (const file of files) {
    const path = join(outDir, file.path);
    const existing = await readIfPresent(path);

    if (file.seeded && existing !== null) {
      result.skipped.push(file.path);
      continue;
    }
    if (existing === file.contents) {
      result.unchanged.push(file.path);
      continue;
    }

    await writeFile(path, file.contents, "utf8");
    result.written.push(file.path);
  }

  // Managed files only: a seeded file is never listed for deletion.
  const managed = files.filter((file) => !file.seeded).map((file) => file.path);
  const current = new Set(managed);
  for (const stale of previous?.files ?? []) {
    if (current.has(stale)) continue;
    await rm(join(outDir, stale), { force: true });
    result.deleted.push(stale);
  }

  const manifest: Manifest = { version: 1, files: managed.sort() };
  await writeFile(join(outDir, MANIFEST_FILE), `${JSON.stringify(manifest, null, 2)}\n`, "utf8");

  return result;
}

/**
 * Compare what would be generated against what's on disk, without writing.
 *
 * Seeded files are excluded: they are expected to have diverged.
 */
export async function checkFiles(outDir: string, files: readonly GeneratedFile[]): Promise<CheckResult> {
  const managed = files.filter((file) => !file.seeded);
  const added: string[] = [];
  const changed: string[] = [];

  for (const file of managed) {
    const existing = await readIfPresent(join(outDir, file.path));
    if (existing === null) added.push(file.path);
    else if (hash(existing) !== hash(file.contents)) changed.push(file.path);
  }

  const expected = new Set(managed.map((file) => file.path));
  const previous = await readManifest(outDir);
  const removed = (previous?.files ?? []).filter((path) => !expected.has(path));

  return { added, changed, removed, ok: added.length === 0 && changed.length === 0 && removed.length === 0 };
}
