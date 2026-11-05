import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { IDBFactory, IDBObjectStore } from 'fake-indexeddb';
import { createArtboard, createLayer, emptyDesign } from '../src/design/schema';
import { newProject } from '../src/project/templates';
import { createStudioProject } from '../src/project/studio-document';
import { analyzeConversion, compareConversion, compileConversion, suggestConversionPlan, updateConversion } from '../src/conversion/engine';

function proof() {
  const website = { ...newProject(), updatedAt: '2026-10-03T10:00:00.000Z' };
  const board = createArtboard({ id: 'business-desktop', name: 'Business landing', width: 1440, height: 1000 });
  const design = { ...emptyDesign(), artboards: [board], layers: [
    createLayer('text', board.id, { id: 'business-heading', name: 'Page heading', text: 'Bring your business online.', x: 100, y: 80, width: 1000, fontSize: 64 }),
    createLayer('text', board.id, { id: 'contact-action', name: 'Contact action', text: 'Start a conversation', x: 100, y: 220, width: 320, fontSize: 20 })
  ] };
  const plan = suggestConversionPlan(design, board.id, website);
  const action = plan.sections.flatMap(section => section.columns.flatMap(column => column.items)).find(item => item.layerId === 'contact-action')!;
  action.role = 'button'; action.destination = { kind: 'section', sectionId: 'contact' };
  plan.contact = { sourceLayerIds: [], title: 'Tell us about your project', description: 'Send a message to our team.', button: 'Send inquiry' };
  return { website, design, plan };
}

function options(design: Parameters<typeof analyzeConversion>[0], website: Parameters<typeof analyzeConversion>[1], plan: Parameters<typeof analyzeConversion>[2], targetPageId?: string) {
  return { now: '2026-10-03T12:00:00.000Z', acknowledgedWarnings: analyzeConversion(design, website, plan, { targetPageId }).issues.filter(issue => issue.severity === 'warning').map(issue => issue.id) };
}

