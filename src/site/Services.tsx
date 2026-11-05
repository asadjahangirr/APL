import type { CSSProperties } from 'react';
import type { ComponentProps } from '../project/schema';
export default function Services({ title, description, items, mobile, tablet, desktop, gap, design = 'classic' }: ComponentProps['Services']) {
  return <section id="services" className="site-section site-container static-services" data-design={design}><h2>{title}</h2><p className="section-description">{description}</p><div className="service-grid" style={{ '--cols-mobile': mobile, '--cols-tablet': tablet ?? mobile, '--cols-desktop': desktop ?? tablet ?? mobile, '--grid-gap': gap + 'px' } as CSSProperties}>{items.map((item, i) => <article className="service-item" key={i}><span className="service-index" aria-hidden="true">{String(i + 1).padStart(2, '0')}</span><h3>{item.title}</h3><p>{item.description}</p></article>)}</div></section>;
}

