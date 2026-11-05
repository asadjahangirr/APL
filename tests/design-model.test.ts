import { describe, expect, it } from 'vitest';
import { createArtboard, createLayer, designSchema, emptyDesign, type DesignDocument } from '../src/design/schema';
import { alignLayers, duplicateLayers, groupLayers, moveLayers, removeArtboards, removeLayers, reorderLayers, selectionRoots, snapMove, transformLayer, ungroupLayers, updateLayer } from '../src/design/model';
import { commitHistory, createHistory, undoHistory } from '../src/design/history';

function fixture(): DesignDocument {
  return designSchema.parse({ ...emptyDesign(), artboards: [createArtboard({ id: 'board', width: 1000, height: 800 })], layers: [
    createLayer('frame', 'board', { id: 'frame', x: 100, y: 100, width: 400, height: 300 }),
    createLayer('rectangle', 'board', { id: 'child', parentId: 'frame', x: 120, y: 140, width: 80, height: 60 }),
    createLayer('rectangle', 'board', { id: 'one', x: 600, y: 100, width: 100, height: 100 }),
    createLayer('text', 'board', { id: 'two', x: 800, y: 250, width: 120, height: 80 }),
  ] });
}
const layer = (design: DesignDocument, id: string) => design.layers.find(value => value.id === id)!;

