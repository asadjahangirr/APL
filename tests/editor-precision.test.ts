import { describe, expect, it } from 'vitest';
import { createNode, createSiteDoc, insertNode, validateDoc, DEFAULT_LAYOUT } from '../src/doc/ops';
import { lumenSample } from '../src/doc/samples';
import type { SiteDoc } from '../src/doc/schema';
import { guidesFor, measureBetween, measureGaps, snapMove, snapPoint, unionRect } from '../src/canvas/snap';
import { angleAt, normalizeAngle, resizeBounds, resizeRotated, rotatePoint } from '../src/canvas/geometry';
import { align, copyPayload, distribute, parsePayload, pastePayload, pasteTarget, reorderSelection, selectSibling, toggleLocked, toggleVisible, topLevelSelection, ungroupSelection, wrapSelection, copyStyle, pasteStyle, CLIPBOARD_KIND, type Measure } from '../src/canvas/arrange';
import { buildCommands, commandFor, eventCombo, filterCommands, formatCombo } from '../src/canvas/commands';
import { EditorStore } from '../src/canvas/store';

/** Free-layout fixture: page root at world (0,0); box frame at (100,100) 400×300 with three squares. */
function fixture() {
  const base = createSiteDoc();
  const root = base.pages[0].rootId;
  let doc = insertNode(base, createNode('frame', { id: 'box', x: 100, y: 100, width: 400, height: 300 }), root);
  doc = insertNode(doc, createNode('rect', { id: 'a', x: 10, y: 10, width: 50, height: 50 }), 'box');
  doc = insertNode(doc, createNode('rect', { id: 'b', x: 100, y: 40, width: 50, height: 50 }), 'box');
  doc = insertNode(doc, createNode('rect', { id: 'c', x: 300, y: 100, width: 50, height: 50 }), 'box');
  return { doc, root };
}
/** World rects derived from authored positions (no rotation, free layouts only). */
const measureFor = (getDoc: () => SiteDoc): Measure => id => {
  const doc = getDoc();
  let node = doc.nodes[id];
  if (!node) return null;
  let x = node.x, y = node.y;
  const w = node.width, h = node.height;
  while (node.parentId) { node = doc.nodes[node.parentId]; if (node.parentId) { x += node.x; y += node.y; } }
  return { x, y, w, h };
};

describe('snapping and guides', () => {
  const targets = [{ x: 0, y: 0, w: 100, h: 100 }, { x: 300, y: 0, w: 100, h: 50 }];
  it('snaps edges and centers within the threshold and reports guides', () => {
    const { dx, dy, guides } = snapMove({ x: 103, y: 147, w: 50, h: 50 }, targets, 6);
    expect(dx).toBe(-3); // left edge → right edge of the first target (x=100)
    expect(dy).toBe(0); // 147 / 172 / 197 are all more than 6px from any horizontal target line
    expect(guides.some(g => g.axis === 'x' && g.pos === 100)).toBe(true);
  });
  it('does not snap beyond the threshold', () => {
    expect(snapMove({ x: 120, y: 500, w: 10, h: 10 }, targets, 6)).toMatchObject({ dx: 0, dy: 0, guides: [] });
  });
  it('snaps points to the nearest line on requested axes only', () => {
    expect(snapPoint({ x: 298, y: 52 }, targets, 6).point).toEqual({ x: 300, y: 50 });
    expect(snapPoint({ x: 298, y: 52 }, targets, 6, ['x']).point).toEqual({ x: 300, y: 52 });
  });
  it('merges guides along the same line', () => {
    const guides = guidesFor({ x: 0, y: 200, w: 100, h: 20 }, targets, ['x']);
    const left = guides.find(g => g.pos === 0)!;
    expect(left).toMatchObject({ from: 0, to: 220 });
  });
});

describe('distance measurement', () => {
  it('measures to the nearest neighbor in each direction or the parent edge', () => {
    const parent = { x: 0, y: 0, w: 1000, h: 500 };
    const siblings = [{ x: 0, y: 100, w: 100, h: 100 }, { x: 400, y: 120, w: 100, h: 50 }];
    const gaps = measureGaps({ x: 200, y: 100, w: 100, h: 100 }, siblings, parent);
    const values = gaps.map(g => g.value).sort((a, b) => a - b);
    expect(values).toEqual([100, 100, 100, 300]); // left 100, right 100, top (parent) 100, bottom (parent) 300
  });
  it('Alt-measures gaps between separate layers and insets inside a container', () => {
    expect(measureBetween({ x: 0, y: 0, w: 10, h: 10 }, { x: 30, y: 0, w: 10, h: 10 }).map(m => m.value)).toEqual([20]);
    expect(measureBetween({ x: 10, y: 20, w: 10, h: 10 }, { x: 0, y: 0, w: 100, h: 100 }).map(m => m.value)).toEqual([10, 80, 20, 70]);
    expect(unionRect([{ x: 0, y: 0, w: 10, h: 10 }, { x: 20, y: 5, w: 10, h: 10 }])).toEqual({ x: 0, y: 0, w: 30, h: 15 });
  });
});

