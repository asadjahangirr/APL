import { INPUT_TYPES, type SiteDoc, type SiteNode } from './schema';

type InputType = (typeof INPUT_TYPES)[number];

/** Field type that fits a label or placeholder ("Email" → email, "••••" → password). */
export function guessInputType(text: string): InputType {
  if (/e-?mail|@/i.test(text)) return 'email';
  if (/password|••/i.test(text)) return 'password';
  if (/phone|mobile number|\btel\b/i.test(text)) return 'tel';
  if (/search|jump to/i.test(text)) return 'search';
  if (/website|\burl\b|https?:/i.test(text)) return 'url';
  return 'text';
}

/** Link names that should point at a page with the same name ("Home" also matches the page at /). */
export function pageForLabel(doc: SiteDoc, label: string): string | null {
  const key = label.trim().toLowerCase();
  if (!key) return null;
  const page = doc.pages.find(value => value.name.trim().toLowerCase() === key) ?? (key === 'home' ? doc.pages.find(value => value.path === '/') : undefined);
  return page?.id ?? null;
}

/**
 * Designs inserted before buttons and fields were real elements: frames named
 * "… button" become buttons, and the text inside a "Field" box becomes an input
 * (a text area when the box is taller, multi-line style). Returns the same doc
 * when nothing changes.
 */
export function upgradeInteractive(doc: SiteDoc): SiteDoc {
  let nodes: Record<string, SiteNode> | null = null;
  const put = (node: SiteNode) => { nodes ??= { ...doc.nodes }; nodes[node.id] = node; };
  for (const node of Object.values(doc.nodes)) {
    if (node.type === 'frame' && node.tag === 'div' && /(^|\s)button$/i.test(node.name.trim()) && !node.link) put({ ...node, tag: 'button' });
    if (node.type === 'frame' && node.name === 'Field' && node.children.length === 1) {
      const child = doc.nodes[node.children[0]];
      if (child?.type === 'text' && child.tag === 'span') {
        const area = node.layout.alignCross === 'start';
        put({ ...child, tag: area ? 'textarea' : 'input', ...(area ? {} : { inputType: guessInputType(child.text) }), sizing: { ...child.sizing, h: 'fill' } });
      }
    }
  }
  return nodes ? { ...doc, nodes } : doc;
}

/**
 * After copying layers with new ids: a click action that points inside the
 * copy follows it to the copied layer (a duplicated accordion opens its own
 * answer). Actions pointing elsewhere are kept.
 */
export function remapLink<T extends SiteNode>(node: T, ids: Map<string, string>): T {
  const link = node.link;
  if ((link?.type === 'scroll' || link?.type === 'toggle') && ids.has(link.targetId)) return { ...node, link: { ...link, targetId: ids.get(link.targetId)! } };
  return node;
}
