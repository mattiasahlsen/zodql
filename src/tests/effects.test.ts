import z from "zod";
import { zodqlField } from "../zodql-field-builder.js";
import { zodql } from "../zodql-builder.js";
import { normalizeIndentation } from "../testing/normalizeIndentation.js";

describe("zod effects (transform / preprocess / refine)", () => {
  it("resolves a .transform()-wrapped object field to its underlying shape", () => {
    const userSchema = z.object({
      id: z.string(),
      user: zodqlField()
        .withArguments({ id: "$userId" })
        .toSchema(z.object({ name: z.string(), createdAt: z.string() }))
        .transform((value: { name: string; createdAt: string }) => ({
          ...value,
          createdAt: new Date(value.createdAt),
        })),
    });

    const { queryString } = zodql("query", userSchema).compile();

    expect(queryString).toBe(
      normalizeIndentation(`
        query {
          id
          user (id: $userId) {
            name
            createdAt
          }
        }
      `)
    );
  });

  it("resolves a chained .transform().transform() field to its underlying shape", () => {
    const userSchema = z.object({
      user: zodqlField()
        .toSchema(z.object({ name: z.string() }))
        .transform((value: { name: string }) => value)
        .transform((value: { name: string }) => value),
    });

    const { queryString } = zodql("query", userSchema).compile();

    expect(queryString).toBe(
      normalizeIndentation(`
        query {
          user {
            name
          }
        }
      `)
    );
  });

  it("resolves a z.preprocess()-wrapped object field to its underlying shape", () => {
    const userSchema = z.object({
      user: z.preprocess(
        (value) => value,
        zodqlField()
          .withArguments({ id: "$userId" })
          .toSchema(z.object({ name: z.string() }))
      ),
    });

    const { queryString } = zodql("query", userSchema).compile();

    expect(queryString).toBe(
      normalizeIndentation(`
        query {
          user (id: $userId) {
            name
          }
        }
      `)
    );
  });

  it("resolves a .refine() applied before toSchema(), keeping field metadata", () => {
    const userSchema = z.object({
      user: zodqlField()
        .withArguments({ id: "$userId" })
        .toSchema(
          z
            .object({ name: z.string(), age: z.number() })
            .refine((value) => value.age >= 0, { message: "age must be non-negative" })
        ),
    });

    const { queryString } = zodql("query", userSchema).compile();

    expect(queryString).toBe(
      normalizeIndentation(`
        query {
          user (id: $userId) {
            name
            age
          }
        }
      `)
    );
  });

  it("loses field metadata when .refine() is applied after toSchema()", () => {
    const fieldSchema = zodqlField()
      .withArguments({ id: "$userId" })
      .toSchema(z.object({ name: z.string() }));

    const userSchema = z.object({
      user: fieldSchema.refine(() => true),
    });

    const { queryString } = zodql("query", userSchema).compile();

    // The `withArguments()` call is lost because `.refine()` clones the schema
    // into a new instance that doesn't carry over zodql's symbol-keyed
    // metadata; the plain-object shape still comes through via the fallback.
    expect(queryString).toBe(
      normalizeIndentation(`
        query {
          user {
            name
          }
        }
      `)
    );
  });
});
