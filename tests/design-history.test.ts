import { describe, expect, it } from 'vitest';
import { commitHistory, createHistory, DESIGN_HISTORY_LIMIT, redoHistory, undoHistory } from '../src/design/history';
import { createArtboard, createLayer, emptyDesign } from '../src/design/schema';
import { moveLayers } from '../src/design/model';

describe('Design history', () => {
  it('undoes and redoes committed geometry, then clears redo on a divergent edit', () => {
    const initial = { ...emptyDesign(), artboards: [createArtboard({ id: 'board' })], layers: [createLayer('text', 'board', { id: 'text' })] };
    const first = createHistory(initial);
    const moved = commitHistory(first, moveLayers(first.present, ['text'], 12, 5));
    const undone = undoHistory(moved);
    expect(undone.present).toEqual(initial);
    expect(redoHistory(undone).present).toEqual(moved.present);
    expect(commitHistory(undone, moveLayers(undone.present, ['text'], -10, 0)).future).toEqual([]);
    expect(first.present).toEqual(initial);
    expect(first.past).toEqual([]);
    expect(undoHistory(first)).toBe(first);
  });

  it('records one completed gesture, ignores no-op commits and retains at most50 past states', () => {
    const initial = { ...emptyDesign(), artboards: [createArtboard({ id: 'board' })], layers: [createLayer('rectangle', 'board', { id: 'rect' })] };
    let history = createHistory(initial);
    expect(commitHistory(history, structuredClone(history.present))).toBe(history);
    for (let index = 0; index < 60; index++) history = commitHistory(history, moveLayers(history.present, ['rect'], 1, 0));
    expect(history.past).toHaveLength(DESIGN_HISTORY_LIMIT);
    for (let index = 0; index < DESIGN_HISTORY_LIMIT; index++) history = undoHistory(history);
    expect(history.present.layers[0].x).toBe(initial.layers[0].x + 10);
    expect(history.future).toHaveLength(DESIGN_HISTORY_LIMIT);
    expect(undoHistory(history)).toBe(history);
  });

  it('evicts old snapshots before embedded image histories exceed the 64 MB budget', () => {
    const initial = {
      ...emptyDesign(), artboards: [createArtboard({ id: 'board' })], layers: [createLayer('rectangle', 'board', { id: 'rect' })],
      assets: Array.from({ length: 6 }, (_, index) => ({ id: `image${index}`, name: 'Large local image', dataUrl: `data:image/png;base64,${'A'.repeat(2_800_000)}`, width: 1000, height: 1000 })),
    };
    let history = createHistory(initial);
    for (let index = 0; index < 6; index++) history = commitHistory(history, moveLayers(history.present, ['rect'], 1, 0));
    expect(history.past).toHaveLength(2);
    const states = [...history.past, history.present, ...history.future];
    expect(states.reduce((sum, state) => sum + new TextEncoder().encode(JSON.stringify(state)).byteLength, 0)).toBeLessThanOrEqual(64_000_000);
    expect(undoHistory(undoHistory(history)).present.layers[0].x).toBe(initial.layers[0].x + 4);
  }, 15_000);
});
