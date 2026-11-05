import type { CSSProperties } from 'react';
import type { ComponentProps } from '../project/schema';
import { appearanceStyle, authoredClass } from './authored-style';
import IconGlyph from './IconGlyph';

export default function Icon({ id, name, label, decorative, size, appearance, href, destination }: ComponentProps['Icon'] & { id: string; href?: string }) {
  const style = {
    ...appearanceStyle(appearance),
    '--apl-icon-size-mobile': `${size.mobile}px`,
    '--apl-icon-size-tablet': `${size.tablet ?? size.mobile}px`,
    '--apl-icon-size-desktop': `${size.desktop ?? size.tablet ?? size.mobile}px`,
  } as CSSProperties;
  const className = authoredClass('apl-icon', appearance);
  return <div data-layout-node={id} className="apl-icon-wrap">
    {href ? <a className={className} href={href} aria-label={label} target={destination?.kind === 'url' ? '_blank' : undefined} rel={destination?.kind === 'url' ? 'noopener noreferrer' : undefined} style={style}><IconGlyph name={name}/></a>
      : <span className={className} role={decorative ? undefined : 'img'} aria-label={decorative ? undefined : label} style={style}><IconGlyph name={name}/></span>}
  </div>;
}
