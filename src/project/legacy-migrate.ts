import { legacyProjectSchema } from './legacy-schema';
import { legacyV2ProjectSchema } from './legacy-v2-schema';
import { legacyV3ProjectSchema } from './legacy-v3-schema';
import { legacyV4ProjectSchema } from './legacy-v4-schema';
import { legacyV5ProjectSchema } from './legacy-v5-schema';
import { projectSchema as legacyV6ProjectSchema } from './legacy-v6-schema';
import { projectSchema as legacyV7ProjectSchema } from './legacy-v7-schema';
import { projectSchema, type Project } from './schema';
import { projectSchema as legacyV8ProjectSchema } from './legacy-v8-schema';

/** Frozen website migrations remain separate from the dual-document envelope. */
export function readWebsiteProject(input: unknown): Project {
  let candidate = input;
  if (candidate && typeof candidate === 'object' && 'schemaVersion' in candidate && candidate.schemaVersion === 1) {
    const old = legacyProjectSchema.parse(candidate);
    const header = old.page.nodes.find(node => node.type === 'Header');
    const footer = old.page.nodes.find(node => node.type === 'Footer');
    candidate = {
      schemaVersion: 2, id: old.id, name: old.name, updatedAt: old.updatedAt, theme: old.theme,
      shared: {
        header: { id: header?.id || old.id + '-header', enabled: Boolean(header), props: {
          brand: header?.props.brand ?? old.name, linkLabel: header?.props.linkLabel ?? '',
          target: { pageId: 'home', anchor: header?.props.target || '#top' }
        } },
        footer: { id: footer?.id || old.id + '-footer', enabled: Boolean(footer), props: footer?.props || { brand: old.name, note: '' } }
      },
      pages: [{ id: 'home', name: 'Home', path: '/', inNavigation: true, title: old.page.title, description: old.page.description,
        nodes: old.page.nodes.filter(node => node.type !== 'Header' && node.type !== 'Footer') }]
    };
  }
  if (candidate && typeof candidate === 'object' && 'schemaVersion' in candidate && candidate.schemaVersion === 2) {
    // Validate the frozen v2 contract first. Existing sections keep their exact IDs and data.
    const old = legacyV2ProjectSchema.parse(candidate);
    candidate = { ...old, schemaVersion: 3 };
  }
  if (candidate && typeof candidate === 'object' && 'schemaVersion' in candidate && candidate.schemaVersion === 3) {
    const old = legacyV3ProjectSchema.parse(candidate);
    candidate = { ...old, schemaVersion: 4, content: { services: [] } };
  }
  if (candidate && typeof candidate === 'object' && 'schemaVersion' in candidate && candidate.schemaVersion === 4) {
    const old = legacyV4ProjectSchema.parse(candidate);
    candidate = { ...old, schemaVersion: 5, content: { ...old.content, portfolio: [] } };
  }
  if (candidate && typeof candidate === 'object' && 'schemaVersion' in candidate && candidate.schemaVersion === 5) {
    candidate = { ...legacyV5ProjectSchema.parse(candidate), schemaVersion: 6 };
  }
  if (candidate && typeof candidate === 'object' && 'schemaVersion' in candidate && candidate.schemaVersion === 6) {
    const old = legacyV6ProjectSchema.parse(candidate);
    candidate = { ...old, schemaVersion: 7, content: { ...old.content, articles: [] } };
  }
  if (candidate && typeof candidate === 'object' && 'schemaVersion' in candidate && candidate.schemaVersion === 7) {
    // Validate the frozen v7 contract before introducing authored appearance.
    candidate = { ...legacyV7ProjectSchema.parse(candidate), schemaVersion: 8 };
  }
  if (candidate && typeof candidate === 'object' && 'schemaVersion' in candidate && candidate.schemaVersion === 8) {
    candidate = { ...legacyV8ProjectSchema.parse(candidate), schemaVersion: 9, components: [] };
  }
  return projectSchema.parse(candidate);
}

export const readLegacyProject = readWebsiteProject;
