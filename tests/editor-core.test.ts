import { describe, expect, it } from 'vitest';
import { applyConstraints, createNode, createSiteDoc, insertNode, nextName, pathForName, resizeNode, updatePage, validateDoc, DocError, addPage } from '../src/doc/ops';
import { lumenSample } from '../src/doc/samples';
import type { SiteDoc } from '../src/doc/schema';
import { deleteSelection, duplicateSelection, insertImage, nudge, pruneAssets, selectAll, selectChildren, selectParent, toggleAutoLayout, replaceImage } from '../src/canvas/actions';
import { chainOf, dropIndex, enterChild, fitRect, insertSize, pickSelectable, rectFromPoints, resizeBounds, zoomAt } from '../src/canvas/geometry';
import { EditorStore } from '../src/canvas/store';
import { resolveLayerDrop } from '../src/canvas/LayersPanel';

const free = () => {
  const base = createSiteDoc();
  const root = base.pages[0].rootId;
  let doc = insertNode(base, createNode('frame', { id: 'box', x: 100, y: 100, width: 400, height: 300 }), root);
  doc = insertNode(doc, createNode('rect', { id: 'a', x: 10, y: 10, width: 50, height: 50 }), 'box');
  doc = insertNode(doc, createNode('rect', { id: 'b', x: 300, y: 200, width: 50, height: 50, constraints: { h: 'right', v: 'bottom' } }), 'box');
  return { doc, root };
};

describe('editor store history', () => {
  it('records one undo step per commit and coalesces gestures', () => {
    const { doc } = free();
    const store = new EditorStore(doc);
    store.commit(d => resizeNode(d, 'a', { x: 20 }));
    expect(store.getState().canUndo).toBe(true);
    store.beginGesture();
    for (let x = 21; x < 40; x++) store.commit(d => resizeNode(d, 'a', { x }));
    store.endGesture();
    expect(store.getState().doc.nodes.a.x).toBe(39);
    store.undo();
    expect(store.getState().doc.nodes.a.x).toBe(20);
    store.undo();
    expect(store.getState().doc.nodes.a.x).toBe(10);
    expect(store.getState().canUndo).toBe(false);
    store.redo(); store.redo();
    expect(store.getState().doc.nodes.a.x).toBe(39);
  });

  it('silent commits never create history; cancelled gestures restore the document', () => {
    const store = new EditorStore(free().doc);
    store.commit(d => resizeNode(d, 'a', { width: 70 }), { silent: true });
    expect(store.getState().canUndo).toBe(false);
    store.beginGesture();
    store.commit(d => resizeNode(d, 'a', { x: 99 }));
    store.cancelGesture();
    expect(store.getState().doc.nodes.a.x).toBe(10);
    expect(store.getState().canUndo).toBe(false);
  });

  it('reports document errors as notices instead of throwing, and drops deleted ids from the selection on undo', () => {
    const { doc, root } = free();
    const store = new EditorStore(doc);
    expect(store.commit(d => { throw new DocError('Nope'); return d; })).toBe(false);
    expect(store.getState().notice).toBe('Nope');
    store.select(['a']);
    deleteSelection(store);
    expect(store.getState().doc.nodes.a).toBeUndefined();
    expect(store.getState().selection).toEqual(['box']);
    store.undo();
    expect(store.getState().doc.nodes.a).toBeTruthy();
    store.redo();
    expect(store.getState().selection).toEqual(['box']);
    store.select([root]);
    deleteSelection(store); // page roots cannot be deleted
    expect(store.getState().doc.nodes[root]).toBeTruthy();
  });
});

describe('selection rules', () => {
  const doc = lumenSample();
  const chain = chainOf(doc, 'card-1-title');
  it('selects the outermost layer first, then siblings within the current scope', () => {
    expect(chain).toEqual(['home', 'features', 'card-1', 'card-1-title']);
    expect(pickSelectable(doc, chain, [], false)).toBe('features');
    expect(pickSelectable(doc, chain, ['card-2'], false)).toBe('card-1');
    expect(pickSelectable(doc, chain, ['card-1-body'], false)).toBe('card-1-title');
    expect(pickSelectable(doc, chain, [], true)).toBe('card-1-title');
    expect(pickSelectable(doc, ['home'], [], false)).toBeNull();
  });
  it('double-click enters one level deeper', () => {
    expect(enterChild(chain, 'features')).toBe('card-1');
    expect(enterChild(chain, 'card-1-title')).toBeNull();
    expect(enterChild(chain, undefined)).toBeNull();
  });
});

