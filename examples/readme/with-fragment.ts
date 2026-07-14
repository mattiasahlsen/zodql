import { zodql, zodqlField, zodqlFragment } from "@mattiasahlsen/zodql";
import { z } from "zod";

const imageFragment = zodqlFragment({
  name: "ImageFields",
  on: "Image",
  schema: z.object({
    url: z.string(),
    width: z.number(),
  }),
  inline: false,
});

const mediaQuery = zodql(
  "query",
  z.object({
    media: zodqlField()
      .withFragment(imageFragment)
      .toSchema(z.object({ id: z.string() })),
  })
).compile();
export default mediaQuery;

// The fragment's fields are optional on the parsed result
export type Media = z.infer<typeof mediaQuery.schema>["media"];
