import type { CSSProperties, ReactNode } from 'react';
import type { LayoutPreset, Responsive } from '../project/schema';

export const layoutTracks: Record<LayoutPreset, string> = {
  stack: 'minmax(0,1fr)', halves: 'repeat(2,minmax(0,1fr))', thirds: 'repeat(3,minmax(0,1fr))', quarters: 'repeat(4,minmax(0,1fr))',
  'one-two': 'minmax(0,1fr) minmax(0,2fr)', 'two-one': 'minmax(0,2fr) minmax(0,1fr)',
  'one-three': 'minmax(0,1fr) minmax(0,3fr)', 'three-one': 'minmax(0,3fr) minmax(0,1fr)'
};
export const layoutOptions = [
  { value: 'stack', label: 'Stacked / one column' }, { value: 'halves', label: 'Equal halves / 50–50' },
  { value: 'thirds', label: 'Equal thirds' }, { value: 'quarters', label: 'Equal quarters' },
  { value: 'one-two', label: 'One-third / two-thirds' }, { value: 'two-one', label: 'Two-thirds / one-third' },
  { value: 'one-three', label: 'One-quarter / three-quarters' }, { value: 'three-one', label: 'Three-quarters / one-quarter' }
] as const;
// Stable recipe identities compose with shape, theme and motion; they are not code copies.
export const buttonDesigns = [
  { value: 'solid', label: 'Solid', description: 'A confident filled action.' },
  { value: 'outline', label: 'Outline', description: 'An open, bordered action.' },
  { value: 'soft', label: 'Soft', description: 'A quiet tinted surface.' },
  { value: 'text', label: 'Editorial', description: 'A minimal underlined link.' },
  { value: 'offset', label: 'Offset', description: 'A raised edge with a hard offset shadow.' },
  { value: 'double', label: 'Double frame', description: 'An inset outline within a strong outer border.' },
  { value: 'icon-tab', label: 'Arrow tab', description: 'An action and arrow in separate compartments.' },
  { value: 'bracket', label: 'Bracket', description: 'Open corners framing a typographic action.' }
] as const;
export type ContentRenderer = (attributes: { className: string; style?: CSSProperties }) => ReactNode;
export function responsiveVars<T extends number | string>(prefix: string, values: Responsive<T>, format: (value: T) => string = value => String(value)): CSSProperties {
  const tablet = values.tablet ?? values.mobile, desktop = values.desktop ?? tablet;
  return { ['--' + prefix + '-mobile']: format(values.mobile), ['--' + prefix + '-tablet']: format(tablet), ['--' + prefix + '-desktop']: format(desktop) } as CSSProperties;
}