describe('geometry', () => {
  it('computes drop positions for columns, rows and wrapping rows', () => {
    const column = [{ x: 0, y: 0, w: 100, h: 50 }, { x: 0, y: 60, w: 100, h: 50 }];
    expect(dropIndex(column, 'vertical', { x: 10, y: 10 })).toBe(0);
    expect(dropIndex(column, 'vertical', { x: 10, y: 70 })).toBe(1);
    expect(dropIndex(column, 'vertical', { x: 10, y: 200 })).toBe(2);
    const rows = [{ x: 0, y: 0, w: 100, h: 40 }, { x: 110, y: 0, w: 100, h: 40 }, { x: 0, y: 50, w: 100, h: 40 }];
    expect(dropIndex(rows, 'horizontal', { x: 150, y: 20 })).toBe(1);
    expect(dropIndex(rows, 'horizontal', { x: 190, y: 20 })).toBe(2);
    expect(dropIndex(rows, 'horizontal', { x: 10, y: 70 })).toBe(2);
    expect(dropIndex(rows, 'grid', { x: 300, y: 70 })).toBe(3);
  });

  it('resizes from every handle, keeps ratio with Shift and flips past the edge', () => {
    const start = { x: 10, y: 10, w: 100, h: 50 };
    expect(resizeBounds('se', start, 20, 10)).toEqual({ x: 10, y: 10, w: 120, h: 60 });
    expect(resizeBounds('nw', start, 20, 10)).toEqual({ x: 30, y: 20, w: 80, h: 40 });
    expect(resizeBounds('e', start, 100, 0, true)).toEqual({ x: 10, y: 10, w: 200, h: 100 });
    expect(resizeBounds('e', start, -150, 0)).toEqual({ x: -40, y: 10, w: 50, h: 50 });
    expect(rectFromPoints({ x: 50, y: 5 }, { x: 10, y: 25 })).toEqual({ x: 10, y: 5, w: 40, h: 20 });
  });

  it('zooms around the cursor and fits content', () => {
    const v = zoomAt({ x: 0, y: 0, zoom: 1 }, 2, { x: 100, y: 100 });
    expect(v).toEqual({ x: -100, y: -100, zoom: 2 });
    const fit = fitRect(1000, 800, { x: 0, y: 0, w: 1440, h: 900 }, 40);
    expect(fit.zoom).toBeCloseTo(920 / 1440);
    expect(insertSize(2000, 1000)).toEqual({ width: 640, height: 320 });
    expect(insertSize(100, 50)).toEqual({ width: 100, height: 50 });
  });
});

describe('constraints on resize', () => {
  it('moves right/bottom-pinned children and stretches left+right ones', () => {
    let { doc } = free();
    doc = insertNode(doc, createNode('rect', { id: 'c', x: 10, y: 10, width: 380, height: 20, constraints: { h: 'leftRight', v: 'top' } }), 'box');
    doc = insertNode(doc, createNode('rect', { id: 'd', x: 175, y: 0, width: 50, height: 10, constraints: { h: 'center', v: 'top' } }), 'box');
    const next = resizeNode(doc, 'box', { width: 600, height: 400 });
    expect(next.nodes.a).toMatchObject({ x: 10, y: 10 });
    expect(next.nodes.b).toMatchObject({ x: 500, y: 300 });
    expect(next.nodes.c).toMatchObject({ x: 10, width: 580 });
    expect(next.nodes.d).toMatchObject({ x: 275 });
    validateDoc(next);
    expect(applyConstraints(doc, 'box', 400, 300, 400, 300)).toBe(doc);
  });
});

