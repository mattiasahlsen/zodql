import type * as PrettierModule from "prettier";

/**
 * Run generated source through the project's own Prettier config.
 *
 * Prettier is an optional peer: when it isn't installed the emitted text is
 * used as-is, which is already close to Prettier-clean, so the only cost is a
 * noisier diff.
 */
export async function createFormatter(
  outputDir: string,
  enabled: boolean
): Promise<(source: string, filePath: string) => Promise<string>> {
  if (!enabled) return async (source) => source;

  let prettier: typeof PrettierModule;
  try {
    prettier = await import("prettier");
  } catch {
    return async (source) => source;
  }

  const config = await prettier.resolveConfig(outputDir).catch(() => null);

  return async (source, filePath) => {
    try {
      return await prettier.format(source, { ...config, filepath: filePath, parser: "typescript" });
    } catch {
      // A formatting failure must not lose the file — emit it unformatted.
      return source;
    }
  };
}
