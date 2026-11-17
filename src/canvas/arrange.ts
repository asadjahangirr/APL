import { remapLink } from '../doc/interactive';
import { z } from 'zod';
import { createNode, getNode, insertNodes, isPageRoot, moveNode, newId, nextName, removeNodes, setChildrenOrder, subtreeIds, updateNode } from '../doc/ops';
import { assetSchema, MAX_ASSETS, MAX_NODES, nodeSchema, siteDocSchema, type Asset, type SiteDoc, type SiteNode, type TextStyle } from '../doc/schema';
import type { Point, Rect } from './geometry';
import { unionRect } from './snap';
import type { EditorStore } from './store';

/**
 * Arrangement and clipboard commands. Functions that need on-screen geometry
 * receive `measure`, which returns a layer's world-space rect (or null).
 */
export type Measure = (id: string) => Rect | null;

const isFreeIn = (doc: SiteDoc, node: SiteNode) => {
  const parent = node.parentId ? doc.nodes[node.parentId] : null;
  return !!parent && parent.type === 'frame' && (parent.layout.mode === 'none' || node.absolute);
};
/** Selected ids, without page roots and without layers whose ancestor is also selected. */
export function topLevelSelection(doc: SiteDoc, ids: string[]): string[] {
  // Page roots are never arranged, so they must not hide their children either.
  const set = new Set(ids.filter(id => !isPageRoot(doc, id)));
  return ids.filter(id => {
    const node = doc.nodes[id];
    if (!node || isPageRoot(doc, id)) return false;
    let parent = node.parentId;
    while (parent) { if (set.has(parent)) return false; parent = doc.nodes[parent]?.parentId ?? null; }
    return true;
  });
}

/** A layer's box in its parent's coordinate space (authored values when free, measured otherwise). */
export function boxInParent(doc: SiteDoc, id: string, measure: Measure): Rect {
  const node = getNode(doc, id);
  if (isFreeIn(doc, node)) return { x: node.x, y: node.y, w: node.width, h: node.height };
  const own = measure(id), parent = node.parentId ? measure(node.parentId) : null;
  if (!own || !parent) return { x: node.x, y: node.y, w: node.width, h: node.height };
  return { x: own.x - parent.x, y: own.y - parent.y, w: own.w, h: own.h };
}

// ── Group / frame selection / ungroup ────────────────────────────────────────
export function wrapSelection(store: EditorStore, measure: Measure, kind: 'group' | 'frame'): void {
  const { doc, selection } = store.getState();
  const ids = topLevelSelection(doc, selection);
  if (!ids.length) return;
  const parentId = doc.nodes[ids[0]].parentId!;
  if (ids.some(id => doc.nodes[id].parentId !== parentId)) { store.notify('Select layers inside the same frame to group them.'); return; }
  const parent = doc.nodes[parentId];
  if (parent.type !== 'frame') return;
  const ordered = parent.children.filter(id => ids.includes(id));
  const boxes = new Map(ordered.map(id => [id, boxInParent(doc, id, measure)]));
  const union = unionRect([...boxes.values()]);
  const flowParent = parent.layout.mode !== 'none';
  const frame = createNode('frame', {
    name: nextName(doc, kind === 'group' ? 'Group' : 'Frame'),
    x: Math.round(union.x), y: Math.round(union.y), width: Math.max(1, Math.round(union.w)), height: Math.max(1, Math.round(union.h)),
    fills: [], clip: false, absolute: flowParent && ordered.every(id => doc.nodes[id].absolute),
  });
  const indices = ordered.map(id => parent.children.indexOf(id));
  const index = flowParent ? Math.min(...indices) : Math.max(...indices) + 1;
  store.commit(current => {
    let next = insertNodes(current, [frame], parentId, index);
    ordered.forEach((id, i) => {
      const box = boxes.get(id)!, node = next.nodes[id];
      next = moveNode(next, id, frame.id, i);
      next = updateNode(next, id, {
        x: Math.round(box.x - frame.x), y: Math.round(box.y - frame.y), absolute: false,
        // Inside a free frame, "fill" has no container to fill: keep the measured size.
        sizing: { h: node.sizing.h === 'fill' ? 'fixed' : node.sizing.h, v: node.sizing.v === 'fill' ? 'fixed' : node.sizing.v },
        width: node.sizing.h === 'fill' ? Math.round(box.w) : node.width, height: node.sizing.v === 'fill' ? Math.round(box.h) : node.height,
      });
    });
    return next;
  }, { selection: [frame.id] });
}

