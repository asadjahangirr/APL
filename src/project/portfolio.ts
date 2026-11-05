import { projectSchema, type Project } from './schema';
import { emptyPortfolio, portfolioPayloadSchema, publishedPortfolioSchema, type PortfolioPayload, type PublicPortfolio } from './portfolio-schema';
import { targetHref } from './pages';

export const portfolioCollectionDefaults = {
  title: 'Selected work', description: 'A selection of projects, each with a story of its own.',
  mobile: 1, tablet: 2, desktop: 2, gap: 32, design: 'gallery' as const, motion: 'lift' as const,
};
export function publicPortfolio(project: Project): PublicPortfolio[] {
  return project.content.portfolio.flatMap(entry => entry.published ? [{ id: entry.id, ...entry.published,
    href: entry.published.target ? targetHref(project, entry.published.target) ?? undefined : entry.published.externalUrl,
  }] : [])
    .sort((a, b) => a.id < b.id ? -1 : a.id > b.id ? 1 : 0);
}
export function addPortfolioCollection(project: Project, pageId: string): Project {
  return projectSchema.parse({ ...project, updatedAt: new Date().toISOString(), pages: project.pages.map(page =>
    page.id !== pageId || page.nodes.some(node => node.type === 'PortfolioCollection') ? page :
      { ...page, nodes: [...page.nodes, { id: crypto.randomUUID(), type: 'PortfolioCollection', props: portfolioCollectionDefaults }] }) });
}
export function createPortfolioItem(project: Project): { project: Project; id: string } {
  const id = crypto.randomUUID();
  return { id, project: projectSchema.parse({ ...project, updatedAt: new Date().toISOString(), content: {
    ...project.content, portfolio: [...project.content.portfolio, { id, draft: emptyPortfolio(), published: null, revision: 1, publishedRevision: null }],
  } }) };
}
export function mutatePortfolioItem(project: Project, id: string, action: 'save' | 'publish' | 'unpublish', expectedRevision: number, draft?: PortfolioPayload): Project {
  const entry = project.content.portfolio.find(item => item.id === id);
  if (!entry) throw new Error('Portfolio project not found.');
  if (entry.revision !== expectedRevision) throw new Error('This portfolio project changed. Reopen it before saving.');
  const revision = entry.revision + 1;
  const updated = action === 'save' ? { ...entry, draft: portfolioPayloadSchema.parse(draft), revision }
    : action === 'publish' ? { ...entry, published: structuredClone(publishedPortfolioSchema.parse(entry.draft)), revision, publishedRevision: revision }
    : { ...entry, published: null, revision, publishedRevision: null };
  return projectSchema.parse({ ...project, updatedAt: new Date().toISOString(), content: {
    ...project.content, portfolio: project.content.portfolio.map(item => item.id === id ? updated : item),
  } });
}
