import { z } from 'zod';

const text = z.string().max(4000);
const image = z.string().max(3_000_000).refine(v => v === '' || /^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/.test(v), 'Upload a PNG, JPEG or WebP image.');
const anchor = z.string().regex(/^#[a-z][a-z0-9-]*$/);
const nodeId = z.string().regex(/^[A-Za-z0-9_-]{1,100}$/);
export const definitions = {
  Header: z.object({ brand: text, linkLabel: text, target: z.object({ pageId: nodeId, anchor }).strict() }).strict(),
  Hero: z.object({ eyebrow: text, title: text, description: text, image, imageAlt: text, layout: z.enum(['split', 'statement']) }).strict(),
  Services: z.object({ title: text, description: text, items: z.array(z.object({ title: text, description: text }).strict()).min(1).max(12), mobile: z.number().int().min(1).max(4), tablet: z.number().int().min(1).max(6).optional(), desktop: z.number().int().min(1).max(6).optional(), gap: z.number().int().min(8).max(64) }).strict(),
  Text: z.object({ title: text, body: text, align: z.enum(['left', 'center']) }).strict(),
  Contact: z.object({ title: text, description: text, button: text }).strict(),
  Footer: z.object({ brand: text, note: text }).strict()
};
export type ComponentProps = { [K in keyof typeof definitions]: z.infer<typeof definitions[K]> };
export type ComponentKind = keyof ComponentProps;
export type SiteNode = { [K in ComponentKind]: { id: string; type: K; props: ComponentProps[K] } }[ComponentKind];
const node = z.discriminatedUnion('type', [
  z.object({ id: nodeId, type: z.literal('Hero'), props: definitions.Hero }).strict(),
  z.object({ id: nodeId, type: z.literal('Services'), props: definitions.Services }).strict(),
  z.object({ id: nodeId, type: z.literal('Text'), props: definitions.Text }).strict(),
  z.object({ id: nodeId, type: z.literal('Contact'), props: definitions.Contact }).strict()
]);
export const MAX_PAGES = 50;
export const MAX_BACKUP_BYTES = 10_000_000;
export const routeSchema = z.string().max(160).refine(value => {
  if (value === '/') return true;
  if (!/^\/[a-z0-9]+(?:-[a-z0-9]+)*(?:\/[a-z0-9]+(?:-[a-z0-9]+)*){0,3}$/.test(value)) return false;
  if (value.split('/').some(segment => /^(con|prn|aux|nul|com[1-9]|lpt[1-9])$/.test(segment))) return false;
  const first = value.split('/')[1];
  return !['admin', 'api', 'assets', 'node-modules'].includes(first);
}, 'Use a unique path such as /about or /work/design. Admin, API and asset paths are reserved.');
export const pageSchema = z.object({
  id: nodeId, name: z.string().trim().min(1).max(60), path: routeSchema,
  inNavigation: z.boolean(), title: z.string().trim().min(1).max(120),
  description: z.string().max(320), nodes: z.array(node).max(60)
}).strict();
export const legacyV2ProjectSchema = z.object({
  schemaVersion: z.literal(2),
  id: z.uuid(),
  name: z.string().trim().min(1).max(80),
  updatedAt: z.iso.datetime(),
  theme: z.object({ accent: z.string().regex(/^#[0-9a-fA-F]{6}$/), font: z.enum(['sans', 'humanist', 'serif']) }).strict(),
  shared: z.object({
    header: z.object({ id: nodeId, enabled: z.boolean(), props: definitions.Header }).strict(),
    footer: z.object({ id: nodeId, enabled: z.boolean(), props: definitions.Footer }).strict()
  }).strict(),
  pages: z.array(pageSchema).min(1).max(MAX_PAGES)
}).strict().superRefine((p, ctx) => {
  if (new TextEncoder().encode(JSON.stringify(p, null, 2)).byteLength > MAX_BACKUP_BYTES) ctx.addIssue({ code: 'custom', message: 'This local prototype supports project backups up to 10 MB. Reduce image sizes or remove unused content.' });
  const ids = [p.shared.header.id, p.shared.footer.id, ...p.pages.flatMap(page => page.nodes.map(n => n.id))];
  if (new Set(ids).size !== ids.length) ctx.addIssue({ code: 'custom', message: 'Component IDs must be unique.' });
  if (new Set(p.pages.map(page => page.id)).size !== p.pages.length) ctx.addIssue({ code: 'custom', message: 'Page IDs must be unique.' });
  if (new Set(p.pages.map(page => page.path)).size !== p.pages.length) ctx.addIssue({ code: 'custom', message: 'Each page needs a unique URL path.' });
  if (p.pages.filter(page => page.path === '/').length !== 1) ctx.addIssue({ code: 'custom', message: 'Keep exactly one homepage at /.' });
  for (const page of p.pages) for (const type of ['Hero', 'Services', 'Contact']) {
    if (page.nodes.filter(n => n.type === type).length > 1) ctx.addIssue({ code: 'custom', message: 'Use one ' + type + ' section per page.' });
  }
});
export type Project = z.infer<typeof legacyV2ProjectSchema>;
export type SitePage = z.infer<typeof pageSchema>;
export type BodyProps = Pick<ComponentProps, 'Hero' | 'Services' | 'Text' | 'Contact'>;
export type NavigationLink = { id: string; label: string; href: string };
export function hasContact(p: Project) { return p.pages.some(page => page.nodes.some(n => n.type === 'Contact')); }
export function allNodes(p: Project): SiteNode[] {
  return [
    ...(p.shared.header.enabled ? [{ id: p.shared.header.id, type: 'Header' as const, props: p.shared.header.props }] : []),
    ...p.pages.flatMap(page => page.nodes),
    ...(p.shared.footer.enabled ? [{ id: p.shared.footer.id, type: 'Footer' as const, props: p.shared.footer.props }] : [])
  ];
}
export function filename(name: string) {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 60) || 'website';
}

