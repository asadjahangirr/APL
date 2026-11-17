import { createNode, DEFAULT_LAYOUT, DocError, getNode, insertNode, isPageRoot, moveNode, nextName, setChildrenOrder, updateNode } from '../doc/ops';
import type { Layout, SiteDoc, SiteNode } from '../doc/schema';
import type { Rect } from './geometry';
import { unionRect } from './snap';

/** Auto-layout helpers: inference, sizing rules, on-canvas spacing regions and drop targets. */

type Axis = 'h' | 'v';
const r0 = (value: number) => Math.max(0, Math.round(value));

export interface InferredLayout { mode: 'horizontal' | 'vertical'; gap: number; padding: Layout['padding']; alignCross: Layout['alignCross']; order: number[] }

/**
 * Infer direction, gap, padding, cross alignment and reading order from where
 * layers currently sit, so adding auto layout keeps the design looking the same.
 */
export function inferLayout(rects: Rect[], frame?: Rect): InferredLayout {
  if (!rects.length) return { mode: 'vertical', gap: 0, padding: [0, 0, 0, 0], alignCross: 'start', order: [] };
  const u = unionRect(rects);
  const spreadX = u.w - Math.max(...rects.map(r => r.w)), spreadY = u.h - Math.max(...rects.map(r => r.h));
  const mode = spreadX > spreadY ? 'horizontal' : 'vertical';
  const order = rects.map((r, i) => i).sort((a, b) => (mode === 'horizontal' ? rects[a].x - rects[b].x || rects[a].y - rects[b].y : rects[a].y - rects[b].y || rects[a].x - rects[b].x));
  const sorted = order.map(i => rects[i]);
  const gaps = sorted.slice(1).map((r, i) => (mode === 'horizontal' ? r.x - (sorted[i].x + sorted[i].w) : r.y - (sorted[i].y + sorted[i].h)));
  const gap = gaps.length ? r0(gaps.reduce((sum, g) => sum + g, 0) / gaps.length) : 0;
  const near = (values: number[]) => Math.max(...values) - Math.min(...values) <= 1.5;
  const alignCross: Layout['alignCross'] = mode === 'horizontal'
    ? (near(rects.map(r => r.y)) ? 'start' : near(rects.map(r => r.y + r.h / 2)) ? 'center' : near(rects.map(r => r.y + r.h)) ? 'end' : 'start')
    : (near(rects.map(r => r.x)) ? 'start' : near(rects.map(r => r.x + r.w / 2)) ? 'center' : near(rects.map(r => r.x + r.w)) ? 'end' : 'start');
  const padding: Layout['padding'] = frame ? [r0(u.y - frame.y), r0(frame.x + frame.w - u.x - u.w), r0(frame.y + frame.h - u.y - u.h), r0(u.x - frame.x)] : [0, 0, 0, 0];
  return { mode, gap, padding, alignCross, order };
}

/**
 * Turn a frame into an auto-layout frame (inferring settings from its children's
 * current positions), or wrap several sibling layers in a new auto-layout frame.
 * `rects` are the layers' boxes in the parent's coordinate space.
 */
