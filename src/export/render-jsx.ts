import type { SiteNode } from '../project/schema';

export const layoutComponentKinds = new Set<string>(['Section', 'Columns', 'Column', 'Heading', 'Paragraph', 'Image', 'Button', 'Icon']);
export interface JSXOptions {
  href?: (node: SiteNode) => string | undefined;
  items?: (node: SiteNode) => string | undefined;
  extra?: (node: SiteNode) => string;
}
/** Validated structure becomes JSX; authored strings remain JSON data. */
export function renderNodeJSX(node: SiteNode, expression: string, options: JSXOptions = {}, depth = 0): string {
  const indent = '  '.repeat(depth);
  const id = layoutComponentKinds.has(node.type) ? ' id={' + JSON.stringify(node.id) + '}' : '';
  const href = options.href?.(node), items = options.items?.(node);
  const opening = indent + '<' + node.type + ' {...(' + expression + '.props as ComponentProps[' + JSON.stringify(node.type) + '])}' + id +
    (href ? ' href={' + href + '}' : '') + (items ? ' items={' + items + '}' : '') + (options.extra?.(node) ?? '');
  if (!('children' in node)) return opening + ' />';
  return opening + '>\n' + node.children.map((child, index) => renderNodeJSX(child, expression + '.children![' + index + ']', options, depth + 1)).join('\n') + '\n' + indent + '</' + node.type + '>';
}