describe('reviewed conversion and local persistence together', () => {
  beforeEach(() => { vi.resetModules(); vi.stubGlobal('indexedDB', new IDBFactory()); });
  afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); });

  it('commits a real semantic/contact conversion then preserves its provenance through later Design changes', async () => {
    const { website, design, plan } = proof();
    const storage = await import('../src/project/storage');
    await storage.saveStudioProject(createStudioProject(website, design));
    const base = await storage.getCurrentStudioProject(website.id);
    const revision = storage.getStudioRevision(website.id);
    const result = await compileConversion(base.design, base.website, plan, options(base.design, base.website, plan));
    const candidate = createStudioProject(result.website, base.design, [result.record]);
    await storage.saveStudioProject(candidate, { revision });
    const converted = await storage.getCurrentStudioProject(website.id);
    expect(converted.website.pages).toHaveLength(website.pages.length + 1);
    expect(converted.website.pages.find(page => page.id === result.record.pageId)?.nodes.some(node => node.type === 'Contact')).toBe(true);
    expect(converted.website.pages[0]).toEqual(website.pages[0]);
    expect(converted.website.content).toEqual(website.content);
    expect(await compareConversion(converted.design, converted.website, converted.conversions[0])).toBe('current');
    const changed = structuredClone(design); changed.layers[0].text = 'Updated after conversion.';
    await storage.saveDesign(converted.website, changed);
    const newer = await storage.getCurrentStudioProject(website.id);
    expect(newer.conversions).toEqual([result.record]);
    expect(newer.website).toEqual(converted.website);
    expect(await compareConversion(newer.design, newer.website, newer.conversions[0])).toBe('design-changed');
  });

  it('rejects an actual async compilation when a Website edit arrives during review', async () => {
    const { website, design, plan } = proof();
    const storage = await import('../src/project/storage');
    await storage.saveStudioProject(createStudioProject(website, design));
    const base = await storage.getCurrentStudioProject(website.id);
    const revision = storage.getStudioRevision(website.id);
    const compiling = compileConversion(base.design, base.website, plan, options(base.design, base.website, plan));
    const edited = { ...website, name: 'Edited while compiling' };
    await storage.saveProject(edited);
    const result = await compiling;
    const candidate = createStudioProject(result.website, design, [result.record]);
    expect(() => storage.saveStudioProject(candidate, { revision })).toThrow('changed while you reviewed');
    const current = await storage.getCurrentStudioProject(website.id);
    expect(current.website).toEqual(edited);
    expect(current.design).toEqual(design);
    expect(current.conversions).toEqual([]);
  });

  it('updates only owned converted roots after explicit overwrite approval and leaves authored content intact', async () => {
    const { website, design, plan } = proof();
    const storage = await import('../src/project/storage');
    const result = await compileConversion(design, website, plan, options(design, website, plan));
    await storage.saveStudioProject(createStudioProject(result.website, design, [result.record]));
    const edited = structuredClone(result.website);
    const page = edited.pages.find(page => page.id === result.record.pageId)!;
    page.nodes.push({ id: 'authored-after-conversion', type: 'Text', props: { title: 'Keep this authored content', body: 'This was written in Build.', align: 'left' } });
    const convertedRoot = page.nodes.find(node => result.record.targetRootIds.includes(node.id))!;
    if (convertedRoot.type !== 'Section') throw new Error('Expected a native Section.');
    convertedRoot.props.padding.mobile = 99;
    await storage.saveProject(edited);
    const changed = structuredClone(design); changed.layers[0].text = 'The reviewed new heading';
    await storage.saveDesign(edited, changed);
    const current = await storage.getCurrentStudioProject(website.id);
    const revision = storage.getStudioRevision(website.id);
    expect(await compareConversion(current.design, current.website, current.conversions[0])).toBe('both-changed');
    await expect(updateConversion(current.design, current.website, current.conversions[0], plan, options(current.design, current.website, plan, result.record.pageId))).rejects.toThrow('explicitly confirm');
    const updated = await updateConversion(current.design, current.website, current.conversions[0], plan, { ...options(current.design, current.website, plan, result.record.pageId), overwriteTargetChanges: true });
    await storage.saveStudioProject(createStudioProject(updated.website, current.design, [updated.record]), { revision });
    const saved = await storage.getCurrentStudioProject(website.id);
    expect(saved.website.pages[0]).toEqual(website.pages[0]);
    expect(saved.website.pages.find(page => page.id === result.record.pageId)?.nodes.find(node => node.id === 'authored-after-conversion')).toEqual(page.nodes.at(-1));
    expect(saved.website.content).toEqual(website.content);
    expect(await compareConversion(saved.design, saved.website, saved.conversions[0])).toBe('current');
  });

  it('retains a compiled page, Design and fingerprints after aborting the successful put transaction', async () => {
    const { website, design, plan } = proof();
    const storage = await import('../src/project/storage');
    const original = createStudioProject(website, design);
    await storage.saveStudioProject(original);
    const result = await compileConversion(design, website, plan, options(design, website, plan));
    const candidate = createStudioProject(result.website, design, [result.record]);
    const put = IDBObjectStore.prototype.put;
    const failure = vi.spyOn(IDBObjectStore.prototype, 'put').mockImplementation(function(this: IDBObjectStore, value, key) {
      const request = key === undefined ? put.call(this, value) : put.call(this, value, key);
      if (this.name === 'projects') request.addEventListener('success', () => this.transaction.abort());
      return request;
    });
    await expect(storage.saveStudioProject(candidate, { revision: storage.getStudioRevision(website.id) })).rejects.toThrow('Could not save locally');
    expect(await storage.getCurrentStudioProject(website.id)).toEqual(candidate);
    expect(await storage.getStudioProject(candidate.website)).toEqual(candidate);
    const open = indexedDB.open('apl-studio', 1);
    const persisted = await new Promise<unknown>((resolve, reject) => {
      open.onerror = () => reject(open.error);
      open.onsuccess = () => {
        const db = open.result, tx = db.transaction('projects', 'readonly'), request = tx.objectStore('projects').get(website.id);
        request.onsuccess = () => resolve(request.result);
        tx.oncomplete = () => db.close();
      };
    });
    expect(persisted).toEqual(original);
    failure.mockRestore();
    await storage.saveProject(candidate.website);
    expect(await compareConversion((await storage.getCurrentStudioProject(website.id)).design, candidate.website, result.record)).toBe('current');
  });
});
