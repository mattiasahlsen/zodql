import z from "zod";
import { zodqlField } from "../ZodqlFieldBuilder.js";
import { zodql, zodqlFragment } from "../ZodqlBuilder.js";
import { normalizeIndentation } from "../testing/normalizeIndentation.js";

describe("regression tests", () => {
  it("handles case 1: a mutation with deeply nested fragments", () => {
    const userErrorsFragmentSchema = zodqlFragment({
      name: "UserErrorsFragment",
      on: "UserError",
      schema: z.object({
        path: z.array(z.string()).nullable(),
        message: z.string(),
      }),
    });

    const secondaryMethodFragmentSchema = zodqlFragment({
      name: "SecondaryMethodFragment",
      on: "MethodB",
      schema: z.object({
        id: z.number(),
        name: z.string(),
        kind: z.string(),
      }),
    });

    const primaryMethodFragmentSchema = zodqlFragment({
      name: "PrimaryMethodFragment",
      on: "MethodA",
      schema: z.object({
        id: z.number(),
        name: z.string(),
      }),
    });

    const widgetFragmentSchema = zodqlFragment({
      name: "WidgetFragment",
      on: "Widget",
      schema: z.object({
        id: z.number(),
        name: z.string(),
        uri: z.string().nullable(),
        entries: z.array(
          z.object({
            id: z.string(),
            name: z.string(),
            status: z.object({
              active: z.boolean(),
            }),
          })
        ),
      }),
    });

    const bundleFragmentSchema = zodqlFragment({
      name: "BundleFragment",
      on: "Bundle",
      schema: z.object({
        id: z.string(),
        lines: z.array(
          z.object({
            id: z.string(),
            quantity: z.number().positive(),
            widget: zodqlField().withFragment(widgetFragmentSchema).toSchema(z.object({})),
          })
        ),
        summary: z.object({
          location: z.object({
            line1: z.string().nullable(),
            line2: z.string().nullable(),
            zipCode: z.string().nullable(),
            city: z.string().nullable(),
            country: z.object({
              name: z.string(),
              code: z.string(),
            }),
            region: z
              .object({
                name: z.string(),
                code: z.string(),
              })
              .nullable(),
            mail: z.email().nullable(),
            firstName: z.string().nullable(),
            lastName: z.string().nullable(),
            phoneNumber: z.string().nullable(),
            secondaryPhoneNumber: z.string().nullable(),
          }),
          primaryMethod: zodqlField().withFragment(primaryMethodFragmentSchema).toSchema(z.object({})),
          secondaryMethod: zodqlField().withFragment(secondaryMethodFragmentSchema).toSchema(z.object({})),
          extras: z
            .object({
              kind: z.string(),
            })
            .array(),
        }),
      }),
    });

    const createBundleMutationDefinition = zodql(
      "mutation",
      z.object({
        createBundle: zodqlField()
          .withArguments({ input: "$input" })
          .withArguments({ quantity: "$quantity" })
          .withArguments({ externalRef: "$externalRef" })
          .withArguments({ comment: "$comment" })
          .toSchema(
            z.object({
              bundle: zodqlField().withFragment(bundleFragmentSchema).toSchema(z.object({})),
              userErrors: zodqlField().withFragment(userErrorsFragmentSchema).toSchema(z.object({})).array(),
            })
          ),
      })
    ).defineVariables({
      input: {
        schema: z.string(),
        typeName: "String!",
      },
      quantity: {
        schema: z.number().positive(),
        typeName: "Int!",
      },
      comment: {
        schema: z.string().nullable(),
        typeName: "String!",
      },
      externalRef: {
        schema: z.string().nullable(),
        typeName: "String!",
      },
    });

    const createBundleMutation = createBundleMutationDefinition.compile();

    expect(createBundleMutation.queryString).toBe(
      normalizeIndentation(`
        mutation ($input: String!, $quantity: Int!, $comment: String!, $externalRef: String!) {
          createBundle (input: $input, quantity: $quantity, externalRef: $externalRef, comment: $comment) {
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
              ...WidgetFragment
            }
          }
          summary {
            location {
              line1
              line2
              zipCode
              city
              country {
                name
                code
              }
              region {
                name
                code
              }
              mail
              firstName
              lastName
              phoneNumber
              secondaryPhoneNumber
            }
            primaryMethod {
              ...PrimaryMethodFragment
            }
            secondaryMethod {
              ...SecondaryMethodFragment
            }
            extras {
              kind
            }
          }
        }

        fragment WidgetFragment on Widget {
          id
          name
          uri
          entries {
            id
            name
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
          path
          message
        }
      `)
    );

    type CreateBundleMutationType = z.infer<typeof createBundleMutation.schema>;

    const exampleValue: CreateBundleMutationType = {
      createBundle: {
        bundle: {
          id: "d9a2a52d7c0a55cba7684624c5303d9c",
          lines: [
            {
              id: "7189cc7e877d42769ab1650bae1ae070",
              quantity: 2,
              widget: {
                id: 15630,
                name: "Sample Widget Name",
                uri: "sample-widget-slug",
                entries: [
                  { id: "15630-1", name: "Option A", status: { active: true } },
                  { id: "15630-2", name: "Option B", status: { active: true } },
                ],
              },
            },
          ],
          summary: {
            location: {
              line1: null,
              line2: null,
              zipCode: null,
              city: null,
              country: { name: "Testland", code: "TL" },
              region: null,
              mail: null,
              firstName: null,
              lastName: null,
              phoneNumber: null,
              secondaryPhoneNumber: null,
            },
            primaryMethod: { id: 42, name: "Standard Option" },
            secondaryMethod: { id: 60, name: "Method One", kind: "TYPE_A" },
            extras: [{ kind: "EXTRA_A" }],
          },
        },
        userErrors: [],
      },
    };

    expect(exampleValue).toEqual(createBundleMutation.schema.parse(exampleValue));
  });

  it("handles case 2: inline fragment mixed with a plain field on the same node", () => {
    const widgetSchema = z.object({ id: z.number() });

    const registerResourceResultSchema = z.object({
      registerResource: zodqlField()
        .withArguments({ for: "RESOURCE", uri: "$uri" })
        .withFragment({
          inline: true,
          on: "ResourceRegistrationPayload",
          schema: z.object({ widget: widgetSchema.optional() }),
        })
        .toSchema(
          z.object({
            userErrors: z.object({ message: z.string(), path: z.string().optional() }).array(),
          })
        ),
    });

    const registerResourceMutation = zodql("mutation", registerResourceResultSchema)
      .defineVariables({ uri: { schema: z.string().min(1), typeName: "String!" } })
      .compile();

    expect(registerResourceMutation.queryString).toBe(
      normalizeIndentation(`
        mutation ($uri: String!) {
          registerResource (for: RESOURCE, uri: $uri) {
            userErrors {
              message
              path
            }
            ... on ResourceRegistrationPayload {
              widget {
                id
              }
            }
          }
        }
      `)
    );

    const exampleValue: z.infer<typeof registerResourceMutation.schema> = {
      registerResource: { widget: { id: 123 }, userErrors: [] },
    };

    expect(exampleValue).toEqual(registerResourceMutation.schema.parse(exampleValue));
  });

  it("handles case 3: discriminated array elements sharing a base fragment", () => {
    const entrySchema = zodqlField()
      .withFragment({
        on: "MappedAttribute",
        schema: z.object({ id: z.number().int() }),
        inline: false,
        name: "MappedAttribute",
      })
      .toSchema(
        z.object({
          type: z.object({
            isMulti: z.boolean(),
            name: z.string().min(1),
          }),
          elements: zodqlField()
            .withFragment({
              on: "AttributeStringElement",
              inline: false,
              name: "AttributeStringElement",
              schema: z.object({
                value: z.string(),
                translations: z.object({
                  value: z.string(),
                  language: z.object({
                    code: z.string().min(1),
                    countryCode: z.string().min(1),
                    languageCode: z.string().min(1),
                  }),
                }),
              }),
            })
            .withFragment({
              on: "AttributeChoiceElement",
              inline: false,
              name: "AttributeChoiceElement",
              schema: z.object({
                value: z.object({ name: z.string(), value: z.string() }),
                values: z.array(z.object({ name: z.string(), value: z.string() })),
              }),
            })
            .toSchema(
              z.object({
                key: z.string().min(1),
                kind: z.enum(["SELECT", "INPUT", "TEXTAREA", "READONLY", "FILE", "IMAGE"]),
              })
            )
            .array(),
        })
      );

    const containerSchema = z.object({
      id: z.number().int(),
      attributes: entrySchema.array(),
    });

    const query = zodql(
      "query",
      z.object({
        container: zodqlField().withArguments({ id: "$id" }).toSchema(containerSchema),
      })
    ).defineVariables({
      id: { schema: z.number().int(), typeName: "Int!" },
    });

    const { queryString, variables, schema } = query.compile();

    expect(queryString).toBe(
      normalizeIndentation(`
        query ($id: Int!) {
          container (id: $id) {
            id
            attributes {
              type {
                isMulti
                name
              }
              elements {
                key
                kind
                ...AttributeStringElement
                ...AttributeChoiceElement
              }
              ...MappedAttribute
            }
          }
        }

        fragment MappedAttribute on MappedAttribute {
          id
        }

        fragment AttributeStringElement on AttributeStringElement {
          value
          translations {
            value
            language {
              code
              countryCode
              languageCode
            }
          }
        }

        fragment AttributeChoiceElement on AttributeChoiceElement {
          value {
            name
            value
          }
          values {
            name
            value
          }
        }
      `)
    );

    expect(variables).toMatchObject({
      id: { typeName: "Int!" },
    });

    const exampleValue: z.infer<typeof schema> = {
      container: {
        id: 123,
        attributes: [
          {
            type: { isMulti: false, name: "Color" },
            elements: [
              {
                key: "color",
                kind: "SELECT",
                value: { name: "Red", value: "red" },
                values: [
                  { name: "Red", value: "red" },
                  { name: "Blue", value: "blue" },
                ],
              },
              {
                key: "description",
                kind: "TEXTAREA",
                value: "A red container",
                translations: {
                  value: "Un contenant rouge",
                  language: { code: "fr", countryCode: "FR", languageCode: "FR" },
                },
              },
            ],
          },
        ],
      },
    };

    expect(exampleValue).toEqual(schema.parse(exampleValue));

    for (const element of exampleValue.container.attributes.flatMap((attr) => attr.elements)) {
      element satisfies {
        key: string;
        kind: "SELECT" | "INPUT" | "TEXTAREA" | "READONLY" | "FILE" | "IMAGE";
      };

      if ("values" in element) {
        element.values satisfies Array<{ name: string; value: string }>;
        element.value satisfies { name: string; value: string };
      }
    }
  });
});
