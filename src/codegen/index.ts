/**
 * The runtime and types that generated builder modules import.
 *
 * Published as the `@mattiasahlsen/zodql/codegen` subpath so the main entry
 * point stays free of anything only codegen consumers need. Generated code
 * holds no logic of its own — it is field metadata plus a call into here.
 */
export { asSelectionOf, type AbstractSelection, type GqlObjectConfig, type ObjectSelection } from "./brand.js";
export {
  applyWrappers,
  buildAbstractSelection,
  buildObjectSelection,
  ON_KEY,
  type FieldDef,
} from "./build-selection.js";
export type {
  AbstractOutput,
  ApplyWrappers,
  LeafPick,
  NoExcessPick,
  NonEmptyPick,
  ResolveLeaf,
  Wrapper,
} from "./pick.js";
