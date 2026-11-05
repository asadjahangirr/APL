import { z } from 'zod';

import { serviceEntrySchema } from './service-schema';
import { portfolioEntrySchema } from './portfolio-schema';
import { articleEntrySchema } from './article-schema';
import { themeSchema } from './theme';
import { responsiveAppearanceSchema } from './appearance-schema';
import { pageTargetSchema, buttonDestinationSchema } from './link-schema';
import { iconNameSchema } from './icon-schema';
export { pageTargetSchema, buttonDestinationSchema } from './link-schema';
export type { ButtonDestination, PageTarget } from './link-schema';

const text = z.string().max(4000);
const image = z.string().max(3_000_000).refine(v => v === '' || /^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/.test(v), 'Upload a PNG, JPEG or WebP image.');
const nodeId = z.string().regex(/^[A-Za-z0-9_-]{1,100}$/);
const target = pageTargetSchema;
const layoutPreset = z.enum(['stack', 'halves', 'thirds', 'quarters', 'one-two', 'two-one', 'one-three', 'three-one']);
export type LayoutPreset = z.infer<typeof layoutPreset>;
export type Responsive<T> = { mobile: T; tablet?: T; desktop?: T };
const responsive = <T extends z.ZodType>(value: T) => z.object({ mobile: value, tablet: value.optional(), desktop: value.optional() }).strict();
const gap = responsive(z.number().int().min(0).max(96));
const appearance = responsiveAppearanceSchema.optional();
export const sectionAnchorSchema = z.string().max(100).regex(/^#c-[a-z0-9]+(?:-[a-z0-9]+)*$/);
const entryIds = z.array(z.uuid().transform(value => value.toLowerCase())).max(50).refine(values => new Set(values).size === values.length, 'Choose each published entry once.').optional();
const collectionLayout = { title: text, description: text, mobile: z.number().int().min(1).max(4), tablet: z.number().int().min(1).max(6).optional(), desktop: z.number().int().min(1).max(6).optional(), gap: z.number().int().min(8).max(64), motion: z.enum(['none','lift','zoom','reveal']).default('none'), entryIds };
export const definitions = {
  PortfolioCollection: z.object({ ...collectionLayout, design: z.enum(['gallery','editorial','split','poster','index','framed']).default('gallery') }).strict(),
  ServiceCollection: z.object({ ...collectionLayout, design: z.enum(['classic','tiles','bands','spotlight']).default('classic') }).strict(),
  ArticleCollection: z.object({ ...collectionLayout, design: z.enum(['classic','tiles','bands','spotlight']).default('classic') }).strict(),
  Header: z.object({ brand: text, linkLabel: text, target, design: z.enum(['classic','centered','framed','editorial']).optional() }).strict(),
  Hero: z.object({ eyebrow: text, title: text, description: text, image, imageAlt: text, layout: z.enum(['split','statement','centered','editorial','portrait','inset']), motion: z.enum(['none','reveal','unveil']).optional() }).strict(),
  Services: z.object({ title: text, description: text, items: z.array(z.object({ title: text, description: text }).strict()).min(1).max(12), mobile: z.number().int().min(1).max(4), tablet: z.number().int().min(1).max(6).optional(), desktop: z.number().int().min(1).max(6).optional(), gap: z.number().int().min(8).max(64), design: z.enum(['classic','bordered','numbered']).optional() }).strict(),
  Text: z.object({ title: text, body: text, align: z.enum(['left', 'center']), design: z.enum(['classic','editorial','panel']).optional() }).strict(),
  Contact: z.object({ title: text, description: text, button: text, appearance, buttonAppearance: appearance, fieldAppearance: appearance }).strict(),
  Footer: z.object({ brand: text, note: text, design: z.enum(['classic','columns','editorial','framed']).optional() }).strict(),
  Section: z.object({ padding: responsive(z.number().int().min(0).max(160)), width: z.enum(['content', 'wide', 'full']), tone: z.enum(['plain', 'soft', 'contrast']), anchor: sectionAnchorSchema.optional(), appearance }).strict(),
  Columns: z.object({ layout: responsive(layoutPreset), gap, align: z.enum(['start', 'center', 'stretch']), appearance }).strict(),
  Column: z.object({ gap, align: z.enum(['start', 'center', 'end']), appearance }).strict(),
  Heading: z.object({ text, level: z.enum(['h1', 'h2', 'h3', 'h4']), size: z.enum(['small', 'medium', 'large']), align: z.enum(['left', 'center', 'right']), appearance }).strict(),
  Paragraph: z.object({ text, align: z.enum(['left', 'center', 'right']), appearance }).strict(),
  Image: z.object({ image, alt: text, ratio: z.enum(['square', 'landscape', 'portrait']), radius: z.enum(['none', 'soft', 'round']), appearance }).strict(),
  Button: z.object({ label: text, target, destination: buttonDestinationSchema.optional(), icon: iconNameSchema.optional(), iconPosition: z.enum(['start','end']).optional(), variant: z.enum(['solid','outline','soft','text','offset','double','icon-tab','bracket']), shape: z.enum(['square', 'rounded', 'pill']), motion: z.enum(['none','lift','arrow','press','sweep']), appearance }).strict(),
  Icon: z.object({ name: iconNameSchema, label: z.string().max(240), decorative: z.boolean(), size: responsive(z.number().int().min(12).max(160)), appearance, target: target.optional(), destination: buttonDestinationSchema.optional() }).strict().refine(props => props.decorative && !props.target && !props.destination || props.label.trim().length > 0, 'Give meaningful and linked icons an accessible label.')
};
export type ComponentProps = { [K in keyof typeof definitions]: z.infer<typeof definitions[K]> };
export type ComponentKind = keyof ComponentProps;
const leafNode = z.discriminatedUnion('type', [
  z.object({ id: nodeId, type: z.literal('Heading'), props: definitions.Heading }).strict(),
  z.object({ id: nodeId, type: z.literal('Paragraph'), props: definitions.Paragraph }).strict(),
  z.object({ id: nodeId, type: z.literal('Image'), props: definitions.Image }).strict(),
  z.object({ id: nodeId, type: z.literal('Button'), props: definitions.Button }).strict(),
  z.object({ id: nodeId, type: z.literal('Icon'), props: definitions.Icon }).strict()
]);
const columnNode = z.object({ id: nodeId, type: z.literal('Column'), props: definitions.Column, children: z.array(leafNode).max(20) }).strict();
const columnsNode = z.object({ id: nodeId, type: z.literal('Columns'), props: definitions.Columns, children: z.array(columnNode).max(4) }).strict();
const layoutChild = z.union([leafNode, columnsNode]);
export const reusableInstanceSchema = z.object({
  componentId: z.uuid(), revision: z.number().int().min(1).max(1_000_000),
  nodeIds: z.record(nodeId, nodeId).refine(values => Object.keys(values).length <= 1000 && new Set(Object.values(values)).size === Object.keys(values).length, 'A reusable instance needs a bounded unique ID map.'),
  fingerprint: z.string().regex(/^[a-f0-9]{64}$/),
}).strict();
export type ReusableInstance = z.infer<typeof reusableInstanceSchema>;
const rootLink = { reusable: reusableInstanceSchema.optional() };
const sectionNode = z.object({ id: nodeId, type: z.literal('Section'), props: definitions.Section, children: z.array(layoutChild).max(20), ...rootLink }).strict();
// Finite structural schemas reject recursive containers instead of parsing an unbounded tree.
const node = z.discriminatedUnion('type', [
  z.object({ id: nodeId, type: z.literal('PortfolioCollection'), props: definitions.PortfolioCollection, ...rootLink }).strict(),
  z.object({ id: nodeId, type: z.literal('ServiceCollection'), props: definitions.ServiceCollection, ...rootLink }).strict(),
  z.object({ id: nodeId, type: z.literal('ArticleCollection'), props: definitions.ArticleCollection, ...rootLink }).strict(),
  z.object({ id: nodeId, type: z.literal('Hero'), props: definitions.Hero, ...rootLink }).strict(),
  z.object({ id: nodeId, type: z.literal('Services'), props: definitions.Services, ...rootLink }).strict(),
  z.object({ id: nodeId, type: z.literal('Text'), props: definitions.Text, ...rootLink }).strict(),
  z.object({ id: nodeId, type: z.literal('Contact'), props: definitions.Contact, ...rootLink }).strict(),
  sectionNode
]);
export type LeafNode = z.infer<typeof leafNode>;
export type ColumnNode = z.infer<typeof columnNode>;
export type LayoutChild = z.infer<typeof layoutChild>;
export type BodyNode = z.infer<typeof node>;
export const reusableComponentSchema = z.object({ id: z.uuid(), name: z.string().trim().min(1).max(80), revision: z.number().int().min(1).max(1_000_000), sourcePageId: nodeId, node }).strict().refine(component => !component.node.reusable, 'Reusable blueprints cannot contain another linked component.');
export type ReusableComponent = z.infer<typeof reusableComponentSchema>;
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
  description: z.string().max(320), nodes: z.array(node).max(60),
  showHeader: z.boolean().optional(), showFooter: z.boolean().optional()
}).strict();
export const projectSchema = z.object({
  schemaVersion: z.literal(9),
  components: z.array(reusableComponentSchema).max(50),
  content: z.object({ services: z.array(serviceEntrySchema).max(50), portfolio: z.array(portfolioEntrySchema).max(50), articles: z.array(articleEntrySchema).max(50) }).strict(),
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
  for (const item of p.content.portfolio) for (const payload of [item.draft, item.published]) if (payload?.target) {
    const page = p.pages.find(page => page.id === payload.target?.pageId);
    const anchor = payload.target.anchor;
    if (!page || anchor !== '#top' && !page.nodes.some(node => node.type === 'Section' && node.props.anchor === anchor))
      ctx.addIssue({ code: 'custom', message: 'A portfolio card links to a missing page or section. Choose another destination before removing that page.' });
  }
  const serviceIds = p.content.services.map(item => item.id);
  const slugs = p.content.services.flatMap(item => item.published ? [item.published.slug] : []);
  if (new Set(serviceIds).size !== serviceIds.length || new Set(slugs).size !== slugs.length) ctx.addIssue({code:'custom',message:'Services need unique IDs and published URL slugs.'});
  if (hasServices(p) && p.pages.some(page => page.path === '/services' || page.path.startsWith('/services/'))) ctx.addIssue({code:'custom',message:'The services collection uses /services and /services/... . Change the conflicting page path first.'});
  const articleIds = p.content.articles.map(item => item.id);
  const articleSlugs = p.content.articles.flatMap(item => item.published ? [item.published.slug] : []);
  if (new Set(articleIds).size !== articleIds.length || new Set(articleSlugs).size !== articleSlugs.length) ctx.addIssue({code:'custom',message:'Articles need unique IDs and published URL slugs.'});
  if (hasArticles(p) && p.pages.some(page => page.path === '/articles' || page.path.startsWith('/articles/'))) ctx.addIssue({code:'custom',message:'The articles collection uses /articles and /articles/... . Change the conflicting page path first.'});
  if (new TextEncoder().encode(JSON.stringify(p, null, 2)).byteLength > MAX_BACKUP_BYTES) ctx.addIssue({ code: 'custom', message: 'This local prototype supports project backups up to 10 MB. Reduce image sizes or remove unused content.' });
  const ids = [p.shared.header.id, p.shared.footer.id, ...p.pages.flatMap(page => walkNodes(page.nodes).map(n => n.id))];
  const blueprintNodes = p.components.flatMap(component => walkNodes([component.node]));
  if (ids.length + blueprintNodes.length > MAX_TOTAL_NODES) ctx.addIssue({ code: 'custom', message: 'This local prototype supports up to 1,000 components per project, including reusable blueprints and layout containers.' });
  if (new Set(ids).size !== ids.length) ctx.addIssue({ code: 'custom', message: 'Component IDs must be unique.' });
  if (new Set(p.pages.map(page => page.id)).size !== p.pages.length) ctx.addIssue({ code: 'custom', message: 'Page IDs must be unique.' });
  if (new Set(p.pages.map(page => page.path)).size !== p.pages.length) ctx.addIssue({ code: 'custom', message: 'Each page needs a unique URL path.' });
  if (p.pages.filter(page => page.path === '/').length !== 1) ctx.addIssue({ code: 'custom', message: 'Keep exactly one homepage at /.' });
  if (new Set(p.components.map(component => component.id)).size !== p.components.length) ctx.addIssue({ code: 'custom', message: 'Reusable component IDs must be unique.' });
  if (new Set(p.components.map(component => component.name.toLowerCase())).size !== p.components.length) ctx.addIssue({ code: 'custom', message: 'Give each reusable component a unique name.' });
  for (const component of p.components) {
    const localIds = walkNodes([component.node]).map(node => node.id);
    if (new Set(localIds).size !== localIds.length) ctx.addIssue({ code: 'custom', message: 'Reusable blueprint node IDs must be unique within their component.' });
  }
  for (const page of p.pages) for (const root of page.nodes) if (root.reusable) {
    const component = p.components.find(component => component.id === root.reusable!.componentId);
    if (!component || component.node.type !== root.type || root.reusable.revision > component.revision || root.reusable.nodeIds[component.node.id] !== root.id) ctx.addIssue({ code: 'custom', message: 'This reusable instance does not match its component and root ID.' });
  }
  for (const page of p.pages) {
    const anchors = page.nodes.flatMap(node => node.type === 'Section' && node.props.anchor ? [node.props.anchor] : []);
    if (new Set(anchors).size !== anchors.length) ctx.addIssue({ code: 'custom', message: 'Section anchors must be unique on each page.' });
  }
  for (const page of p.pages) for (const type of ['Hero', 'Services', 'ServiceCollection', 'PortfolioCollection', 'ArticleCollection', 'Contact']) {
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
export function hasArticles(p: { pages: { nodes: { type: string }[] }[] }) { return p.pages.some(page => page.nodes.some(n => n.type === 'ArticleCollection')); }
