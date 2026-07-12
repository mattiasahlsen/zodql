export function normalizeIndentation(str: string): string {
  let lines = str.split("\n");
  while (lines[0]?.trim() === "") {
    lines = lines.slice(1);
  }
  while (lines.at(-1)?.trim() === "") {
    lines = lines.slice(0, -1);
  }

  const trimmedLines = lines.map((line) => line.trimEnd());
  const nonEmptyLines = trimmedLines.filter((line) => line.trim() !== "");

  const indentLengths = nonEmptyLines
    .map((line) => /^(\s*)/.exec(line)?.[1]?.length)
    .filter((len) => len !== undefined);

  const minIndent = Math.min(...indentLengths);

  const normalizedLines = trimmedLines.map((line) => line.slice(minIndent));
  return normalizedLines.join("\n");
}
