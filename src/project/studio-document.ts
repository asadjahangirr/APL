import { z } from 'zod';
import { designSchema, emptyDesign, type DesignDocument } from '../design/schema';
import { conversionRecordsSchema, type ConversionRecord } from '../conversion/schema';
import { readWebsiteProject } from './legacy-migrate';
import { legacyV8StudioSchema } from './legacy-v8-studio';
import { legacyV9StudioSchema } from './legacy-v9-studio';
import { projectSchema, type Project } from './schema';

/** The website's existing 10 MB limit stays unchanged; Design has its own limit. */
export const MAX_STUDIO_BACKUP_BYTES = 30_000_000;

export const studioProjectSchema = z.object({
  schemaVersion: z.literal(10),
  id: z.uuid(),
  name: z.string().trim().min(1).max(80),
  updatedAt: z.iso.datetime(),
  website: projectSchema,
  design: designSchema,
  conversions: conversionRecordsSchema
}).strict().superRefine((studio, context) => {
  for (const key of ['id', 'name', 'updatedAt'] as const) {
    if (studio[key] !== studio.website[key]) context.addIssue({ code: 'custom', path: [key], message: 'Project metadata must match its website document.' });
  }
  if (new Set(studio.conversions.map(record => record.id)).size !== studio.conversions.length) {
    context.addIssue({ code: 'custom', path: ['conversions'], message: 'Conversion records need unique identifiers.' });
  }
  if (new TextEncoder().encode(JSON.stringify(studio, null, 2)).byteLength > MAX_STUDIO_BACKUP_BYTES) {
    context.addIssue({ code: 'custom', message: 'This project backup exceeds 30 MB. Reduce images or remove unused content.' });
  }
});

export type StudioProject = z.infer<typeof studioProjectSchema>;

export function createStudioProject(website: Project, design: DesignDocument = emptyDesign(), conversions: ConversionRecord[] = []): StudioProject {
  return studioProjectSchema.parse({ schemaVersion: 10, id: website.id, name: website.name, updatedAt: website.updatedAt, website, design, conversions });
}

/** Pure, read-only migration. No source input or stored record is modified. */
export function readStudioProject(input: unknown): StudioProject {
  if (input && typeof input === 'object' && 'schemaVersion' in input) {
    if (input.schemaVersion === 10) return studioProjectSchema.parse(input);
    if (input.schemaVersion === 9 && 'website' in input) {
      const previous = legacyV9StudioSchema.parse(input);
      return createStudioProject(readWebsiteProject(previous.website), previous.design, previous.conversions);
    }
    // Website v8 and Studio v8 are distinct formats; only the envelope has website.
    if (input.schemaVersion === 8 && 'website' in input) {
      const previous = legacyV8StudioSchema.parse(input);
      return createStudioProject(readWebsiteProject(previous.website), previous.design);
    }
  }
  return createStudioProject(readWebsiteProject(input));
}
