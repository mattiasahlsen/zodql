import type { SchemaIr, TypeIr } from "./types.js";

/** Turn a `--include`/`--exclude` entry into a matcher. `*` is the only wildcard. */
function toMatcher(pattern: string): (name: string) => boolean {
  if (!pattern.includes("*")) return (name) => name === pattern;
  const source = `^${pattern.split("*").map(escapeRegExp).join(".*")}$`;
  const regexp = new RegExp(source);
  return (name) => regexp.test(name);
}

function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function matchesAny(name: string, patterns: readonly string[]): boolean {
  return patterns.some((pattern) => toMatcher(pattern)(name));
}

/** Types a type refers to: field types, plus an abstract type's implementors. */
function referencesOf(type: TypeIr): string[] {
  if (type.kind === "enum") return [];
  const fromFields = type.fields.map((field) => field.namedType);
  return type.kind === "abstract" ? [...fromFields, ...type.implementors] : fromFields;
}

/**
 * Narrow the schema to the types actually worth generating.
 *
 * `include` names roots; everything reachable from them is kept, because a
 * builder is useless if the types its fields select can't be built. On a schema
 * the size of GitHub's this is the difference between 30 files and 1,100.
 */
export function filterIr(
  ir: SchemaIr,
  options: { include?: readonly string[]; exclude?: readonly string[]; maxDepth?: number }
): SchemaIr {
  const { include = [], exclude = [], maxDepth = Infinity } = options;
  const byName = new Map(ir.types.map((type) => [type.name, type] as const));

  let kept: Set<string>;
  if (include.length === 0) {
    kept = new Set(byName.keys());
  } else {
    kept = new Set<string>();
    let frontier = ir.types.filter((type) => matchesAny(type.name, include)).map((type) => type.name);
    for (let depth = 0; frontier.length > 0 && depth <= maxDepth; depth += 1) {
      const next: string[] = [];
      for (const name of frontier) {
        if (kept.has(name)) continue;
        kept.add(name);
        const type = byName.get(name);
        if (type) next.push(...referencesOf(type).filter((reference) => byName.has(reference)));
      }
      frontier = next;
    }
  }

  // Exclusions are applied after the closure, so `--exclude` always wins.
  for (const name of [...kept]) {
    if (matchesAny(name, exclude)) kept.delete(name);
  }

  return { ...ir, types: ir.types.filter((type) => kept.has(type.name)) };
}
