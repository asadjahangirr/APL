import site from '../site-data.json';

type Page = { id: string; name: string; path: string; nodes: { type: string; props: Record<string, unknown> }[] };
// Use an explicit shape: generated JSON can contain a different union of nodes
// for each website, including websites with no custom section anchors.
const pages: readonly Page[] = site.pages;
export const portfolioPages = pages.map(page => ({ id: page.id, name: page.name, path: page.path }));
export function portfolioTargetHref(target: { pageId: string; anchor: string }): string | undefined {
  const page = pages.find(page => page.id === target.pageId);
  if (!page) return undefined;
  const anchors = ['#top', ...page.nodes.flatMap(node => node.type === 'Contact' ? ['#contact']
    : node.type === 'Services' ? ['#services'] : node.type === 'Section' && typeof node.props.anchor === 'string' ? [node.props.anchor] : [])];
  return anchors.includes(target.anchor) ? page.path + (target.anchor === '#top' ? '' : target.anchor) : undefined;
}
