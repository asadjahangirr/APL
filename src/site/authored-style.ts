import type { CSSProperties } from 'react';
import type { ResponsiveAppearance } from '../project/appearance-schema';

type Field = keyof ResponsiveAppearance;
const fields: Record<Field, { variable: string; properties: string[]; pixels?: boolean }> = {
  fontFamily: { variable: 'font-family', properties: ['fontFamily'] },
  fontSize: { variable: 'font-size', properties: ['fontSize'], pixels: true },
  fontWeight: { variable: 'font-weight', properties: ['fontWeight'] },
  lineHeight: { variable: 'line-height', properties: ['lineHeight'] },
  color: { variable: 'color', properties: ['color'] },
  background: { variable: 'background', properties: ['backgroundColor'] },
  borderColor: { variable: 'border-color', properties: ['borderColor'] },
  borderWidth: { variable: 'border-width', properties: ['borderWidth'], pixels: true },
  radius: { variable: 'radius', properties: ['borderRadius'], pixels: true },
  paddingX: { variable: 'padding-x', properties: ['paddingLeft', 'paddingRight'], pixels: true },
  paddingY: { variable: 'padding-y', properties: ['paddingTop', 'paddingBottom'], pixels: true },
  gap: { variable: 'gap', properties: ['gap'], pixels: true },
  maxWidth: { variable: 'max-width', properties: ['maxWidth'], pixels: true },
  minHeight: { variable: 'min-height', properties: ['minHeight'], pixels: true },
  aspectRatio: { variable: 'aspect-ratio', properties: ['aspectRatio'] },
};

/** Only authored fields override recipes; omitted fields keep their existing CSS. */
export function appearanceStyle(appearance?: ResponsiveAppearance, selected?: readonly Field[]): CSSProperties {
  const style: Record<string, string> = {};
  for (const key of selected ?? Object.keys(fields) as Field[]) {
    const value = appearance?.[key];
    if (!value) continue;
    const field = fields[key];
    const tablet = value.tablet ?? value.mobile, desktop = value.desktop ?? tablet;
    const format = (entry: string | number) => String(entry) + (field.pixels ? 'px' : '');
    const variable = '--apl-authored-' + field.variable;
    style[variable + '-mobile'] = format(value.mobile);
    style[variable + '-tablet'] = format(tablet);
    style[variable + '-desktop'] = format(desktop);
    for (const property of field.properties) style[property] = 'var(' + variable + ')';
    if (key === 'borderWidth') style.borderStyle = 'solid';
    // Canvas typography has normal tracking; recipe tracking should not distort
    // text whose font metrics the user authored explicitly.
    if (key === 'fontFamily' || key === 'fontSize') style.letterSpacing = 'normal';
  }
  return style as CSSProperties;
}

export function authoredClass(base: string, appearance?: ResponsiveAppearance): string {
  return base + (appearance && Object.values(appearance).some(value => value !== undefined) ? ' apl-authored' : '');
}
