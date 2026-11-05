import { z } from 'zod';

export const pageTargetSchema = z.object({
  pageId: z.string().regex(/^[A-Za-z0-9_-]{1,100}$/),
  anchor: z.string().regex(/^#[a-z][a-z0-9-]*$/),
}).strict();
export type PageTarget = z.infer<typeof pageTargetSchema>;
const webUrl = z.string().min(1).max(2048).refine(value => {
  if (!/^https?:\/\//i.test(value) || /[\u0000-\u0020\u007f<>"'\\]/.test(value)) return false;
  try { const url = new URL(value); return ['http:', 'https:'].includes(url.protocol) && Boolean(url.hostname) && !url.username && !url.password; }
  catch { return false; }
}, 'Use a complete http:// or https:// address without credentials or control characters.');
const phone = z.string().max(30).regex(/^\+?[0-9][0-9 ()-]*$/).refine(value => {
  const digits = value.replace(/\D/g, '').length; return digits >= 3 && digits <= 20;
}, 'Use a phone number with 3–20 digits, optionally beginning with +.');
export const buttonDestinationSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('url'), value: webUrl }).strict(),
  z.object({ kind: z.literal('email'), value: z.email().max(254) }).strict(),
  z.object({ kind: z.literal('phone'), value: phone }).strict(),
  z.object({ kind: z.literal('service'), entryId: z.uuid().transform(value => value.toLowerCase()) }).strict(),
  z.object({ kind: z.literal('article'), entryId: z.uuid().transform(value => value.toLowerCase()) }).strict(),
  z.object({ kind: z.literal('portfolio'), entryId: z.uuid().transform(value => value.toLowerCase()) }).strict(),
]);
export type ButtonDestination = z.infer<typeof buttonDestinationSchema>;
