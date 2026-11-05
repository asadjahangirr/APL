import { designSchema, type DesignDocument } from '../design/schema';
import { projectSchema, type Project } from './schema';
import { createStudioProject, readStudioProject, studioProjectSchema, type StudioProject } from './studio-document';
import { archiveMigrationOriginal } from './protection-store';

type StagedDocuments = {
  website?: Project;
  websiteMode?: 'replace' | 'metadata';
  design?: DesignDocument;
  conversions?: StudioProject['conversions'];
};
export type StudioSaveExpectation = { revision: number };

const saved = new Map<string, StudioProject>();
// Optional fields allow a cold Website-only API call to preserve the stored Design
// and records when the queue loads them. A full conversion stages all three at once.
const staged = new Map<string, StagedDocuments>();
const revisions = new Map<string, number>();
const originals = new Map<string, unknown>();
const protectedOriginals = new Set<string>();
let writes: Promise<void> = Promise.resolve();
let pendingWrites = 0;

export function hasPendingSaves(): boolean { return pendingWrites > 0; }
export function getStudioRevision(id: string): number { return revisions.get(id) ?? 0; }
function stage(id: string, documents: StagedDocuments): void {
  staged.set(id, documents);
  revisions.set(id, getStudioRevision(id) + 1);
}

function open(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('apl-studio', 1);
    request.onupgradeneeded = () => request.result.createObjectStore('projects', { keyPath: 'id' });
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(new Error('Could not open local projects. Your saved data has not been changed.'));
  });
}

function rememberOriginal(raw: unknown, studio: StudioProject): void {
  if (!(raw && typeof raw === 'object' && 'schemaVersion' in raw && raw.schemaVersion === 10 && 'website' in raw)) originals.set(studio.id, raw);
}

async function readStored(id: string): Promise<StudioProject | undefined> {
  if (saved.has(id)) return saved.get(id);
  const db = await open();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('projects', 'readonly');
    const request = tx.objectStore('projects').get(id);
    request.onsuccess = () => {
      try {
        const studio = request.result === undefined ? undefined : readStudioProject(request.result);
        if (studio) { saved.set(id, studio); rememberOriginal(request.result, studio); }
        resolve(studio);
      } catch { reject(new Error('This saved project could not be read. Its original data has not been changed.')); }
    };
    tx.oncomplete = () => db.close();
    tx.onabort = tx.onerror = () => { db.close(); reject(new Error('Could not read local projects. Your saved data has not been changed.')); };
  });
}

export async function listProjects(): Promise<Project[]> {
  const db = await open();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('projects', 'readonly');
    const request = tx.objectStore('projects').getAll();
    request.onsuccess = () => {
      try {
        const studios = request.result.map((value: unknown) => readStudioProject(value));
        for (let index = 0; index < studios.length; index++) {
          const studio = studios[index];
          saved.set(studio.id, studio);
          rememberOriginal(request.result[index], studio);
        }
        resolve(studios.map(studio => studio.website).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)));
      } catch { reject(new Error('A saved project could not be read. Your saved data has not been changed.')); }
    };
    tx.oncomplete = () => db.close();
    tx.onabort = tx.onerror = () => { db.close(); reject(new Error('Could not read local projects. Your saved data has not been changed.')); };
  });
}

function websiteFrom(base: StudioProject | undefined, documents: StagedDocuments | undefined, fallback?: Project): Project | undefined {
  const website = documents?.website;
  if (website && documents?.websiteMode === 'metadata' && base) {
    return { ...base.website, updatedAt: website.updatedAt > base.updatedAt ? website.updatedAt : base.updatedAt };
  }
  return website ?? base?.website ?? fallback;
}

