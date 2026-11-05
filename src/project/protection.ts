import type { Project } from './schema';
import { getStudioProject } from './storage';
import { readStudioProject, type StudioProject } from './studio-document';
import { legacyV8StudioSchema, type LegacyV8StudioProject } from './legacy-v8-studio';
import { legacyV9StudioSchema, type LegacyV9StudioProject } from './legacy-v9-studio';
import { archiveMigrationOriginal, CONVERSION_MIGRATION_PREFIX, REUSABLE_MIGRATION_PREFIX, readProtectionSnapshots, WEBSITE_MIGRATION_PREFIX, writeImmutableSnapshot } from './protection-store';

const snapshotId = 'before-editorial-shell-v1';

/** One immutable, separate snapshot of the first existing workspace this shell opens. */
export async function protectProjects(projects: Project[]): Promise<void> {
  if (!projects.length) return;
  const snapshot = await Promise.all(projects.map(getStudioProject));
  await writeImmutableSnapshot(snapshotId, snapshot);
}

export async function readProtection(): Promise<StudioProject[]> {
  const snapshot = (await readProtectionSnapshots()).find(value => value.id === snapshotId);
  try { return (snapshot?.projects ?? []).map(readStudioProject); }
  catch { throw new Error('Could not read the recovery snapshot. Your saved projects are unchanged.'); }
}

/** Keep exact raw inputs; storage imports the independent driver to avoid a cycle. */
export const protectMigrationOriginal = archiveMigrationOriginal;

export async function readMigrationProtection(): Promise<StudioProject[]> {
  const snapshots = await readProtectionSnapshots();
  try { return snapshots.filter(record => record.id.startsWith(WEBSITE_MIGRATION_PREFIX)).flatMap(record => record.projects.map(readStudioProject)); }
  catch { throw new Error('Could not read the original website snapshots. Your saved projects are unchanged.'); }
}

/** Frozen Phase 2 envelopes, suitable for exact-format recovery downloads. */
export async function readConversionProtection(): Promise<LegacyV8StudioProject[]> {
  const snapshots = await readProtectionSnapshots();
  try { return snapshots.filter(record => record.id.startsWith(CONVERSION_MIGRATION_PREFIX)).flatMap(record => record.projects.map(value => legacyV8StudioSchema.parse(value))); }
  catch { throw new Error('Could not read the original Design and Website snapshots. Your saved projects are unchanged.'); }
}

/** Exact Phase 3 envelopes, archived before their first reusable-component write. */
export async function readReusableProtection(): Promise<LegacyV9StudioProject[]> {
  const snapshots = await readProtectionSnapshots();
  try { return snapshots.filter(record => record.id.startsWith(REUSABLE_MIGRATION_PREFIX)).flatMap(record => record.projects.map(value => legacyV9StudioSchema.parse(value))); }
  catch { throw new Error('Could not read the original connected Website snapshots. Your saved projects are unchanged.'); }
}
