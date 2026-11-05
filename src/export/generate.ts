import { allNodes, walkNodes, hasContact, hasServices, hasPortfolio, hasArticles, filename, type Project, type ComponentKind, type SiteNode } from '../project/schema';
import { readProject } from '../project/migrate';
import { readStudioProject } from '../project/studio-document';
import { headerHref, buttonHref, iconHref, navigationLinks } from '../project/pages';
export type Sources = Record<string, string>;
export type Files = Record<string, Uint8Array>;
const encode = (s: string) => new TextEncoder().encode(s);
export async function sha256(bytes: Uint8Array) {
  return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', bytes as Uint8Array<ArrayBuffer>))).map(b => b.toString(16).padStart(2, '0')).join('');
}
function dependencyLock(source: string, backend: boolean, cms: boolean) {
  const lock = JSON.parse(source);
  if (!backend) {
    delete lock.packages[''].dependencies['@supabase/supabase-js'];
    delete lock.packages[''].dependencies['server-only'];
  }
  if (!cms) delete lock.packages[''].dependencies.sharp;
  delete lock.packages[''].scripts;
  const kept = new Set<string>(['']);
  function locate(from: string, name: string): string | null {
    let current = from;
    while (true) {
      const candidate = (current ? current + '/' : '') + 'node_modules/' + name;
      if (lock.packages[candidate]) return candidate;
      if (!current) return null;
      const parent = current.lastIndexOf('/node_modules/');
      current = parent >= 0 ? current.slice(0, parent) : '';
    }
  }
  function visit(path: string) {
    const p = lock.packages[path]; if (!p) return;
    const dependencies = { ...p.dependencies, ...p.optionalDependencies, ...p.peerDependencies, ...(path === '' ? p.devDependencies : {}) };
    for (const name of Object.keys(dependencies)) {
      const child = locate(path, name);
      if (child && !kept.has(child)) { kept.add(child); visit(child); }
    }
  }
  visit('');
  lock.packages = Object.fromEntries(Object.entries(lock.packages).filter(([path]) => kept.has(path)));
  return JSON.stringify(lock, null, 2);
}
export async function generateProject(input: unknown, sources: Sources): Promise<{ files: Files; project: Project; modules: string[] }> {
  const studio = input && typeof input === 'object' && 'schemaVersion' in input && 'website' in input && (input.schemaVersion === 10 || input.schemaVersion === 9 || input.schemaVersion === 8) ? readStudioProject(input) : undefined;
  const project = studio?.website ?? readProject(input);
  for (const page of project.pages) if (!page.nodes.length) throw new Error('Add a content section to "' + page.name + '" before exporting.');
  for (const page of project.pages) for (const node of walkNodes(page.nodes)) {
    if ('children' in node && !node.children.length) throw new Error('Add content to the empty ' + node.type.toLowerCase() + ' in "' + page.name + '" before exporting, or remove that container.');
    if (node.type === 'Button' && !buttonHref(project, node.props)) throw new Error('The button "' + node.props.label + '" in "' + page.name + '" points to a missing section or page. Choose a valid button destination before exporting.');
    if (node.type === 'Icon' && (node.props.destination || node.props.target) && !iconHref(project, node.props)) throw new Error('The icon "' + node.props.label + '" in "' + page.name + '" points to a missing section or page. Choose a valid icon destination before exporting.');
  }
  const contact = hasContact(project); const services = hasServices(project); const portfolio = hasPortfolio(project); const articles = hasArticles(project); const cms = services || portfolio || articles; const backend = contact || cms; const files: Files = {};
  if (services && project.pages.some(page => page.path === '/services' || page.path.startsWith('/services/'))) throw new Error('The services CMS uses /services and /services/[slug]. Rename your page in that URL space before exporting.');
  if (articles && project.pages.some(page => page.path === '/articles' || page.path.startsWith('/articles/'))) throw new Error('The articles CMS uses /articles and /articles/[slug]. Rename your page in that URL space before exporting.');
  if (project.shared.header.enabled && project.shared.header.props.linkLabel && !headerHref(project)) throw new Error('The header action points to a missing section or page. Choose a destination in Site header & footer.');
  function put(path: string, value: string | Uint8Array) {
    // Only our fixed CMS routes may use Next.js dynamic segments. Authored page
    // paths are separately validated and cannot add arbitrary route syntax.
    const fixedDynamicRoutes = new Set(['app/services/[slug]/page.tsx', 'app/api/services/[id]/image/route.ts', 'app/api/portfolio/[id]/image/route.ts', 'app/articles/[slug]/page.tsx', 'app/api/articles/[id]/image/route.ts', 'app/api/services/[id]/link/route.ts', 'app/api/articles/[id]/link/route.ts', 'app/api/portfolio/[id]/link/route.ts']);
    const checkedPath = fixedDynamicRoutes.has(path) ? path.replace(/\[(slug|id)\]/g, 'dynamic') : path;
    if (path.length > 240 || !/^[a-zA-Z0-9_./-]+$/.test(checkedPath) || path.split('/').some(part => !part || part === '..' || part === '.' || part.endsWith('.') || /^(con|prn|aux|nul|com[0-9]|lpt[0-9])(?:\.|$)/i.test(part) || /^\.env(?!\.example$)/.test(part))) throw new Error('Unsafe export path.');
    files[path] = typeof value === 'string' ? encode(value) : value;
  }
  for (const [path, value] of Object.entries(sources)) {
    if (!services && path === 'templates/base/tests/services-cms.mjs') continue;
    if (!articles && path === 'templates/base/tests/articles-cms.mjs') continue;
    if (!portfolio && path === 'templates/base/tests/portfolio-cms.mjs') continue;
    if (path.startsWith('templates/base/')) put(path.slice('templates/base/'.length), value);
    if (backend && path.startsWith('templates/auth/')) put(path.slice('templates/auth/'.length), value);
    if (contact && path.startsWith('templates/contact/')) put(path.slice('templates/contact/'.length), value);
    if (services && path.startsWith('templates/cms/')) put(path.slice('templates/cms/'.length), value);
    if (portfolio && path.startsWith('templates/portfolio/')) put(path.slice('templates/portfolio/'.length), value);
    if (articles && path.startsWith('templates/articles/')) put(path.slice('templates/articles/'.length), value);
    if (cms && path.startsWith('templates/cms-common/')) put(path.slice('templates/cms-common/'.length), value);
  }
  const requiredTemplates = [
    ...(services ? ['app/api/services/[id]/link/route.ts'] : []),
    ...(articles ? ['app/api/articles/[id]/link/route.ts'] : []),
    ...(portfolio ? ['app/api/portfolio/[id]/link/route.ts', 'lib/portfolio-target.ts'] : []),
    ...(backend ? ['lib/server.ts', 'app/admin/page.tsx', 'app/api/admin/session/route.ts', 'scripts/create-admin.mjs', 'supabase/config.toml', 'supabase/migrations/20260925000000_auth.sql'] : []),
    ...(contact ? ['app/admin/Inbox.tsx', 'app/api/contact/route.ts', 'app/api/admin/submissions/route.ts'] : []),
    ...(cms ? ['lib/cms-image-codec.mjs', 'lib/cms-requests.ts'] : []),
    ...(portfolio ? ['app/admin/PortfolioAdmin.tsx', 'lib/portfolio.ts', 'scripts/import-portfolio.mjs', 'app/api/admin/portfolio/route.ts', 'app/api/admin/portfolio/image/route.ts', 'app/api/portfolio/[id]/image/route.ts', 'supabase/migrations/20260929000000_portfolio.sql', 'supabase/migrations/20261017000000_portfolio_internal_targets.sql'] : []),
    ...(services ? ['app/admin/ServicesAdmin.tsx', 'lib/services.ts', 'scripts/import-content.mjs', 'app/api/admin/services/route.ts', 'app/api/admin/services/image/route.ts', 'app/api/services/[id]/image/route.ts', 'supabase/migrations/20260928000000_services.sql'] : []),
    ...(articles ? ['app/admin/ArticlesAdmin.tsx', 'lib/articles.ts', 'scripts/import-articles.mjs', 'app/api/admin/articles/route.ts', 'app/api/admin/articles/image/route.ts', 'app/api/articles/[id]/image/route.ts', 'supabase/migrations/20260930000000_articles.sql'] : [])
  ];
  for (const required of requiredTemplates) if (!files[required]) throw new Error('The selected module export is incomplete: missing ' + required + '.');
  if (!files['package-lock.json']) throw new Error('Export dependency lock is missing. Run the repository setup steps.');
  const pkg = JSON.parse(sources['templates/base/package.json']);
  if (!backend) {
    delete pkg.dependencies['@supabase/supabase-js']; delete pkg.dependencies['server-only'];
    delete pkg.scripts['setup:admin'];
    put('.env.example', 'SITE_URL=http://localhost:3000\n');
  }
  if (!cms) { delete pkg.dependencies.sharp; delete pkg.scripts['setup:content']; }
  else {
    pkg.scripts['setup:content'] = 'node --env-file=.env.local scripts/setup-content.mjs';
    const imports = [...(services ? ['./import-content.mjs'] : []), ...(portfolio ? ['./import-portfolio.mjs'] : []), ...(articles ? ['./import-articles.mjs'] : [])];
    put('scripts/setup-content.mjs', imports.map(source => 'await import(' + JSON.stringify(source) + ');').join('\n') + '\n');
  }
  if (backend && !contact && files['.env.example']) {
    put('.env.example', new TextDecoder().decode(files['.env.example']).split(/\r?\n/).filter(line => !/^(?:BREVO_|CONTACT_|EMAIL_|# Generate a long random value for contact|# Optional notification email)/.test(line)).join('\n'));
  }
  put('package.json', JSON.stringify(pkg, null, 2));
  put('package-lock.json', dependencyLock(sources['templates/base/package-lock.json'], backend, cms));
  if (backend) {
    put('admin-modules.json', JSON.stringify({ contact, services, portfolio, articles }, null, 2));
    const sections = [
      ...(services ? [{ id: 'services', label: 'Services', component: 'ServicesAdmin', editable: true }] : []),
      ...(portfolio ? [{ id: 'portfolio', label: 'Portfolio', component: 'PortfolioAdmin', editable: true }] : []),
      ...(articles ? [{ id: 'articles', label: 'Articles', component: 'ArticlesAdmin', editable: true }] : []),
      ...(contact ? [{ id: 'inbox', label: 'Inbox', component: 'Inbox', editable: false }] : []),
    ];
    const multiple = sections.length > 1;
    const body = (section: typeof sections[number], callback: string) => '<' + section.component + ' request={request}' + (section.editable ? ' onDirtyChange={' + callback + '}' : '') + '/>';
    put('app/admin/Modules.tsx', [
      '"use client";',
      ...(multiple ? ['import { useCallback, useState } from "react";'] : []),
      ...sections.map(section => 'import ' + section.component + ' from "./' + section.component + '";'),
      'type Props = { request: (path: string, init?: RequestInit) => Promise<Response>; onDirtyChange: (dirty: boolean) => void };',
      'export default function AdminModules({ request, onDirtyChange }: Props) {',
      ...(multiple ? [
        'const [tab, setTab] = useState(' + JSON.stringify(sections[0].id) + ');',
        'const [dirty, setDirty] = useState(false);',
        'const changeDirty = useCallback((value: boolean) => { setDirty(value); onDirtyChange(value); }, [onDirtyChange]);',
        'function select(next: string) { if (next === tab || (dirty && !window.confirm("Discard your unsaved content changes?"))) return; changeDirty(false); setTab(next); }',
        'return <><nav className="admin-tabs" aria-label="Administration sections">' + sections.map(section => '<button type="button" aria-pressed={tab === "' + section.id + '"} onClick={() => select("' + section.id + '")}> ' + section.label + ' </button>').join('') + '</nav>',
        ...sections.map(section => '{tab === "' + section.id + '" && ' + body(section, 'changeDirty') + '}'),
        '</>;'
      ] : ['return ' + body(sections[0], 'onDirtyChange') + ';']),
      '}'
    ].join('\n'));
  }
  if (cms) {
    const config = files['supabase/config.toml'];
    if (!config) throw new Error('The content CMS requires the owner backend configuration.');
    put('supabase/config.toml', new TextDecoder().decode(config).replace(/(\[storage\]\s*\r?\n\s*enabled\s*=\s*)false/, '$1true'));
  }
  if (services) put('content-seed.json', JSON.stringify(project.content.services, null, 2));
  if (portfolio) put('portfolio-seed.json', JSON.stringify(project.content.portfolio, null, 2));
  if (articles) put('articles-seed.json', JSON.stringify(project.content.articles, null, 2));
  if (!sources['src/project/schema.ts']) throw new Error('Export project schema source is missing.');
  put('src/project/schema.ts', sources['src/project/schema.ts']);
  if (!sources['src/project/service-schema.ts']) throw new Error('Export service schema source is missing.');
  put('src/project/service-schema.ts', sources['src/project/service-schema.ts']);
  for (const helper of ['src/project/portfolio-schema.ts', 'src/project/article-schema.ts', 'src/project/link-schema.ts', 'src/project/icon-schema.ts', 'src/project/theme.ts', 'src/project/appearance-schema.ts', 'src/site/authored-style.ts']) {
    if (!sources[helper]) throw new Error('Missing project support source: ' + helper);
    put(helper, sources[helper]);
  }
  if (cms) {
    if (!sources['src/site/collection-designs.ts']) throw new Error('Missing collection design catalog.');
    put('src/site/collection-designs.ts', sources['src/site/collection-designs.ts']);
  }
  put('app/globals.css', sources['src/site/site.css']);
  const kinds = [...new Set(allNodes(project).map(n => n.type))] as ComponentKind[];
  for (const kind of kinds) {
    const source = sources['src/site/' + kind + '.tsx'];
    if (!source) throw new Error('Missing component source: ' + kind);
    put('src/site/' + kind + '.tsx', source);
  }
  if (kinds.includes('Button') || kinds.includes('Icon')) {
    const iconGlyph = sources['src/site/IconGlyph.tsx'];
    if (!iconGlyph) throw new Error('Missing icon drawing source.');
    put('src/site/IconGlyph.tsx', iconGlyph);
  }
  if (services) {
    const detail = sources['src/site/ServiceDetail.tsx'];
    if (!detail) throw new Error('Missing service detail component source.');
    put('src/site/ServiceDetail.tsx', detail);
  }
  if (articles) {
    const detail = sources['src/site/ArticleDetail.tsx'];
    if (!detail) throw new Error('Missing article detail component source.');
    put('src/site/ArticleDetail.tsx', detail);
  }
  const layoutKinds = new Set<ComponentKind>(['Section', 'Columns', 'Column', 'Heading', 'Paragraph', 'Image', 'Button', 'Icon']);
  if (kinds.some(kind => layoutKinds.has(kind))) {
    const helpers = sources['src/site/layout-utils.ts'];
    if (!helpers) throw new Error('Missing layout helper source.');
    put('src/site/layout-utils.ts', helpers);
  }
  // CMS draft data belongs only in the owner's private seed and project backup.
  // This JSON is imported by public UI modules, so omit all collection content.
  const { content: _content, components: _components, ...siteData } = structuredClone(project);
  for (const node of siteData.pages.flatMap(page => walkNodes(page.nodes))) {
    if ('reusable' in node) delete node.reusable;
    if ((node.type === 'Hero' || node.type === 'Image') && node.props.image) {
      const match = node.props.image.match(/^data:image\/(png|jpeg|webp);base64,(.+)$/)!;
      const bytes = Uint8Array.from(atob(match[2]), c => c.charCodeAt(0));
      const extension = match[1] === 'jpeg' ? 'jpg' : match[1];
      const path = 'public/assets/' + node.id + '.' + extension;
      put(path, bytes); node.props.image = '/' + path.slice(7);
    }
  }
  put('site-data.json', JSON.stringify(siteData, null, 2));
  put('project.apl.json', JSON.stringify(studio ?? project, null, 2));
  function exportLink(node: Extract<SiteNode, { type: 'Button' | 'Icon' }>) {
    const href = node.type === 'Button' ? buttonHref(project, node.props) : iconHref(project, node.props);
    const destination = node.props.destination;
    if (href && destination && 'entryId' in destination) {
      const collection = destination.kind === 'service' ? 'services' : destination.kind === 'article' ? 'articles' : 'portfolio';
      return '/api/' + collection + '/' + destination.entryId + '/link';
    }
    return href;
  }
  const buttons = Object.fromEntries(allNodes(project).filter(node => node.type === 'Button').map(node => [node.id, exportLink(node)]));
  const icons = Object.fromEntries(allNodes(project).filter(node => node.type === 'Icon').map(node => [node.id, exportLink(node)]));
  put('site-navigation.json', JSON.stringify({ pages: navigationLinks(project), action: headerHref(project) || '/', buttons, icons }, null, 2));
  put('src/site/SiteShell.tsx', [
    'import type { ReactNode } from "react";',
    'import { themeStyle } from "../project/theme";',
    'import site from "../../site-data.json";',
    ...(project.shared.header.enabled || project.shared.footer.enabled ? ['import { definitions } from "../project/schema";'] : []),
    ...(project.shared.header.enabled ? ['import navigation from "../../site-navigation.json";', 'import Header from "./Header";'] : []),
    ...(project.shared.footer.enabled ? ['import Footer from "./Footer";'] : []),
    'export default function SiteShell({ children, pageId }: { children: ReactNode; pageId: string }) {',
    'const page = site.pages.find(page => page.id === pageId) as { showHeader?: boolean; showFooter?: boolean } | undefined;',
    'return <main id="top" className="site" data-page-id={pageId} data-font={site.theme.font} style={themeStyle(site.theme)}>',
    ...(project.shared.header.enabled ? ['{page?.showHeader !== false && <Header {...definitions.Header.parse(site.shared.header.props)} href={navigation.action} links={navigation.pages} activePageId={pageId}/>}'] : []),
    '{children}',
    ...(project.shared.footer.enabled ? ['{page?.showFooter !== false && <Footer {...definitions.Footer.parse(site.shared.footer.props)}/>}'] : []),
    '</main>; }'
  ].join('\n'));
  for (const [index, page] of siteData.pages.entries()) {
    const segments = page.path.split('/').filter(Boolean);
    const relative = '../'.repeat(segments.length + 1);
    const pageKinds = [...new Set(walkNodes(page.nodes).map(node => node.type))];
    const imports = pageKinds.map(kind => 'import ' + kind + ' from "' + relative + 'src/site/' + kind + '";');
    // Source structure is generated from validated component kinds. Authored
    // text remains JSON data and cannot become JSX or executable source.
    function element(node: SiteNode, expression: string, depth = 0): string {
      const indent = '  '.repeat(depth);
      const id = layoutKinds.has(node.type) ? ' id={' + JSON.stringify(node.id) + '}' : '';
      const href = node.type === 'Button' ? ' href={navigation.buttons[' + JSON.stringify(node.id) + ']}' : node.type === 'Icon' ? ' href={navigation.icons[' + JSON.stringify(node.id) + '] ?? undefined}' : '';
      const items = node.type === 'ServiceCollection' ? ' items={services}' : node.type === 'PortfolioCollection' ? ' items={portfolio}' : node.type === 'ArticleCollection' ? ' items={articles}' : '';
      const opening = indent + '<' + node.type + ' {...(' + expression + '.props as ComponentProps["' + node.type + '"])}' + id + href + items;
      if (!('children' in node)) return opening + ' />';
      return opening + '>\n' + node.children.map((child, i) => element(child, expression + '.children![' + i + ']', depth + 1)).join('\n') + '\n' + indent + '</' + node.type + '>';
    }
    const elements = page.nodes.map((node, i) => element(node, 'nodes[' + i + ']'));
    put('app/' + (segments.length ? segments.join('/') + '/' : '') + 'page.tsx', [
      ...imports, 'import SiteShell from "' + relative + 'src/site/SiteShell";',
      ...(pageKinds.includes('ServiceCollection') ? ['import { listServices } from "' + relative + 'lib/services";'] : []),
      ...(pageKinds.includes('PortfolioCollection') ? ['import { listPortfolio } from "' + relative + 'lib/portfolio";'] : []),
      ...(pageKinds.includes('ArticleCollection') ? ['import { listArticles } from "' + relative + 'lib/articles";'] : []),
      ...(pageKinds.includes('ServiceCollection') || pageKinds.includes('PortfolioCollection') || pageKinds.includes('ArticleCollection') ? ['export const dynamic = "force-dynamic";'] : []),
      ...(pageKinds.includes('Button') || pageKinds.includes('Icon') ? ['import navigation from "' + relative + 'site-navigation.json";'] : []),
      'import type { ComponentProps } from "' + relative + 'src/project/schema";',
      'import site from "' + relative + 'site-data.json";',
      'const page = site.pages[' + index + '];',
      'type ExportNode = { props: unknown; children?: ExportNode[] };',
      'const nodes: ExportNode[] = page.nodes;',
      'export const metadata = { title: page.title, description: page.description };',
      'export default ' + (pageKinds.includes('ServiceCollection') || pageKinds.includes('PortfolioCollection') || pageKinds.includes('ArticleCollection') ? 'async ' : '') + 'function Page() { ' + (pageKinds.includes('ServiceCollection') ? 'const services = await listServices(); ' : '') + (pageKinds.includes('PortfolioCollection') ? 'const portfolio = await listPortfolio(); ' : '') + (pageKinds.includes('ArticleCollection') ? 'const articles = await listArticles(); ' : '') + 'return <SiteShell pageId={page.id}>', ...elements, '</SiteShell>; }'
    ].join('\n'));
  }
  if (services) {
    const collection = allNodes(project).find(node => node.type === 'ServiceCollection')!;
    put('service-collection.json', JSON.stringify(collection.props, null, 2));
    put('app/services/page.tsx', [
      'import SiteShell from "../../src/site/SiteShell";',
      'import ServiceCollection from "../../src/site/ServiceCollection";',
      'import { listServices } from "../../lib/services";',
      'import settings from "../../service-collection.json";',
      'import type { ComponentProps } from "../../src/project/schema";',
      'export const dynamic = "force-dynamic";',
      'export const metadata = { title: settings.title || "Services", description: settings.description };',
      'export default async function ServicesPage() { const services = await listServices();',
      'return <SiteShell pageId="services-cms"><ServiceCollection {...(settings as ComponentProps["ServiceCollection"])} items={services} pageTitle/></SiteShell>; }'
    ].join('\n'));
    put('app/services/[slug]/page.tsx', [
      'import { notFound } from "next/navigation";',
      'import SiteShell from "../../../src/site/SiteShell";',
      'import ServiceDetail from "../../../src/site/ServiceDetail";',
      'import { getService } from "../../../lib/services";',
      'export const dynamic = "force-dynamic";',
      'type Props = { params: Promise<{ slug: string }> };',
      'export async function generateMetadata({ params }: Props) { const service = await getService((await params).slug); return service ? { title: service.title, description: service.summary } : { title: "Service not found" }; }',
      'export default async function ServicePage({ params }: Props) { const service = await getService((await params).slug); if (!service) notFound();',
      'return <SiteShell pageId="services-cms"><ServiceDetail service={service}/></SiteShell>; }'
    ].join('\n'));
  }
  if (articles) {
    const collection = allNodes(project).find(node => node.type === 'ArticleCollection')!;
    put('article-collection.json', JSON.stringify(collection.props, null, 2));
    put('app/articles/page.tsx', [
      'import SiteShell from "../../src/site/SiteShell";',
      'import ArticleCollection from "../../src/site/ArticleCollection";',
      'import { listArticles } from "../../lib/articles";',
      'import settings from "../../article-collection.json";',
      'import type { ComponentProps } from "../../src/project/schema";',
      'export const dynamic = "force-dynamic";',
      'export const metadata = { title: settings.title || "Articles", description: settings.description };',
      'export default async function ArticlesPage() { const articles = await listArticles();',
      'return <SiteShell pageId="articles-cms"><ArticleCollection {...(settings as ComponentProps["ArticleCollection"])} items={articles} pageTitle/></SiteShell>; }'
    ].join('\n'));
    put('app/articles/[slug]/page.tsx', [
      'import { notFound } from "next/navigation";',
      'import SiteShell from "../../../src/site/SiteShell";',
      'import ArticleDetail from "../../../src/site/ArticleDetail";',
      'import { getArticle } from "../../../lib/articles";',
      'export const dynamic = "force-dynamic";',
      'type Props = { params: Promise<{ slug: string }> };',
      'export async function generateMetadata({ params }: Props) { const article = await getArticle((await params).slug); return article ? { title: article.title, description: article.summary } : { title: "Article not found" }; }',
      'export default async function ArticlePage({ params }: Props) { const article = await getArticle((await params).slug); if (!article) notFound();',
      'return <SiteShell pageId="articles-cms"><ArticleDetail article={article}/></SiteShell>; }'
    ].join('\n'));
  }
  const modules = [...(contact ? ['contact', 'admin-inbox'] : []), ...(services ? ['services-cms', 'admin-services'] : []), ...(portfolio ? ['portfolio-cms', 'admin-portfolio'] : []), ...(articles ? ['articles-cms', 'admin-articles'] : [])];
  const hashes: Record<string,string> = {};
  for (const path of Object.keys(files).sort()) hashes[path] = await sha256(files[path]);
  const contentHash = await sha256(encode(JSON.stringify(hashes)));
  put('export-manifest.json', JSON.stringify({ formatVersion: 8, generatorVersion: '0.9.1', projectId: project.id, projectName: project.name, slug: filename(project.name), modules, components: kinds, pages: project.pages.map(({ id, path, title }) => ({ id, path, title })), status: 'generated-verification-required', contentHash, files: hashes }, null, 2));
  return { files, project, modules };
}