export function addAutoLayout(doc: SiteDoc, ids: string[], rects: Map<string, Rect>): { doc: SiteDoc; frameId: string } {
  if (ids.length === 1 && getNode(doc, ids[0]).type === 'frame') {
    const frame = getNode(doc, ids[0]);
    if (frame.type !== 'frame') throw new DocError('Only frames can use auto layout.');
    const children = frame.children.filter(id => !doc.nodes[id].absolute);
    const childRects = children.map(id => rects.get(id) ?? { x: doc.nodes[id].x, y: doc.nodes[id].y, w: doc.nodes[id].width, h: doc.nodes[id].height });
    const inferred = childRects.length ? inferLayout(childRects, { x: 0, y: 0, w: frame.width, h: frame.height }) : { mode: 'vertical' as const, gap: 16, padding: [16, 16, 16, 16] as Layout['padding'], alignCross: 'start' as const, order: [] };
    let next = updateNode(doc, frame.id, {
      layout: { ...DEFAULT_LAYOUT, mode: inferred.mode, gap: inferred.gap, padding: inferred.padding, alignCross: inferred.alignCross },
      sizing: { h: frame.sizing.h === 'fill' ? 'fill' : 'hug', v: frame.sizing.v === 'fill' ? 'fill' : 'hug' },
    });
    const ordered = inferred.order.map(i => children[i]);
    const absolute = frame.children.filter(id => doc.nodes[id].absolute);
    next = setChildrenOrder(next, frame.id, [...ordered, ...absolute]);
    return { doc: next, frameId: frame.id };
  }
  const first = getNode(doc, ids[0]);
  if (!first.parentId || ids.some(id => getNode(doc, id).parentId !== first.parentId || isPageRoot(doc, id))) throw new DocError('Select layers inside the same frame to add auto layout.');
  const parent = getNode(doc, first.parentId);
  if (parent.type !== 'frame') throw new DocError('Layers can only be placed inside frames.');
  const boxes = ids.map(id => rects.get(id) ?? { x: doc.nodes[id].x, y: doc.nodes[id].y, w: doc.nodes[id].width, h: doc.nodes[id].height });
  const u = unionRect(boxes);
  const inferred = inferLayout(boxes);
  const frame = createNode('frame', {
    name: nextName(doc, 'Frame'), x: Math.round(u.x), y: Math.round(u.y), width: Math.round(u.w), height: Math.round(u.h),
    fills: [], clip: false, sizing: { h: 'hug', v: 'hug' },
    layout: { ...DEFAULT_LAYOUT, mode: inferred.mode, gap: inferred.gap, alignCross: inferred.alignCross },
  });
  const index = parent.layout.mode === 'none' ? Math.max(...ids.map(id => parent.children.indexOf(id))) + 1 : Math.min(...ids.map(id => parent.children.indexOf(id)));
  let next = insertNode(doc, frame, parent.id, index);
  inferred.order.forEach((i, position) => {
    const id = ids[i], node = next.nodes[id];
    next = moveNode(next, id, frame.id, position);
    next = updateNode(next, id, { x: 0, y: 0, absolute: false, sizing: { h: node.sizing.h === 'fill' ? 'fixed' : node.sizing.h, v: node.sizing.v === 'fill' ? 'fixed' : node.sizing.v } });
  });
  return { doc: next, frameId: frame.id };
}

/** Which sizing modes a layer may use on an axis. */
export function sizingOptions(doc: SiteDoc, id: string, axis: Axis): ('fixed' | 'hug' | 'fill')[] {
  const node = getNode(doc, id);
  if (isPageRoot(doc, id)) return axis === 'h' ? ['fill'] : ['fixed', 'hug'];
  const parent = node.parentId ? doc.nodes[node.parentId] : undefined;
  const canHug = node.type === 'text' || (node.type === 'frame' && node.layout.mode !== 'none');
  const canFill = !!parent && parent.type === 'frame' && parent.layout.mode !== 'none' && !node.absolute;
  return ['fixed', ...(canHug ? ['hug' as const] : []), ...(canFill ? ['fill' as const] : [])];
}

const mainAxis = (layout: Layout): Axis | null => (layout.mode === 'horizontal' ? 'h' : layout.mode === 'vertical' ? 'v' : null);

/**
 * Change hug/fill/fixed with Figma's conflict rules: a child cannot fill a
 * parent's main axis while that parent hugs it (the parent becomes fixed), and a
 * frame that starts hugging its main axis turns filling children into fixed.
 */
export function setSizing(doc: SiteDoc, id: string, axis: Axis, mode: 'fixed' | 'hug' | 'fill'): SiteDoc {
  if (!sizingOptions(doc, id, axis).includes(mode)) throw new DocError(mode === 'hug' ? 'Only text and auto-layout frames can hug their contents.' : mode === 'fill' ? 'Fill container works for layers inside auto layout.' : 'That size option is not available here.');
  const node = getNode(doc, id);
  let next = updateNode(doc, id, { sizing: { ...node.sizing, [axis]: mode } });
  const parent = node.parentId ? next.nodes[node.parentId] : undefined;
  if (mode === 'fill' && parent?.type === 'frame' && mainAxis(parent.layout) === axis && parent.sizing[axis] === 'hug') {
    next = updateNode(next, parent.id, { sizing: { ...parent.sizing, [axis]: 'fixed' } });
  }
  if (mode === 'hug' && node.type === 'frame' && mainAxis(node.layout) === axis) {
    for (const child of node.children) {
      const c = next.nodes[child];
      if (!c.absolute && c.sizing[axis] === 'fill') next = updateNode(next, child, { sizing: { ...c.sizing, [axis]: 'fixed' } });
    }
  }
  return next;
}

// ── On-canvas spacing handles ────────────────────────────────────────────────
export type SpacingTarget = { kind: 'padding'; side: 0 | 1 | 2 | 3 } | { kind: 'gap' };
export interface SpacingRegion { target: SpacingTarget; rect: Rect; value: number; axis: 'x' | 'y' }

/**
 * Screen regions for an auto-layout frame's padding and gaps. `frame` and
 * `children` are screen rects (children in flow order); `zoom` converts values.
 */
