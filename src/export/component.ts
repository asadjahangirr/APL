import {
  projectSchema,
  walkNodes,
  type ComponentKind,
  type Project,
  type SiteNode,
} from '../project/schema';
import { buttonHref, headerHref, iconHref, targetHref } from '../project/pages';
import { generateProject, type Files, type Sources } from './generate';
import { selectedStyles } from './component-styles';

const encode = (value: string) => new TextEncoder().encode(value);
const decode = (value: Uint8Array) => new TextDecoder('utf-8', { fatal: true }).decode(value);

export interface ComponentBundle {
  selection: { kind: ComponentKind; pageId: string; nodeId: string };
  componentName: string;
  entryPath: string;
  usage: string;
  files: Files;
  modules: string[];
  warnings: string[];
}

function id(): string {
  return crypto.randomUUID();
}

/** The website schema only permits layout leaves inside a Section. */
function asPageNodes(node: SiteNode): Project['pages'][number]['nodes'] {
  const selected = structuredClone(node);
  if ('reusable' in selected) delete selected.reusable;
  if (['Section', 'Hero', 'Services', 'Text', 'Contact', 'ServiceCollection', 'PortfolioCollection', 'ArticleCollection'].includes(selected.type)) {
    return [selected] as Project['pages'][number]['nodes'];
  }
  const section = {
    id: id(),
    type: 'Section',
    props: { padding: { mobile: 48 }, width: 'content', tone: 'plain' },
    children: selected.type === 'Column'
      ? [{
          id: id(),
          type: 'Columns',
          props: { layout: { mobile: 'stack' }, gap: { mobile: 16 }, align: 'stretch' },
          children: [selected],
        }]
      : [selected],
  };
  return [section] as unknown as Project['pages'][number]['nodes'];
}

function findSelection(project: Project, pageId: string, nodeId: string) {
  const page = project.pages.find(item => item.id === pageId);
  if (!page) throw new Error('This page no longer exists. Choose another page.');
  if (nodeId === '@shared/header') {
    if (!project.shared.header.enabled) throw new Error('The shared header is disabled.');
    return { page, kind: 'Header' as const, node: undefined };
  }
  if (nodeId === '@shared/footer') {
    if (!project.shared.footer.enabled) throw new Error('The shared footer is disabled.');
    return { page, kind: 'Footer' as const, node: undefined };
  }
  const node = walkNodes(page.nodes).find(item => item.id === nodeId);
  if (!node) throw new Error('This component no longer exists on the selected page.');
  return { page, kind: node.type, node };
}

