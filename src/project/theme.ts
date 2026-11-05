import { z } from 'zod';
import type { CSSProperties } from 'react';
const color = z.string().regex(/^#[0-9a-fA-F]{6}$/, 'Use a six-digit hex color.');
export const themeSchema = z.object({
  accent: color, font: z.enum(['sans', 'humanist', 'serif']),
  background: color.default('#f9faf7'), surface: color.default('#e9eee7'),
  ink: color.default('#202824'), muted: color.default('#56605a'), line: color.default('#dce1d9'),
}).strict();
export type SiteTheme = z.infer<typeof themeSchema>;
export const themePresets: { id: string; name: string; description: string; theme: SiteTheme }[] = [
  { id: 'studio', name: 'Studio', description: 'Evergreen on soft white', theme: { accent: '#244c40', font: 'sans', background: '#f9faf7', surface: '#e9eee7', ink: '#202824', muted: '#56605a', line: '#dce1d9' } },
  { id: 'editorial', name: 'Editorial', description: 'Warm paper and oxblood', theme: { accent: '#803a3a', font: 'serif', background: '#f7f3ec', surface: '#ebe3d7', ink: '#292421', muted: '#665b52', line: '#d6cbbd' } },
  { id: 'cobalt', name: 'Cobalt', description: 'Clear blue and crisp white', theme: { accent: '#244ac4', font: 'sans', background: '#fafbff', surface: '#e9edf8', ink: '#1d263e', muted: '#515d75', line: '#d6ddeb' } },
  { id: 'clay', name: 'Clay', description: 'Terracotta and natural linen', theme: { accent: '#91452d', font: 'humanist', background: '#faf4ee', surface: '#eedfd3', ink: '#322721', muted: '#6a564a', line: '#dcccbd' } },
  { id: 'ink', name: 'Ink', description: 'Charcoal and warm silver', theme: { accent: '#e7d7b5', font: 'sans', background: '#191b1c', surface: '#272a2c', ink: '#f2f0e9', muted: '#b9bab5', line: '#45494b' } },
  { id: 'nocturne', name: 'Nocturne', description: 'Deep navy and muted blue', theme: { accent: '#b6c7eb', font: 'serif', background: '#171e2c', surface: '#242e40', ink: '#f2f4fa', muted: '#b2bdd0', line: '#414e65' } },
];
function luminance(hex: string) {
  const rgb = [1, 3, 5].map(offset => parseInt(hex.slice(offset, offset + 2), 16) / 255)
    .map(value => value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4);
  return rgb[0] * 0.2126 + rgb[1] * 0.7152 + rgb[2] * 0.0722;
}
export function contrastRatio(first: string, second: string) {
  const a = luminance(first), b = luminance(second);
  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
}
export function themeStyle(theme: Omit<SiteTheme, 'font'> & { font?: string }): CSSProperties {
  const accentOn = contrastRatio(theme.accent, '#ffffff') >= contrastRatio(theme.accent, '#000000') ? '#ffffff' : '#000000';
  return {
    '--accent': theme.accent, '--accent-on': accentOn, '--site-background': theme.background,
    '--surface': theme.surface, '--ink': theme.ink, '--muted': theme.muted, '--line': theme.line,
    '--contrast-background': theme.accent, '--contrast-foreground': accentOn,
  } as CSSProperties;
}
