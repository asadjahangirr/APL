import { describe, expect, it } from 'vitest';
import { createNode, createSiteDoc, DEFAULT_LAYOUT, DocError, insertNode, validateDoc } from '../src/doc/ops';
import { lumenSample } from '../src/doc/samples';
import { addAutoLayout, adjustSpacing, dropContainer, inferLayout, preferReorder, setSizing, sizingForParent, sizingOptions, spacingRegions } from '../src/canvas/autolayout';
import { toggleAutoLayout } from '../src/canvas/actions';
import { EditorStore } from '../src/canvas/store';
import { chainOf } from '../src/canvas/geometry';

const rect = (x: number, y: number, w = 100, h = 40) => ({ x, y, w, h });

describe('layout inference', () => {
  it('detects a row with its gap, centered alignment and reading order', () => {
    const inferred = inferLayout([rect(260, 10, 100, 40), rect(0, 0, 100, 60), rect(130, 5, 100, 50)]);
    expect(inferred).toMatchObject({ mode: 'horizontal', gap: 30, alignCross: 'center', order: [1, 2, 0] });
  });
  it('detects a left-aligned column and padding inside a frame', () => {
    const inferred = inferLayout([rect(24, 100), rect(24, 20), rect(24, 60)], { x: 0, y: 0, w: 300, h: 180 });
    expect(inferred).toMatchObject({ mode: 'vertical', gap: 0, alignCross: 'start', order: [1, 2, 0], padding: [20, 176, 40, 24] });
  });
});

describe('adding auto layout', () => {
  it('wraps loose siblings into a hugging frame in reading order', () => {
    const base = createSiteDoc();
    const root = base.pages[0].rootId;
    let doc = insertNode(base, createNode('rect', { id: 'b', x: 220, y: 100, width: 100, height: 40 }), root);
    doc = insertNode(doc, createNode('rect', { id: 'a', x: 100, y: 100, width: 100, height: 40, sizing: { h: 'fixed', v: 'fixed' } }), root);
    const rects = new Map([['a', rect(100, 100)], ['b', rect(220, 100)]]);
    const { doc: next, frameId } = addAutoLayout(doc, ['b', 'a'], rects);
    expect(next.nodes[frameId]).toMatchObject({ x: 100, y: 100, width: 220, height: 40, sizing: { h: 'hug', v: 'hug' }, children: ['a', 'b'] });
    expect(next.nodes[frameId].type === 'frame' && next.nodes[frameId].layout).toMatchObject({ mode: 'horizontal', gap: 20 });
    validateDoc(next);
  });
  it('turns a frame into auto layout without moving absolute children into the flow', () => {
    const base = createSiteDoc();
    let doc = insertNode(base, createNode('frame', { id: 'card', width: 300, height: 200 }), base.pages[0].rootId);
    doc = insertNode(doc, createNode('text', { id: 'title', x: 20, y: 20, width: 200, height: 30 }), 'card');
    doc = insertNode(doc, createNode('rect', { id: 'badge', x: 250, y: 10, absolute: true }), 'card');
    doc = insertNode(doc, createNode('text', { id: 'body', x: 20, y: 60, width: 200, height: 30 }), 'card');
    const store = new EditorStore(doc);
    store.select(['card']);
    toggleAutoLayout(store); // free children: their authored (canvas-synced) boxes are used
    const card = store.getState().doc.nodes.card;
    expect(card.type === 'frame' && card.layout).toMatchObject({ mode: 'vertical', gap: 10, padding: [20, 80, 110, 20] });
    expect(card.children).toEqual(['title', 'body', 'badge']);
    toggleAutoLayout(store);
    expect(store.getState().doc.nodes.card.type === 'frame' && (store.getState().doc.nodes.card as { layout: { mode: string } }).layout.mode).toBe('none');
    expect(store.getState().doc.nodes.card.sizing).toEqual({ h: 'fixed', v: 'fixed' });
  });
});

