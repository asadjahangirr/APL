import type { ComponentProps } from '../project/schema';
import { appearanceStyle, authoredClass } from './authored-style';
export default function Paragraph({ id, text, align, appearance }: ComponentProps['Paragraph'] & { id: string }) {
  return <p data-layout-node={id} className={authoredClass('apl-paragraph', appearance)} style={{ textAlign: align, ...appearanceStyle(appearance) }}>{text}</p>;
}
