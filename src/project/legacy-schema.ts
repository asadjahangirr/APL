import { z } from 'zod';

const text = z.string().max(4000);
const image = z.string().max(3_000_000).refine(v => v === '' || /^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/.test(v), 'Upload a PNG, JPEG or WebP image.');
const anchor = z.string().regex(/^#[a-z][a-z0-9-]*$/);
export const definitions = {
  Header: z.object({ brand: text, linkLabel: text, target: anchor }).strict(),
  Hero: z.object({ eyebrow: text, title: text, description: text, image, imageAlt: text, layout: z.enum(['split', 'statement']) }).strict(),
  Services: z.object({ title: text, description: text, items: z.array(z.object({ title: text, description: text }).strict()).min(1).max(12), mobile: z.number().int().min(1).max(4), tablet: z.number().int().min(1).max(6).optional(), desktop: z.number().int().min(1).max(6).optional(), gap: z.number().int().min(8).max(64) }).strict(),
  Text: z.object({ title: text, body: text, align: z.enum(['left', 'center']) }).strict(),
  Contact: z.object({ title: text, description: text, button: text }).strict(),
  Footer: z.object({ brand: text, note: text }).strict()
};
export type ComponentProps = { [K in keyof typeof definitions]: z.infer<typeof definitions[K]> };
export type ComponentKind = keyof ComponentProps;
export type SiteNode = { [K in ComponentKind]: { id: string; type: K; props: ComponentProps[K] } }[ComponentKind];
const nodeId = z.string().regex(/^[A-Za-z0-9_-]{1,100}$/);
const node = z.discriminatedUnion('type', [
  z.object({ id: nodeId, type: z.literal('Header'), props: definitions.Header }).strict(),
  z.object({ id: nodeId, type: z.literal('Hero'), props: definitions.Hero }).strict(),
  z.object({ id: nodeId, type: z.literal('Services'), props: definitions.Services }).strict(),
  z.object({ id: nodeId, type: z.literal('Text'), props: definitions.Text }).strict(),
  z.object({ id: nodeId, type: z.literal('Contact'), props: definitions.Contact }).strict(),
  z.object({ id: nodeId, type: z.literal('Footer'), props: definitions.Footer }).strict()
]);
export const legacyProjectSchema = z.object({
  schemaVersion: z.literal(1),
  id: z.uuid(),
  name: z.string().trim().min(1).max(80),
  updatedAt: z.iso.datetime(),
  theme: z.object({ accent: z.string().regex(/^#[0-9a-fA-F]{6}$/), font: z.enum(['sans', 'humanist', 'serif']) }).strict(),
  page: z.object({
    title: z.string().min(1).max(120),
    description: z.string().max(320),
    nodes: z.array(node).min(1).max(60)
  }).strict()
}).strict().superRefine((p, ctx) => {
  const ids = p.page.nodes.map(n => n.id);
  if (new Set(ids).size !== ids.length) ctx.addIssue({ code: 'custom', message: 'Component IDs must be unique.' });
  for (const type of ['Header', 'Hero', 'Services', 'Contact', 'Footer']) {
    if (p.page.nodes.filter(n => n.type === type).length > 1) ctx.addIssue({ code: 'custom', message: 'This prototype supports one ' + type + ' section.' });
  }
});
export type Project = z.infer<typeof legacyProjectSchema>;
export function hasContact(p: Project) { return p.page.nodes.some(n => n.type === 'Contact'); }
export function filename(name: string) {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 60) || 'website';
}


