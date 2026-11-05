import { z } from "zod";

export const articleIdSchema = z.string().uuid();
export const articleSlugSchema = z
  .string()
  .min(1)
  .max(80)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);
export const articleImageSchema = z.union([
  z.literal(""),
  z.string().regex(/^[0-9a-f-]{36}\/[0-9a-f-]{36}\.webp$/),
  z.string().regex(/^[0-9a-f-]{36}\/seed-[0-9a-f]{64}\.webp$/),
]);
export const articlePayloadSchema = z
  .object({
    title: z.string().max(120),
    slug: z.union([z.literal(""), articleSlugSchema]),
    summary: z.string().max(320),
    body: z.string().max(12000),
    image: articleImageSchema,
    imageAlt: z.string().max(240),
  })
  .strict();
export const publishedArticleSchema = articlePayloadSchema.refine(
  (value) => value.title.trim().length > 0 && value.slug.length > 0,
  {
    message: "A title and a URL slug are required before publishing.",
  },
);
export const articleEntrySchema = z
  .object({
    id: articleIdSchema,
    draft: articlePayloadSchema,
    published: publishedArticleSchema.nullable(),
    revision: z.number().int().positive().max(Number.MAX_SAFE_INTEGER),
    publishedRevision: z
      .number()
      .int()
      .positive()
      .max(Number.MAX_SAFE_INTEGER)
      .nullable(),
  })
  .strict();
export type ArticlePayload = z.infer<typeof articlePayloadSchema>;
export type ArticleEntry = z.infer<typeof articleEntrySchema>;

export const articleMutationSchema = z.discriminatedUnion("action", [
  z
    .object({
      action: z.literal("create"),
      id: articleIdSchema,
      draft: articlePayloadSchema,
    })
    .strict(),
  z
    .object({
      action: z.literal("save"),
      id: articleIdSchema,
      expectedRevision: z.number().int().positive(),
      draft: articlePayloadSchema,
    })
    .strict(),
  z
    .object({
      action: z.literal("publish"),
      id: articleIdSchema,
      expectedRevision: z.number().int().positive(),
    })
    .strict(),
  z
    .object({
      action: z.literal("unpublish"),
      id: articleIdSchema,
      expectedRevision: z.number().int().positive(),
    })
    .strict(),
]);
