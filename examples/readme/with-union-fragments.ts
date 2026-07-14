import { zodql, zodqlField, zodqlFragment } from "@mattiasahlsen/zodql";
import { z } from "zod";

const imageFragment = zodqlFragment({
  name: "ImageFields",
  on: "Image",
  schema: z.object({ url: z.string(), width: z.number() }),
  inline: false,
});

const videoFragment = zodqlFragment({
  name: "VideoFields",
  on: "Video",
  schema: z.object({ url: z.string(), duration: z.number() }),
  inline: false,
});

const mediaQuery = zodql(
  "query",
  z.object({
    media: zodqlField()
      .withUnionFragments([imageFragment, videoFragment], { requireOne: true })
      .toSchema(z.object({ id: z.string() })),
  })
).compile();
export default mediaQuery;

// The parsed result is a discriminated union on `__typename`
export type Media = z.infer<typeof mediaQuery.schema>["media"];