export function ungroupSelection(store: EditorStore, measure: Measure): void {
  const { doc, selection } = store.getState();
  const frames = topLevelSelection(doc, selection).filter(id => doc.nodes[id].type === 'frame' && doc.nodes[id].children.length);
  if (!frames.length) return;
  const released: string[] = [];
  store.commit(current => {
    let next = current;
    for (const id of frames) {
      const frame = next.nodes[id];
      const parentId = frame.parentId!;
      const parent = next.nodes[parentId];
      if (parent.type !== 'frame') continue;
      const origin = boxInParent(next, id, measure);
      const children = [...frame.children];
      const childBoxes = new Map(children.map(child => [child, boxInParent(next, child, measure)]));
      let index = parent.children.indexOf(id);
      for (const child of children) {
        const box = childBoxes.get(child)!;
        next = moveNode(next, child, parentId, index++);
        const node = next.nodes[child];
        next = updateNode(next, child, {
          x: Math.round(origin.x + box.x), y: Math.round(origin.y + box.y),
          ...(parent.layout.mode === 'none' && (node.sizing.h === 'fill' || node.sizing.v === 'fill') ? {
            sizing: { h: node.sizing.h === 'fill' ? 'fixed' : node.sizing.h, v: node.sizing.v === 'fill' ? 'fixed' : node.sizing.v },
            width: Math.round(box.w), height: Math.round(box.h),
          } : {}),
        });
        released.push(child);
      }
      next = removeNodes(next, [id]);
    }
    return next;
  }, { selection: released });
}

// ── Align / distribute ───────────────────────────────────────────────────────
export type AlignEdge = 'left' | 'hcenter' | 'right' | 'top' | 'vcenter' | 'bottom';

export function align(store: EditorStore, measure: Measure, edge: AlignEdge): void {
  const { doc, selection } = store.getState();
  const ids = topLevelSelection(doc, selection).filter(id => isFreeIn(doc, doc.nodes[id]) && !doc.nodes[id].locked);
  if (!ids.length) { store.notify('Alignment moves freely positioned layers. In auto layout, use the frame’s alignment instead.'); return; }
  const rects = new Map(ids.map(id => [id, measure(id)]).filter((entry): entry is [string, Rect] => entry[1] !== null));
  if (!rects.size) return;
  const target = ids.length === 1 ? measure(doc.nodes[ids[0]].parentId!) : unionRect([...rects.values()]);
  if (!target) return;
  store.commit(current => [...rects].reduce((next, [id, r]) => {
    const dx = edge === 'left' ? target.x - r.x : edge === 'right' ? target.x + target.w - r.x - r.w : edge === 'hcenter' ? target.x + target.w / 2 - r.x - r.w / 2 : 0;
    const dy = edge === 'top' ? target.y - r.y : edge === 'bottom' ? target.y + target.h - r.y - r.h : edge === 'vcenter' ? target.y + target.h / 2 - r.y - r.h / 2 : 0;
    if (!dx && !dy) return next;
    const node = next.nodes[id];
    return updateNode(next, id, { x: Math.round(node.x + dx), y: Math.round(node.y + dy) });
  }, current));
}

/** Equal gaps between three or more freely positioned layers. */
export function distribute(store: EditorStore, measure: Measure, axis: 'h' | 'v'): void {
  const { doc, selection } = store.getState();
  const ids = topLevelSelection(doc, selection).filter(id => isFreeIn(doc, doc.nodes[id]) && !doc.nodes[id].locked);
  const items = ids.map(id => ({ id, r: measure(id) })).filter((item): item is { id: string; r: Rect } => item.r !== null);
  if (items.length < 3) { store.notify('Select three or more freely positioned layers to distribute spacing.'); return; }
  const pos = (r: Rect) => (axis === 'h' ? r.x : r.y), len = (r: Rect) => (axis === 'h' ? r.w : r.h);
  items.sort((a, b) => pos(a.r) - pos(b.r));
  const start = pos(items[0].r), end = Math.max(...items.map(item => pos(item.r) + len(item.r)));
  const gap = (end - start - items.reduce((sum, item) => sum + len(item.r), 0)) / (items.length - 1);
  let cursor = start;
  store.commit(current => items.reduce((next, item) => {
    const delta = Math.round(cursor - pos(item.r));
    cursor += len(item.r) + gap;
    if (!delta) return next;
    const node = next.nodes[item.id];
    return updateNode(next, item.id, axis === 'h' ? { x: node.x + delta } : { y: node.y + delta });
  }, current));
}

// ── Layer order ──────────────────────────────────────────────────────────────
export type OrderOp = 'forward' | 'backward' | 'front' | 'back';

