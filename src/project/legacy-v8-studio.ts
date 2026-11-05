import { z } from 'zod';
import { designSchema } from '../design/schema';
import { projectSchema as legacyV7ProjectSchema } from './legacy-v7-schema';

/** Frozen Phase 2 envelope. Do not widen its Website or conversion contract. */
export const legacyV8StudioSchema = z.object({
  schemaVersion: z.literal(8),
  id: z.uuid(),
  name: z.string().trim().min(1).max(80),
  updatedAt: z.iso.datetime(),
  website: legacyV7ProjectSchema,
  design: designSchema,
  conversions: z.array(z.never()).max(0)
}).strict().superRefine((studio, context) => {
  for (const key of ['id', 'name', 'updatedAt'] as const) {
    if (studio[key] !== studio.website[key]) context.addIssue({ code: 'custom', path: [key], message: 'Project metadata must match its website document.' });
  }
  if (new TextEncoder().encode(JSON.stringify(studio, null, 2)).byteLength > 30_000_000) {
    context.addIssue({ code: 'custom', message: 'This project backup exceeds 30 MB. Reduce images or remove unused content.' });
  }
});

export type LegacyV8StudioProject = z.infer<typeof legacyV8StudioSchema>;