describe('rotation', () => {
  it('rotates points, measures angles and normalizes', () => {
    const p = rotatePoint({ x: 1, y: 0 }, 90);
    expect(p.x).toBeCloseTo(0); expect(p.y).toBeCloseTo(1);
    expect(angleAt({ x: 0, y: 0 }, { x: 0, y: 10 })).toBeCloseTo(90);
    expect(normalizeAngle(270)).toBe(-90);
    expect(normalizeAngle(-540)).toBe(180);
  });
  it('matches the unrotated resize at 0° and keeps the opposite corner pinned when rotated', () => {
    const start = { x: 10, y: 20, w: 100, h: 50 };
    expect(resizeRotated(start, 0, 'se', 20, 10)).toEqual(resizeBounds('se', start, 20, 10));
    const corner = (r: typeof start, fx: number, fy: number, deg: number) => {
      const c = { x: r.x + r.w / 2, y: r.y + r.h / 2 }, o = rotatePoint({ x: (fx - 0.5) * r.w, y: (fy - 0.5) * r.h }, deg);
      return { x: c.x + o.x, y: c.y + o.y };
    };
    const next = resizeRotated(start, 30, 'se', 25, 15);
    const before = corner(start, 0, 0, 30), after = corner(next, 0, 0, 30);
    expect(after.x).toBeCloseTo(before.x); expect(after.y).toBeCloseTo(before.y);
  });
});

describe('group, ungroup and frame selection', () => {
  it('groups siblings into a frame that preserves their positions, and ungroups back', () => {
    const { doc } = fixture();
    const store = new EditorStore(doc);
    const measure = measureFor(() => store.getState().doc);
    store.select(['a', 'b']);
    wrapSelection(store, measure, 'group');
    const [group] = store.getState().selection;
    const g = store.getState().doc.nodes[group];
    expect(g).toMatchObject({ type: 'frame', name: 'Group 1', x: 10, y: 10, width: 140, height: 80, parentId: 'box', children: ['a', 'b'] });
    expect(store.getState().doc.nodes.a).toMatchObject({ x: 0, y: 0 });
    expect(store.getState().doc.nodes.b).toMatchObject({ x: 90, y: 30 });
    expect(store.getState().doc.nodes.box.children).toEqual([group, 'c']);
    validateDoc(store.getState().doc);
    ungroupSelection(store, measure);
    expect(store.getState().doc.nodes[group]).toBeUndefined();
    expect(store.getState().doc.nodes.a).toMatchObject({ x: 10, y: 10, parentId: 'box' });
    expect(store.getState().doc.nodes.b).toMatchObject({ x: 100, y: 40, parentId: 'box' });
    expect(store.getState().selection).toEqual(['a', 'b']);
    validateDoc(store.getState().doc);
  });
  it('refuses to group layers from different frames', () => {
    const { doc, root } = fixture();
    const store = new EditorStore(insertNode(doc, createNode('rect', { id: 'z' }), root));
    store.select(['a', 'z']);
    wrapSelection(store, measureFor(() => store.getState().doc), 'frame');
    expect(store.getState().notice).toMatch(/same frame/);
  });
  it('ignores descendants of selected layers', () => {
    const { doc } = fixture();
    expect(topLevelSelection(doc, ['box', 'a', doc.pages[0].rootId])).toEqual(['box']);
  });
});

