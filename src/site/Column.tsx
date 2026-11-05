import type { ReactNode } from 'react';
import type { ComponentProps } from '../project/schema';
import { responsiveVars, type ContentRenderer } from './layout-utils';
import { appearanceStyle, authoredClass } from './authored-style';
export default function Column({ id, gap, align, appearance, children, renderContent }: ComponentProps['Column'] & { id: string; children?: ReactNode; renderContent?: ContentRenderer }) {
  const attributes = { className: authoredClass('apl-column-content', appearance), style: { ...responsiveVars('column-gap', gap, value => value + 'px'), justifyContent: align === 'start' ? 'flex-start' : align === 'end' ? 'flex-end' : 'center', ...appearanceStyle(appearance) } };
  return <div data-layout-node={id} className="apl-column">{renderContent ? renderContent(attributes) : <div {...attributes}>{children}</div>}</div>;
}
