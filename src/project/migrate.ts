import type { Project } from './schema';
import { readWebsiteProject } from './legacy-migrate';
import { readStudioProject } from './studio-document';

export { readWebsiteProject, readLegacyProject } from './legacy-migrate';

/** Pure compatibility facade for Website backups and both Studio envelopes. */
export function readProject(input: unknown): Project {
  if (input && typeof input === 'object' && 'schemaVersion' in input &&
      (input.schemaVersion === 10 || ((input.schemaVersion === 9 || input.schemaVersion === 8) && 'website' in input))) {
    return readStudioProject(input).website;
  }
  return readWebsiteProject(input);
}