describe('align and distribute', () => {
  it('aligns several layers to their combined bounds and one layer to its parent', () => {
    const store = new EditorStore(fixture().doc);
    const measure = measureFor(() => store.getState().doc);
    store.select(['a', 'b', 'c']);
    align(store, measure, 'top');
    expect(['a', 'b', 'c'].map(id => store.getState().doc.nodes[id].y)).toEqual([10, 10, 10]);
    align(store, measure, 'right');
    expect(['a', 'b', 'c'].map(id => store.getState().doc.nodes[id].x)).toEqual([300, 300, 300]);
    store.select(['a']);
    align(store, measure, 'hcenter');
    expect(store.getState().doc.nodes.a.x).toBe(175); // (400 - 50) / 2
    align(store, measure, 'bottom');
    expect(store.getState().doc.nodes.a.y).toBe(250);
  });
  it('distributes equal gaps and requires three layers', () => {
    const store = new EditorStore(fixture().doc);
    const measure = measureFor(() => store.getState().doc);
    store.select(['a', 'b', 'c']);
    distribute(store, measure, 'h');
    const xs = ['a', 'b', 'c'].map(id => store.getState().doc.nodes[id].x);
    expect(xs).toEqual([10, 155, 300]);
    store.select(['a', 'b']);
    distribute(store, measure, 'v');
    expect(store.getState().notice).toMatch(/three or more/);
  });
  it('explains that auto-layout children are aligned by their frame', () => {
    const store = new EditorStore(lumenSample());
    store.select(['card-1']);
    align(store, () => ({ x: 0, y: 0, w: 1, h: 1 }), 'left');
    expect(store.getState().notice).toMatch(/auto layout/);
  });
});

describe('layer order, visibility, lock and siblings', () => {
  it('moves layers forward/backward/front/back', () => {
    const store = new EditorStore(fixture().doc);
    const order = () => store.getState().doc.nodes.box.children;
    store.select(['a']);
    reorderSelection(store, 'forward'); expect(order()).toEqual(['b', 'a', 'c']);
    reorderSelection(store, 'front'); expect(order()).toEqual(['b', 'c', 'a']);
    reorderSelection(store, 'back'); expect(order()).toEqual(['a', 'b', 'c']);
    reorderSelection(store, 'backward'); expect(order()).toEqual(['a', 'b', 'c']);
    store.select(['b', 'c']);
    reorderSelection(store, 'backward'); expect(order()).toEqual(['b', 'c', 'a']);
  });
  it('toggles visibility and locking for the selection, and tabs through siblings', () => {
    const store = new EditorStore(fixture().doc);
    store.select(['a', 'b']);
    toggleVisible(store);
    expect(store.getState().doc.nodes.a.visible).toBe(false);
    toggleVisible(store);
    expect(store.getState().doc.nodes.b.visible).toBe(true);
    toggleLocked(store);
    expect(store.getState().doc.nodes.a.locked).toBe(true);
    expect(store.getState().selection).toEqual([]);
    store.select(['c']);
    selectSibling(store, 1); expect(store.getState().selection).toEqual(['a']);
    selectSibling(store, -1); expect(store.getState().selection).toEqual(['c']);
  });
});

describe('clipboard', () => {
  it('round-trips layers with images through JSON with fresh ids', () => {
    let { doc } = fixture();
    doc = { ...doc, assets: { pic: { id: 'pic', name: 'Pic', mime: 'image/png', dataUrl: 'data:image/png;base64,iVBORw0KGgo=', width: 1, height: 1 } } };
    doc = insertNode(doc, createNode('image', { id: 'img', assetId: 'pic' }), 'box');
    const payload = copyPayload(doc, ['box', 'a'])!;
    expect(payload.subtrees).toHaveLength(1); // 'a' is inside the copied box
    expect(payload.assets.map(a => a.id)).toEqual(['pic']);
    const parsed = parsePayload(JSON.stringify(payload))!;
    expect(parsed).toBeTruthy();
    const store = new EditorStore(doc);
    store.select([]);
    expect(pastePayload(store, parsed)).toBe(true);
    const [pasted] = store.getState().selection;
    const next = store.getState().doc;
    expect(pasted).not.toBe('box');
    expect(next.nodes[pasted]).toMatchObject({ type: 'frame', x: 100, y: 100, parentId: doc.pages[0].rootId });
    expect(next.nodes[pasted].children).toHaveLength(4);
    const image = next.nodes[next.nodes[pasted].children[3]];
    expect(image.type === 'image' && image.assetId).not.toBe('pic');
    expect(Object.keys(next.assets)).toHaveLength(2);
    validateDoc(next);
  });
  it('rejects malformed, hostile or inconsistent payloads', () => {
    const { doc } = fixture();
    const payload = copyPayload(doc, ['a'])!;
    expect(parsePayload('not json')).toBeNull();
    expect(parsePayload(JSON.stringify({ ...payload, kind: 'other' }))).toBeNull();
    const evil = structuredClone(payload);
    (evil.subtrees[0][0] as { fills: unknown }).fills = [{ type: 'solid', color: 'red;}body{display:none', visible: true }];
    expect(parsePayload(JSON.stringify(evil))).toBeNull();
    const orphan = structuredClone(payload);
    orphan.subtrees[0][0] = { ...orphan.subtrees[0][0], children: ['ghost'] };
    expect(parsePayload(JSON.stringify(orphan))).toBeNull();
  });
  it('pastes inside a selected frame, next to a selected layer, or onto the page', () => {
    const { doc, root } = fixture();
    expect(pasteTarget(doc, ['box'], root)).toEqual({ parentId: 'box' });
    expect(pasteTarget(doc, ['a'], root)).toEqual({ parentId: 'box', index: 1 });
    expect(pasteTarget(doc, [], root)).toEqual({ parentId: root });
    expect(CLIPBOARD_KIND).toBe('apl-v2/layers');
  });
  it('copies and pastes properties', () => {
    const { doc } = fixture();
    const store = new EditorStore(insertNode(doc, createNode('rect', { id: 'styled', radius: [8, 8, 8, 8], opacity: 0.5, fills: [{ type: 'solid', color: '#FF0000', visible: true }] }), 'box'));
    store.select(['styled']); copyStyle(store);
    store.select(['a', 'b']); pasteStyle(store);
    expect(store.getState().doc.nodes.a).toMatchObject({ radius: [8, 8, 8, 8], opacity: 0.5, fills: [{ color: '#FF0000' }] });
  });
});

