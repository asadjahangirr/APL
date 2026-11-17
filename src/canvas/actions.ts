import { cloneSubtree, createNode, insertNode, insertNodes, isPageRoot, nextName, removeNodes, updateNode } from '../doc/ops';
import type { Asset, SiteDoc, SiteNode } from '../doc/schema';
import { insertSize, type Point, type Rect } from './geometry';
import { addAutoLayout } from './autolayout';
import { instantiate } from '../doc/components';
import { boxInParent, wrapSelection, type Measure } from './arrange';
import type { EditorStore } from './store';

/** Editing commands shared by keyboard shortcuts, menus and tests. */

const editable = (doc: SiteDoc, ids: string[]) => ids.filter(id => doc.nodes[id] && !isPageRoot(doc, id));
const isFreeChild = (doc: SiteDoc, node: SiteNode) => {
  const parent = node.parentId ? doc.nodes[node.parentId] : null;
  return !!parent && parent.type === 'frame' && (parent.layout.mode === 'none' || node.absolute);
};

export function deleteSelection(store: EditorStore): void {
  const { doc, selection } = store.getState();
  const ids = editable(doc, selection);
  if (!ids.length) return;
  const parent = doc.nodes[ids[0]].parentId;
  store.commit(current => removeNodes(current, ids), { selection: parent && !isPageRoot(doc, parent) ? [parent] : [] });
}

export function duplicateSelection(store: EditorStore): void {
  const { doc, selection } = store.getState();
  const ids = editable(doc, selection);
  if (!ids.length) return;
  const created: string[] = [];
  store.commit(current => ids.reduce((next, id) => {
    const node = next.nodes[id];
    // Duplicating a main component makes a linked instance of it.
    const clones = node.component ? instantiate(next, id) : cloneSubtree(next, id);
    const [root] = clones;
    if (isFreeChild(next, node)) { root.x = node.x + 10; root.y = node.y + 10; }
    root.name = node.name;
    created.push(root.id);
    const parent = next.nodes[node.parentId!];
    return insertNodes(next, clones, parent.id, parent.children.indexOf(id) + 1);
  }, current), { selection: created });
}

/** Ctrl+Alt+K: make the selected frame a main component (other selections are framed first). */
export function createComponent(store: EditorStore, measure: Measure): void {
  let { doc, selection } = store.getState();
  if (!selection.length) return;
  if (selection.length > 1 || doc.nodes[selection[0]]?.type !== 'frame') { wrapSelection(store, measure, 'frame'); ({ doc, selection } = store.getState()); }
  const node = doc.nodes[selection[0]];
  if (!node || node.type !== 'frame' || isPageRoot(doc, node.id)) { store.notify('Select a frame, or layers to wrap in one, to create a component.'); return; }
  if (node.instanceOf || node.sourceId) { store.notify('This is part of an instance. Detach it first to make a new component from it.'); return; }
  if (store.commit(current => updateNode(current, node.id, { component: true }))) store.notify('Component created. Press Ctrl+D to add instances; editing this one updates them all.');
}

export function nudge(store: EditorStore, dx: number, dy: number): void {
  const { doc, selection } = store.getState();
  const ids = editable(doc, selection).filter(id => isFreeChild(doc, doc.nodes[id]) && !doc.nodes[id].locked);
  if (!ids.length) return;
  store.commit(current => ids.reduce((next, id) => updateNode(next, id, { x: next.nodes[id].x + dx, y: next.nodes[id].y + dy }), current));
}

/** Esc: select the parent (deselect at the top level). */
export function selectParent(store: EditorStore): void {
  const { doc, selection } = store.getState();
  const node = selection.length ? doc.nodes[selection[0]] : undefined;
  const parent = node?.parentId;
  store.select(parent && !isPageRoot(doc, parent) ? [parent] : []);
}
/** Enter: select the children of the selected frame. */
export function selectChildren(store: EditorStore): void {
  const { doc, selection } = store.getState();
  const children = selection.flatMap(id => doc.nodes[id]?.children ?? []);
  if (children.length) store.select(children);
}
/** Ctrl/⌘+A: select all siblings of the current selection (or all top-level layers). */
export function selectAll(store: EditorStore): void {
  const { doc, selection, pageId } = store.getState();
  const page = doc.pages.find(value => value.id === pageId)!;
  const parentId = selection.length && doc.nodes[selection[0]] && !isPageRoot(doc, selection[0]) ? doc.nodes[selection[0]].parentId! : page.rootId;
  store.select([...doc.nodes[parentId].children]);
}

/**
 * Shift+A: remove auto layout from a selected auto-layout frame; otherwise add
 * it, inferring direction, gap, padding and order from the current arrangement
 * (a frame keeps its children; other selections are wrapped in a new frame).
 */
