import { remapLink } from './interactive';
import { siteDocSchema, type Breakpoint, type Layout, type NodeType, type Override, type Page, type SiteDoc, type SiteNode, type TextStyle } from './schema';

/** Immutable document operations used by the editor. Every function returns a new document. */

export class DocError extends Error {
  constructor(message: string) { super(message); this.name = 'DocError'; }
}

export function newId(): string {
  return crypto.randomUUID().replace(/-/g, '').slice(0, 20);
}

export const DEFAULT_TEXT_STYLE: TextStyle = {
  fontFamily: 'Inter', fontWeight: 400, fontSize: 16, lineHeight: 1.4, letterSpacing: 0,
  align: 'left', italic: false, decoration: 'none', transform: 'none',
};
export const DEFAULT_LAYOUT: Layout = {
  mode: 'none', gap: 0, counterGap: null, padding: [0, 0, 0, 0], alignMain: 'start', alignCross: 'start', wrap: false, gridColumns: 2,
};

const NAMES: Record<NodeType, string> = { frame: 'Frame', text: 'Text', rect: 'Rectangle', ellipse: 'Ellipse', image: 'Image', vector: 'Vector', embed: 'Embed' };

type NodeOf<T extends NodeType> = Extract<SiteNode, { type: T }>;
type Patch<T extends NodeType> = Partial<Omit<NodeOf<T>, 'type'>>;

export function createNode<T extends NodeType>(type: T, patch: Patch<T> = {}): NodeOf<T> {
  const common = {
    id: newId(), name: NAMES[type], parentId: null, children: [], locked: false,
    x: 0, y: 0, width: 100, height: 100,
    minWidth: null, maxWidth: null, minHeight: null, maxHeight: null,
    sizing: { h: 'fixed', v: 'fixed' }, constraints: { h: 'left', v: 'top' }, absolute: false,
    visible: true, rotation: 0, opacity: 1, fills: [], stroke: null, effects: [],
    radius: [0, 0, 0, 0], clip: false, overrides: {},
  } as const;
  const solid = (color: string) => [{ type: 'solid' as const, color, visible: true }];
  const specific = {
    frame: { type: 'frame', tag: 'div', layout: DEFAULT_LAYOUT, fills: solid('#FFFFFF'), clip: true },
    text: { type: 'text', tag: 'p', text: 'Text', textStyle: DEFAULT_TEXT_STYLE, fills: solid('#111111'), sizing: { h: 'hug', v: 'hug' }, width: 40, height: 22 },
    rect: { type: 'rect', fills: solid('#D9D9D9') },
    ellipse: { type: 'ellipse', fills: solid('#D9D9D9') },
    image: { type: 'image', assetId: null, fit: 'cover', alt: '', fills: solid('#E5E5E5') },
    vector: { type: 'vector', path: 'M0 0L100 100', viewBox: [100, 100], fills: [] },
    embed: { type: 'embed', kind: 'url', url: '', code: '', width: 560, height: 315, fills: solid('#F1F1EF') },
  }[type as NodeType];
  return { ...common, ...specific, ...patch } as unknown as NodeOf<T>;
}

export function createSiteDoc(name = 'Untitled site'): SiteDoc {
  const root = createNode('frame', { name: 'Home', width: 1440, height: 900, sizing: { h: 'fill', v: 'fixed' }, clip: false });
  const page: Page = { id: newId(), name: 'Home', path: '/', rootId: root.id, title: name, description: '' };
  return { version: 1, id: newId(), name, pages: [page], nodes: { [root.id]: root }, assets: {} };
}

export function validateDoc(doc: SiteDoc): SiteDoc { return siteDocSchema.parse(doc); }

