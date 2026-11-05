import type { ComponentProps } from '../project/schema';
import { appearanceStyle, authoredClass } from './authored-style';
export default function Heading({ id, text, level: Tag, size, align, appearance }: ComponentProps['Heading'] & { id: string }) {
  return <Tag data-layout-node={id} className={authoredClass('apl-heading', appearance)} data-size={size} style={{ textAlign: align, ...appearanceStyle(appearance) }}>{text}</Tag>;
}
