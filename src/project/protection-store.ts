import { readStudioProject } from './studio-document';

export const WEBSITE_MIGRATION_PREFIX = 'before-design-canvas-v1:';
export const CONVERSION_MIGRATION_PREFIX = 'before-guided-conversion-v1:';
export const REUSABLE_MIGRATION_PREFIX = 'before-reusable-components-v1:';
export type ProtectionSnapshot = { id: string; createdAt: string; projects: unknown[] };

function openProtection(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('apl-studio-protection', 1);
    request.onupgradeneeded = () => request.result.createObjectStore('snapshots', { keyPath: 'id' });
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(new Error('Could not prepare a local recovery snapshot. Download project backups to preserve your work.'));
  });
}

/** Add once: even a later migration must never replace an earlier archive. */
export async function writeImmutableSnapshot(id: string, projects: unknown[]): Promise<void> {
  const db = await openProtection();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('snapshots', 'readwrite'), store = tx.objectStore('snapshots');
    const request = store.get(id);
    request.onsuccess = () => { if (!request.result) store.add({ id, createdAt: new Date().toISOString(), projects }); };
    tx.oncomplete = () => { db.close(); resolve(); };
    tx.onabort = tx.onerror = () => { db.close(); reject(new Error('Could not preserve the original project before migration. Your original project has not been changed. Download a backup before retrying.')); };
  });
}

export async function readProtectionSnapshots(): Promise<ProtectionSnapshot[]> {
  const db = await openProtection();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('snapshots', 'readonly'), request = tx.objectStore('snapshots').getAll();
    request.onsuccess = () => resolve(request.result);
    tx.oncomplete = () => db.close();
    tx.onabort = tx.onerror = () => { db.close(); reject(new Error('Could not read the recovery snapshot. Your saved projects are unchanged.')); };
  });
}

export async function archiveMigrationOriginal(original: unknown): Promise<void> {
  const studio = readStudioProject(original);
  const isStudio8 = original && typeof original === 'object' && 'schemaVersion' in original && original.schemaVersion === 8 && 'website' in original;
  const isStudio9 = original && typeof original === 'object' && 'schemaVersion' in original && original.schemaVersion === 9 && 'website' in original;
  await writeImmutableSnapshot((isStudio9 ? REUSABLE_MIGRATION_PREFIX : isStudio8 ? CONVERSION_MIGRATION_PREFIX : WEBSITE_MIGRATION_PREFIX) + studio.id, [original]);
}