// ── Queries ──────────────────────────────────────────────────────────────────
export function getNode(doc: SiteDoc, id: string): SiteNode {
  const node = doc.nodes[id];
  if (!node) throw new DocError('That layer no longer exists.');
  return node;
}
/** The node and all descendants, parent before children, in child order. */
export function subtreeIds(doc: SiteDoc, id: string): string[] {
  const out: string[] = [];
  const visit = (current: string) => { out.push(current); for (const child of getNode(doc, current).children) visit(child); };
  visit(id);
  return out;
}
/** Nearest parent first. */
export function ancestorIds(doc: SiteDoc, id: string): string[] {
  const out: string[] = [];
  let current = getNode(doc, id).parentId;
  while (current !== null) { out.push(current); current = getNode(doc, current).parentId; }
  return out;
}
export function pageOf(doc: SiteDoc, id: string): Page | undefined {
  const rootId = [id, ...ancestorIds(doc, id)].at(-1);
  return doc.pages.find(page => page.rootId === rootId);
}
export function isPageRoot(doc: SiteDoc, id: string): boolean { return doc.pages.some(page => page.rootId === id); }

// ── Mutations ────────────────────────────────────────────────────────────────
function withNodes(doc: SiteDoc, changes: Record<string, SiteNode | null>): SiteDoc {
  const nodes = { ...doc.nodes };
  for (const [id, node] of Object.entries(changes)) { if (node) nodes[id] = node; else delete nodes[id]; }
  return { ...doc, nodes };
}
function clampIndex(index: number | undefined, length: number): number {
  return index === undefined ? length : Math.max(0, Math.min(length, Math.trunc(index)));
}

/**
 * Insert a node (with an optional prepared subtree whose internal links are already set).
 * `nodes[0]` is the subtree root; its parent becomes `parentId`.
 */
export function insertNodes(doc: SiteDoc, nodes: SiteNode[], parentId: string, index?: number): SiteDoc {
  const parent = getNode(doc, parentId);
  if (parent.type !== 'frame') throw new DocError('Layers can only be placed inside frames.');
  if (!nodes.length) return doc;
  for (const node of nodes) if (doc.nodes[node.id]) throw new DocError('A layer with that id already exists.');
  const [root, ...rest] = nodes;
  const children = [...parent.children];
  children.splice(clampIndex(index, children.length), 0, root.id);
  return withNodes(doc, {
    [parent.id]: { ...parent, children },
    [root.id]: { ...root, parentId: parent.id },
    ...Object.fromEntries(rest.map(node => [node.id, node])),
  });
}
export function insertNode(doc: SiteDoc, node: SiteNode, parentId: string, index?: number): SiteDoc {
  return insertNodes(doc, [{ ...node, children: [] } as SiteNode], parentId, index);
}

export function removeNodes(doc: SiteDoc, ids: string[]): SiteDoc {
  let next = doc;
  for (const id of ids) {
    if (!next.nodes[id]) continue; // already removed with an ancestor
    if (isPageRoot(next, id)) throw new DocError('Delete the page to remove its page frame.');
    const node = getNode(next, id);
    const changes: Record<string, SiteNode | null> = Object.fromEntries(subtreeIds(next, id).map(child => [child, null]));
    if (node.parentId !== null) {
      const parent = getNode(next, node.parentId);
      changes[parent.id] = { ...parent, children: parent.children.filter(child => child !== id) };
    }
    next = withNodes(next, changes);
  }
  return next;
}

type Editable = Partial<Omit<SiteNode, 'id' | 'type' | 'parentId' | 'children'>> & Record<string, unknown>;
const STRUCTURAL = new Set(['id', 'type', 'parentId', 'children']);

/** Patch base (desktop) properties. Structural fields cannot be changed here. */
export function updateNode(doc: SiteDoc, id: string, patch: Editable): SiteDoc {
  const node = getNode(doc, id);
  for (const key of Object.keys(patch)) if (STRUCTURAL.has(key)) throw new DocError(`Use structural operations to change ${key}.`);
  return withNodes(doc, { [id]: { ...node, ...patch } as SiteNode });
}

/** Patch a breakpoint override. `undefined` values remove that override key. */
export function updateOverride(doc: SiteDoc, id: string, breakpoint: Exclude<Breakpoint, 'desktop'>, patch: Override): SiteDoc {
  const node = getNode(doc, id);
  const merged: Record<string, unknown> = { ...(node.overrides[breakpoint] ?? {}) };
  for (const [key, value] of Object.entries(patch)) {
    if (value === undefined) delete merged[key];
    else if (['layout', 'textStyle', 'sizing', 'constraints'].includes(key)) merged[key] = { ...(merged[key] as object | undefined), ...(value as object) };
    else merged[key] = value;
  }
  const overrides = { ...node.overrides };
  if (Object.keys(merged).length) overrides[breakpoint] = merged as Override; else delete overrides[breakpoint];
  return withNodes(doc, { [id]: { ...node, overrides } as SiteNode });
}

