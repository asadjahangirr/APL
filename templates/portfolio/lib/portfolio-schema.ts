import { z } from "zod";
import { isPortfolioUrl } from "./portfolio-url.mjs";

export const portfolioIdSchema = z.string().uuid();
export const portfolioImageSchema = z.union([
  z.literal(""),
  z.string().regex(/^[0-9a-f-]{36}\/[0-9a-f-]{36}\.webp$/),
  z.string().regex(/^[0-9a-f-]{36}\/seed-[0-9a-f]{64}\.webp$/),
]);
const pageTargetSchema = z.object({
  pageId: z.string().regex(/^[A-Za-z0-9_-]{1,100}$/),
  anchor: z.string().regex(/^#[a-z][a-z0-9-]*$/),
}).strict();
export const portfolioPayloadSchema = z.object({
  title: z.string().max(120),
  summary: z.string().max(320),
  category: z.string().max(80),
  externalUrl: z.string().max(2048).refine(value => value === "" || isPortfolioUrl(value), {
    message: "Enter a complete HTTP or HTTPS project URL without credentials or spaces.",
  }),
  target: pageTargetSchema.optional(),
  image: portfolioImageSchema,
  imageAlt: z.string().max(240),
}).strict();
export const publishedPortfolioSchema = portfolioPayloadSchema.refine(
  value => value.title.trim().length > 0 && (Boolean(value.target) || isPortfolioUrl(value.externalUrl)),
  { message: "A title and a valid page or project URL are required before publishing." },
);
export const portfolioEntrySchema = z.object({
  id: portfolioIdSchema,
  draft: portfolioPayloadSchema,
  published: publishedPortfolioSchema.nullable(),
  revision: z.number().int().positive().max(Number.MAX_SAFE_INTEGER),
  publishedRevision: z.number().int().positive().max(Number.MAX_SAFE_INTEGER).nullable(),
}).strict().refine(value => value.published
  ? value.publishedRevision !== null && value.publishedRevision <= value.revision
  : value.publishedRevision === null,
{ message: "The published revision must belong to this saved project." });
export type PortfolioPayload = z.infer<typeof portfolioPayloadSchema>;
export type PortfolioEntry = z.infer<typeof portfolioEntrySchema>;
const revision = z.number().int().positive().max(Number.MAX_SAFE_INTEGER);
export const portfolioMutationSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("create"), id: portfolioIdSchema, draft: portfolioPayloadSchema }).strict(),
  z.object({ action: z.literal("save"), id: portfolioIdSchema, expectedRevision: revision, draft: portfolioPayloadSchema }).strict(),
  z.object({ action: z.literal("publish"), id: portfolioIdSchema, expectedRevision: revision }).strict(),
  z.object({ action: z.literal("unpublish"), id: portfolioIdSchema, expectedRevision: revision }).strict(),
]);