describe('sizing rules', () => {
  it('offers hug only for text and auto-layout frames, and fill only inside auto layout', () => {
    const doc = lumenSample();
    expect(sizingOptions(doc, 'card-1-dot', 'h')).toEqual(['fixed', 'fill']);
    expect(sizingOptions(doc, 'hero', 'v')).toEqual(['fixed', 'hug', 'fill']);
    expect(sizingOptions(doc, 'home', 'h')).toEqual(['fill']);
    expect(sizingOptions(doc, 'glow', 'h')).toEqual(['fixed']); // absolute inside auto layout
    expect(() => setSizing(doc, 'glow', 'h', 'fill')).toThrow(DocError);
  });
  it('turns a hugging parent fixed when a child fills its main axis, and back', () => {
    let doc = lumenSample();
    doc = setSizing(doc, 'cta', 'h', 'fill'); // actions is a hugging row
    expect(doc.nodes.actions.sizing.h).toBe('fixed');
    doc = setSizing(doc, 'actions', 'h', 'hug');
    expect(doc.nodes.cta.sizing.h).toBe('fixed');
    validateDoc(doc);
  });
  it('drops fill when a layer leaves auto layout', () => {
    const node = createNode('rect', { sizing: { h: 'fill', v: 'fixed' } });
    expect(sizingForParent(node, createNode('frame'))).toEqual({ h: 'fixed', v: 'fixed' });
    expect(sizingForParent(node, createNode('frame', { layout: { ...DEFAULT_LAYOUT, mode: 'vertical' } }))).toEqual({ h: 'fill', v: 'fixed' });
  });
});

describe('spacing handles', () => {
  const layout = { ...DEFAULT_LAYOUT, mode: 'vertical' as const, gap: 10, padding: [20, 30, 40, 50] as [number, number, number, number] };
  it('builds padding and gap regions in screen space', () => {
    const regions = spacingRegions(layout, rect(0, 0, 400, 300), [rect(50, 20, 300, 50), rect(50, 80, 300, 50)], 1);
    expect(regions.map(r => r.target.kind === 'padding' ? 'p' + r.target.side : 'gap')).toEqual(['p0', 'p1', 'p2', 'p3', 'gap']);
    expect(regions[0].rect).toEqual({ x: 50, y: 0, w: 320, h: 20 });
    expect(regions[4].rect).toEqual({ x: 50, y: 70, w: 320, h: 10 }); // the 10px gap between the children
    expect(spacingRegions(layout, rect(0, 0, 400, 300), [rect(50, 20, 300, 50), rect(50, 72, 300, 50)], 1)[4].rect.h).toBe(6); // tiny gaps stay grabbable
    expect(spacingRegions({ ...layout, alignMain: 'spaceBetween' }, rect(0, 0, 400, 300), [rect(0, 0, 1, 1), rect(0, 9, 1, 1)], 1)).toHaveLength(4);
    expect(spacingRegions(DEFAULT_LAYOUT, rect(0, 0, 1, 1), [], 1)).toEqual([]);
  });
  it('adjusts gaps and padding with inward drags, mirroring and all-sides', () => {
    expect(adjustSpacing(layout, { kind: 'gap' }, 10, 15).gap).toBe(25);
    expect(adjustSpacing(layout, { kind: 'gap' }, 10, -50).gap).toBe(0);
    expect(adjustSpacing(layout, { kind: 'padding', side: 0 }, 20, 5).padding).toEqual([25, 30, 40, 50]);
    expect(adjustSpacing(layout, { kind: 'padding', side: 1 }, 30, -10).padding).toEqual([20, 40, 40, 50]);
    expect(adjustSpacing(layout, { kind: 'padding', side: 3 }, 50, 4, { mirror: true }).padding).toEqual([20, 54, 40, 54]);
    expect(adjustSpacing(layout, { kind: 'padding', side: 2 }, 40, -2, { all: true }).padding).toEqual([42, 42, 42, 42]);
  });
});

describe('drop targets', () => {
  it('chooses the deepest unlocked frame that is not being dragged', () => {
    const doc = lumenSample();
    const chain = chainOf(doc, 'card-2-title');
    expect(dropContainer(doc, chain, ['card-1'])).toBe('card-2');
    expect(dropContainer(doc, chain, ['card-2'])).toBe('features');
    const locked = { ...doc, nodes: { ...doc.nodes, 'card-2': { ...doc.nodes['card-2'], locked: true } } };
    expect(dropContainer(locked, chain, [])).toBe('features');
  });
});

describe('reorder versus nesting', () => {
  it("reorders near a sibling frame's edges and nests only well inside it", () => {
    const doc = lumenSample();
    const card = { x: 100, y: 100, w: 200, h: 100 };
    expect(preferReorder(doc, 'card-3', 'features', card, { x: 296, y: 150 })).toBe('features');
    expect(preferReorder(doc, 'card-3', 'features', card, { x: 200, y: 150 })).toBe('card-3');
    expect(preferReorder(doc, 'hero', 'features', card, { x: 296, y: 150 })).toBe('hero'); // not a sibling
  });
});
