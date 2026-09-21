import { z } from "zod";
import { buildObjectSelection, type FieldDef } from "./build-selection.js";

const defs: Record<string, FieldDef> = {
  name: { kind: "leaf", schema: () => z.string(), wrappers: [] },
  owner: { kind: "object", wrappers: ["nullable"] },
};

describe("buildObjectSelection", () => {
  it("rejects an unknown field by name", () => {
    expect(() => buildObjectSelection(defs, { name: true, nope: true }, "Repository")).toThrow(
      'Unknown field "nope" on type "Repository".'
    );
  });

  /**
   * `defs` is an object literal, so a plain `defs[fieldName]` lookup walks
   * `Object.prototype` and finds a function for these. The guard has to be
   * `Object.hasOwn`, or the "readable error for a JavaScript caller" this
   * validation exists for turns into `def.schema is not a function`.
   */
  it.each(["toString", "constructor", "hasOwnProperty", "valueOf"])(
    "rejects %s rather than inheriting it from Object.prototype",
    (key) => {
      expect(() => buildObjectSelection(defs, { name: true, [key]: true }, "Repository")).toThrow(
        `Unknown field "${key}" on type "Repository".`
      );
    }
  );

  it("still accepts a field whose name happens to shadow a prototype member", () => {
    const leaf: FieldDef = { kind: "leaf", schema: () => z.string(), wrappers: [] };
    const shadowing: Record<string, FieldDef> = { toString: leaf };
    expect(buildObjectSelection(shadowing, { toString: true }, "Weird").shape).toHaveProperty("toString");
  });

  it("requires a selection to pick something", () => {
    expect(() => buildObjectSelection(defs, {}, "Repository")).toThrow(
      'A selection on type "Repository" must pick at least one field.'
    );
  });

  it("requires an object field to be given a selection rather than `true`", () => {
    expect(() => buildObjectSelection(defs, { owner: true }, "Repository")).toThrow(
      /selects an object type, so it needs a selection/
    );
  });
});
