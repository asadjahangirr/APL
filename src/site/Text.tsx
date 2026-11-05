import type { ComponentProps } from '../project/schema';
export default function Text({ title, body, align, design = 'classic' }: ComponentProps['Text']) {
  return <section className="site-section site-container text-section" data-design={design} style={{ textAlign: align }}><h2>{title}</h2><p>{body}</p></section>;
}

