import type { ComponentProps } from '../project/schema';
import { appearanceStyle, authoredClass } from './authored-style';
import IconGlyph from './IconGlyph';
export default function Button({ id, label, href, variant, shape, motion, destination, appearance, icon, iconPosition = 'start' }: ComponentProps['Button'] & { id: string; href: string }) {
  return <div data-layout-node={id} className="apl-button-wrap">
    <a className={authoredClass('apl-link-button', appearance)} href={href} target={destination?.kind === 'url' ? '_blank' : undefined} rel={destination?.kind === 'url' ? 'noopener noreferrer' : undefined} data-design={variant} data-shape={shape} data-motion={motion} style={appearanceStyle(appearance)}>
      {icon && iconPosition === 'start' && <IconGlyph name={icon} className="apl-button-icon"/>}<span>{label}</span>{icon && iconPosition === 'end' && <IconGlyph name={icon} className="apl-button-icon"/>}{(motion === 'arrow' || variant === 'icon-tab') && <span className="apl-button-arrow" aria-hidden="true">↗</span>}
    </a>
  </div>;
}