describe('commands and shortcuts', () => {
  const key = (code: string, mods: Partial<{ ctrlKey: boolean; metaKey: boolean; altKey: boolean; shiftKey: boolean }> = {}, keyValue = '') =>
    eventCombo({ code, key: keyValue, ctrlKey: false, metaKey: false, altKey: false, shiftKey: false, ...mods });
  it('normalizes physical keys and modifiers', () => {
    expect(key('KeyG', { ctrlKey: true, shiftKey: true })).toBe('mod+shift+g');
    expect(key('KeyA', { altKey: true }, 'å')).toBe('alt+a');
    expect(key('Digit1', { shiftKey: true }, '!')).toBe('shift+1');
    expect(key('BracketRight', { metaKey: true })).toBe('mod+]');
    expect(key('ArrowLeft', { shiftKey: true })).toBe('shift+arrowleft');
    expect(formatCombo('mod+shift+g')).toMatch(/G$/);
  });
  it('has unique bindings and finds commands for the palette', () => {
    const store = new EditorStore(lumenSample());
    const noop = () => undefined;
    const commands = buildCommands({ store, canvas: () => null, measure: () => null, pickImage: noop, openPreview: noop, openPalette: noop, openLibrary: noop, copy: noop, cut: noop, paste: noop });
    const combos = commands.flatMap(command => command.keys ?? []);
    expect(new Set(combos).size).toBe(combos.length);
    expect(commandFor(commands, 'mod+g')?.id).toBe('group');
    expect(filterCommands(commands, 'align left').map(c => c.id)).toEqual(['align-left']);
    expect(filterCommands(commands, 'nudge')).toEqual([]); // hidden
    expect(filterCommands(commands, 'go to home').length).toBe(1);
    commandFor(commands, 'r')!.run();
    expect(store.getState().tool).toBe('rect');
  });
});

describe('frames in auto layout keep working with arrange tools', () => {
  it('groups auto-layout children using measured positions and keeps the group in the flow', () => {
    const doc = lumenSample();
    const store = new EditorStore(doc);
    const rects: Record<string, { x: number; y: number; w: number; h: number }> = {
      actions: { x: 500, y: 600, w: 400, h: 50 }, cta: { x: 500, y: 600, w: 180, h: 50 }, 'cta-secondary': { x: 696, y: 600, w: 204, h: 50 },
    };
    store.select(['cta', 'cta-secondary']);
    wrapSelection(store, id => rects[id] ?? null, 'frame');
    const [frame] = store.getState().selection;
    const node = store.getState().doc.nodes[frame];
    expect(node).toMatchObject({ parentId: 'actions', width: 400, height: 50, absolute: false, layout: DEFAULT_LAYOUT });
    expect(store.getState().doc.nodes['cta-secondary']).toMatchObject({ x: 196, y: 0 });
    validateDoc(store.getState().doc);
  });
});