export function clearOverride(doc: SiteDoc, id: string, breakpoint: Exclude<Breakpoint, 'desktop'>, key?: keyof Override): SiteDoc {
  const node = getNode(doc, id);
  if (!node.overrides[breakpoint]) return doc;
  if (key === undefined) return updateOverride(doc, id, breakpoint, Object.fromEntries(Object.keys(node.overrides[breakpoint]!).map(k => [k, undefined])));
  return updateOverride(doc, id, breakpoint, { [key]: undefined });
}

/** Reparent and/or reorder. `index` is the position in the new parent's children after removal. */
export function moveNode(doc: SiteDoc, id: string, parentId: string, index?: number): SiteDoc {
  const node = getNode(doc, id);
  if (isPageRoot(doc, id)) throw new DocError('Page frames cannot be moved into other layers.');
  const target = getNode(doc, parentId);
  if (target.type !== 'frame') throw new DocError('Layers can only be placed inside frames.');
  if (parentId === id || ancestorIds(doc, parentId).includes(id)) throw new DocError('A layer cannot be moved inside itself.');
  const oldParent = getNode(doc, node.parentId!);
  const without = oldParent.children.filter(child => child !== id);
  if (oldParent.id === parentId) {
    without.splice(clampIndex(index, without.length), 0, id);
    return withNodes(doc, { [parentId]: { ...oldParent, children: without } });
  }
  const children = [...target.children];
  children.splice(clampIndex(index, children.length), 0, id);
  return withNodes(doc, {
    [oldParent.id]: { ...oldParent, children: without },
    [parentId]: { ...target, children },
    [id]: { ...node, parentId },
  });
}

/** Deep-copy a subtree with fresh ids (for duplicate / paste). Returns nodes with nodes[0] as root (parentId null). */
export function cloneSubtree(doc: SiteDoc, id: string, idFactory: () => string = newId): SiteNode[] {
  const ids = subtreeIds(doc, id);
  const map = new Map(ids.map(old => [old, idFactory()]));
  return ids.map(old => {
    const node = getNode(doc, old);
    return remapLink({ ...structuredClone(node), id: map.get(old)!, parentId: old === id ? null : map.get(node.parentId!)!, children: node.children.map(child => map.get(child)!) } as SiteNode, map);
  });
}

// ── Pages ────────────────────────────────────────────────────────────────────
export function addPage(doc: SiteDoc, name: string, path: string): SiteDoc {
  if (doc.pages.some(page => page.path === path)) throw new DocError('That page path is already used.');
  const root = createNode('frame', { name, width: 1440, height: 900, sizing: { h: 'fill', v: 'fixed' }, clip: false });
  const page: Page = { id: newId(), name, path, rootId: root.id, title: name, description: '' };
  return { ...doc, pages: [...doc.pages, page], nodes: { ...doc.nodes, [root.id]: root } };
}
export function removePage(doc: SiteDoc, pageId: string): SiteDoc {
  const page = doc.pages.find(value => value.id === pageId);
  if (!page) return doc;
  if (page.path === '/') throw new DocError('The home page cannot be deleted.');
  const nodes = { ...doc.nodes };
  for (const id of subtreeIds(doc, page.rootId)) delete nodes[id];
  return { ...doc, pages: doc.pages.filter(value => value.id !== pageId), nodes };
}

// ── Geometry-aware edits ─────────────────────────────────────────────────────
const round = (value: number) => Math.round(value * 100) / 100;

/**
 * Figma-style constraints: when a frame changes size from (ow, oh) to (nw, nh),
 * reposition/resize its freely positioned children so they keep their pinned
 * relationship (right, center, stretch, scale). Recurses into resized frames.
 */
