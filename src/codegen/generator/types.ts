import type { Wrapper } from "../pick.js";

/** What a field's named type resolves to, which decides how it is picked. */
export type FieldKind = "scalar" | "enum" | "object" | "abstract";

export interface FieldArgumentIr {
  readonly name: string;
  /** The argument's GraphQL type, rendered as SDL (e.g. `[IssueState!]`). */
  readonly type: string;
}

export interface FieldIr {
  readonly name: string;
  readonly description: string | undefined;
  readonly deprecationReason: string | undefined;
  /** Type modifiers, outermost-first. See {@link Wrapper}. */
  readonly wrappers: readonly Wrapper[];
  /** The named type at the bottom of the modifiers, e.g. `String` or `Language`. */
  readonly namedType: string;
  readonly kind: FieldKind;
  readonly args: readonly FieldArgumentIr[];
}

export interface EnumValueIr {
  readonly name: string;
  readonly description: string | undefined;
  readonly deprecationReason: string | undefined;
}

export type TypeIr =
  | {
      readonly kind: "object";
      readonly name: string;
      readonly description: string | undefined;
      readonly fields: readonly FieldIr[];
    }
  | {
      readonly kind: "abstract";
      readonly name: string;
      readonly description: string | undefined;
      /** Fields common to every implementor. Empty for a union. */
      readonly fields: readonly FieldIr[];
      /** Concrete object types this resolves to. */
      readonly implementors: readonly string[];
    }
  | {
      readonly kind: "enum";
      readonly name: string;
      readonly description: string | undefined;
      readonly values: readonly EnumValueIr[];
    };

export interface SchemaIr {
  readonly types: readonly TypeIr[];
  /** Every scalar in the schema, built-ins included, sorted by name. */
  readonly scalars: readonly { readonly name: string; readonly description: string | undefined }[];
}

export interface CodegenOptions {
  /** Schema sources: SDL files or introspection JSON. */
  readonly schema: readonly string[];
  readonly out: string;
  /** Root type names to keep; the reachable closure is computed from them. Empty means everything. */
  readonly include?: readonly string[];
  readonly exclude?: readonly string[];
  readonly maxDepth?: number;
  readonly defaultScalar?: "string" | "unknown";
  /** Prefix for the type-name brand, for projects generating from two schemas. */
  readonly brandNamespace?: string;
  readonly barrel?: boolean;
  readonly format?: boolean;
}

export interface GeneratedFile {
  /** Path relative to the output directory. */
  readonly path: string;
  readonly contents: string;
  /**
   * A seeded file is written once and then belongs to the user: never
   * overwritten, never deleted, never part of the drift check.
   */
  readonly seeded?: boolean;
}