function budgetChecked(website: Project, design?: DesignDocument, conversions: StudioProject['conversions'] = []): StudioProject {
  try { return createStudioProject(website, design, conversions); }
  catch (error) {
    if (error && typeof error === 'object' && 'issues' in error && Array.isArray(error.issues) && error.issues.some(issue => issue.message?.includes('30 MB'))) {
      throw new Error('This change would exceed the 30 MB APL backup limit for Design, Website and conversion records together. Reduce image sizes or remove unused content first. Your previous project is preserved.');
    }
    throw error;
  }
}

function compose(id: string, base = saved.get(id), fallback?: Project): StudioProject {
  const documents = staged.get(id);
  const website = websiteFrom(base, documents, fallback);
  if (!website) throw new Error('This project is not available. Your saved data has not been changed.');
  return budgetChecked(website, documents?.design ?? base?.design, documents?.conversions ?? base?.conversions);
}

/** Legacy import helper; use attachStudioProject when conversion records exist. */
export function attachDesign(projectId: string, design: DesignDocument): void {
  const parsed = designSchema.parse(design);
  const knownWebsite = websiteFrom(saved.get(projectId), staged.get(projectId));
  if (knownWebsite) budgetChecked(knownWebsite, parsed, staged.get(projectId)?.conversions ?? saved.get(projectId)?.conversions);
  stage(projectId, { ...staged.get(projectId), design: parsed });
}

/** Validate the complete envelope before exposing it to UI/history or import state. */
export function validateStudioProjectForStorage(candidate: StudioProject): StudioProject {
  const parsed = studioProjectSchema.parse(candidate);
  const latest = websiteFrom(saved.get(parsed.id), staged.get(parsed.id));
  const website = latest && latest.updatedAt > parsed.updatedAt ? { ...parsed.website, updatedAt: latest.updatedAt } : parsed.website;
  return budgetChecked(website, parsed.design, parsed.conversions);
}

/** Imports/duplicates first replace project metadata, then attach all documents. */
export function attachStudioProject(candidate: StudioProject): StudioProject {
  const checked = validateStudioProjectForStorage(candidate);
  stage(checked.id, { website: checked.website, websiteMode: 'replace', design: checked.design, conversions: checked.conversions });
  return checked;
}

export function validateDesignForProject(project: Project, design: DesignDocument): DesignDocument {
  const parsed = projectSchema.parse(project);
  const latest = websiteFrom(saved.get(parsed.id), staged.get(parsed.id));
  const website = latest ? { ...latest, updatedAt: parsed.updatedAt > latest.updatedAt ? parsed.updatedAt : latest.updatedAt } : parsed;
  return budgetChecked(website, design, staged.get(parsed.id)?.conversions ?? saved.get(parsed.id)?.conversions).design;
}

export function validateWebsiteForProject(project: Project): Project {
  const parsed = projectSchema.parse(project);
  const latest = websiteFrom(saved.get(parsed.id), staged.get(parsed.id));
  const website = latest && latest.updatedAt > parsed.updatedAt ? { ...parsed, updatedAt: latest.updatedAt } : parsed;
  return budgetChecked(website, staged.get(parsed.id)?.design ?? saved.get(parsed.id)?.design, staged.get(parsed.id)?.conversions ?? saved.get(parsed.id)?.conversions).website;
}

/** Backup compatibility: preserve the caller's Website and recover staged Design/records. */
export async function getStudioProject(project: Project): Promise<StudioProject> {
  const website = projectSchema.parse(project);
  let base: StudioProject | undefined;
  try { base = await readStored(website.id); }
  catch (error) { if (!staged.get(website.id)?.website) throw error; }
  const documents = staged.get(website.id);
  return budgetChecked(website, documents?.design ?? base?.design, documents?.conversions ?? base?.conversions);
}

/** Authoritative current state for conversion previews; never uses a stale facade. */
export async function getCurrentStudioProject(projectOrId: Project | string): Promise<StudioProject> {
  const id = typeof projectOrId === 'string' ? projectOrId : projectOrId.id;
  let base: StudioProject | undefined;
  try { base = await readStored(id); }
  catch (error) { if (!staged.get(id)?.website) throw error; }
  return compose(id, base, typeof projectOrId === 'string' ? undefined : projectSchema.parse(projectOrId));
}