export function applyConstraints(doc: SiteDoc, frameId: string, ow: number, oh: number, nw: number, nh: number): SiteDoc {
  const frame = getNode(doc, frameId);
  if (frame.type !== 'frame') return doc;
  const dw = nw - ow, dh = nh - oh;
  if (Math.abs(dw) < 0.01 && Math.abs(dh) < 0.01) return doc;
  let next = doc;
  for (const childId of frame.children) {
    const child = getNode(next, childId);
    if (frame.layout.mode !== 'none' && !child.absolute) continue;
    let { x, y, width, height } = child;
    switch (child.constraints.h) {
      case 'right': x += dw; break;
      case 'leftRight': width = Math.max(1, width + dw); break;
      case 'center': x += dw / 2; break;
      case 'scale': if (ow > 0) { x *= nw / ow; width = Math.max(1, width * nw / ow); } break;
    }
    switch (child.constraints.v) {
      case 'bottom': y += dh; break;
      case 'topBottom': height = Math.max(1, height + dh); break;
      case 'center': y += dh / 2; break;
      case 'scale': if (oh > 0) { y *= nh / oh; height = Math.max(1, height * nh / oh); } break;
    }
    [x, y, width, height] = [x, y, width, height].map(round);
    if (x === child.x && y === child.y && width === child.width && height === child.height) continue;
    next = updateNode(next, childId, { x, y, width, height });
    if (child.type === 'frame' && (width !== child.width || height !== child.height)) next = applyConstraints(next, childId, child.width, child.height, width, height);
  }
  return next;
}

/** Resize a node and carry its constrained children along. */
export function resizeNode(doc: SiteDoc, id: string, bounds: { x?: number; y?: number; width?: number; height?: number }): SiteDoc {
  const node = getNode(doc, id);
  const width = round(Math.max(1, bounds.width ?? node.width)), height = round(Math.max(1, bounds.height ?? node.height));
  let next = updateNode(doc, id, { x: round(bounds.x ?? node.x), y: round(bounds.y ?? node.y), width, height });
  if (node.type === 'frame') next = applyConstraints(next, id, node.width, node.height, width, height);
  return next;
}

export function updatePage(doc: SiteDoc, pageId: string, patch: Partial<Omit<Page, 'id' | 'rootId'>>): SiteDoc {
  const page = doc.pages.find(value => value.id === pageId);
  if (!page) throw new DocError('That page no longer exists.');
  if (patch.path !== undefined && patch.path !== page.path) {
    if (page.path === '/') throw new DocError('The home page always lives at /.');
    if (doc.pages.some(value => value.path === patch.path)) throw new DocError('That page path is already used.');
  }
  return { ...doc, pages: doc.pages.map(value => (value.id === pageId ? { ...value, ...patch } : value)) };
}

/** Turn a page name into a valid, unused path such as /about or /about-2. */
export function pathForName(doc: SiteDoc, name: string): string {
  const slug = name.toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40) || 'page';
  const reserved = ['admin', 'api', 'assets', 'auth', 'node-modules'];
  const base = '/' + (reserved.includes(slug) ? slug + '-page' : slug);
  let path = base, suffix = 2;
  while (doc.pages.some(page => page.path === path)) path = `${base}-${suffix++}`;
  return path;
}

/** "Rectangle 3" style default names. */
export function nextName(doc: SiteDoc, base: string): string {
  let max = 0;
  const pattern = new RegExp('^' + base.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + ' (\\d+)$');
  for (const node of Object.values(doc.nodes)) {
    const match = pattern.exec(node.name);
    if (match) max = Math.max(max, Number(match[1]));
  }
  return `${base} ${max + 1}`;
}

/** Replace a frame's child order with a permutation of the same children. */
export function setChildrenOrder(doc: SiteDoc, parentId: string, order: string[]): SiteDoc {
  const parent = getNode(doc, parentId);
  if (order.length !== parent.children.length || new Set(order).size !== order.length || order.some(id => !parent.children.includes(id))) throw new DocError('That layer order is not valid.');
  if (order.every((id, index) => parent.children[index] === id)) return doc;
  return { ...doc, nodes: { ...doc.nodes, [parentId]: { ...parent, children: order } } };
}