export function spacingRegions(layout: Layout, frame: Rect, children: Rect[], zoom: number, minSize = 6): SpacingRegion[] {
  if (layout.mode === 'none') return [];
  const [top, right, bottom, left] = layout.padding.map(p => p * zoom);
  const out: SpacingRegion[] = [
    { target: { kind: 'padding', side: 0 }, axis: 'y', value: layout.padding[0], rect: { x: frame.x + left, y: frame.y, w: Math.max(0, frame.w - left - right), h: Math.max(minSize, top) } },
    { target: { kind: 'padding', side: 1 }, axis: 'x', value: layout.padding[1], rect: { x: frame.x + frame.w - Math.max(minSize, right), y: frame.y + top, w: Math.max(minSize, right), h: Math.max(0, frame.h - top - bottom) } },
    { target: { kind: 'padding', side: 2 }, axis: 'y', value: layout.padding[2], rect: { x: frame.x + left, y: frame.y + frame.h - Math.max(minSize, bottom), w: Math.max(0, frame.w - left - right), h: Math.max(minSize, bottom) } },
    { target: { kind: 'padding', side: 3 }, axis: 'x', value: layout.padding[3], rect: { x: frame.x, y: frame.y + top, w: Math.max(minSize, left), h: Math.max(0, frame.h - top - bottom) } },
  ];
  if ((layout.mode === 'horizontal' || layout.mode === 'vertical') && !layout.wrap && layout.alignMain !== 'spaceBetween') {
    for (let i = 1; i < children.length; i++) {
      const a = children[i - 1], b = children[i];
      if (layout.mode === 'horizontal') {
        const x = a.x + a.w, w = Math.max(minSize, b.x - x);
        out.push({ target: { kind: 'gap' }, axis: 'x', value: layout.gap, rect: { x: (x + b.x) / 2 - w / 2, y: frame.y + top, w, h: Math.max(0, frame.h - top - bottom) } });
      } else {
        const y = a.y + a.h, h = Math.max(minSize, b.y - y);
        out.push({ target: { kind: 'gap' }, axis: 'y', value: layout.gap, rect: { x: frame.x + left, y: (y + b.y) / 2 - h / 2, w: Math.max(0, frame.w - left - right), h } });
      }
    }
  }
  return out;
}

/**
 * New layout after dragging a spacing handle by `delta` world px along its axis.
 * Padding grows when dragged inward; Alt mirrors to the opposite side, Shift applies to all sides.
 */
export function adjustSpacing(layout: Layout, target: SpacingTarget, start: number, delta: number, options: { mirror?: boolean; all?: boolean } = {}): Layout {
  if (target.kind === 'gap') return { ...layout, gap: r0(start + delta) };
  const inward = target.side === 0 || target.side === 3 ? 1 : -1;
  const value = r0(start + inward * delta);
  const padding = [...layout.padding] as Layout['padding'];
  if (options.all) padding.fill(value);
  else {
    padding[target.side] = value;
    if (options.mirror) padding[(target.side + 2) % 4] = value;
  }
  return { ...layout, padding };
}

/** The frame a dragged layer should land in: the deepest unlocked frame under the pointer that is not being dragged. */
export function dropContainer(doc: SiteDoc, chain: string[], moving: string[]): string | null {
  const blocked = new Set(moving);
  for (let i = chain.length - 1; i >= 0; i--) {
    const node = doc.nodes[chain[i]];
    if (!node || chain.slice(0, i + 1).some(id => blocked.has(id))) continue;
    if (node.type === 'frame' && !node.locked) return node.id;
  }
  return null;
}

/** Resolve a node's sizing after it moves into a new parent (fill only survives inside auto layout). */
export function sizingForParent(node: SiteNode, parent: SiteNode): SiteNode['sizing'] {
  const flow = parent.type === 'frame' && parent.layout.mode !== 'none';
  return { h: !flow && node.sizing.h === 'fill' ? 'fixed' : node.sizing.h, v: !flow && node.sizing.v === 'fill' ? 'fixed' : node.sizing.v };
}

/**
 * When dragging inside an auto-layout frame, hovering a sibling frame should
 * reorder, not nest — unless the pointer is well inside that sibling (its inner
 * 60%). Returns the container to use.
 */
export function preferReorder(doc: SiteDoc, candidate: string, parentId: string, candidateRect: Rect | null, point: { x: number; y: number }): string {
  const parent = doc.nodes[parentId], node = doc.nodes[candidate];
  if (!node || !parent || candidate === parentId || node.parentId !== parentId || parent.type !== 'frame' || parent.layout.mode === 'none' || !candidateRect) return candidate;
  const insetX = candidateRect.w * 0.2, insetY = candidateRect.h * 0.2;
  const inside = point.x > candidateRect.x + insetX && point.x < candidateRect.x + candidateRect.w - insetX && point.y > candidateRect.y + insetY && point.y < candidateRect.y + candidateRect.h - insetY;
  return inside ? candidate : parentId;
}