/** Generate a runnable, independent copy with the chosen renderer and necessary modules. */
export async function generateComponentBundle(
  input: Project,
  pageId: string,
  nodeId: string,
  sources: Sources,
): Promise<ComponentBundle> {
  const original = projectSchema.parse(input);
  const selection = findSelection(original, pageId, nodeId);
  const sharedHeader = selection.kind === 'Header';
  const sharedFooter = selection.kind === 'Footer';
  const warnings: string[] = [];

  const pageNodes = selection.node
    ? asPageNodes(selection.node)
    : [{
        id: id(),
        type: 'Text',
        props: { title: 'Component preview', body: 'The selected shared component is displayed around this example page.', align: 'left' },
      }] as Project['pages'][number]['nodes'];

  const candidate: Project = structuredClone(original);
  candidate.components = [];
  candidate.pages = [{
    ...selection.page,
    path: '/',
    inNavigation: true,
    showHeader: sharedHeader,
    showFooter: sharedFooter,
    nodes: pageNodes,
  }];
  candidate.shared.header.enabled = sharedHeader;
  candidate.shared.footer.enabled = sharedFooter;
  candidate.content.services = selection.kind === 'ServiceCollection' ? candidate.content.services : [];
  candidate.content.portfolio = selection.kind === 'PortfolioCollection' ? candidate.content.portfolio : [];
  candidate.content.articles = selection.kind === 'ArticleCollection' ? candidate.content.articles : [];
  for (const entry of candidate.content.portfolio) for (const payload of [entry.draft, entry.published]) {
    if (payload?.target && !targetHref(candidate, payload.target)) {
      payload.target = { pageId: candidate.pages[0].id, anchor: '#top' };
      warnings.push('A portfolio card pointed to a case-study page outside this bundle. Its example destination is the top of this page; reconnect it after copying.');
    }
  }

  if (sharedHeader && candidate.shared.header.props.linkLabel && !headerHref(candidate)) {
    candidate.shared.header.props.target = { pageId: candidate.pages[0].id, anchor: '#top' };
    warnings.push('The header action pointed outside this one-page bundle. Its example destination is the top of the page; reconnect it after copying.');
  }
  for (const node of walkNodes(candidate.pages[0].nodes)) {
    if (node.type === 'Button' && !buttonHref(candidate, node.props)) {
      node.props.destination = undefined;
      node.props.target = { pageId: candidate.pages[0].id, anchor: '#top' };
      warnings.push('A button destination pointed outside this bundle. Its example destination is the top of the page; reconnect it after copying.');
    }
    if (node.type === 'Icon' && (node.props.target || node.props.destination) && !iconHref(candidate, node.props)) {
      node.props.destination = undefined;
      node.props.target = { pageId: candidate.pages[0].id, anchor: '#top' };
      warnings.push('An icon destination pointed outside this bundle. Its example destination is the top of the page; reconnect it after copying.');
    }
  }

  const mini = projectSchema.parse(candidate);
  const kinds = new Set<ComponentKind>(walkNodes(mini.pages[0].nodes).map(node => node.type));
  if (sharedHeader) kinds.add('Header');
  if (sharedFooter) kinds.add('Footer');
  const sourcePaths = [...kinds].map(kind => 'src/site/' + kind + '.tsx');
  if (kinds.has('ServiceCollection')) sourcePaths.push('src/site/ServiceDetail.tsx');
  if (kinds.has('ArticleCollection')) sourcePaths.push('src/site/ArticleDetail.tsx');
  for (const path of sourcePaths) if (!sources[path]) throw new Error('Missing component source: ' + path);
  const stylesheet = sources['src/site/site.css'];
  if (!stylesheet) throw new Error('Missing component stylesheet.');

  const backend = ['Contact', 'ServiceCollection', 'PortfolioCollection', 'ArticleCollection'].includes(selection.kind);
  if (backend) warnings.push('This component needs its included backend setup. The form or CMS is not live until you configure your own Supabase project and run verification.');

  const readme = [
    '# ' + selection.kind + ' component bundle',
    '',
    'This is an independent Next.js example of the selected component. It contains only its selected renderer, required layout wrappers, and required functional modules.',
    '',
    '## Where to look',
    '',
    '- ' + 'src/site/' + selection.kind + '.tsx' + ' — readable component source.',
    '- app/page.tsx — working usage example; shared header/footer are wired in src/site/SiteShell.tsx.',
    '- app/globals.css — styles used by the selected component and its example shell.',
    '- site-data.json — safely serialized component settings and design tokens.',
    '- package.json and package-lock.json — public dependencies and locked versions.',
    '',
    '## Run it',
    '',
    '1. Run npm ci.',
    '2. Read SETUP.md and .env.example. Backend components require your own Supabase project and administrator setup.',
    '3. Run npm run dev, then open http://localhost:3000.',
    '4. Run npm run verify before using a backend feature outside a local test.',
    '',
    'Run the complete bundle in a new folder first. It includes routing, theme values, and any necessary server handlers. To add it to an existing React project, copy the component, its support files and styles, then merge the dependency requirements. Do not replace your existing package or environment files. Run the included verifier before relying on backend features.',
    ...(warnings.length ? ['', '## Review before using', '', ...warnings.map(message => '- ' + message)] : []),
    '',
  ].join('\n');

  const localSources: Sources = {
    ...sources,
    'src/site/site.css': selectedStyles(stylesheet, sourcePaths.map(path => sources[path])),
    'templates/base/README.md': readme,
  };
  const result = await generateProject(mini, localSources);
  const entryPath = 'src/site/' + selection.kind + '.tsx';
  if (!result.files[entryPath]) throw new Error('The selected component source was not included in the bundle.');
  const usagePath = sharedHeader || sharedFooter ? 'src/site/SiteShell.tsx' : 'app/page.tsx';
  const usage = decode(result.files[usagePath]);
  return {
    selection: { kind: selection.kind, pageId, nodeId },
    componentName: selection.kind,
    entryPath,
    usage,
    files: result.files,
    modules: result.modules,
    warnings,
  };
}

