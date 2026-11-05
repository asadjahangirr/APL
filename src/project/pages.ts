import { buttonDestinationSchema, hasArticles, hasServices, hasPortfolio, projectSchema, type ButtonDestination, type ComponentProps, type Project, type SitePage, type NavigationLink } from './schema';

export function pageAnchors(page: SitePage) {
  return ['#top', ...(page.nodes.some(n => n.type === 'Services') ? ['#services'] : []), ...(page.nodes.some(n => n.type === 'Contact') ? ['#contact'] : []),
    ...page.nodes.flatMap(node => node.type === 'Section' && node.props.anchor ? [node.props.anchor] : [])];
}
export function navigationLinks(project: Project): NavigationLink[] {
  return [...project.pages.filter(page => page.inNavigation).map(page => ({ id: page.id, label: page.name, href: page.path })), ...(hasServices(project) ? [{id:'services-cms',label:'Services',href:'/services'}] : []), ...(hasArticles(project) ? [{id:'articles-cms',label:'Articles',href:'/articles'}] : [])];
}
export function headerHref(project: Project): string | null {
  return targetHref(project, project.shared.header.props.target);
}
export function targetHref(project: Project, target: Project['shared']['header']['props']['target']): string | null {
  const page = project.pages.find(page => page.id === target.pageId);
  return page && pageAnchors(page).includes(target.anchor) ? page.path + (target.anchor === '#top' ? '' : target.anchor) : null;
}
export function destinationHref(project: Project, destination: ButtonDestination): string | null {
  const parsed = buttonDestinationSchema.safeParse(destination);
  if (!parsed.success) return null;
  const selected = parsed.data;
  switch (selected.kind) {
    case 'url': return selected.value;
    case 'email': return 'mailto:' + selected.value;
    case 'phone': return 'tel:' + selected.value.replace(/[ ()-]/g, '');
    case 'service': { const entry = project.content.services.find(item => item.id === selected.entryId); return hasServices(project) && entry?.published ? '/services/' + entry.published.slug : null; }
    case 'article': { const entry = project.content.articles.find(item => item.id === selected.entryId); return hasArticles(project) && entry?.published ? '/articles/' + entry.published.slug : null; }
    case 'portfolio': { const entry = project.content.portfolio.find(item => item.id === selected.entryId); return hasPortfolio(project) && entry?.published ? entry.published.target ? targetHref(project, entry.published.target) : entry.published.externalUrl || null : null; }
  }
}
/** An external destination intentionally takes precedence over the legacy target. */
export function buttonHref(project: Project, button: ComponentProps['Button']): string | null {
  return button.destination ? destinationHref(project, button.destination) : targetHref(project, button.target);
}
export function iconHref(project: Project, icon: ComponentProps['Icon']): string | null {
  return icon.destination ? destinationHref(project, icon.destination) : icon.target ? targetHref(project, icon.target) : null;
}
export function addPage(project: Project, name: string, path: string): Project {
  const page: SitePage = { id: crypto.randomUUID(), name, path, inNavigation: true, title: name, description: '', nodes: [
    { id: crypto.randomUUID(), type: 'Hero', props: { eyebrow: '', title: name, description: 'Tell your story here.', image: '', imageAlt: '', layout: 'statement' } }
  ] };
  return projectSchema.parse({ ...project, updatedAt: new Date().toISOString(), pages: [...project.pages, page] });
}
export function editPage(project: Project, id: string, settings: Pick<SitePage, 'name' | 'path' | 'inNavigation' | 'showHeader' | 'showFooter'>): Project {
  const current = project.pages.find(page => page.id === id);
  if (!current) throw new Error('Page not found.');
  if (current.path === '/' && settings.path !== '/') throw new Error('The homepage stays at /.');
  return projectSchema.parse({ ...project, updatedAt: new Date().toISOString(), pages: project.pages.map(page => page.id === id ? { ...page, ...settings } : page) });
}
export function movePage(project: Project, id: string, direction: -1 | 1): Project {
  const index = project.pages.findIndex(page => page.id === id), target = index + direction;
  if (index < 0 || target < 0 || target >= project.pages.length) return project;
  const pages = [...project.pages]; [pages[index], pages[target]] = [pages[target], pages[index]];
  return projectSchema.parse({ ...project, updatedAt: new Date().toISOString(), pages });
}
export function removePage(project: Project, id: string): Project {
  const page = project.pages.find(page => page.id === id);
  if (!page || page.path === '/') throw new Error('The homepage cannot be deleted.');
  const copy = structuredClone(project);
  copy.pages = copy.pages.filter(page => page.id !== id);
  if (copy.shared.header.props.target.pageId === id) {
    copy.shared.header.props.target = { pageId: copy.pages.find(page => page.path === '/')!.id, anchor: '#top' };
  }
  return projectSchema.parse({ ...copy, updatedAt: new Date().toISOString() });
}
