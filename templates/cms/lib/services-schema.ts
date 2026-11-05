import { z } from "zod";

export const serviceIdSchema = z.string().uuid();
export const serviceSlugSchema = z
  .string()
  .min(1)
  .max(80)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);
export const serviceImageSchema = z.union([
  z.literal(""),
  z.string().regex(/^[0-9a-f-]{36}\/[0-9a-f-]{36}\.webp$/),
  z.string().regex(/^[0-9a-f-]{36}\/seed-[0-9a-f]{64}\.webp$/),
]);
export const servicePayloadSchema = z
  .object({
    title: z.string().max(120),
    slug: z.union([z.literal(""), serviceSlugSchema]),
    summary: z.string().max(320),
    body: z.string().max(12000),
    image: serviceImageSchema,
    imageAlt: z.string().max(240),
  })
  .strict();
export const publishedServiceSchema = servicePayloadSchema.refine(
  (value) => value.title.trim().length > 0 && value.slug.length > 0,
  {
    message: "A title and a URL slug are required before publishing.",
  },
);
export const serviceEntrySchema = z
  .object({
    id: serviceIdSchema,
    draft: servicePayloadSchema,
    published: publishedServiceSchema.nullable(),
    revision: z.number().int().positive().max(Number.MAX_SAFE_INTEGER),
    publishedRevision: z
      .number()
      .int()
      .positive()
      .max(Number.MAX_SAFE_INTEGER)
      .nullable(),
  })
  .strict();
export type ServicePayload = z.infer<typeof servicePayloadSchema>;
export type ServiceEntry = z.infer<typeof serviceEntrySchema>;

export const serviceMutationSchema = z.discriminatedUnion("action", [
  z
    .object({
      action: z.literal("create"),
      id: serviceIdSchema,
      draft: servicePayloadSchema,
    })
    .strict(),
  z
    .object({
      action: z.literal("save"),
      id: serviceIdSchema,
      expectedRevision: z.number().int().positive(),
      draft: servicePayloadSchema,
    })
    .strict(),
  z
    .object({
      action: z.literal("publish"),
      id: serviceIdSchema,
      expectedRevision: z.number().int().positive(),
    })
    .strict(),
  z
    .object({
      action: z.literal("unpublish"),
      id: serviceIdSchema,
      expectedRevision: z.number().int().positive(),
    })
    .strict(),
]);
