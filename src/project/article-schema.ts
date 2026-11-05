import { z } from "zod";
const image = z
  .string()
  .max(3_000_000)
  .refine(
    (value) =>
      value === "" ||
      (value.length <= 2_666_700 &&
        /^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/.test(value)),
    "Use an uploaded PNG, JPEG or WebP image.",
  );
export const articlePayloadSchema = z
  .object({
    title: z.string().max(120),
    slug: z
      .string()
      .max(80)
      .regex(/^(?:[a-z0-9]+(?:-[a-z0-9]+)*)?$/),
    summary: z.string().max(320),
    body: z.string().max(12000),
    image,
    imageAlt: z.string().max(240),
  })
  .strict();
export const publishedArticleSchema = articlePayloadSchema.refine(
  (value) => value.title.trim().length > 0 && value.slug.length > 0,
  "A published article needs a title and URL slug.",
);
export const articleEntrySchema = z
  .object({
    id: z.uuid().transform(value => value.toLowerCase()),
    draft: articlePayloadSchema,
    published: publishedArticleSchema.nullable(),
    revision: z.number().int().min(1),
    publishedRevision: z.number().int().min(1).nullable(),
  })
  .strict()
  .superRefine((entry, ctx) => {
    if (
      Boolean(entry.published) !== Boolean(entry.publishedRevision) ||
      (entry.publishedRevision || 0) > entry.revision
    )
      ctx.addIssue({
        code: "custom",
        message: "Invalid article publication revision.",
      });
  });
export type ArticlePayload = z.infer<typeof articlePayloadSchema>;
export type ArticleEntry = z.infer<typeof articleEntrySchema>;
export type PublicArticle = ArticlePayload & { id: string };
export const emptyArticle = (): ArticlePayload => ({
  title: "",
  slug: "",
  summary: "",
  body: "",
  image: "",
  imageAlt: "",
});
