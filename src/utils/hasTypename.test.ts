import z from "zod";
import { hasTypename } from "./hasTypename.js";
import { zodqlField } from "../ZodqlFieldBuilder.js";
import { zodql, zodqlFragment } from "../ZodqlBuilder.js";
import { expectTypeof } from "../testing/assertType.js";

type Cat = { __typename: "Cat"; meow: boolean };
type Dog = { __typename: "Dog"; bark: boolean };
type Animal = Cat | Dog;

describe("hasTypename", () => {
  describe("matching", () => {
    it("returns true when __typename matches", () => {
      const obj: Animal = { __typename: "Cat", meow: true };

      expect(hasTypename(obj, "Cat")).toBe(true);
    });

    it("returns false when __typename does not match", () => {
      const obj: Animal = { __typename: "Dog", bark: true };

      expect(hasTypename(obj, "Cat")).toBe(false);
    });

    it("returns false when object has no __typename field", () => {
      const obj = { name: "unknown" };

      expect(hasTypename(obj, "Cat")).toBe(false);
    });

    it("returns false for an empty object", () => {
      expect(hasTypename({}, "Cat")).toBe(false);
    });

    it("returns false for null or undefined", () => {
      expect(hasTypename(null, "Cat")).toBe(false);
      expect(hasTypename(undefined, "Cat")).toBe(false);
    });

    it("works with objects that have extra properties", () => {
      const obj = { __typename: "Dog" as const, bark: true, age: 5 };

      expect(hasTypename(obj, "Dog")).toBe(true);
    });
  });

  describe("type narrowing", () => {
    it("narrows a plain union to the matching member", () => {
      const obj: Animal = { __typename: "Cat", meow: true };

      if (hasTypename(obj, "Cat")) {
        expect(obj.meow).toBe(true);
        expectTypeof(obj).toBe<Cat>();
      } else {
        throw new Error("Expected hasTypename to return true");
      }
    });

    it("distinguishes between members on raw GraphQL response objects", () => {
      type AdminUser = { __typename: "AdminUser"; id: string; adminId: string };
      type GuestUser = { __typename: "GuestUser"; id: string; guestId: string };
      type User = AdminUser | GuestUser;

      const admin: User = { __typename: "AdminUser", id: "1", adminId: "admin-123" };
      const guest: User = { __typename: "GuestUser", id: "2", guestId: "guest-456" };

      expect(hasTypename(admin, "AdminUser")).toBe(true);
      expect(hasTypename(admin, "GuestUser")).toBe(false);
      expect(hasTypename(guest, "GuestUser")).toBe(true);
      expect(hasTypename(guest, "AdminUser")).toBe(false);

      if (hasTypename(admin, "AdminUser")) {
        expect(admin.adminId).toBe("admin-123");
      }

      if (hasTypename(guest, "GuestUser")) {
        expect(guest.guestId).toBe("guest-456");
      }
    });
  });

  describe("integration with zodql fragments", () => {
    it("narrows a parsed regular-fragment result that carries __typename in the schema", () => {
      const adminFragment = zodqlFragment({
        name: "AdminFragment",
        on: "AdminUser",
        schema: z.object({
          adminId: z.string(),
        }),
      });
      const guestFragment = zodqlFragment({
        name: "GuestFragment",
        on: "GuestUser",
        schema: z.object({
          guestId: z.string(),
        }),
      });

      const userSchema = zodqlField()
        .withFragment(adminFragment)
        .withFragment(guestFragment)
        .toSchema(
          z.object({
            id: z.string(),
            name: z.string(),
            __typename: z.string(),
          })
        );

      const { schema } = zodql(
        "query",
        z.object({
          user: userSchema,
        })
      ).compile();

      const result = schema.parse({
        user: {
          id: "user-1",
          name: "User One",
          adminId: "admin-123",
          __typename: "AdminUser",
        },
      });

      expect(hasTypename(result.user, "AdminUser")).toBe(true);
      expect((result.user as { adminId: string }).adminId).toBe("admin-123");
    });
  });
});
