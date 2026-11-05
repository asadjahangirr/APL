import type { CSSProperties } from 'react';
import type { CollectionMotion, PortfolioDesign } from './collection-designs';

export type PortfolioCardItem = { id: string; title: string; summary: string; category?: string; externalUrl?: string; href?: string; image?: string; imageAlt?: string };
export type PortfolioCollectionProps = { title: string; description: string; mobile: number; tablet?: number; desktop?: number; gap: number; design?: PortfolioDesign; motion?: CollectionMotion; items: PortfolioCardItem[]; sectionId?: string | null };

function safeHref(value: string | undefined) {
  if (!value) return undefined;
  if (/^\/(?!\/)(?:[a-z0-9]+(?:[-/][a-z0-9]+)*)?(?:#[a-z][a-z0-9-]*)?$/.test(value)) return value;
  try { const url = new URL(value); return ['https:', 'http:'].includes(url.protocol) && !url.username && !url.password ? url.href : undefined; }
  catch { return undefined; }
}
function ProjectImage({ item, index }: { item: PortfolioCardItem; index: number }) {
  return <div className="portfolio-image">{item.image ? <img src={item.image} alt={item.imageAlt ?? ''} loading="lazy" /> : <div className="collection-image-placeholder" aria-hidden="true"><span className="placeholder-category">{item.category || 'SELECTED WORK'}</span><span className="placeholder-monogram">{item.title.trim().slice(0, 1) || String(index + 1).padStart(2, '0')}</span><span className="placeholder-rule" /></div>}</div>;
}
export default function PortfolioCollection({ title, description, mobile, tablet, desktop, gap, items, design = 'gallery', motion = 'none', sectionId = 'portfolio-collection' }: PortfolioCollectionProps) {
  return <section id={sectionId ?? undefined} className="site-section site-container portfolio-collection" data-design={design} data-motion={motion}>
    <div className="collection-heading"><div><p className="service-eyebrow">SELECTED WORK</p><h2>{title}</h2></div>{description && <p className="section-description">{description}</p>}</div>
    {!items.length ? <p className="collection-empty">No projects have been published yet.</p> : <div className="portfolio-grid" style={{ '--cols-mobile': mobile, '--cols-tablet': tablet ?? mobile, '--cols-desktop': desktop ?? tablet ?? mobile, '--grid-gap': gap + 'px' } as CSSProperties}>
      {items.map((item, index) => { const href = safeHref(item.href ?? item.externalUrl), external = Boolean(href && !href.startsWith('/')); return <article className="portfolio-card collection-motion-card" data-portfolio-id={item.id} key={item.id} style={{ '--card-order': Math.min(index, 8) } as CSSProperties}>
        <a className="portfolio-card-link" href={href} target={external ? '_blank' : undefined} rel={external ? 'noopener noreferrer' : undefined} aria-label={href ? external ? `Visit ${item.title} website (opens in a new tab)` : `Read ${item.title} case study` : item.title}>
          <span className="portfolio-number" aria-hidden="true">{String(index + 1).padStart(2, '0')}</span>
          {design === 'editorial' && <div className="portfolio-editorial-heading"><p className="portfolio-category">{item.category || 'PROJECT'}</p><h3>{item.title}</h3></div>}
          <ProjectImage item={item} index={index} />
          <div className="portfolio-copy">{design !== 'editorial' && <><p className="portfolio-category">{item.category || 'PROJECT'}</p><h3>{item.title}</h3></>}{item.summary && <p className="portfolio-summary">{item.summary}</p>}<span className="portfolio-visit">{href ? external ? 'Visit website' : 'View case study' : 'Destination unavailable'} {href && <span className="collection-arrow" aria-hidden="true">{external ? '\u2197' : '\u2192'}</span>}</span></div>
        </a>
      </article>; })}
    </div>}
  </section>;
}