export async function getDesign(project: Project): Promise<DesignDocument> { return (await getStudioProject(project)).design; }

function enqueueSave(id: string, validationRejected?: () => void): Promise<void> {
  pendingWrites += 1;
  const operation = writes.catch(() => {}).then(async () => {
    // Strict reads must precede writes, including when recovery can use memory.
    const base = await readStored(id);
    let studio: StudioProject;
    try { studio = compose(id, base); }
    catch (error) { validationRejected?.(); throw error; }
    if (originals.has(id) && !protectedOriginals.has(id)) {
      await archiveMigrationOriginal(originals.get(id));
      protectedOriginals.add(id);
    }
    const db = await open();
    await new Promise<void>((resolve, reject) => {
      let tx: IDBTransaction | undefined;
      const fail = () => { db.close(); reject(new Error('Could not save locally. Download a project backup before closing this page.')); };
      try {
        tx = db.transaction('projects', 'readwrite');
        tx.oncomplete = () => { saved.set(id, studio); db.close(); resolve(); };
        tx.onabort = tx.onerror = fail;
        tx.objectStore('projects').put(studio);
      } catch { tx?.abort(); fail(); }
    });
  });
  const tracked = operation.finally(() => { pendingWrites -= 1; });
  writes = tracked;
  return tracked;
}

function restoreRejectedStage(id: string, installed: StagedDocuments, previous: StagedDocuments | undefined, field: 'website' | 'design'): void {
  const current = staged.get(id);
  if (!current || current[field] !== installed[field]) return;
  const restored = { ...current };
  if (field === 'website') {
    if (previous?.website) { restored.website = previous.website; restored.websiteMode = previous.websiteMode; }
    else { delete restored.website; delete restored.websiteMode; }
  } else {
    if (previous?.design) restored.design = previous.design;
    else delete restored.design;
    if (current === installed) {
      if (previous?.website) { restored.website = previous.website; restored.websiteMode = previous.websiteMode; }
      else { delete restored.website; delete restored.websiteMode; }
    }
  }
  stage(id, restored);
}

export function saveProject(project: Project): Promise<void> {
  const website = validateWebsiteForProject(project);
  const previous = staged.get(website.id);
  const installed: StagedDocuments = { ...previous, website, websiteMode: 'replace' };
  stage(website.id, installed);
  return enqueueSave(website.id, () => restoreRejectedStage(website.id, installed, previous, 'website'));
}

export function saveDesign(project: Project, design: DesignDocument): Promise<void> {
  const parsed = projectSchema.parse(project);
  const checkedDesign = validateDesignForProject(parsed, design);
  const previous = staged.get(parsed.id);
  const latest = websiteFrom(saved.get(parsed.id), previous);
  const website = latest ? { ...latest, updatedAt: parsed.updatedAt > latest.updatedAt ? parsed.updatedAt : latest.updatedAt } : parsed;
  const installed: StagedDocuments = { ...previous, website, websiteMode: previous?.websiteMode ?? 'metadata', design: checkedDesign };
  stage(parsed.id, installed);
  return enqueueSave(parsed.id, () => restoreRejectedStage(parsed.id, installed, previous, 'design'));
}

/** Single-tab optimistic review guard and one atomic full-envelope stage/write. */
export function saveStudioProject(candidate: StudioProject, expected?: StudioSaveExpectation): Promise<void> {
  const checked = validateStudioProjectForStorage(candidate);
  if (expected && getStudioRevision(checked.id) !== expected.revision) throw new Error('This project changed while you reviewed the conversion. Compare it again before applying. Your work is preserved.');
  stage(checked.id, { website: checked.website, websiteMode: 'replace', design: checked.design, conversions: checked.conversions });
  return enqueueSave(checked.id);
}