describe('Pure design operations', () => {
  it('moves selected roots and descendants exactly once and respects inherited locks', () => {
    const design = fixture(), original = structuredClone(design);
    expect(selectionRoots(design, ['frame', 'child']).map(value => value.id)).toEqual(['frame']);
    const moved = moveLayers(design, ['frame', 'child'], 20, -10);
    expect(layer(moved, 'frame')).toMatchObject({ x: 120, y: 90 });
    expect(layer(moved, 'child')).toMatchObject({ x: 140, y: 130 });
    expect(layer(moved, 'one')).toEqual(layer(design, 'one'));
    expect(design).toEqual(original);
    const locked = updateLayer(design, 'frame', { locked: true });
    expect(moveLayers(locked, ['child'], 20, 20)).toBe(locked);
    expect(removeLayers(locked, ['child'])).toBe(locked);
  });

  it('resizes a frame clipping box without stretching its descendants or changing their typography', () => {
    const design = fixture();
    design.typeStyles = [{ id: 'shared-type', name: 'Shared title', fontFamily: 'Georgia', fontSize: 64, fontWeight: 700, lineHeight: 1.4 }];
    design.layers.push(createLayer('text', 'board', { id: 'frame-title', parentId: 'frame', x: 150, y: 160, width: 200, height: 90, typeStyleId: 'shared-type' }));
    const unchangedChildren = transformLayer(design, 'frame', { width: 800, height: 150 });
    expect(layer(unchangedChildren, 'child')).toEqual(layer(design, 'child'));
    expect(layer(unchangedChildren, 'frame-title')).toEqual(layer(design, 'frame-title'));
    const transformed = transformLayer(design, 'frame', { x: 200, y: 300, width: 800, height: 150, rotation: 90 });
    expect(layer(transformed, 'child')).toMatchObject({ x: 220, y: 340, width: 80, height: 60, rotation: 0 });
    expect(layer(transformed, 'frame-title')).toMatchObject({ x: 250, y: 360, width: 200, height: 90, fontSize: 40, typeStyleId: 'shared-type' });
    expect(layer(transformed, 'frame')).toMatchObject({ x: 200, y: 300, width: 800, height: 150, rotation: 90 });
    expect(transformed.typeStyles).toEqual(design.typeStyles);
  });

  it('uniformly scales a group and bakes linked typography without changing reusable styles', () => {
    const design = fixture();
    design.typeStyles = [{ id: 'shared-type', name: 'Shared title', fontFamily: 'Georgia', fontSize: 64, fontWeight: 700, lineHeight: 1.4 }];
    design.layers = design.layers.map(value => value.id === 'two' ? { ...value, typeStyleId: 'shared-type', rotation: 15 } : value.id === 'one' ? { ...value, radius: 12, strokeWidth: 6, stroke: '#000000' } : value);
    const grouped = groupLayers(design, ['one', 'two']);
    const group = grouped.layers.find(value => value.type === 'group')!;
    const scaled = transformLayer(grouped, group.id, { x: 100, y: 120, width: group.width * 2, rotation: 90 });
    expect(layer(scaled, group.id)).toMatchObject({ width: group.width * 2, height: group.height * 2, rotation: 90 });
    expect(layer(scaled, 'one')).toMatchObject({ x: 100 + (600 - group.x) * 2, y: 120 + (100 - group.y) * 2, width: 200, height: 200, radius: 24, strokeWidth: 12 });
    expect(layer(scaled, 'two')).toMatchObject({ width: 240, height: 160, fontFamily: 'Georgia', fontSize: 128, fontWeight: 700, lineHeight: 1.4, typeStyleId: null, rotation: 15 });
    expect(scaled.typeStyles).toEqual(design.typeStyles);
    expect(layer(grouped, 'two')).toMatchObject({ fontSize: 40, typeStyleId: 'shared-type' });
    const heightOnly = transformLayer(grouped, group.id, { height: group.height / 2 });
    expect(layer(heightOnly, group.id).width).toBeCloseTo(group.width / 2);
    expect(layer(heightOnly, 'two').fontSize).toBe(32);
  });

  it('preserves linked styles on a group move or rotation and rejects an anisotropic resize immutably', () => {
    const design = fixture();
    design.typeStyles = [{ id: 'shared-type', name: 'Shared title', fontFamily: 'Georgia', fontSize: 64, fontWeight: 700, lineHeight: 1.4 }];
    design.layers = design.layers.map(value => value.id === 'two' ? { ...value, typeStyleId: 'shared-type' } : value);
    const grouped = groupLayers(design, ['one', 'two']), original = structuredClone(grouped);
    const group = grouped.layers.find(value => value.type === 'group')!;
    const moved = transformLayer(grouped, group.id, { x: group.x + 10, y: group.y - 5, rotation: 30 });
    expect(layer(moved, 'two')).toMatchObject({ x: 810, y: 245, fontSize: 40, typeStyleId: 'shared-type', rotation: 0 });
    const rotationRoundoff = transformLayer(grouped, group.id, { rotation: 30, width: group.width * (1 + Number.EPSILON), height: group.height * (1 - Number.EPSILON) });
    expect(layer(rotationRoundoff, 'two')).toEqual(layer(grouped, 'two'));
    expect(() => transformLayer(grouped, group.id, { width: group.width * 2, height: group.height * 1.5 })).toThrow(/Groups keep their proportions/);
    expect(grouped).toEqual(original);
    const canvasRoundoff = transformLayer(grouped, group.id, { width: group.width * 2, height: group.height * (2 + 1e-9) });
    expect(layer(canvasRoundoff, group.id).height).toBe(group.height * 2);
  });

  it('duplicates complete selected subtrees with independent IDs and unchanged asset/style refs', () => {
    const design = fixture(), duplicated = duplicateLayers(design, ['frame', 'child']);
    const clones = duplicated.layers.filter(value => !design.layers.some(original => original.id === value.id));
    expect(clones).toHaveLength(2);
    const frame = clones.find(value => value.type === 'frame')!, child = clones.find(value => value.type === 'rectangle')!;
    expect(frame.parentId).toBeNull();
    expect(child.parentId).toBe(frame.id);
    expect(child.x).toBe(144);
    expect(new Set(duplicated.layers.map(value => value.id)).size).toBe(6);
    expect(removeLayers(duplicated, [frame.id]).layers).toEqual(design.layers);
    expect(removeArtboards(duplicated, ['board']).layers).toEqual([]);
  });

  it('groups same-parent layers without moving geometry and restores them on ungroup', () => {
    const design = fixture(), grouped = groupLayers(design, ['one', 'two'], 'Intro');
    const group = grouped.layers.find(value => value.type === 'group')!;
    expect(group).toMatchObject({ name: 'Intro', x: 600, y: 100, width: 320, height: 230 });
    expect(layer(grouped, 'one')).toMatchObject({ x: 600, y: 100, parentId: group.id });
    expect(layer(grouped, 'two').parentId).toBe(group.id);
    expect(ungroupLayers(grouped, [group.id]).layers).toEqual(design.layers);
    expect(() => groupLayers(design, ['child', 'two'])).toThrow(/same artboard and parent/);
  });

  it('bakes a rotated group into direct children while keeping nested relative geometry', () => {
    let design = moveLayers(moveLayers(fixture(), ['frame'], 200, 100), ['one'], -500, 0);
    design = groupLayers(design, ['frame', 'one']);
    const group = design.layers.find(value => value.type === 'group')!;
    design = updateLayer(design, group.id, { rotation: 90, opacity: 0.5 });
    const ungrouped = ungroupLayers(design, [group.id]);
    expect(layer(ungrouped, 'frame').x).toBeCloseTo(0);
    expect(layer(ungrouped, 'frame')).toMatchObject({ y: 300, rotation: 90, opacity: 0.5 });
    expect(layer(ungrouped, 'child').x).toBeCloseTo(20);
    expect(layer(ungrouped, 'child')).toMatchObject({ y: 340, rotation: 0, opacity: 1, parentId: 'frame' });
    expect(layer(ungrouped, 'one').x).toBeCloseTo(100);
    expect(layer(ungrouped, 'one').y).toBeCloseTo(100);
  });

  it('changes only sibling paint order, preserving stable selected order', () => {
    const design = fixture();
    const front = reorderLayers(design, ['frame', 'one'], 'front');
    expect(front.layers.filter(value => value.parentId === null).map(value => value.id)).toEqual(['two', 'frame', 'one']);
    expect(layer(front, 'child').parentId).toBe('frame');
    const back = reorderLayers(design, ['two'], 'back');
    expect(back.layers.filter(value => value.parentId === null).map(value => value.id)).toEqual(['two', 'frame', 'one']);
    expect(reorderLayers(design, ['one'], 'forward').layers.filter(value => value.parentId === null).map(value => value.id)).toEqual(['frame', 'two', 'one']);
    expect(reorderLayers(design, ['one'], 'backward').layers.filter(value => value.parentId === null).map(value => value.id)).toEqual(['one', 'frame', 'two']);
  });

  it('aligns multiple layers to their shared bounds and a single layer to the artboard', () => {
    const design = fixture();
    const aligned = alignLayers(design, ['one', 'two'], 'left');
    expect(layer(aligned, 'one').x).toBe(600);
    expect(layer(aligned, 'two').x).toBe(600);
    const center = alignLayers(design, ['one'], 'center');
    expect(layer(center, 'one').x).toBe(450);
    const inside = alignLayers(design, ['child'], 'right');
    expect(layer(inside, 'child').x).toBe(420);
  });

  it('snaps near artboard and sibling edges but excludes the selected subtree itself', () => {
    const design = fixture();
    const snapped = snapMove(design, ['one'], -597, 3, 6);
    expect(snapped.dx).toBe(-600);
    expect(snapped.guides).toContainEqual({ axis: 'x', position: 0 });
    const distant = snapMove(design, ['one'], -137, 37, 1);
    expect(distant).toEqual({ dx: -137, dy: 37, guides: [] });
    const moved = moveLayers(design, ['one'], snapped.dx, snapped.dy);
    expect(layer(moved, 'one').x).toBe(0);
  });

  it('frees deleted image assets after their final reference and restores assets through undo', () => {
    const design = fixture();
    design.assets = [
      { id: 'shared-picture', name: 'Shared image', dataUrl: 'data:image/png;base64,iVBORw0KGgo=', width: 16, height: 16 },
      { id: 'unused-import', name: 'Preserved imported image', dataUrl: 'data:image/png;base64,iVBORw0KGgo=', width: 16, height: 16 },
    ];
    design.layers.push(createLayer('image', 'board', { id: 'picture-one', assetId: 'shared-picture' }), createLayer('image', 'board', { id: 'picture-two', parentId: 'frame', assetId: 'shared-picture' }));
    const first = removeLayers(design, ['picture-one']);
    expect(first.assets.map(asset => asset.id)).toEqual(['shared-picture', 'unused-import']);
    const final = removeLayers(first, ['frame']);
    expect(final.assets.map(asset => asset.id)).toEqual(['unused-import']);
    const history = commitHistory(createHistory(first), final);
    expect(undoHistory(history).present).toEqual(first);
    expect(design.assets).toHaveLength(2);
  });

  it('retains assets used by a duplicated image or another artboard', () => {
    const design = fixture();
    design.assets = [{ id: 'photo', name: 'Photo', dataUrl: 'data:image/png;base64,iVBORw0KGgo=', width: 16, height: 16 }];
    design.layers.push(createLayer('image', 'board', { id: 'photo-layer', assetId: 'photo' }));
    const duplicated = duplicateLayers(design, ['photo-layer']);
    expect(removeLayers(duplicated, ['photo-layer']).assets).toEqual(design.assets);
    design.artboards.push(createArtboard({ id: 'second-board' }));
    design.layers.push(createLayer('image', 'second-board', { id: 'other-photo', assetId: 'photo' }));
    const first = removeArtboards(design, ['board']);
    expect(first.assets).toEqual(design.assets);
    expect(first.layers.map(layer => layer.id)).toEqual(['other-photo']);
    expect(removeArtboards(first, ['second-board']).assets).toEqual([]);
  });
});
