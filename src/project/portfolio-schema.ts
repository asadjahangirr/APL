import { z } from 'zod';
import { pageTargetSchema } from './link-schema';

/** Links are navigated by visitors; the builder/backend never fetches them. */
export function safeProjectUrl(value: string) {
  if (!value || value.length > 2048 || /[\s\u0000-\u001f\u007f\\]/u.test(value)) return false;
  const authority = value.match(/^https?:\/\/([^/?#]+)/i)?.[1];
  if (!authority || /[@%]/.test(authority)) return false;
  const port = authority.startsWith("[")
    ? authority.slice(authority.indexOf("]") + 1)
    : authority.includes(":") ? authority.slice(authority.indexOf(":")) : "";
  if (port && (!/^:[0-9]{1,5}$/.test(port) || Number(port.slice(1)) > 65535)) return false;
  try {
    const url = new URL(value);
    return (url.protocol === "https:" || url.protocol === "http:") &&
      Boolean(url.hostname) && !url.username && !url.password;
  } catch {
    return false;
  }
}

export const portfolioPayloadSchema = z.object({
  title: z.string().max(120),
  summary: z.string().max(320),
  category: z.string().max(80),
  externalUrl: z.string().max(2048).refine(value => value === '' || safeProjectUrl(value), 'Use a complete http:// or https:// website address without credentials or spaces.'),
  target: pageTargetSchema.optional(),
  image: z.string().max(2_666_700).refine(value => value === '' || /^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/.test(value), 'Upload a PNG, JPEG or WebP image.'),
  imageAlt: z.string().max(240),
}).strict();
export const publishedPortfolioSchema = portfolioPayloadSchema.refine(
  value => value.title.trim().length > 0 && (Boolean(value.target) || safeProjectUrl(value.externalUrl)),
  'Publishing requires a title and a page destination or complete website link.',
);
export const portfolioEntrySchema = z.object({
  id: z.uuid().transform(value => value.toLowerCase()),
  draft: portfolioPayloadSchema,
  published: publishedPortfolioSchema.nullable(),
  revision: z.number().int().min(1),
  publishedRevision: z.number().int().min(1).nullable(),
}).strict().superRefine((entry, context) => {
  if (Boolean(entry.published) !== Boolean(entry.publishedRevision) || (entry.publishedRevision || 0) > entry.revision)
    context.addIssue({ code: 'custom', message: 'Invalid portfolio publication revision.' });
});
export type PortfolioPayload = z.infer<typeof portfolioPayloadSchema>;
export type PortfolioEntry = z.infer<typeof portfolioEntrySchema>;
export type PublicPortfolio = PortfolioPayload & { id: string; href?: string };
export const emptyPortfolio = (): PortfolioPayload => ({
  title: '', summary: '', category: '', externalUrl: '', image: '', imageAlt: '',
});