export function reorderSelection(store: EditorStore, op: OrderOp): void {
  const { doc, selection } = store.getState();
  const ids = new Set(topLevelSelection(doc, selection));
  const parents = new Set([...ids].map(id => doc.nodes[id].parentId!));
  store.commit(current => [...parents].reduce((next, parentId) => {
    const order = [...next.nodes[parentId].children];
    if (op === 'front') return setChildrenOrder(next, parentId, [...order.filter(id => !ids.has(id)), ...order.filter(id => ids.has(id))]);
    if (op === 'back') return setChildrenOrder(next, parentId, [...order.filter(id => ids.has(id)), ...order.filter(id => !ids.has(id))]);
    if (op === 'forward') {
      for (let i = order.length - 2; i >= 0; i--) if (ids.has(order[i]) && !ids.has(order[i + 1])) [order[i], order[i + 1]] = [order[i + 1], order[i]];
    } else {
      for (let i = 1; i < order.length; i++) if (ids.has(order[i]) && !ids.has(order[i - 1])) [order[i], order[i - 1]] = [order[i - 1], order[i]];
    }
    return setChildrenOrder(next, parentId, order);
  }, current));
}

export function toggleVisible(store: EditorStore): void {
  const { doc, selection } = store.getState();
  const ids = topLevelSelection(doc, selection);
  const visible = !ids.some(id => doc.nodes[id].visible);
  store.commit(current => ids.reduce((next, id) => updateNode(next, id, { visible }), current));
}
export function toggleLocked(store: EditorStore): void {
  const { doc, selection } = store.getState();
  const ids = topLevelSelection(doc, selection);
  const locked = !ids.every(id => doc.nodes[id].locked);
  store.commit(current => ids.reduce((next, id) => updateNode(next, id, { locked }), current), { selection: locked ? [] : ids });
}
/** Tab / Shift+Tab: select the next / previous sibling (wrapping). */
export function selectSibling(store: EditorStore, direction: 1 | -1): void {
  const { doc, selection, pageId } = store.getState();
  const current = selection[0] && doc.nodes[selection[0]] && !isPageRoot(doc, selection[0]) ? selection[0] : null;
  const page = doc.pages.find(value => value.id === pageId)!;
  const siblings = current ? doc.nodes[doc.nodes[current].parentId!].children : doc.nodes[page.rootId].children;
  if (!siblings.length) return;
  const index = current ? siblings.indexOf(current) : direction === 1 ? -1 : 0;
  store.select([siblings[(index + direction + siblings.length) % siblings.length]]);
}

// ── Clipboard ────────────────────────────────────────────────────────────────
export const CLIPBOARD_KIND = 'apl-v2/layers';
const payloadSchema = z.object({
  kind: z.literal(CLIPBOARD_KIND), version: z.literal(1),
  subtrees: z.array(z.array(nodeSchema).min(1).max(MAX_NODES)).min(1).max(500),
  assets: z.array(assetSchema).max(MAX_ASSETS),
}).strict();
export type ClipboardPayload = z.infer<typeof payloadSchema>;

function referencedAssets(nodes: SiteNode[]): Set<string> {
  const used = new Set<string>();
  for (const node of nodes) {
    if (node.type === 'image' && node.assetId) used.add(node.assetId);
    for (const paint of [...node.fills, ...Object.values(node.overrides).flatMap(o => o?.fills ?? [])]) if (paint.type === 'image') used.add(paint.assetId);
  }
  return used;
}

export function copyPayload(doc: SiteDoc, ids: string[]): ClipboardPayload | null {
  const roots = topLevelSelection(doc, ids);
  if (!roots.length) return null;
  const subtrees = roots.map(root => subtreeIds(doc, root).map(id => {
    const node = structuredClone(doc.nodes[id]);
    return (id === root ? { ...node, parentId: null } : node) as SiteNode;
  }));
  const used = referencedAssets(subtrees.flat());
  return { kind: CLIPBOARD_KIND, version: 1, subtrees, assets: [...used].map(id => doc.assets[id]).filter(Boolean) };
}

/** Parse and validate clipboard text; returns null for anything that is not a well-formed APL layer payload. */
export function parsePayload(text: string): ClipboardPayload | null {
  let raw: unknown;
  try { raw = JSON.parse(text); } catch { return null; }
  const parsed = payloadSchema.safeParse(raw);
  if (!parsed.success) return null;
  for (const subtree of parsed.data.subtrees) {
    const byId = new Map(subtree.map(node => [node.id, node]));
    if (byId.size !== subtree.length || subtree[0].parentId !== null) return null;
    for (const node of subtree) {
      if (node !== subtree[0] && (!node.parentId || byId.get(node.parentId)?.children.includes(node.id) !== true)) return null;
      if (node.children.some(child => byId.get(child)?.parentId !== node.id)) return null;
      if (node.children.length && node.type !== 'frame') return null;
    }
  }
  return parsed.data;
}

