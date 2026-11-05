import { z } from 'zod';
import { designSchema } from '../design/schema';
import { conversionRecordsSchema } from '../conversion/schema';


import { projectSchema } from './legacy-v8-schema';

/** The website's existing 10 MB limit stays unchanged; Design has its own limit. */
export const MAX_STUDIO_BACKUP_BYTES = 30_000_000;

export const legacyV9StudioSchema = z.object({
  schemaVersion: z.literal(9),
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

export type LegacyV9StudioProject = z.infer<typeof legacyV9StudioSchema>;