export function toggleAutoLayout(store: EditorStore, measure: Measure = () => null): void {
  const { doc, selection } = store.getState();
  const ids = selection.filter(id => doc.nodes[id]);
  if (!ids.length) return;
  const node = doc.nodes[ids[0]];
  if (ids.length === 1 && node.type === 'frame' && node.layout.mode !== 'none') {
    store.commit(current => updateNode(current, node.id, {
      layout: { ...node.layout, mode: 'none' },
      sizing: { h: node.sizing.h === 'hug' ? 'fixed' : node.sizing.h, v: node.sizing.v === 'hug' ? 'fixed' : node.sizing.v },
    }));
    return;
  }
  const subjects = ids.length === 1 && node.type === 'frame' ? node.children : ids.filter(id => !isPageRoot(doc, id));
  if (!subjects.length && !(ids.length === 1 && node.type === 'frame')) return;
  const rects = new Map(subjects.map(id => [id, boxInParent(doc, id, measure)]));
  let frameId = '';
  store.commit(current => { const result = addAutoLayout(current, ids.length === 1 && node.type === 'frame' ? ids : subjects, rects); frameId = result.frameId; return result.doc; });
  if (frameId) store.select([frameId]);
}

/**
 * Add an image asset and an image layer centered on `at` (world space) inside
 * `containerId`, appended to the flow if the container uses auto layout.
 */
export function insertImage(store: EditorStore, asset: Asset, containerId: string, container: Rect, at: Point): void {
  const { doc } = store.getState();
  const parent = doc.nodes[containerId];
  if (!parent || parent.type !== 'frame') return;
  const size = insertSize(asset.width, asset.height, Math.min(640, Math.max(64, container.w - 32)));
  const node = createNode('image', {
    name: asset.name || nextName(doc, 'Image'), assetId: asset.id, alt: '', fills: [], ...size,
    x: Math.round(at.x - container.x - size.width / 2), y: Math.round(at.y - container.y - size.height / 2),
  });
  store.commit(current => insertNode({ ...current, assets: { ...current.assets, [asset.id]: asset } }, node, containerId), { selection: [node.id] });
}

export const SAMPLE_CODE = `<style>
  body { margin: 0; display: grid; place-items: center; height: 100vh; font-family: system-ui, sans-serif; }
  button { padding: 12px 20px; border: 0; border-radius: 10px; background: #111; color: #fff; font: inherit; cursor: pointer; }
</style>
<button onclick="this.textContent = 'Clicked ' + (++window.n || (window.n = 1)) + '×'">Click me</button>`;

/** Add an embed layer (video, map or custom code) centered at a point and select it. */
export function insertEmbed(store: EditorStore, kind: 'video' | 'map' | 'code', containerId: string, container: Rect, at: Point): void {
  const { doc } = store.getState();
  if (doc.nodes[containerId]?.type !== 'frame') return;
  const width = Math.min(560, Math.max(160, container.w - 32)), height = Math.round(width * (kind === 'map' ? 0.6 : 0.5625));
  const node = createNode('embed', {
    name: nextName(doc, kind === 'video' ? 'Video' : kind === 'map' ? 'Map' : 'Code'), kind: kind === 'code' ? 'code' : 'url', width, height, radius: [12, 12, 12, 12],
    url: kind === 'map' ? 'https://www.google.com/maps?q=' + encodeURIComponent('Eiffel Tower, Paris') + '&output=embed' : '',
    code: kind === 'code' ? SAMPLE_CODE : '',
    x: Math.round(at.x - container.x - width / 2), y: Math.round(at.y - container.y - height / 2),
  });
  store.commit(current => insertNode(current, node, containerId), { selection: [node.id] });
  if (kind === 'video') store.notify('Paste a YouTube or Vimeo link into Embed › Address in the Design panel.');
}

/** Swap the picture of an existing image layer, keeping its width and adapting its height. */
export function replaceImage(store: EditorStore, id: string, asset: Asset): void {
  store.commit(current => {
    const node = current.nodes[id];
    if (!node || node.type !== 'image') return current;
    const height = node.sizing.v === 'fixed' ? Math.round(node.width * asset.height / asset.width) : node.height;
    return updateNode({ ...current, assets: { ...current.assets, [asset.id]: asset } }, id, { assetId: asset.id, height, name: node.name });
  });
}

/** Drop assets no layer references any more (keeps saved documents small). */
export function pruneAssets(doc: SiteDoc): SiteDoc {
  // Images used by layers and by site settings (favicon, social preview).
  const used = new Set<string>([doc.settings?.favicon, doc.settings?.socialImage].filter((id): id is string => !!id));
  for (const node of Object.values(doc.nodes)) {
    if (node.type === 'image' && node.assetId) used.add(node.assetId);
    for (const paint of [...node.fills, ...Object.values(node.overrides).flatMap(o => o?.fills ?? [])]) if (paint.type === 'image') used.add(paint.assetId);
  }
  const unused = Object.keys(doc.assets).filter(id => !used.has(id));
  if (!unused.length) return doc;
  const assets = { ...doc.assets };
  for (const id of unused) delete assets[id];
  return { ...doc, assets };
}
