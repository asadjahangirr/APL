import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import { IDBFactory, IDBObjectStore } from 'fake-indexeddb';
import { createArtboard, createLayer, designSchema, emptyDesign, type DesignDocument } from '../src/design/schema';
import { projectSchema, type Project } from '../src/project/schema';
import { readProject } from '../src/project/migrate';
import { createStudioProject, readStudioProject, studioProjectSchema } from '../src/project/studio-document';
import { newProject } from '../src/project/templates';
import { legacyV8StudioSchema } from '../src/project/legacy-v8-studio';
import { projectSchema as legacyV7ProjectSchema } from '../src/project/legacy-v7-schema';
import { conversionRecordSchema, type ConversionRecord } from '../src/conversion/schema';
import legacyV1 from './fixtures/project-v1.json';
import legacyV4 from './fixtures/project-v4.json';

function populatedDesign(): DesignDocument {
  const desktop = createArtboard({ id: 'desktop', width: 1440, height: 1000 });
  const mobile = createArtboard({ id: 'mobile', name: 'Mobile', x: 1600, width: 390, height: 844 });
  return {
    ...emptyDesign(), artboards: [desktop, mobile],
    colors: [{ id: 'brand-green', name: 'Brand green', value: '#244c40' }],
    typeStyles: [{ id: 'headline', name: 'Headline', fontFamily: 'Georgia', fontSize: 64, fontWeight: 400, lineHeight: 1.1 }],
    assets: [{ id: 'image-source', name: 'Uploaded illustration', width: 1, height: 1, dataUrl: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScLbtAAAAABJRU5ErkJggg==' }],
    layers: [
      createLayer('frame', desktop.id, { id: 'hero-frame', fill: '#ffffff' }),
      createLayer('text', desktop.id, { id: 'hero-title', parentId: 'hero-frame', text: 'Make room for ideas.', typeStyleId: 'headline', colorStyleId: 'brand-green' }),
      createLayer('image', desktop.id, { id: 'hero-image', assetId: 'image-source' }),
      createLayer('ellipse', mobile.id, { id: 'mobile-shape', visible: false, locked: true, rotation: 22, opacity: 0.5 })
    ]
  };
}

function conversionRecord(website: Project): ConversionRecord {
  return conversionRecordSchema.parse({
    version: 1, id: 'approved-conversion', algorithmVersion: '1.0.0',
    createdAt: website.updatedAt, updatedAt: website.updatedAt, artboardId: 'desktop',
    pageId: website.pages[0].id, targetRootIds: [website.pages[0].nodes[0].id],
    sourceFingerprint: 'a'.repeat(64), targetFingerprint: 'b'.repeat(64),
    plan: { version: 1, artboardId: 'desktop',
      page: { name: 'Home', path: '/', title: 'Home', description: '', inNavigation: true, showHeader: true, showFooter: true },
      sections: [{ id: 'converted-section', name: 'Introduction', frameId: 'hero-frame',
        columns: [{ id: 'intro-column', items: [{ layerId: 'hero-title', role: 'heading', level: 'h1' }] }],
        layout: { mobile: 'stack' }, gap: { mobile: 16 }, paddingX: { mobile: 24 }, paddingY: { mobile: 24 }, contentGap: { mobile: 16 } }],
      contact: null }, acknowledgedWarnings: []
  });
}

function legacyStudio8() {
  const { components: _components, ...historical } = newProject();
  const website = legacyV7ProjectSchema.parse({ ...historical, schemaVersion: 7 });
  return legacyV8StudioSchema.parse({ schemaVersion: 8, id: website.id, name: website.name, updatedAt: website.updatedAt, website, design: populatedDesign(), conversions: [] });
}

let budgetFixture: { website: Project; design: DesignDocument } | undefined;
function individuallyValidNearBudget() {
  if (budgetFixture) return budgetFixture;
  const website = newProject(), home = website.pages[0];
  const image = 'data:image/png;base64,' + 'A'.repeat(2_490_000);
  website.pages = Array.from({ length: 4 }, (_, index) => {
    const page = structuredClone(home);
    page.nodes.forEach(node => { node.id = crypto.randomUUID(); if (node.type === 'Hero') node.props.image = image; });
    return { ...page, id: index ? 'page-' + index : home.id, path: index ? '/page-' + index : '/' };
  });
  const artboard = createArtboard({ id: 'budget-board' });
  const design = { ...emptyDesign(), artboards: [artboard], layers: Array.from({ length: 1000 }, (_, index) => createLayer('text', artboard.id, { id: 'budget-layer-' + index, text: '' })) };
  const overhead = new TextEncoder().encode(JSON.stringify(design)).byteLength;
  const text = 'x'.repeat(Math.floor((19_990_000 - overhead) / design.layers.length));
  design.layers.forEach(layer => { layer.text = text; });
  budgetFixture = { website: projectSchema.parse(website), design: designSchema.parse(design) };
  return budgetFixture;
}

describe('dual-document backups and read-only migration', () => {
  it('migrates frozen Studio8 and Website7 purely while preserving both authored documents', () => {
    const original = legacyStudio8();
    const bytes = JSON.stringify(original);
    const migrated = readStudioProject(original);
    expect(migrated.schemaVersion).toBe(10);
    expect(migrated.website.schemaVersion).toBe(9);
    const { components, ...websiteWithoutComponents } = migrated.website;
    expect(components).toEqual([]);
    expect({ ...websiteWithoutComponents, schemaVersion: 7 }).toEqual(original.website);
    expect(migrated.design).toEqual(original.design);
    expect(migrated.conversions).toEqual([]);
    expect(JSON.stringify(original)).toBe(bytes);
    expect(() => readStudioProject({ ...original, conversions: [conversionRecord(migrated.website)] })).toThrow();
    expect(() => legacyV8StudioSchema.parse({ ...original, website: migrated.website })).toThrow();
  });

  it('round-trips records with detached source/target references but rejects duplicate record IDs', () => {
    const website = newProject(), record = conversionRecord(website);
    record.artboardId = record.plan.artboardId = 'deleted-artboard';
    record.pageId = 'deleted-page';
    record.targetRootIds = ['deleted-root'];
    const studio = createStudioProject(website, populatedDesign(), [record]);
    expect(readStudioProject(JSON.parse(JSON.stringify(studio)))).toEqual(studio);
    expect(() => createStudioProject(website, populatedDesign(), [record, record])).toThrow('unique');
    expect(() => readStudioProject({ ...studio, conversions: [{ ...record, version: 2 }] })).toThrow();
  });

  it('wraps the current website without changing a byte of its authored payload', () => {
    const website = readProject(legacyV4);
    website.pages.push({ id: 'private-story', name: 'Private story', path: '/private-story', inNavigation: false, title: 'Story', description: '', nodes: [] });
    const bytes = JSON.stringify(website);
    const envelope = readStudioProject(website);
    expect(JSON.stringify(envelope.website)).toBe(bytes);
    expect(JSON.stringify(website)).toBe(bytes);
    expect(envelope.design).toEqual(emptyDesign());
    expect(envelope.conversions).toEqual([]);
    expect(readProject(envelope)).toEqual(website);
    expect(envelope.website.content.services).toEqual(website.content.services);
  });

  it('reads every frozen v1-v6 contract without rewriting the original input', () => {
    const base = readProject(legacyV1);
    const { content: _content, components: _components, ...withoutContent } = base;
    const minimal = { ...withoutContent, theme: { accent: base.theme.accent, font: base.theme.font } };
    const fixtures = [
      legacyV1,
      { ...minimal, schemaVersion: 2 },
      { ...minimal, schemaVersion: 3 },
      legacyV4,
      { ...withoutContent, schemaVersion: 5, theme: base.theme, content: { services: [], portfolio: [] } },
      { ...withoutContent, schemaVersion: 6, theme: base.theme, content: { services: [], portfolio: [] } }
    ];
    for (const input of fixtures) {
      const original = JSON.stringify(input);
      const studio = readStudioProject(input);
      expect(studio.website).toEqual(readProject(input));
      expect(studio.design.artboards).toEqual([]);
      expect(JSON.stringify(input)).toBe(original);
    }
  });

  it('round-trips ordered artboards, nested layers, images and reusable styles alongside Website', () => {
    const studio = createStudioProject(newProject(), populatedDesign());
    const restored = readStudioProject(JSON.parse(JSON.stringify(studio)));
    expect(restored).toEqual(studio);
    expect(restored.design.layers.map(layer => layer.id)).toEqual(['hero-frame', 'hero-title', 'hero-image', 'mobile-shape']);
    expect(readProject(restored)).toEqual(studio.website);
    // Mutating a restored document never changes the imported input.
    restored.design.layers[1].text = 'A new direction';
    expect(studio.design.layers[1].text).toBe('Make room for ideas.');
    expect(restored.website).toEqual(studio.website);
  });

  it('rejects future formats, mismatched metadata and premature conversions immutably', () => {
    const studio = createStudioProject(newProject(), populatedDesign());
    for (const bad of [
      { ...studio, schemaVersion: 11 },
      { ...studio, id: crypto.randomUUID() },
      { ...studio, name: 'Other project' },
      { ...studio, updatedAt: '2020-01-01T00:00:00.000Z' },
      { ...studio, conversions: [{ frameId: 'hero-frame', pageId: 'home' }] }
    ]) {
      const original = JSON.stringify(bad);
      expect(() => readStudioProject(bad)).toThrow();
      expect(() => readProject(bad)).toThrow();
      expect(JSON.stringify(bad)).toBe(original);
    }
  });

  it('rejects missing parents, assets, artboards, styles, cycles and unknown layer kinds', () => {
    const studio = createStudioProject(newProject(), populatedDesign());
    for (const modify of [
      (design: DesignDocument) => { design.layers[1].parentId = 'missing'; },
      (design: DesignDocument) => { design.layers[1].artboardId = 'missing'; },
      (design: DesignDocument) => { design.layers[2].assetId = 'missing'; },
      (design: DesignDocument) => { design.layers[1].typeStyleId = 'missing'; },
      (design: DesignDocument) => { design.layers[1].colorStyleId = 'missing'; },
      (design: DesignDocument) => { design.layers[0].parentId = 'hero-frame'; }
    ]) {
      const broken = structuredClone(studio);
      modify(broken.design);
      expect(studioProjectSchema.safeParse(broken).success).toBe(false);
      expect(() => readProject(broken)).toThrow();
    }
    const broken = structuredClone(studio) as unknown as { design: { layers: { type: string }[] } };
    broken.design.layers[0].type = 'script';
    expect(() => readStudioProject(broken)).toThrow();
  });
});

function database(name = 'apl-studio', store = 'projects'): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(name, 1);
    request.onupgradeneeded = () => request.result.createObjectStore(store, { keyPath: 'id' });
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function putRaw(value: unknown) {
  const db = await database();
  return new Promise<void>((resolve, reject) => {
    const tx = db.transaction('projects', 'readwrite');
    tx.objectStore('projects').put(value);
    tx.oncomplete = () => { db.close(); resolve(); };
    tx.onabort = tx.onerror = () => { db.close(); reject(tx.error); };
  });
}

async function getRaw(id: string, name = 'apl-studio', store = 'projects'): Promise<unknown> {
  const db = await database(name, store);
  return new Promise((resolve, reject) => {
    const tx = db.transaction(store, 'readonly'), request = tx.objectStore(store).get(id);
    request.onsuccess = () => resolve(request.result);
    tx.oncomplete = () => db.close();
    tx.onabort = tx.onerror = () => { db.close(); reject(tx.error); };
  });
}

describe('dual editor local persistence', () => {
  beforeEach(() => { vi.resetModules(); vi.stubGlobal('indexedDB', new IDBFactory()); });
  afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); });

  it('preserves exact raw Studio8 in a separate immutable archive before the first v10 write', async () => {
    const original = legacyStudio8(), bytes = JSON.stringify(original);
    await putRaw(original);
    const storage = await import('../src/project/storage');
    const [website] = await storage.listProjects();
    expect(JSON.stringify(await getRaw(original.id))).toBe(bytes);
    await storage.saveProject({ ...website, name: 'First Phase 3 edit' });
    const archiveId = 'before-guided-conversion-v1:' + original.id;
    const archive = await getRaw(archiveId, 'apl-studio-protection', 'snapshots') as { projects: unknown[] };
    expect(JSON.stringify(archive.projects[0])).toBe(bytes);
    expect((await getRaw(original.id) as { schemaVersion: number }).schemaVersion).toBe(10);
    await storage.saveDesign(website, emptyDesign());
    expect(await getRaw(archiveId, 'apl-studio-protection', 'snapshots')).toEqual(archive);
    const protection = await import('../src/project/protection');
    expect(await protection.readConversionProtection()).toEqual([original]);
  });

  it('keeps a raw Studio8 untouched when its Phase 3 archive cannot be saved', async () => {
    const original = legacyStudio8();
    await putRaw(original);
    const storage = await import('../src/project/storage');
    const [website] = await storage.listProjects();
    const factory = indexedDB;
    vi.stubGlobal('indexedDB', { open(name: string, version?: number) {
      if (name === 'apl-studio-protection') throw new DOMException('Archive unavailable', 'SecurityError');
      return version === undefined ? factory.open(name) : factory.open(name, version);
    } });
    await expect(storage.saveProject({ ...website, name: 'Pending Phase 3' })).rejects.toThrow('Archive unavailable');
    expect(await getRaw(original.id)).toEqual(original);
    expect((await storage.getCurrentStudioProject(original.id)).name).toBe('Pending Phase 3');
  });

  it('preserves conversion records through interleaved normal Design and Website edits', async () => {
    const storage = await import('../src/project/storage');
    const website = newProject(), records = [conversionRecord(website)];
    await storage.saveStudioProject(createStudioProject(website, populatedDesign(), records));
    const editedDesign = populatedDesign();
    editedDesign.layers[1].text = 'A later Design edit';
    const first = storage.saveDesign(website, editedDesign);
    const editedWebsite = { ...website, name: 'A later Build edit' };
    const second = storage.saveProject(editedWebsite);
    await Promise.all([first, second]);
    const current = await storage.getCurrentStudioProject(website);
    expect(current.website).toEqual(editedWebsite);
    expect(current.design).toEqual(editedDesign);
    expect(current.conversions).toEqual(records);
    expect(readStudioProject(await getRaw(website.id))).toEqual(current);
    expect((await storage.getStudioProject(editedWebsite)).conversions).toEqual(records);
  });

  it('rejects a stale reviewed candidate before mutating either document or its revision', async () => {
    const storage = await import('../src/project/storage');
    const website = newProject();
    await storage.saveStudioProject(createStudioProject(website, populatedDesign()));
    const reviewed = await storage.getCurrentStudioProject(website.id);
    const reviewRevision = storage.getStudioRevision(website.id);
    reviewed.website.name = reviewed.name = 'Stale converted Website';
    reviewed.conversions = [conversionRecord(website)];
    const newer = populatedDesign();
    newer.layers[1].text = 'Changed after review';
    await storage.saveDesign(website, newer);
    const before = await storage.getCurrentStudioProject(website.id);
    const revision = storage.getStudioRevision(website.id);
    expect(() => storage.saveStudioProject(reviewed, { revision: reviewRevision })).toThrow('changed while you reviewed');
    expect(storage.getStudioRevision(website.id)).toBe(revision);
    expect(await storage.getCurrentStudioProject(website.id)).toEqual(before);
    expect(readStudioProject(await getRaw(website.id))).toEqual(before);
  });

  it('stages conversion documents and records atomically, retaining the whole candidate after quota failure', async () => {
    const storage = await import('../src/project/storage');
    const website = newProject();
    const original = createStudioProject(website, populatedDesign());
    await storage.saveStudioProject(original);
    const design = populatedDesign();
    design.layers[1].text = 'Confirmed source';
    const candidate = createStudioProject({ ...website, name: 'Confirmed Website' }, design, [conversionRecord(website)]);
    const originalPut = IDBObjectStore.prototype.put;
    const failure = vi.spyOn(IDBObjectStore.prototype, 'put').mockImplementation(function(this: IDBObjectStore, value, key) {
      if (this.name === 'projects') throw new DOMException('Simulated quota failure', 'QuotaExceededError');
      return key === undefined ? originalPut.call(this, value) : originalPut.call(this, value, key);
    });
    const pending = storage.saveStudioProject(candidate, { revision: storage.getStudioRevision(website.id) });
    expect(await storage.getCurrentStudioProject(website.id)).toEqual(candidate);
    await expect(pending).rejects.toThrow('Could not save locally');
    expect(readStudioProject(await getRaw(website.id))).toEqual(original);
    expect(await storage.getStudioProject(candidate.website)).toEqual(candidate);
    expect(storage.hasPendingSaves()).toBe(false);
    failure.mockRestore();
    await storage.saveProject(candidate.website);
    expect(readStudioProject(await getRaw(website.id))).toEqual(candidate);
  });

  it('backs up the complete never-saved conversion when IndexedDB is denied entirely', async () => {
    const storage = await import('../src/project/storage');
    const website = newProject();
    const candidate = createStudioProject(website, populatedDesign(), [conversionRecord(website)]);
    vi.stubGlobal('indexedDB', { open() { throw new DOMException('Database denied', 'SecurityError'); } });
    await expect(storage.saveStudioProject(candidate)).rejects.toThrow('Database denied');
    expect(await storage.getCurrentStudioProject(website.id)).toEqual(candidate);
    expect(await storage.getStudioProject(website)).toEqual(candidate);
  });

  it('imports and duplicates full envelopes without dropping or sharing records', async () => {
    const storage = await import('../src/project/storage');
    const website = newProject();
    const original = createStudioProject(website, populatedDesign(), [conversionRecord(website)]);
    await storage.saveStudioProject(original);
    const copy = createStudioProject({ ...website, id: crypto.randomUUID(), name: 'Copy' }, original.design, original.conversions);
    storage.attachStudioProject(copy);
    await storage.saveProject(copy.website);
    const restored = readStudioProject(JSON.parse(JSON.stringify(copy)));
    const imported = createStudioProject({ ...restored.website, id: crypto.randomUUID(), name: 'Imported' }, restored.design, restored.conversions);
    storage.attachStudioProject(imported);
    await storage.saveProject(imported.website);
    original.conversions[0].acknowledgedWarnings.push('Original-only edit');
    await storage.saveStudioProject(original);
    expect((await storage.getCurrentStudioProject(copy.id)).conversions[0].acknowledgedWarnings).toEqual([]);
    expect((await storage.getCurrentStudioProject(imported.id)).conversions[0].acknowledgedWarnings).toEqual([]);
    expect(readStudioProject(await getRaw(copy.id))).toEqual(copy);
  });

  it('includes record overhead in the 30 MB guard before accepting a full conversion stage', async () => {
    const { website, design } = individuallyValidNearBudget();
    const trimmed = structuredClone(design);
    const draft = { schemaVersion: 10, id: website.id, name: website.name, updatedAt: website.updatedAt, website, design: trimmed, conversions: [] };
    const size = new TextEncoder().encode(JSON.stringify(draft, null, 2)).byteLength;
    const removePerLayer = Math.ceil((size - 29_990_000) / trimmed.layers.length);
    trimmed.layers.forEach(layer => { layer.text = layer.text.slice(0, -removePerLayer); });
    const before = createStudioProject(website, trimmed);
    const record = conversionRecord(website);
    record.acknowledgedWarnings = Array.from({ length: 1000 }, () => 'w'.repeat(200));
    const candidate = { ...before, conversions: [record] };
    const storage = await import('../src/project/storage');
    storage.attachStudioProject(before);
    const revision = storage.getStudioRevision(website.id);
    expect(() => storage.saveStudioProject(candidate, { revision })).toThrow('30 MB');
    expect(() => storage.attachStudioProject(candidate)).toThrow('30 MB');
    expect(storage.getStudioRevision(website.id)).toBe(revision);
    expect(await storage.getCurrentStudioProject(website.id)).toEqual(before);
    expect(storage.hasPendingSaves()).toBe(false);
  }, 20_000);

  it('lists a raw website read-only, then saves v10 with an immutable exact original snapshot', async () => {
    const original = newProject();
    const bytes = JSON.stringify(original);
    await putRaw(original);
    const storage = await import('../src/project/storage');
    expect(await storage.listProjects()).toEqual([original]);
    expect(JSON.stringify(await getRaw(original.id))).toBe(bytes);
    const changed = { ...original, name: 'A new project name' };
    await storage.saveProject(changed);
    const stored = readStudioProject(await getRaw(original.id));
    expect(stored.schemaVersion).toBe(10);
    expect(stored.website).toEqual(changed);
    const archived = await getRaw('before-design-canvas-v1:' + original.id, 'apl-studio-protection', 'snapshots') as { projects: unknown[] };
    expect(JSON.stringify(archived.projects[0])).toBe(bytes);
    await storage.saveProject({ ...changed, name: 'Another update' });
    expect(await getRaw('before-design-canvas-v1:' + original.id, 'apl-studio-protection', 'snapshots')).toEqual(archived);
  });

  it('serializes simultaneous Design and Build writes without losing either document', async () => {
    const storage = await import('../src/project/storage');
    const original = { ...newProject(), updatedAt: '2026-01-01T00:00:00.000Z' };
    await storage.saveProject(original);
    const firstDesign = populatedDesign();
    const first = storage.saveDesign({ ...original, updatedAt: '2026-01-02T00:00:00.000Z' }, firstDesign);
    const build = { ...original, name: 'Changed in Build', updatedAt: '2026-01-03T00:00:00.000Z' };
    build.pages = build.pages.map(page => ({ ...page, title: 'A website edit' }));
    const second = storage.saveProject(build);
    const latestDesign = structuredClone(firstDesign);
    latestDesign.layers[1].text = 'A design edit';
    // This stale canvas closure carries a later timestamp, but its old Website
    // content must not replace the Build edit waiting in the same write queue.
    const third = storage.saveDesign({ ...original, updatedAt: '2026-01-04T00:00:00.000Z' }, latestDesign);
    await Promise.all([first, second, third]);
    const stored = readStudioProject(await getRaw(original.id));
    expect(stored.design).toEqual(latestDesign);
    expect(stored.website.name).toBe('Changed in Build');
    expect(stored.website.pages[0].title).toBe('A website edit');
    expect(stored.updatedAt).toBe('2026-01-04T00:00:00.000Z');
  });

  it('does not replace a legacy original if its immutable migration snapshot cannot be saved', async () => {
    const original = newProject();
    await putRaw(original);
    const storage = await import('../src/project/storage');
    await storage.listProjects();
    const factory = indexedDB;
    vi.stubGlobal('indexedDB', {
      open(name: string, version?: number) {
        if (name === 'apl-studio-protection') throw new DOMException('Recovery database unavailable', 'SecurityError');
        return version === undefined ? factory.open(name) : factory.open(name, version);
      }
    });
    const changed = { ...original, name: 'Pending migration' };
    await expect(storage.saveProject(changed)).rejects.toThrow('Recovery database unavailable');
    expect(await getRaw(original.id)).toEqual(original);
    expect((await storage.getStudioProject(changed)).website).toEqual(changed);
    vi.stubGlobal('indexedDB', factory);
    await storage.saveProject(changed);
    expect(readStudioProject(await getRaw(original.id)).website).toEqual(changed);
  });

  it('preserves the newest Design timestamp when a delayed older Build facade saves later', async () => {
    const storage = await import('../src/project/storage');
    const original = { ...newProject(), updatedAt: '2026-01-01T00:00:00.000Z' };
    await storage.saveProject(original);
    const design = populatedDesign();
    await storage.saveDesign({ ...original, updatedAt: '2026-01-03T00:00:00.000Z' }, design);
    await storage.saveProject({ ...original, name: 'Changed in Build', updatedAt: '2026-01-02T00:00:00.000Z' });
    const stored = readStudioProject(await getRaw(original.id));
    expect(stored.website.name).toBe('Changed in Build');
    expect(stored.design).toEqual(design);
    expect(stored.updatedAt).toBe('2026-01-03T00:00:00.000Z');
  });

  it('tracks queued saves immediately and clears pending state on both success and failure', async () => {
    const storage = await import('../src/project/storage');
    const original = newProject();
    expect(storage.hasPendingSaves()).toBe(false);
    const first = storage.saveProject(original);
    const second = storage.saveDesign(original, populatedDesign());
    expect(storage.hasPendingSaves()).toBe(true);
    await first;
    expect(storage.hasPendingSaves()).toBe(true);
    await second;
    expect(storage.hasPendingSaves()).toBe(false);
    vi.stubGlobal('indexedDB', { open() { throw new DOMException('Database unavailable', 'SecurityError'); } });
    const failed = storage.saveProject(original);
    expect(storage.hasPendingSaves()).toBe(true);
    await expect(failed).rejects.toThrow('Database unavailable');
    expect(storage.hasPendingSaves()).toBe(false);
  });

  it('rejects a combined oversized Design edit before staging and preserves a complete recovery backup', async () => {
    const { website, design } = individuallyValidNearBudget();
    expect(new TextEncoder().encode(JSON.stringify(design)).byteLength).toBeLessThan(20_000_000);
    expect(new TextEncoder().encode(JSON.stringify(website, null, 2)).byteLength).toBeLessThan(10_000_000);
    expect(() => createStudioProject(website, design)).toThrow('30 MB');
    const storage = await import('../src/project/storage');
    const prior = populatedDesign();
    await storage.saveProject(website);
    await storage.saveDesign(website, prior);
    const before = await storage.getStudioProject(website);
    expect(() => storage.validateDesignForProject(website, design)).toThrow('30 MB');
    expect(() => storage.saveDesign(website, design)).toThrow('30 MB');
    expect(await storage.getStudioProject(website)).toEqual(before);
    expect(readStudioProject(await getRaw(website.id))).toEqual(before);
    expect(storage.hasPendingSaves()).toBe(false);
  }, 20_000);

  it('rejects combined oversized Website growth before replacing staged Website or Design', async () => {
    const { website, design } = individuallyValidNearBudget();
    const smallWebsite = { ...newProject(), id: website.id };
    const storage = await import('../src/project/storage');
    storage.attachDesign(smallWebsite.id, design);
    await storage.saveProject(smallWebsite);
    const before = await storage.getStudioProject(smallWebsite);
    expect(() => storage.validateWebsiteForProject(website)).toThrow('30 MB');
    expect(() => storage.saveProject(website)).toThrow('30 MB');
    expect(await storage.getStudioProject(smallWebsite)).toEqual(before);
    expect(readStudioProject(await getRaw(smallWebsite.id))).toEqual(before);
  }, 20_000);

  it('rolls back only an invalid cold-API Website stage after reading the complete stored envelope', async () => {
    const { website, design } = individuallyValidNearBudget();
    const smallWebsite = { ...newProject(), id: website.id };
    await putRaw(createStudioProject(smallWebsite, design));
    const storage = await import('../src/project/storage');
    await expect(storage.saveProject(website)).rejects.toThrow('30 MB');
    expect((await storage.listProjects())[0]).toEqual(smallWebsite);
    expect((await storage.getStudioProject(smallWebsite)).design).toEqual(design);
    expect(storage.validateDesignForProject(smallWebsite, design)).toEqual(design);
    expect(storage.hasPendingSaves()).toBe(false);
  }, 20_000);

  it('keeps unsaved Design in backups after quota failure and allows a later retry', async () => {
    const storage = await import('../src/project/storage');
    const original = newProject();
    await storage.saveProject(original);
    const design = populatedDesign();
    const originalPut = IDBObjectStore.prototype.put;
    const failure = vi.spyOn(IDBObjectStore.prototype, 'put').mockImplementation(function(this: IDBObjectStore, value, key) {
      if (this.name === 'projects') throw new DOMException('Simulated quota failure', 'QuotaExceededError');
      return key === undefined ? originalPut.call(this, value) : originalPut.call(this, value, key);
    });
    await expect(storage.saveDesign(original, design)).rejects.toThrow('Could not save locally');
    expect((await getRaw(original.id) as { design: DesignDocument }).design).toEqual(emptyDesign());
    expect((await storage.getStudioProject(original)).design).toEqual(design);
    failure.mockRestore();
    await storage.saveProject({ ...original, name: 'Retry saved' });
    expect(readStudioProject(await getRaw(original.id)).design).toEqual(design);
    expect(readStudioProject(await getRaw(original.id)).website.name).toBe('Retry saved');
  });

  it('rejects unknown saved versions on read and save without replacing their raw records', async () => {
    const original = newProject();
    const unknown = { ...original, schemaVersion: 99, payload: 'future work' };
    await putRaw(unknown);
    const storage = await import('../src/project/storage');
    await expect(storage.listProjects()).rejects.toThrow('has not been changed');
    await expect(storage.saveProject(original)).rejects.toThrow('has not been changed');
    expect(await getRaw(original.id)).toEqual(unknown);
  });

  it('can back up a never-saved project when the browser refuses IndexedDB entirely', async () => {
    const storage = await import('../src/project/storage');
    const website = newProject(), design = populatedDesign();
    storage.attachDesign(website.id, design);
    vi.stubGlobal('indexedDB', { open() { throw new DOMException('Database unavailable', 'SecurityError'); } });
    await expect(storage.saveProject(website)).rejects.toThrow('Database unavailable');
    const backup = await storage.getStudioProject(website);
    expect(backup.website).toEqual(website);
    expect(backup.design).toEqual(design);
  });

  it('imports and duplicates both documents under independent project IDs', async () => {
    const storage = await import('../src/project/storage');
    const original = newProject(), design = populatedDesign();
    await storage.saveProject(original);
    await storage.saveDesign(original, design);
    const copy = { ...original, id: crypto.randomUUID(), name: 'Independent copy' };
    storage.attachDesign(copy.id, await storage.getDesign(original));
    await storage.saveProject(copy);
    const imported = readStudioProject(JSON.parse(JSON.stringify(await storage.getStudioProject(copy))));
    const importedWebsite = { ...imported.website, id: crypto.randomUUID(), name: 'Imported copy' };
    storage.attachDesign(importedWebsite.id, imported.design);
    await storage.saveProject(importedWebsite);
    expect(readStudioProject(await getRaw(copy.id)).design).toEqual(design);
    expect(readStudioProject(await getRaw(importedWebsite.id)).design).toEqual(design);
    design.layers[1].text = 'Original changed';
    await storage.saveDesign(original, design);
    expect((await storage.getDesign(copy)).layers[1].text).toBe('Make room for ideas.');
    expect((await storage.getDesign(importedWebsite)).layers[1].text).toBe('Make room for ideas.');
  });

  it('keeps recovery snapshot Design frozen after newer edits to the same saved project', async () => {
    const storage = await import('../src/project/storage');
    const protection = await import('../src/project/protection');
    const original = newProject(), firstDesign = populatedDesign();
    await storage.saveProject(original);
    await storage.saveDesign(original, firstDesign);
    await protection.protectProjects([original]);
    const newerDesign = populatedDesign();
    newerDesign.layers[1].text = 'Newer work';
    await storage.saveDesign(original, newerDesign);
    await protection.protectProjects([{ ...original, name: 'Newer project' }]);
    const snapshot = await protection.readProtection();
    expect(snapshot[0].design).toEqual(firstDesign);
    expect(snapshot[0].website).toEqual(original);
  });
});
