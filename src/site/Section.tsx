import type { ReactNode } from 'react';
import type { ComponentProps } from '../project/schema';
import { responsiveVars, type ContentRenderer } from './layout-utils';
import { appearanceStyle, authoredClass } from './authored-style';
export default function Section({ id, padding, width, tone, anchor, appearance, children, renderContent }: ComponentProps['Section'] & { id: string; children?: ReactNode; renderContent?: ContentRenderer }) {
  const attributes = { className: authoredClass('apl-section-content', appearance), style: appearanceStyle(appearance, ['gap', 'maxWidth']) };
  return <section id={anchor?.slice(1)} data-layout-node={id} className={authoredClass('apl-section', appearance)} data-width={width} data-tone={tone} style={{
    ...responsiveVars('section-pad', padding, value => value + 'px'),
    ...appearanceStyle(appearance, ['fontFamily', 'fontSize', 'fontWeight', 'lineHeight', 'color', 'background', 'borderColor', 'borderWidth', 'radius', 'paddingX', 'paddingY', 'minHeight', 'aspectRatio']),
  }}>
    {renderContent ? renderContent(attributes) : <div {...attributes}>{children}</div>}
  </section>;
}