describe('editing actions', () => {
  it('duplicates free layers with an offset and flow layers in place', () => {
    const store = new EditorStore(free().doc);
    store.select(['a']);
    duplicateSelection(store);
    const [copy] = store.getState().selection;
    expect(copy).not.toBe('a');
    expect(store.getState().doc.nodes[copy]).toMatchObject({ x: 20, y: 20, parentId: 'box' });
    expect(store.getState().doc.nodes.box.children).toEqual(['a', copy, 'b']);
    const sample = new EditorStore(lumenSample());
    sample.select(['card-2']);
    duplicateSelection(sample);
    expect(sample.getState().doc.nodes.features.children).toHaveLength(4);
    validateDoc(sample.getState().doc);
  });

  it('nudges only freely positioned layers', () => {
    const store = new EditorStore(free().doc);
    store.select(['a']);
    nudge(store, 10, -1);
    expect(store.getState().doc.nodes.a).toMatchObject({ x: 20, y: 9 });
    const sample = new EditorStore(lumenSample());
    sample.select(['card-1']);
    nudge(sample, 5, 5);
    expect(sample.getState().canUndo).toBe(false);
  });

  it('navigates the tree with Esc / Enter / select all', () => {
    const store = new EditorStore(lumenSample());
    store.select(['card-1-title']);
    selectParent(store);
    expect(store.getState().selection).toEqual(['card-1']);
    selectChildren(store);
    expect(store.getState().selection).toEqual(['card-1-dot', 'card-1-title', 'card-1-body']);
    selectAll(store);
    expect(store.getState().selection).toEqual(['card-1-dot', 'card-1-title', 'card-1-body']);
    store.select(['nav']);
    selectParent(store);
    expect(store.getState().selection).toEqual([]);
  });

  it('adds and removes auto layout, and wraps a layer in an auto-layout frame', () => {
    const store = new EditorStore(free().doc);
    store.select(['box']);
    toggleAutoLayout(store);
    const box = store.getState().doc.nodes.box;
    // Inferred from the current arrangement: a sits left of b, 240px apart, inset 10px / 50px.
    expect(box.type === 'frame' && box.layout).toMatchObject({ mode: 'horizontal', gap: 240, padding: [10, 50, 50, 10], alignCross: 'start' });
    expect(box.sizing).toEqual({ h: 'hug', v: 'hug' });
    toggleAutoLayout(store);
    expect(store.getState().doc.nodes.box.type === 'frame' && (store.getState().doc.nodes.box as { layout: { mode: string } }).layout.mode).toBe('none');
    store.select(['a']);
    toggleAutoLayout(store);
    const [wrapper] = store.getState().selection;
    expect(store.getState().doc.nodes[wrapper]).toMatchObject({ type: 'frame', children: ['a'], parentId: 'box', x: 10, y: 10 });
    expect(store.getState().doc.nodes.a).toMatchObject({ parentId: wrapper, x: 0, y: 0 });
    validateDoc(store.getState().doc);
  });

  it('inserts, replaces and prunes images', () => {
    const { doc } = free();
    const store = new EditorStore(doc);
    const asset = { id: 'pic', name: 'Pic', mime: 'image/png' as const, dataUrl: 'data:image/png;base64,iVBORw0KGgo=', width: 1200, height: 600 };
    insertImage(store, asset, 'box', { x: 100, y: 100, w: 400, h: 300 }, { x: 300, y: 250 });
    const [id] = store.getState().selection;
    expect(store.getState().doc.nodes[id]).toMatchObject({ type: 'image', assetId: 'pic', width: 368, height: 184, x: 16, y: 58 });
    replaceImage(store, id, { ...asset, id: 'pic2', width: 100, height: 100 });
    expect(store.getState().doc.nodes[id]).toMatchObject({ assetId: 'pic2', height: 368 });
    const pruned = pruneAssets(store.getState().doc);
    expect(Object.keys(pruned.assets)).toEqual(['pic2']);
    validateDoc(pruned);
  });
});

describe('layers panel drops', () => {
  it('maps before/after/inside to positions in the reversed layer list', () => {
    const { doc, root } = free();
    // box children: [a, b] → panel shows b above a.
    expect(resolveLayerDrop(doc, 'a', { id: 'b', position: 'before' }, root)).toEqual({ parentId: 'box', index: 1 });
    expect(resolveLayerDrop(doc, 'b', { id: 'a', position: 'after' }, root)).toEqual({ parentId: 'box', index: 0 });
    expect(resolveLayerDrop(doc, 'a', { id: root, position: 'before' }, root)).toEqual({ parentId: root, index: 1 });
    expect(resolveLayerDrop(doc, 'box', { id: 'a', position: 'inside' }, root)).toBeNull(); // into own child
    expect(resolveLayerDrop(doc, 'a', { id: 'b', position: 'inside' }, root)).toBeNull(); // rectangles hold no layers
  });
});

describe('page helpers', () => {
  it('derives unique, valid paths and default names', () => {
    let doc: SiteDoc = createSiteDoc();
    expect(pathForName(doc, 'About Us!')).toBe('/about-us');
    expect(pathForName(doc, 'Admin')).toBe('/admin-page');
    doc = addPage(doc, 'About', '/about');
    expect(pathForName(doc, 'About')).toBe('/about-2');
    expect(() => updatePage(doc, doc.pages[0].id, { path: '/home' })).toThrow(DocError);
    expect(() => updatePage(doc, doc.pages[1].id, { path: '/' })).toThrow(DocError);
    expect(updatePage(doc, doc.pages[1].id, { name: 'Team' }).pages[1].name).toBe('Team');
    expect(nextName(free().doc, 'Rectangle')).toBe('Rectangle 1');
    expect(nextName(insertNode(doc, createNode('rect', { name: 'Rectangle 4' }), doc.pages[0].rootId), 'Rectangle')).toBe('Rectangle 5');
  });
});
