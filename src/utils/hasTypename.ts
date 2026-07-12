/**
 * Type guard that checks whether an object's `__typename` field matches a
 * given GraphQL type name, narrowing the input union to the matching member(s).
 *
 * Safely handles `null` and `undefined` inputs by returning `false`, which is
 * useful for nullable GraphQL union/interface fields.
 *
 * @typeParam T - The string literal type of the expected `__typename` value.
 * @typeParam Obj - The object (or union of objects) to narrow.
 *
 * @param obj - The object to check. May be `null` or `undefined`.
 * @param typename - The expected `__typename` string to match against.
 * @returns `true` if `obj` has a `__typename` field equal to `typename`,
 *   narrowing the type to the matching union member.
 *
 * @example
 * ```typescript
 * type AdminUser = { __typename: "AdminUser"; adminId: string };
 * type GuestUser = { __typename: "GuestUser"; guestId: string };
 * type User = AdminUser | GuestUser;
 *
 * const user: User = getUser();
 *
 * if (hasTypename(user, "AdminUser")) {
 *   // user is narrowed to AdminUser
 *   console.log(user.adminId);
 * }
 *
 * // Safe with nullable values
 * const maybeUser: User | null = getNullableUser();
 * if (hasTypename(maybeUser, "GuestUser")) {
 *   console.log(maybeUser.guestId);
 * }
 * ```
 */
export function hasTypename<T extends string, Obj extends object>(
  obj: Obj | null | undefined,
  typename: T
): obj is Extract<Obj, { __typename: T }> {
  return (
    obj != null &&
    typeof obj === "object" &&
    "__typename" in obj &&
    (obj as unknown as { __typename: string }).__typename === typename
  );
}
