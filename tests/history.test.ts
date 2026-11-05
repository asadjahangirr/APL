import { describe, expect, it } from 'vitest';
import { DocumentHistory } from '../src/editor/history';
import { newProject } from '../src/project/templates';
import type { EditorData } from '../src/editor/config';

function initial(): EditorData {
  const p = newProject();
  return { root: { props: { name: p.name, title: p.pages[0].title, description: p.pages[0].description, accent: p.theme.accent, font: p.theme.font, body: [] } }, content: [] };
}
describe('document history', () => {
  it('protects history from external mutation and restores both undo and redo', () => {
    const data = initial(), original = structuredClone(data), history = new DocumentHistory(data);
    data.root.props!.title = 'Changed'; history.record(data, 1000);
    data.root.props!.title = 'Mutated by editor';
    expect(history.move(-1)).toEqual(original);
    expect(history.move(1)?.root.props?.title).toBe('Changed');
  });
  it('groups rapid typing in one field, preserves distinct fields, and drops a redo branch', () => {
    const history = new DocumentHistory(initial());
    const first = history.current; first.root.props!.title = 'A'; history.record(first, 1000);
    first.root.props!.title = 'AB'; history.record(first, 1100);
    first.root.props!.description = 'Separate edit'; history.record(first, 1200);
    expect(history.move(-1)?.root.props?.title).toBe('AB');
    expect(history.move(-1)?.root.props?.title).not.toBe('A');
    const branch = history.current; branch.root.props!.title = 'New branch'; history.record(branch, 1300);
    expect(history.canRedo).toBe(false);
    expect(history.move(-1)?.root.props?.title).not.toBe('AB');
  });
  it('bounds history and ignores identical changes', () => {
    const history = new DocumentHistory(initial());
    expect(history.record(history.current)).toBe(false);
    for (let i = 0; i < 100; i++) { const d = history.current; d.root.props!.title = String(i); history.record(d, i * 1000); }
    let count = 0; while (history.move(-1)) count++;
    expect(count).toBe(49);
  });
});
