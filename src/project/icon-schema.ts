import { z } from 'zod';

export const ICON_NAMES = ['home', 'arrow-left', 'arrow-right', 'arrow-up-right', 'envelope', 'phone', 'globe', 'instagram', 'linkedin', 'github', 'map-pin', 'calendar', 'briefcase', 'check'] as const;
export const iconNameSchema = z.enum(ICON_NAMES);
export type IconName = z.infer<typeof iconNameSchema>;
