import type { CSSProperties } from 'react';
import type { ComponentProps } from '../project/schema';
import type { PublicService } from '../project/service-schema';
import type { CollectionMotion, ServiceDesign } from './collection-designs';

export default function ServiceCollection({ title, description, mobile, tablet, desktop, gap, items, pageTitle = false, design = 'classic', motion = 'none', sectionId = 'service-collection' }: ComponentProps['ServiceCollection'] & {
  items: PublicService[];
  pageTitle?: boolean;
  sectionId?: string | null;
  design?: ServiceDesign;
  motion?: CollectionMotion;
}) {
  const Title = pageTitle ? 'h1' : 'h2';
  return <section id={sectionId ?? undefined} className="site-section site-container cms-service-collection" data-design={design} data-motion={motion}>
    <p className="service-eyebrow">WHAT WE DO</p>
    <Title>{title}</Title>
    <p className="section-description">{description}</p>
    {!items.length ? <p>No services have been published yet.</p> :
      <div className="service-grid cms-service-grid" style={{ '--cols-mobile': mobile, '--cols-tablet': tablet ?? mobile, '--cols-desktop': desktop ?? tablet ?? mobile, '--grid-gap': gap + 'px' } as CSSProperties}>
        {items.map((item, index) => <article className="service-item cms-service-card collection-motion-card" key={item.id} style={{ '--card-order': Math.min(index, 8) } as CSSProperties}>
          {design === 'spotlight' && <h3 className="service-spotlight-title"><a href={'/services/' + item.slug}>{item.title}</a></h3>}
          {(item.image || design !== 'classic') && <div className="service-card-image">
            {item.image ? <img src={item.image} alt={item.imageAlt} loading="lazy" /> : <div className="collection-image-placeholder" aria-hidden="true"><span className="placeholder-category">OUR EXPERTISE</span><span className="placeholder-monogram">{String(index + 1).padStart(2, '0')}</span><span className="placeholder-rule" /></div>}
          </div>}
          <div className="service-card-copy">
            <span className="service-index" aria-hidden="true">{String(index + 1).padStart(2, '0')}</span>
            {design !== 'spotlight' && <h3><a href={'/services/' + item.slug}>{item.title}</a></h3>}
            <p>{item.summary}</p>
            <a className="service-read" href={'/services/' + item.slug} aria-label={'Read about ' + item.title}>Explore service <span className="collection-arrow" aria-hidden="true">{'\u2192'}</span></a>
          </div>
        </article>)}
      </div>}
  </section>;
}