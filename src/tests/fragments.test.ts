import z from "zod";
import { zodqlField } from "../ZodqlFieldBuilder.js";
import { zodql, zodqlFragment } from "../ZodqlBuilder.js";
import { normalizeIndentation } from "../testing/normalizeIndentation.js";
import { expectTypeof } from "../testing/assertType.js";

describe("regular fragments", () => {
  describe("optional fragments (withFragment)", () => {
    it("reuses the same fragment across multiple fields", () => {
      const userFragment = zodqlFragment({
        name: "UserFragment",
        on: "User",
        schema: z.object({ name: z.string(), mail: z.string() }),
      });

      const userSchema = z.object({
        id: z.string(),
        authenticatedUser: zodqlField()
          .withFragment(userFragment)
          .toSchema(z.object({ token: z.string() })),
        guestUser: zodqlField()
          .withFragment(userFragment)
          .toSchema(z.object({ guestId: z.string() })),
      });

      const { queryString, schema } = zodql("query", z.object({ user: userSchema })).compile();

      expect(queryString).toBe(
        normalizeIndentation(`
          query {
            user {
              id
              authenticatedUser {
                token
                ...UserFragment
              }
              guestUser {
                guestId
                ...UserFragment
              }
            }
          }

          fragment UserFragment on User {
            name
            mail
          }
        `)
      );

      type UserResponse = z.infer<typeof schema>;

      const withAllFields: UserResponse = {
        user: {
          id: "user-1",
          authenticatedUser: { token: "auth-token", mail: "user-1@example.com", name: "User One" },
          guestUser: { guestId: "guest-123", mail: "guest@example.com", name: "Guest User" },
        },
      };
      expect(schema.parse(withAllFields)).toEqual(withAllFields);

      const withPartialFragmentData: UserResponse = {
        user: {
          id: "user-1",
          authenticatedUser: { token: "auth-token" },
          guestUser: { guestId: "guest-123", mail: "guest@example.com", name: "Guest User" },
        },
      };
      expect(schema.parse(withPartialFragmentData)).toEqual(withPartialFragmentData);

      const withNoFragmentData: UserResponse = {
        user: {
          id: "user-1",
          authenticatedUser: { token: "auth-token" },
          guestUser: { guestId: "guest-123" },
        },
      };
      expect(schema.parse(withNoFragmentData)).toEqual(withNoFragmentData);

      expectTypeof(withAllFields).toExtend<{
        user: {
          id: string;
          authenticatedUser: { token: string; name?: string | undefined; mail?: string | undefined };
          guestUser: { guestId: string; name?: string | undefined; mail?: string | undefined };
        };
      }>();
    });

    it("does not duplicate a fragment definition used on multiple fields", () => {
      const userFragment = zodqlFragment({
        name: "UserFragment",
        on: "User",
        schema: z.object({ name: z.string(), mail: z.string() }),
      });

      const userSchema = z.object({
        id: z.string(),
        friend1: zodqlField()
          .withFragment(userFragment)
          .toSchema(z.object({ id: z.string() })),
        friend2: zodqlField()
          .withFragment(userFragment)
          .toSchema(z.object({ id: z.string() })),
      });

      const { queryString } = zodql("query", z.object({ user: userSchema })).compile();

      expect(queryString).toBe(
        normalizeIndentation(`
          query {
            user {
              id
              friend1 {
                id
                ...UserFragment
              }
              friend2 {
                id
                ...UserFragment
              }
            }
          }

          fragment UserFragment on User {
            name
            mail
          }
        `)
      );
    });

    it("applies a fragment to an array field", () => {
      const query = zodql(
        "query",
        z.object({
          users: zodqlField()
            .withFragment({
              name: "UserFragment",
              on: "User",
              schema: z.object({ name: z.string(), mail: z.string() }),
            })
            .toSchema(z.object({ id: z.string() }))
            .array(),
        })
      );

      const { queryString, schema } = query.compile();

      expect(queryString).toBe(
        normalizeIndentation(`
          query {
            users {
              id
              ...UserFragment
            }
          }

          fragment UserFragment on User {
            name
            mail
          }
        `)
      );

      const exampleValue: z.infer<typeof schema> = {
        users: [
          { id: "user-1", name: "User One", mail: "user@example.com" },
          { id: "user-2", name: "User Two", mail: "user2@example.com" },
        ],
      };
      expect(exampleValue).toEqual(schema.parse(exampleValue));

      expectTypeof(exampleValue).toExtend<{
        users: Array<{ id: string; name?: string | undefined; mail?: string | undefined }>;
      }>();
    });
  });

  describe("required fragments (withRequiredFragment)", () => {
    it("infers fragment fields as required on the parsed type", () => {
      const userFragment = zodqlFragment({
        name: "UserFragment",
        on: "User",
        schema: z.object({ name: z.string(), mail: z.string() }),
      });

      const userSchema = z.object({
        id: z.string(),
        friend: zodqlField()
          .withRequiredFragment(userFragment)
          .toSchema(z.object({ id: z.string() })),
      });

      const query = zodql("query", z.object({ user: userSchema })).compile();

      expect(query.queryString).toBe(
        normalizeIndentation(`
          query {
            user {
              id
              friend {
                id
                ...UserFragment
              }
            }
          }

          fragment UserFragment on User {
            name
            mail
          }
        `)
      );

      type User = z.infer<typeof query.schema>;

      const exampleValue: User = {
        user: {
          id: "user-1",
          friend: { id: "friend-1", name: "Friend Name", mail: "friend@example.com" },
        },
      };
      expect(exampleValue).toEqual(query.schema.parse(exampleValue));

      expectTypeof(exampleValue).toBe<{
        user: { id: string; friend: { id: string; name: string; mail: string } };
      }>();
    });

    it("throws when a required fragment's fields are missing from the data", () => {
      const userFragment = zodqlFragment({
        name: "UserFragment",
        on: "User",
        schema: z.object({ name: z.string(), mail: z.string() }),
      });

      const userSchema = z.object({
        id: z.string(),
        friend: zodqlField()
          .withRequiredFragment(userFragment)
          .toSchema(z.object({ id: z.string() })),
      });

      const query = zodql("query", z.object({ user: userSchema })).compile();

      const exampleValue: z.infer<typeof query.schema> = {
        user: { id: "user-1", friend: { id: "friend-1" } as any },
      };
      expect(() => query.schema.parse(exampleValue)).toThrow("Invalid input");
    });

    it("works inside an array field", () => {
      const userFragment = zodqlFragment({
        name: "UserFragment",
        on: "User",
        schema: z.object({ name: z.string() }),
      });

      const userSchema = z.object({
        id: z.string(),
        friends: zodqlField()
          .withRequiredFragment(userFragment)
          .toSchema(z.object({ id: z.string() }))
          .array(),
      });

      const { queryString, schema } = zodql("query", z.object({ user: userSchema })).compile();

      expect(queryString).toBe(
        normalizeIndentation(`
          query {
            user {
              id
              friends {
                id
                ...UserFragment
              }
            }
          }

          fragment UserFragment on User {
            name
          }
        `)
      );

      const exampleValue: z.infer<typeof schema> = {
        user: {
          id: "user-1",
          friends: [
            { id: "friend-1", name: "Friend One" },
            { id: "friend-2", name: "Friend Two" },
          ],
        },
      };
      expect(schema.parse(exampleValue)).toEqual(exampleValue);
    });

    it("works when the field itself is optional", () => {
      const userFragment = zodqlFragment({
        name: "UserFragment",
        on: "User",
        schema: z.object({ name: z.string(), mail: z.string() }),
      });

      const userSchema = z.object({
        id: z.string(),
        friend: zodqlField()
          .withRequiredFragment(userFragment)
          .toSchema(z.object({ id: z.string() }))
          .optional(),
      });

      const { queryString, schema } = zodql("query", z.object({ user: userSchema })).compile();

      expect(queryString).toBe(
        normalizeIndentation(`
          query {
            user {
              id
              friend {
                id
                ...UserFragment
              }
            }
          }

          fragment UserFragment on User {
            name
            mail
          }
        `)
      );

      type UserResponse = z.infer<typeof schema>;
      const withoutFriend: UserResponse = { user: { id: "user-1", friend: undefined } };
      expect(schema.parse(withoutFriend)).toEqual(withoutFriend);

      expect(() => schema.parse({ user: { id: "user-1", friend: { id: "friend-1" } } })).toThrow("Invalid input");

      const withFriend: UserResponse = {
        user: { id: "user-1", friend: { id: "friend-1", name: "Friend Name", mail: "abc@example.com" } },
      };
      expect(schema.parse(withFriend)).toEqual(withFriend);
    });

    it("can be combined with an optional fragment on the same field for different requiredness", () => {
      const userFragment = zodqlFragment({
        name: "UserFragment",
        on: "User",
        schema: z.object({ name: z.string(), mail: z.string() }),
      });

      const userSchema = z.object({
        id: z.string(),
        friendOptional: zodqlField()
          .withFragment(userFragment)
          .toSchema(z.object({ id: z.string() })),
        friendRequired: zodqlField()
          .withRequiredFragment(userFragment)
          .toSchema(z.object({ id: z.string() })),
      });

      const { queryString, schema } = zodql("query", z.object({ user: userSchema })).compile();

      expect(queryString).toBe(
        normalizeIndentation(`
          query {
            user {
              id
              friendOptional {
                id
                ...UserFragment
              }
              friendRequired {
                id
                ...UserFragment
              }
            }
          }

          fragment UserFragment on User {
            name
            mail
          }
        `)
      );

      const exampleValue: z.infer<typeof schema> = {
        user: {
          id: "user-1",
          friendOptional: { id: "friend-1" },
          friendRequired: { id: "friend-2", name: "Friend Two", mail: "test@example.com" },
        },
      };
      expect(schema.parse(exampleValue)).toEqual(exampleValue);
    });
  });

  describe("inline fragments", () => {
    it("applies multiple inline fragments, merging fields when several match", () => {
      const userSchema = z.object({
        id: z.string(),
        profile: zodqlField()
          .withFragment({ on: "User", inline: true, schema: z.object({ name: z.string(), mail: z.string() }) })
          .withFragment({ on: "Admin", inline: true, schema: z.object({ adminLevel: z.number() }) })
          .toSchema(z.object({ bio: z.string() })),
      });

      const { queryString, schema } = zodql("query", z.object({ user: userSchema })).compile();

      expect(queryString).toBe(
        normalizeIndentation(`
          query {
            user {
              id
              profile {
                bio
                ... on User {
                  name
                  mail
                }
                ... on Admin {
                  adminLevel
                }
              }
            }
          }
        `)
      );

      const userProfile: z.infer<typeof schema> = {
        user: { id: "user-1", profile: { bio: "This is my bio", name: "User One", mail: "user-1@example.com" } },
      };
      expect(schema.parse(userProfile)).toEqual(userProfile);

      const adminProfile: z.infer<typeof schema> = {
        user: { id: "user-2", profile: { bio: "This is my bio", adminLevel: 5 } },
      };
      expect(schema.parse(adminProfile)).toEqual(adminProfile);

      const bothMatch: z.infer<typeof schema> = {
        user: {
          id: "user-3",
          profile: {
            bio: "This is my bio",
            name: "User One",
            mail: "user-1@example.com",
            adminLevel: 5,
          } as any,
        },
      };
      expect(schema.parse(bothMatch)).toEqual({
        user: {
          id: "user-3",
          profile: { bio: "This is my bio", name: "User One", mail: "user-1@example.com", adminLevel: 5 },
        },
      });

      expectTypeof(userProfile).toExtend<{
        user: {
          id: string;
          profile: {
            bio: string;
            name?: string | undefined;
            mail?: string | undefined;
            adminLevel?: number | undefined;
          };
        };
      }>();
    });
  });

  describe("combining named and inline fragments", () => {
    it("emits both a named-fragment spread and an inline fragment on the same field", () => {
      const profileFragment = zodqlFragment({
        on: "Profile",
        name: "ProfileFragment",
        schema: z.object({ name: z.string(), mail: z.string() }),
      });

      const userSchema = z.object({
        id: z.string(),
        profile: zodqlField()
          .withFragment(profileFragment)
          .withFragment({ on: "Admin", schema: z.object({ adminLevel: z.number() }), inline: true })
          .toSchema(z.object({ bio: z.string() })),
      });

      const { queryString, schema } = zodql("query", z.object({ user: userSchema })).compile();

      expect(queryString).toBe(
        normalizeIndentation(`
          query {
            user {
              id
              profile {
                bio
                ...ProfileFragment
                ... on Admin {
                  adminLevel
                }
              }
            }
          }

          fragment ProfileFragment on Profile {
            name
            mail
          }
        `)
      );

      const exampleValue: z.infer<typeof schema> = {
        user: { id: "user-1", profile: { bio: "This is my bio", name: "User One", mail: "user-1@example.com" } },
      };
      expect(exampleValue).toEqual(schema.parse(exampleValue));

      expectTypeof(exampleValue).toExtend<{
        user: {
          id: string;
          profile: {
            bio: string;
            name?: string | undefined;
            mail?: string | undefined;
            adminLevel?: number | undefined;
          };
        };
      }>();
    });
  });

  describe("complex nesting", () => {
    it("resolves fragments referenced through nested fields, defining each once at the end of the document", () => {
      const mailFragment = zodqlFragment({
        name: "mailFragment",
        on: "mail",
        schema: z.object({ mail: z.string() }),
      });

      const userInfoFragment = zodqlFragment({
        name: "UserInfoFragment",
        on: "User",
        schema: z.object({
          primarymail: zodqlField()
            .withRequiredFragment(mailFragment)
            .toSchema(z.object({ id: z.string() })),
          mail1: zodqlField().withFragment(mailFragment).toSchema(z.object({})),
          mail2: zodqlField()
            .withFragment({
              name: "mailFragment",
              on: "mail",
              inline: true,
              schema: z.object({ mail: z.string() }),
            })
            .toSchema(z.object({ isVerified: z.boolean() })),
          mail4: zodqlField()
            .withRequiredFragment({
              name: "mailFragment",
              on: "mail",
              schema: z.object({ mail: z.string() }),
            })
            .toSchema(z.object({ id: z.string() })),
          mail5: zodqlField()
            .withRequiredFragment({
              name: "mailFragment",
              on: "mail",
              schema: z.object({ mail: z.string() }),
              inline: true,
            })
            .toSchema(z.object({ id: z.string() })),
        }),
      });

      const friendFragment = zodqlFragment({
        name: "FriendFragment",
        on: "Friend",
        schema: z.object({
          name: z.string(),
          userInfo: zodqlField()
            .withRequiredFragment(userInfoFragment)
            .toSchema(z.object({ id: z.string() })),
        }),
      });

      const userSchema = z.object({
        id: z.string(),
        friend: zodqlField()
          .withRequiredFragment(friendFragment)
          .toSchema(
            z.object({
              friendOfFriend: zodqlField()
                .withFragment(friendFragment)
                .toSchema(z.object({ id: z.string() })),
            })
          ),
        userInfo: zodqlField()
          .withRequiredFragment(userInfoFragment)
          .toSchema(z.object({ id: z.string() })),
        otherFriends: zodqlField().withFragment(friendFragment).toSchema(z.object({})).array(),
        requiredFriends: zodqlField().withRequiredFragment(friendFragment).toSchema(z.object({})).array(),
      });

      const { queryString, schema } = zodql("query", z.object({ user: userSchema })).compile();

      expect(queryString).toBe(
        normalizeIndentation(`
          query {
            user {
              id
              friend {
                friendOfFriend {
                  id
                  ...FriendFragment
                }
                ...FriendFragment
              }
              userInfo {
                id
                ...UserInfoFragment
              }
              otherFriends {
                ...FriendFragment
              }
              requiredFriends {
                ...FriendFragment
              }
            }
          }

          fragment FriendFragment on Friend {
            name
            userInfo {
              id
              ...UserInfoFragment
            }
          }

          fragment UserInfoFragment on User {
            primarymail {
              id
              ...mailFragment
            }
            mail1 {
              ...mailFragment
            }
            mail2 {
              isVerified
              ... on mail {
                mail
              }
            }
            mail4 {
              id
              ...mailFragment
            }
            mail5 {
              id
              ... on mail {
                mail
              }
            }
          }

          fragment mailFragment on mail {
            mail
          }
        `)
      );

      const userInfo = {
        id: "uinfo-fof-1",
        primarymail: { id: "mail-fof-1", mail: "test@example.com" },
        mail1: { mail: "test@example.com" },
        mail2: { isVerified: true, mail: "test@example.com" },
        mail4: { id: "mail4-fof-1", mail: "test@example.com" },
        mail5: { id: "mail5-fof-1", mail: "test@example.com" },
      } as const;
      const friend = { name: "Casual Friend", userInfo } as const;

      const exampleValue: z.infer<typeof schema> = {
        user: {
          id: "user-1",
          otherFriends: [friend],
          requiredFriends: [friend, friend],
          userInfo,
          friend: {
            friendOfFriend: { id: "fof-1", name: "Friend of Friend", userInfo },
            name: "Best Friend",
            userInfo,
          },
        },
      };

      expect(exampleValue).toEqual(schema.parse(exampleValue));

      interface UserInfo {
        id: string;
        primarymail: { id: string; mail: string };
        mail1: { mail?: string };
        mail2: { mail?: string; isVerified: boolean };
        mail4: { id: string; mail: string };
        mail5: { id: string; mail: string };
      }

      interface Friend {
        name: string;
        userInfo: UserInfo & { id: string };
      }

      expectTypeof(exampleValue).toExtend<{
        user: {
          id: string;
          friend: { friendOfFriend: { id: string } & Partial<Friend> };
          userInfo: UserInfo & { id: string };
          otherFriends: Array<Partial<Friend>>;
          requiredFriends: Array<Friend>;
        };
      }>();
    });

    it("supports fragments nested several levels deep, including an inline fragment nested inside a sub-object", () => {
      const bundleWidgetFragment = zodqlFragment({
        name: "BundleWidgetFragment",
        on: "Widget",
        schema: z.object({
          id: z.number(),
          name: z.string(),
          uri: z.string(),
          entries: z.array(
            z.object({
              name: z.string(),
              id: z.string(),
              status: z.object({ active: z.boolean() }),
            })
          ),
        }),
      });

      const primaryMethodFragment = zodqlFragment({
        name: "PrimaryMethodFragment",
        on: "MethodA",
        schema: z.object({ id: z.number(), name: z.string() }),
      });

      const secondaryMethodFragment = zodqlFragment({
        name: "SecondaryMethodFragment",
        on: "MethodB",
        schema: z.object({ id: z.number(), name: z.string(), kind: z.string() }),
      });

      const userErrorsFragment = zodqlFragment({
        name: "UserErrorsFragment",
        on: "UserError",
        schema: z.object({ message: z.string(), path: z.string() }),
      });

      const bundleFragment = zodqlFragment({
        name: "BundleFragment",
        on: "Bundle",
        schema: z.object({
          id: z.string(),
          lines: z.array(
            z.object({
              id: z.string(),
              quantity: z.number(),
              widget: zodqlField().withFragment(bundleWidgetFragment).toSchema(z.object({})),
            })
          ),
          summary: z.object({
            location: z.object({ line1: z.string().nullable() }),
            primaryMethod: zodqlField().withFragment(primaryMethodFragment).toSchema(z.object({})),
            secondaryMethod: zodqlField().withFragment(secondaryMethodFragment).toSchema(z.object({})),
            extras: zodqlField()
              .withFragment({
                on: "ExtraTypeA",
                inline: true,
                schema: z
                  .object({
                    token: z.string(),
                    flagA: z.boolean(),
                    flagB: z.boolean(),
                  })
                  .partial(),
              })
              .toSchema(z.object({ kind: z.string() })),
          }),
        }),
      });

      const query = zodql(
        "mutation",
        z.object({
          createBundle: zodqlField()
            .withArguments({ input: "$input" })
            .toSchema(
              z.object({
                bundle: zodqlField().withFragment(bundleFragment).toSchema(z.object({})),
                userErrors: zodqlField().withFragment(userErrorsFragment).toSchema(z.object({})).array(),
              })
            ),
        })
      ).defineVariables({ input: { schema: z.string(), typeName: "String!" } });

      const { queryString, schema } = query.compile();

      expect(queryString).toBe(
        normalizeIndentation(`
          mutation ($input: String!) {
            createBundle (input: $input) {
              bundle {
                ...BundleFragment
              }
              userErrors {
                ...UserErrorsFragment
              }
            }
          }

          fragment BundleFragment on Bundle {
            id
            lines {
              id
              quantity
              widget {
                ...BundleWidgetFragment
              }
            }
            summary {
              location {
                line1
              }
              primaryMethod {
                ...PrimaryMethodFragment
              }
              secondaryMethod {
                ...SecondaryMethodFragment
              }
              extras {
                kind
                ... on ExtraTypeA {
                  token
                  flagA
                  flagB
                }
              }
            }
          }

          fragment BundleWidgetFragment on Widget {
            id
            name
            uri
            entries {
              name
              id
              status {
                active
              }
            }
          }

          fragment PrimaryMethodFragment on MethodA {
            id
            name
          }

          fragment SecondaryMethodFragment on MethodB {
            id
            name
            kind
          }

          fragment UserErrorsFragment on UserError {
            message
            path
          }
        `)
      );

      const exampleValue: z.infer<typeof schema> = {
        createBundle: {
          bundle: {
            id: "bundle-1",
            lines: [
              {
                id: "line-1",
                quantity: 2,
                widget: {
                  id: 101,
                  name: "Widget One",
                  uri: "/widget-one",
                  entries: [{ name: "Entry A", id: "entry-a", status: { active: true } }],
                },
              },
            ],
            summary: {
              location: { line1: "123 Main St" },
              primaryMethod: { id: 201, name: "Option One" },
              secondaryMethod: { id: 301, name: "Method One", kind: "TypeA" },
              extras: {
                kind: "ExtraTypeA",
                token: "token-xyz",
                flagA: true,
                flagB: false,
              },
            },
          },
          userErrors: [{ message: "Error message", path: "lineItems" }],
        },
      };

      expect(exampleValue).toEqual(schema.parse(exampleValue));
    });
  });

  describe("type narrowing", () => {
    it("narrows the union member using an `in` check against a fragment-only field", () => {
      const adminUserFragment = zodqlFragment({
        name: "AdminUserFragment",
        on: "AdminUser",
        schema: z.object({ adminId: z.string() }),
      });
      const guestUserFragment = zodqlFragment({
        name: "GuestUserFragment",
        on: "GuestUser",
        schema: z.object({ guestId: z.string() }),
      });

      const userSchema = zodqlField()
        .withFragment(adminUserFragment)
        .withFragment(guestUserFragment)
        .toSchema(z.object({ id: z.string(), name: z.string() }));

      const { schema } = zodql("query", z.object({ user: userSchema })).compile();

      const result = schema.parse({
        user: { id: "user-1", name: "User One", adminId: "admin-123" },
      });

      if ("adminId" in result.user) {
        expectTypeof(result.user.adminId).toBe<string>();
      } else {
        throw new Error("Expected user to be of type AdminUser");
      }
    });
  });
});
