import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { unzipSync } from 'fflate';
import { newProject } from '../src/project/templates';
import { projectSchema as legacyV7ProjectSchema } from '../src/project/legacy-v7-schema';
import { legacyV8StudioSchema } from '../src/project/legacy-v8-studio';
import { createStudioProject, readStudioProject } from '../src/project/studio-document';
import { createArtboard, createLayer, emptyDesign } from '../src/design/schema';

const captured: Blob[] = [];
function design(text: string) {
  const board = createArtboard({ id: 'archived-board' });
  return { ...emptyDesign(), artboards: [board], layers: [createLayer('text', board.id, { id: 'archived-text', text })] };
}

async function downloadedZip() {
  expect(captured).toHaveLength(1);
  return unzipSync(new Uint8Array(await captured[0].arrayBuffer()));
}

describe('workspace backups retain frozen envelope formats', () => {
  beforeEach(() => {
    vi.resetModules(); vi.useFakeTimers(); captured.length = 0;
    vi.stubGlobal('document', { createElement: () => ({ href: '', download: '', click: vi.fn() }) });
    vi.spyOn(URL, 'createObjectURL').mockImplementation(blob => { captured.push(blob as Blob); return 'blob:captured-download'; });
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});
    vi.stubGlobal('indexedDB', { open() { throw new DOMException('Database denied', 'SecurityError'); } });
  });
  afterEach(() => { vi.clearAllTimers(); vi.useRealTimers(); vi.restoreAllMocks(); vi.unstubAllGlobals(); });

  it('serializes a frozen Studio8 exactly even when a newer Design is staged under the same ID', async () => {
    const { components: _components, ...historical } = newProject();
    const website = legacyV7ProjectSchema.parse({ ...historical, schemaVersion: 7 });
    const frozen = legacyV8StudioSchema.parse({ schemaVersion: 8, id: website.id, name: website.name, updatedAt: website.updatedAt, website, design: design('Original artwork'), conversions: [] });
    const storage = await import('../src/project/storage');
    storage.attachStudioProject(createStudioProject(readStudioProject(frozen).website, design('Newer staged artwork')));
    const { downloadWorkspace } = await import('../src/export/download');
    await downloadWorkspace([frozen]);
    const files = await downloadedZip();
    expect(new TextDecoder().decode(files[frozen.id + '.apl.json'])).toBe(JSON.stringify(frozen, null, 2));
    expect(JSON.parse(new TextDecoder().decode(files[frozen.id + '.apl.json'])).website.schemaVersion).toBe(7);
    expect(new TextDecoder().decode(files['RESTORE.txt'])).toContain('original document format');
  });

  it('serializes explicit Studio10 snapshots directly while raw Website9 resolves staged companions', async () => {
    const website = newProject(), snapshot = createStudioProject(website, design('Frozen current-format artwork'));
    const storage = await import('../src/project/storage');
    const newer = createStudioProject(website, design('Recoverable unsaved artwork'));
    storage.attachStudioProject(newer);
    const { downloadWorkspace } = await import('../src/export/download');
    await downloadWorkspace([snapshot]);
    let files = await downloadedZip();
    expect(JSON.parse(new TextDecoder().decode(files[website.id + '.apl.json']))).toEqual(snapshot);
    captured.length = 0;
    await downloadWorkspace([website]);
    files = await downloadedZip();
    expect(JSON.parse(new TextDecoder().decode(files[website.id + '.apl.json']))).toEqual(newer);
  });

  it('rejects invalid historical conversions before creating any download', async () => {
    const { components: _components, ...historical } = newProject();
    const website = legacyV7ProjectSchema.parse({ ...historical, schemaVersion: 7 });
    const invalid = { schemaVersion: 8 as const, id: website.id, name: website.name, updatedAt: website.updatedAt, website, design: design('Archived'), conversions: [{ version: 1 }] };
    const { downloadWorkspace } = await import('../src/export/download');
    await expect(downloadWorkspace([invalid as never])).rejects.toThrow();
    expect(captured).toEqual([]);
  });
});
