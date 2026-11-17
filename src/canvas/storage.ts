import { upgradeInteractive } from '../doc/interactive';
import { siteDocSchema, type SiteDoc } from '../doc/schema';

/** Local-first storage for sites (IndexedDB). */
const DB = 'apl-v2';
const STORE = 'sites';
const VERSIONS = 'versions';
const LAST_KEY = 'apl-v2:last-site';

export interface SiteSummary { id: string; name: string; updatedAt: string }
/** One-time document upgrades, recorded per site so a later choice by the owner is never undone. */
const UPGRADES = ['interactive'];
interface Record_ { id: string; name: string; updatedAt: string; doc: SiteDoc; upgrades?: string[] }

function open(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB, 2);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE, { keyPath: 'id' });
      if (!db.objectStoreNames.contains(VERSIONS)) db.createObjectStore(VERSIONS, { keyPath: 'id' }).createIndex('siteId', 'siteId');
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(new Error('Could not open local storage for your sites.'));
  });
}
function run<T>(mode: IDBTransactionMode, work: (store: IDBObjectStore) => IDBRequest<T>, name = STORE): Promise<T> {
  return open().then(db => new Promise<T>((resolve, reject) => {
    const tx = db.transaction(name, mode);
    const request = work(tx.objectStore(name));
    tx.oncomplete = () => { db.close(); resolve(request.result); };
    tx.onerror = tx.onabort = () => { db.close(); reject(tx.error ?? new Error('Saving failed.')); };
  }));
}

export async function saveSite(doc: SiteDoc): Promise<void> {
  const valid = siteDocSchema.parse(doc);
  await run('readwrite', store => store.put({ id: valid.id, name: valid.name, updatedAt: new Date().toISOString(), doc: valid, upgrades: UPGRADES } satisfies Record_));
  rememberLastSite(valid.id);
}
export async function loadSite(id: string): Promise<SiteDoc | null> {
  const record = await run<Record_ | undefined>('readonly', store => store.get(id));
  if (!record) return null;
  const parsed = siteDocSchema.safeParse(record.doc);
  if (!parsed.success) return null;
  // Buttons and form fields became real elements: upgrade designs inserted before that.
  return record.upgrades?.includes('interactive') ? parsed.data : upgradeInteractive(parsed.data);
}
export async function listSites(): Promise<SiteSummary[]> {
  const records = await run<Record_[]>('readonly', store => store.getAll());
  return records.map(({ id, name, updatedAt }) => ({ id, name, updatedAt })).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}
export async function deleteSite(id: string): Promise<void> { await run('readwrite', store => store.delete(id)); }

export function lastSiteId(): string | null {
  try { return localStorage.getItem(LAST_KEY); } catch { return null; }
}
export function rememberLastSite(id: string): void {
  try { localStorage.setItem(LAST_KEY, id); } catch { /* private mode: not essential */ }
}

// ── Version history ──────────────────────────────────────────────────────────
/** A saved copy of a site: named by the owner, or taken automatically while editing. */
export interface Version { id: string; siteId: string; name: string; createdAt: string; auto: boolean; doc: SiteDoc }
const MAX_AUTO = 20, MAX_NAMED = 100, AUTO_EVERY_MS = 30 * 60 * 1000;

export async function listVersions(siteId: string): Promise<Version[]> {
  const all = await run<Version[]>('readonly', store => store.index('siteId').getAll(siteId), VERSIONS);
  return all.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}
export async function saveVersion(doc: SiteDoc, name: string, auto = false): Promise<Version> {
  const version: Version = { id: crypto.randomUUID(), siteId: doc.id, name: name.trim().slice(0, 80) || 'Untitled version', createdAt: new Date().toISOString(), auto, doc: siteDocSchema.parse(doc) };
  await run('readwrite', store => store.put(version), VERSIONS);
  // Keep the newest automatic and named versions within their limits.
  const versions = await listVersions(doc.id);
  for (const old of [...versions.filter(v => v.auto).slice(MAX_AUTO), ...versions.filter(v => !v.auto).slice(MAX_NAMED)]) await deleteVersion(old.id);
  return version;
}
export async function deleteVersion(id: string): Promise<void> { await run('readwrite', store => store.delete(id), VERSIONS); }
export async function loadVersion(id: string): Promise<SiteDoc | null> {
  const version = await run<Version | undefined>('readonly', store => store.get(id), VERSIONS);
  const parsed = version && siteDocSchema.safeParse(version.doc);
  return parsed && parsed.success ? parsed.data : null;
}
/** Take an automatic version at most every 30 minutes of editing a site. */
export async function autoVersion(doc: SiteDoc): Promise<boolean> {
  const key = 'apl-v2:auto-version:' + doc.id;
  let last = 0;
  try { last = Number(localStorage.getItem(key)) || 0; } catch { /* private mode */ }
  if (Date.now() - last < AUTO_EVERY_MS) return false;
  try { localStorage.setItem(key, String(Date.now())); } catch { /* private mode */ }
  await saveVersion(doc, 'Autosaved ' + new Date().toLocaleString(), true);
  return true;
}
