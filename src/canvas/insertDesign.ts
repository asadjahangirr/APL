import { pageForLabel } from '../doc/interactive';
import { createNode, DEFAULT_LAYOUT, insertNodes, updateNode } from '../doc/ops';
import { siteDocSchema, type FrameNode, type SiteDoc, type SiteNode } from '../doc/schema';
import { buildItem, type LibraryItem, type Theme } from '../library/catalog';
import { solid } from '../library/kit';
import type { EditorStore } from './store';

/**
 * Where a library design lands:
 * - sections and pages stack on the current page (after the selected section,
 *   if any). An empty free-form page becomes a vertical stack; a page that
 *   already has free-form content gets the sections in a new stack below it.
 * - elements go inside the selected frame, or next to the selected layer.
 */
/** Placeholder links named after one of the site's pages ("About", "Home") go to that page. */
function linkToPage(doc: SiteDoc, node: SiteNode): SiteNode {
  if (node.link?.type !== 'url' || node.link.href !== '#') return node;
  const pageId = pageForLabel(doc, node.type === 'text' ? node.text : node.name);
  return pageId ? { ...node, link: { type: 'page', pageId } } as SiteNode : node;
}

export function planInsert(doc: SiteDoc, pageRootId: string, selection: string[], item: LibraryItem, theme: Theme, at?: { x: number; y: number }): { doc: SiteDoc; select: string[] } {
  const root = doc.nodes[pageRootId] as FrameNode;
  const subtrees = buildItem(item, theme).map(nodes => nodes.map(node => linkToPage(doc, node)));
  const selected = selection.length === 1 && selection[0] !== root.id ? doc.nodes[selection[0]] : undefined;
  let next = doc, parentId = root.id, index: number | undefined, select = subtrees.map(nodes => nodes[0].id);

  if (item.kind === 'element' && selected) {
    if (selected.type === 'frame') parentId = selected.id;
    else { parentId = selected.parentId!; index = doc.nodes[parentId].children.indexOf(selected.id) + 1; }
  } else if (selected) {
    let top = selected;
    while (top.parentId && top.parentId !== root.id) top = doc.nodes[top.parentId];
    index = root.children.indexOf(top.id) + 1;
  }

  const parent = doc.nodes[parentId] as FrameNode;
  const free = parent.layout.mode === 'none';
  if (parentId === root.id && free && item.kind !== 'element') {
    if (root.children.length === 0) {
      next = updateNode(next, root.id, { layout: { ...root.layout, mode: 'vertical' }, sizing: { ...root.sizing, v: 'hug' }, fills: solid(theme.bg) });
    } else {
      const bottom = Math.max(0, ...root.children.map(id => doc.nodes[id].y + doc.nodes[id].height));
      const stack = createNode('frame', {
        name: item.kind === 'page' ? item.name : 'Sections', x: 0, y: Math.round(bottom), width: root.width, height: 600,
        sizing: { h: 'fixed', v: 'hug' }, constraints: { h: 'leftRight', v: 'top' }, fills: [], clip: false, layout: { ...DEFAULT_LAYOUT, mode: 'vertical' },
      });
      next = insertNodes(next, [stack], root.id);
      parentId = stack.id; index = undefined; select = [stack.id];
    }
  }

  let offset = 0;
  for (const nodes of subtrees) {
    if (free && item.kind === 'element') {
      const bottom = Math.max(0, ...parent.children.map(id => doc.nodes[id].y + doc.nodes[id].height));
      nodes[0] = { ...nodes[0], x: Math.round(at?.x ?? 40) + offset, y: Math.round(at?.y ?? bottom + 40) + offset };
      offset += 24;
    }
    next = insertNodes(next, nodes, parentId, index);
    if (index !== undefined) index++;
  }
  return { doc: next, select };
}

/** Insert a library design into the current page. Returns the new top-level layer ids, or null if it does not fit. */
export function insertDesign(store: EditorStore, item: LibraryItem, theme: Theme, at?: { x: number; y: number }): string[] | null {
  const { doc, pageId, selection } = store.getState();
  const page = doc.pages.find(value => value.id === pageId) ?? doc.pages[0];
  const plan = planInsert(doc, page.rootId, selection.filter(id => doc.nodes[id]), item, theme, at);
  const valid = siteDocSchema.safeParse(plan.doc);
  if (!valid.success) { store.notify('That design could not be added: ' + (valid.error.issues[0]?.message ?? 'it does not fit this site.')); return null; }
  return store.commit(() => plan.doc, { selection: plan.select }) ? plan.select : null;
}
