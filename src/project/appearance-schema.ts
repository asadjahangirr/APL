import { z } from 'zod';

export type ResponsiveValue<T> = { mobile: T; tablet?: T; desktop?: T };
export const authoredFontFamilySchema = z.enum(['Arial', 'Georgia', 'system-ui', 'monospace']);
export type AuthoredFontFamily = z.infer<typeof authoredFontFamilySchema>;
export const authoredColorSchema = z.string().regex(/^(#[A-Fa-f0-9]{6}|#[A-Fa-f0-9]{8}|transparent)$/);

const responsive = <T extends z.ZodType>(value: T) => z.object({
  mobile: value, tablet: value.optional(), desktop: value.optional(),
}).strict();
const bounded = (minimum: number, maximum: number) => z.number().finite().min(minimum).max(maximum);

/** Each authored field starts on mobile; omitted larger screens inherit it. */
export const responsiveAppearanceSchema = z.object({
  fontFamily: responsive(authoredFontFamilySchema).optional(),
  fontSize: responsive(bounded(4, 1000)).optional(),
  fontWeight: responsive(z.number().int().min(100).max(900).multipleOf(100)).optional(),
  lineHeight: responsive(bounded(0.5, 4)).optional(),
  color: responsive(authoredColorSchema).optional(),
  background: responsive(authoredColorSchema).optional(),
  borderColor: responsive(authoredColorSchema).optional(),
  borderWidth: responsive(bounded(0, 100)).optional(),
  radius: responsive(bounded(0, 6000)).optional(),
  paddingX: responsive(bounded(0, 400)).optional(),
  paddingY: responsive(bounded(0, 400)).optional(),
  gap: responsive(bounded(0, 400)).optional(),
  maxWidth: responsive(bounded(1, 12000)).optional(),
  minHeight: responsive(bounded(0, 12000)).optional(),
  aspectRatio: responsive(bounded(0.05, 20)).optional(),
}).strict();

export type ResponsiveAppearance = z.infer<typeof responsiveAppearanceSchema>;
