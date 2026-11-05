import type { ReactNode } from 'react';
import type { ComponentProps } from '../project/schema';
import { responsiveVars, layoutTracks, type ContentRenderer } from './layout-utils';
import { appearanceStyle, authoredClass } from './authored-style';
export default function Columns({ id, layout, gap, align, appearance, children, renderContent }: ComponentProps['Columns'] & { id: string; children?: ReactNode; renderContent?: ContentRenderer }) {
  const attributes = { className: authoredClass('apl-column-grid', appearance), style: { ...responsiveVars('tracks', layout, value => layoutTracks[value]), ...responsiveVars('layout-gap', gap, value => value + 'px'), alignItems: align, '--column-height': align === 'stretch' ? '100%' : 'auto', ...appearanceStyle(appearance) } };
  return <div data-layout-node={id} className="apl-columns">{renderContent ? renderContent(attributes) : <div {...attributes}>{children}</div>}</div>;
}
