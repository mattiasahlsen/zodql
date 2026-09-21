import { createHash } from "node:crypto";

/**
 * Windows refuses these as filenames regardless of extension, so a GraphQL type
 * called `Con` or `Aux` needs disambiguating even when nothing collides with it.
 */
const WINDOWS_RESERVED = new Set([
  "con",
  "prn",
  "aux",
  "nul",
  ...Array.from({ length: 9 }, (_, index) => `com${index + 1}`),
  ...Array.from({ length: 9 }, (_, index) => `lpt${index + 1}`),
]);

/** GraphQL reserves the `__` prefix for introspection. */
export function isIntrospectionType(name: string): boolean {
  return name.startsWith("__");
}

function needsDisambiguation(name: string, byLowerCase: Map<string, string[]>): boolean {
  const key = name.toLowerCase();
  // macOS and Windows filesystems are case-insensitive, but GraphQL type names
  // are case-sensitive — `Foo` and `foo` are both legal and would collide.
  if ((byLowerCase.get(key)?.length ?? 0) > 1) return true;
  return WINDOWS_RESERVED.has(key.split(".")[0] ?? key);
}

/**
 * Assign a deterministic filename to each type.
 *
 * Disambiguation is applied to *every* member of a colliding group, not just
 * the losers, so the result never depends on iteration order.
 */
export function assignFileNames(typeNames: readonly string[]): Map<string, string> {
  const byLowerCase = new Map<string, string[]>();
  for (const name of typeNames) {
    const key = name.toLowerCase();
    byLowerCase.set(key, [...(byLowerCase.get(key) ?? []), name]);
  }

  const assigned = new Map<string, string>();
  for (const name of typeNames) {
    const suffix = needsDisambiguation(name, byLowerCase)
      ? `.${createHash("sha256").update(name).digest("hex").slice(0, 8)}`
      : "";
    assigned.set(name, `${name}${suffix}.ts`);
  }
  return assigned;
}

/** `Repository` -> `buildRepositoryField`. Independent of the filename. */
export function builderName(typeName: string): string {
  return `build${typeName}Field`;
}

/** `Repository` -> `repositoryFields`. Lower-cases only the leading run of capitals. */
export function fieldsConstName(typeName: string): string {
  const leadingCaps = /^[A-Z]+(?![a-z])/.exec(typeName)?.[0];
  const camel = leadingCaps
    ? leadingCaps.toLowerCase() + typeName.slice(leadingCaps.length)
    : typeName.charAt(0).toLowerCase() + typeName.slice(1);
  return `${camel}Fields`;
}
