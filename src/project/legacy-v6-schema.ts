import { z } from 'zod';

import { serviceEntrySchema } from './service-schema';
import { portfolioEntrySchema } from './legacy-portfolio-schema';
import { themeSchema } from './theme';

const text = z.string().max(4000);
const image = z.string().max(3_000_000).refine(v => v === '' || /^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/.test(v), 'Upload a PNG, JPEG or WebP image.');
const anchor = z.string().regex(/^#[a-z][a-z0-9-]*$/);
const nodeId = z.string().regex(/^[A-Za-z0-9_-]{1,100}$/);
const target = z.object({ pageId: nodeId, anchor }).strict();
const layoutPreset = z.enum(['stack', 'halves', 'thirds', 'quarters', 'one-two', 'two-one', 'one-three', 'three-one']);
export type LayoutPreset = z.infer<typeof layoutPreset>;
export type Responsive<T> = { mobile: T; tablet?: T; desktop?: T };
const responsive = <T extends z.ZodType>(value: T) => z.object({ mobile: value, tablet: value.optional(), desktop: value.optional() }).strict();
const gap = responsive(z.number().int().min(0).max(96));
const collectionLayout = { title: text, description: text, mobile: z.number().int().min(1).max(4), tablet: z.number().int().min(1).max(6).optional(), desktop: z.number().int().min(1).max(6).optional(), gap: z.number().int().min(8).max(64), motion: z.enum(['none','lift','zoom','reveal']).default('none') };
export const definitions = {
  PortfolioCollection: z.object({ ...collectionLayout, design: z.enum(['gallery','editorial','split','poster','index','framed']).default('gallery') }).strict(),
  ServiceCollection: z.object({ ...collectionLayout, design: z.enum(['classic','tiles','bands','spotlight']).default('classic') }).strict(),
  Header: z.object({ brand: text, linkLabel: text, target, design: z.enum(['classic','centered','framed','editorial']).optional() }).strict(),
  Hero: z.object({ eyebrow: text, title: text, description: text, image, imageAlt: text, layout: z.enum(['split','statement','centered','editorial','portrait','inset']), motion: z.enum(['none','reveal','unveil']).optional() }).strict(),
  Services: z.object({ title: text, description: text, items: z.array(z.object({ title: text, description: text }).strict()).min(1).max(12), mobile: z.number().int().min(1).max(4), tablet: z.number().int().min(1).max(6).optional(), desktop: z.number().int().min(1).max(6).optional(), gap: z.number().int().min(8).max(64) }).strict(),
  Text: z.object({ title: text, body: text, align: z.enum(['left', 'center']) }).strict(),
  Contact: z.object({ title: text, description: text, button: text }).strict(),
  Footer: z.object({ brand: text, note: text }).strict(),
  Section: z.object({ padding: responsive(z.number().int().min(0).max(160)), width: z.enum(['content', 'wide', 'full']), tone: z.enum(['plain', 'soft', 'contrast']) }).strict(),
  Columns: z.object({ layout: responsive(layoutPreset), gap, align: z.enum(['start', 'center', 'stretch']) }).strict(),
  Column: z.object({ gap, align: z.enum(['start', 'center', 'end']) }).strict(),
  Heading: z.object({ text, level: z.enum(['h2', 'h3', 'h4']), size: z.enum(['small', 'medium', 'large']), align: z.enum(['left', 'center', 'right']) }).strict(),
  Paragraph: z.object({ text, align: z.enum(['left', 'center', 'right']) }).strict(),
  Image: z.object({ image, alt: text, ratio: z.enum(['square', 'landscape', 'portrait']), radius: z.enum(['none', 'soft', 'round']) }).strict(),
  Button: z.object({ label: text, target, variant: z.enum(['solid','outline','soft','text','offset','double','icon-tab','bracket']), shape: z.enum(['square', 'rounded', 'pill']), motion: z.enum(['none','lift','arrow','press','sweep']) }).strict()
};
export type ComponentProps = { [K in keyof typeof definitions]: z.infer<typeof definitions[K]> };
export type ComponentKind = keyof ComponentProps;
const leafNode = z.discriminatedUnion('type', [
  z.object({ id: nodeId, type: z.literal('Heading'), props: definitions.Heading }).strict(),
  z.object({ id: nodeId, type: z.literal('Paragraph'), props: definitions.Paragraph }).strict(),
  z.object({ id: nodeId, type: z.literal('Image'), props: definitions.Image }).strict(),
  z.object({ id: nodeId, type: z.literal('Button'), props: definitions.Button }).strict()
]);
const columnNode = z.object({ id: nodeId, type: z.literal('Column'), props: definitions.Column, children: z.array(leafNode).max(20) }).strict();
const columnsNode = z.object({ id: nodeId, type: z.literal('Columns'), props: definitions.Columns, children: z.array(columnNode).max(4) }).strict();
const layoutChild = z.union([leafNode, columnsNode]);
const sectionNode = z.object({ id: nodeId, type: z.literal('Section'), props: definitions.Section, children: z.array(layoutChild).max(20) }).strict();
// Finite structural schemas reject recursive containers instead of parsing an unbounded tree.
const node = z.discriminatedUnion('type', [
  z.object({ id: nodeId, type: z.literal('PortfolioCollection'), props: definitions.PortfolioCollection }).strict(),
  z.object({ id: nodeId, type: z.literal('ServiceCollection'), props: definitions.ServiceCollection }).strict(),
  z.object({ id: nodeId, type: z.literal('Hero'), props: definitions.Hero }).strict(),
  z.object({ id: nodeId, type: z.literal('Services'), props: definitions.Services }).strict(),
  z.object({ id: nodeId, type: z.literal('Text'), props: definitions.Text }).strict(),
  z.object({ id: nodeId, type: z.literal('Contact'), props: definitions.Contact }).strict(),
  sectionNode
]);
export type LeafNode = z.infer<typeof leafNode>;
export type ColumnNode = z.infer<typeof columnNode>;
export type LayoutChild = z.infer<typeof layoutChild>;
export type BodyNode = z.infer<typeof node>;
type SharedNode = { [K in 'Header' | 'Footer']: { id: string; type: K; props: ComponentProps[K] } }['Header' | 'Footer'];
export type SiteNode = BodyNode | LayoutChild | ColumnNode | SharedNode;
export const MAX_PAGES = 50;
export const MAX_BACKUP_BYTES = 10_000_000;
export const MAX_TOTAL_NODES = 1000;
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
export const projectSchema = z.object({
  schemaVersion: z.literal(6),
  content: z.object({ services: z.array(serviceEntrySchema).max(50), portfolio: z.array(portfolioEntrySchema).max(50) }).strict(),
  id: z.uuid(),
  name: z.string().trim().min(1).max(80),
  updatedAt: z.iso.datetime(),
  theme: themeSchema,
  shared: z.object({
    header: z.object({ id: nodeId, enabled: z.boolean(), props: definitions.Header }).strict(),
    footer: z.object({ id: nodeId, enabled: z.boolean(), props: definitions.Footer }).strict()
  }).strict(),
  pages: z.array(pageSchema).min(1).max(MAX_PAGES)
}).strict().superRefine((p, ctx) => {
  const portfolioIds = p.content.portfolio.map(item => item.id);
  if (new Set(portfolioIds).size !== portfolioIds.length) ctx.addIssue({code:'custom',message:'Portfolio projects need unique IDs.'});
  const serviceIds = p.content.services.map(item => item.id);
  const slugs = p.content.services.flatMap(item => item.published ? [item.published.slug] : []);
  if (new Set(serviceIds).size !== serviceIds.length || new Set(slugs).size !== slugs.length) ctx.addIssue({code:'custom',message:'Services need unique IDs and published URL slugs.'});
  if (hasServices(p) && p.pages.some(page => page.path === '/services' || page.path.startsWith('/services/'))) ctx.addIssue({code:'custom',message:'The services collection uses /services and /services/... . Change the conflicting page path first.'});
  if (new TextEncoder().encode(JSON.stringify(p, null, 2)).byteLength > MAX_BACKUP_BYTES) ctx.addIssue({ code: 'custom', message: 'This local prototype supports project backups up to 10 MB. Reduce image sizes or remove unused content.' });
  const ids = [p.shared.header.id, p.shared.footer.id, ...p.pages.flatMap(page => walkNodes(page.nodes).map(n => n.id))];
  if (ids.length > MAX_TOTAL_NODES) ctx.addIssue({ code: 'custom', message: 'This local prototype supports up to 1,000 components per project, including shared sections and layout containers.' });
  if (new Set(ids).size !== ids.length) ctx.addIssue({ code: 'custom', message: 'Component IDs must be unique.' });
  if (new Set(p.pages.map(page => page.id)).size !== p.pages.length) ctx.addIssue({ code: 'custom', message: 'Page IDs must be unique.' });
  if (new Set(p.pages.map(page => page.path)).size !== p.pages.length) ctx.addIssue({ code: 'custom', message: 'Each page needs a unique URL path.' });
  if (p.pages.filter(page => page.path === '/').length !== 1) ctx.addIssue({ code: 'custom', message: 'Keep exactly one homepage at /.' });
  for (const page of p.pages) for (const type of ['Hero', 'Services', 'ServiceCollection', 'PortfolioCollection', 'Contact']) {
    if (page.nodes.filter(n => n.type === type).length > 1) ctx.addIssue({ code: 'custom', message: 'Use one ' + type + ' section per page.' });
  }
});
export type Project = z.infer<typeof projectSchema>;
export type SitePage = z.infer<typeof pageSchema>;
export type BodyProps = Omit<ComponentProps, 'Header' | 'Footer'>;
export type NavigationLink = { id: string; label: string; href: string };
export function hasContact(p: Project) { return p.pages.some(page => page.nodes.some(n => n.type === 'Contact')); }
/** Depth-first document order, including each container before its children. */
export function walkNodes(nodes: readonly SiteNode[]): SiteNode[] {
  return nodes.flatMap(node => [node, ...('children' in node ? walkNodes(node.children) : [])]);
}
export function allNodes(p: Project): SiteNode[] {
  return [
    ...(p.shared.header.enabled ? [{ id: p.shared.header.id, type: 'Header' as const, props: p.shared.header.props }] : []),
    ...p.pages.flatMap(page => walkNodes(page.nodes)),
    ...(p.shared.footer.enabled ? [{ id: p.shared.footer.id, type: 'Footer' as const, props: p.shared.footer.props }] : [])
  ];
}
export function filename(name: string) {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 60) || 'website';
}


export function hasServices(p: { pages: { nodes: { type: string }[] }[] }) { return p.pages.some(page => page.nodes.some(n => n.type === 'ServiceCollection')); }

export function hasPortfolio(p: { pages: { nodes: { type: string }[] }[] }) { return p.pages.some(page => page.nodes.some(n => n.type === 'PortfolioCollection')); }

