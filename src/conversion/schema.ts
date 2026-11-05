import { z } from 'zod';
import { responsiveAppearanceSchema } from '../project/appearance-schema';

export const CONVERSION_ALGORITHM_VERSION = '1.0.0' as const;
export const MAX_CONVERSION_RECORDS = 50;
const id = z.string().regex(/^[A-Za-z0-9_-]{1,100}$/);
const text = z.string().max(4000);
const anchor = z.string().regex(/^#[a-z][a-z0-9-]*$/);
const responsive = <T extends z.ZodType>(value: T) => z.object({ mobile: value, tablet: value.optional(), desktop: value.optional() }).strict();
const spacing = responsive(z.number().finite().min(0).max(400));
export const conversionLayoutSchema = z.enum(['stack', 'halves', 'thirds', 'quarters', 'one-two', 'two-one', 'one-three', 'three-one']);
export const conversionDestinationSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('section'), sectionId: id }).strict(),
  z.object({ kind: z.literal('page'), pageId: id, anchor }).strict(),
  z.object({ kind: z.literal('url'), value: z.string().max(2048) }).strict(),
  z.object({ kind: z.literal('email'), value: z.string().max(254) }).strict(),
  z.object({ kind: z.literal('phone'), value: z.string().max(40) }).strict(),
]);
export const conversionItemSchema = z.object({
  layerId: id,
  role: z.enum(['heading', 'paragraph', 'image', 'button', 'decoration', 'ignore']),
  level: z.enum(['h1', 'h2', 'h3', 'h4']).optional(),
  alt: text.optional(),
  destination: conversionDestinationSchema.optional(),
  appearance: responsiveAppearanceSchema.optional(),
}).strict();
export const conversionSectionSchema = z.object({
  id, name: z.string().trim().min(1).max(100), frameId: id.nullable(),
  columns: z.array(z.object({ id, items: z.array(conversionItemSchema).max(20) }).strict()).min(1).max(4),
  layout: responsive(conversionLayoutSchema),
  gap: spacing, paddingX: spacing, paddingY: spacing, contentGap: spacing,
}).strict();
export const conversionPlanSchema = z.object({
  version: z.literal(1), artboardId: id,
  page: z.object({
    name: z.string().trim().min(1).max(60),
    path: z.string().max(160),
    title: z.string().trim().min(1).max(120), description: z.string().max(320),
    inNavigation: z.boolean(), showHeader: z.boolean(), showFooter: z.boolean(),
  }).strict(),
  sections: z.array(conversionSectionSchema).min(1).max(30),
  contact: z.object({
    sourceLayerIds: z.array(id).max(200), title: text, description: text, button: text,
    appearance: responsiveAppearanceSchema.optional(), buttonAppearance: responsiveAppearanceSchema.optional(), fieldAppearance: responsiveAppearanceSchema.optional(),
  }).strict().nullable(),
}).strict().superRefine((plan, context) => {
  const sectionIds = plan.sections.map(section => section.id);
  const columnIds = plan.sections.flatMap(section => section.columns.map(column => column.id));
  const itemIds = plan.sections.flatMap(section => section.columns.flatMap(column => column.items.map(item => item.layerId)));
  if (new Set(sectionIds).size !== sectionIds.length || new Set(columnIds).size !== columnIds.length) context.addIssue({ code: 'custom', message: 'Sections and columns need unique identifiers.' });
  if (new Set(itemIds).size !== itemIds.length) context.addIssue({ code: 'custom', message: 'Map each source layer once, in its confirmed reading order.' });
  if (itemIds.length > 200) context.addIssue({ code: 'custom', message: 'Convert at most 200 mapped layers in one business-page proof.' });
  if (new Set(plan.contact?.sourceLayerIds ?? []).size !== (plan.contact?.sourceLayerIds.length ?? 0)) context.addIssue({ code: 'custom', message: 'Contact source layers must be unique.' });
});

/** Compact provenance only. Design assets and source snapshots are never copied into records. */
export const conversionRecordSchema = z.object({
  version: z.literal(1), id,
  algorithmVersion: z.literal(CONVERSION_ALGORITHM_VERSION),
  createdAt: z.iso.datetime(), updatedAt: z.iso.datetime(), artboardId: id, pageId: id,
  targetRootIds: z.array(id).min(1).max(60),
  sourceFingerprint: z.string().regex(/^[a-f0-9]{64}$/),
  targetFingerprint: z.string().regex(/^[a-f0-9]{64}$/),
  plan: conversionPlanSchema,
  acknowledgedWarnings: z.array(z.string().min(1).max(200)).max(1000),
}).strict().superRefine((record, context) => {
  if (record.artboardId !== record.plan.artboardId) context.addIssue({ code: 'custom', message: 'Conversion provenance must reference its planned artboard.' });
  if (new Set(record.targetRootIds).size !== record.targetRootIds.length) context.addIssue({ code: 'custom', message: 'Converted root identifiers must be unique.' });
});
export const conversionRecordsSchema = z.array(conversionRecordSchema).max(MAX_CONVERSION_RECORDS);
export type ConversionPlan = z.infer<typeof conversionPlanSchema>;
export type ConversionSection = z.infer<typeof conversionSectionSchema>;
export type ConversionItem = z.infer<typeof conversionItemSchema>;
export type ConversionDestination = z.infer<typeof conversionDestinationSchema>;
export type ConversionRecord = z.infer<typeof conversionRecordSchema>;