/** Where pasted layers go: inside a selected frame, next to the selection, or on the page. */
export function pasteTarget(doc: SiteDoc, selection: string[], pageRootId: string): { parentId: string; index?: number } {
  const first = selection.length === 1 ? doc.nodes[selection[0]] : undefined;
  if (first?.type === 'frame') return { parentId: first.id };
  if (first?.parentId) return { parentId: first.parentId, index: doc.nodes[first.parentId].children.indexOf(first.id) + 1 };
  return { parentId: pageRootId };
}

export function pastePayload(store: EditorStore, payload: ClipboardPayload): boolean {
  const { doc, selection, pageId } = store.getState();
  const page = doc.pages.find(value => value.id === pageId)!;
  const target = pasteTarget(doc, selection, page.rootId);
  const assetIds = new Map(payload.assets.map(asset => [asset.id, newId()]));
  const roots: string[] = [];
  const result = (() => {
    let next: SiteDoc = { ...doc, assets: { ...doc.assets, ...Object.fromEntries(payload.assets.map(asset => [assetIds.get(asset.id)!, { ...asset, id: assetIds.get(asset.id)! } satisfies Asset])) } };
    let index = target.index;
    for (const subtree of payload.subtrees) {
      const ids = new Map(subtree.map(node => [node.id, newId()]));
      const remapPaint = <T extends { type: string }>(paint: T): T => (paint.type === 'image' ? { ...paint, assetId: assetIds.get((paint as unknown as { assetId: string }).assetId) ?? 'missing' } : paint);
      const nodes = subtree.map(node => {
        const copy = {
          ...node, id: ids.get(node.id)!, parentId: node.parentId ? ids.get(node.parentId)! : null, children: node.children.map(child => ids.get(child)!),
          fills: node.fills.map(remapPaint),
          overrides: Object.fromEntries(Object.entries(node.overrides).map(([bp, o]) => [bp, o && o.fills ? { ...o, fills: o.fills.map(remapPaint) } : o])),
        } as SiteNode;
        if (copy.type === 'image' && copy.assetId) copy.assetId = assetIds.get(copy.assetId) ?? null;
        return remapLink(copy, ids);
      });
      next = insertNodes(next, nodes, target.parentId, index);
      if (index !== undefined) index++;
      roots.push(nodes[0].id);
    }
    return next;
  })();
  const valid = siteDocSchema.safeParse(result);
  if (!valid.success) { store.notify('Those layers could not be pasted here: ' + (valid.error.issues[0]?.message ?? 'they do not fit this site.')); return false; }
  return store.commit(() => result, { selection: roots });
}

/** Paste plain text as a new text layer. */
export function pasteText(store: EditorStore, text: string, containerId: string, container: Rect, at: Point): void {
  const value = text.slice(0, 20_000);
  if (!value.trim()) return;
  const { doc } = store.getState();
  const node = createNode('text', {
    name: value.trim().slice(0, 40), text: value, x: Math.round(at.x - container.x), y: Math.round(at.y - container.y),
    sizing: value.length > 60 ? { h: 'fixed', v: 'hug' } : { h: 'hug', v: 'hug' }, width: value.length > 60 ? 480 : 40,
  });
  if (!doc.nodes[containerId]) return;
  store.commit(current => insertNodes(current, [node], containerId), { selection: [node.id] });
}

// ── Copy / paste properties ──────────────────────────────────────────────────
interface StyleClip { fills: SiteNode['fills']; stroke: SiteNode['stroke']; effects: SiteNode['effects']; radius: SiteNode['radius']; opacity: number; textStyle?: TextStyle }
let styleClip: StyleClip | null = null;

export function copyStyle(store: EditorStore): void {
  const { doc, selection } = store.getState();
  const node = selection.length === 1 ? doc.nodes[selection[0]] : undefined;
  if (!node) { store.notify('Select one layer to copy its style.'); return; }
  styleClip = structuredClone({ fills: node.fills, stroke: node.stroke, effects: node.effects, radius: node.radius, opacity: node.opacity, ...(node.type === 'text' ? { textStyle: node.textStyle } : {}) });
  store.notify('Style copied. Select layers and press Ctrl+Alt+V to apply it.');
}
export function pasteStyle(store: EditorStore): void {
  const { doc, selection } = store.getState();
  if (!styleClip) { store.notify('Copy a style first with Ctrl+Alt+C.'); return; }
  const clip = styleClip;
  const ids = selection.filter(id => doc.nodes[id]);
  store.commit(current => ids.reduce((next, id) => {
    const node = next.nodes[id];
    const { textStyle, ...common } = clip;
    return updateNode(next, id, { ...structuredClone(common), ...(node.type === 'text' && textStyle ? { textStyle: structuredClone(textStyle) } : {}) });
  }, current));
}

