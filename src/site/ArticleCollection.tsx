import type { CSSProperties } from 'react';
import type { ComponentProps } from '../project/schema';
import type { PublicArticle } from '../project/article-schema';
import type { CollectionMotion, ArticleDesign } from './collection-designs';

export default function ArticleCollection({ title, description, mobile, tablet, desktop, gap, items, pageTitle = false, design = 'classic', motion = 'none', sectionId = 'article-collection' }: ComponentProps['ArticleCollection'] & {
  items: PublicArticle[];
  pageTitle?: boolean;
  sectionId?: string | null;
  design?: ArticleDesign;
  motion?: CollectionMotion;
}) {
  const Title = pageTitle ? 'h1' : 'h2';
  return <section id={sectionId ?? undefined} className="site-section site-container cms-article-collection" data-design={design} data-motion={motion}>
    <p className="article-eyebrow">FIELD NOTES</p>
    <Title>{title}</Title>
    <p className="section-description">{description}</p>
    {!items.length ? <p>No articles have been published yet.</p> :
      <div className="article-grid cms-article-grid" style={{ '--cols-mobile': mobile, '--cols-tablet': tablet ?? mobile, '--cols-desktop': desktop ?? tablet ?? mobile, '--grid-gap': gap + 'px' } as CSSProperties}>
        {items.map((item, index) => <article className="article-item cms-article-card collection-motion-card" key={item.id} style={{ '--card-order': Math.min(index, 8) } as CSSProperties}>
          {design === 'spotlight' && <h3 className="article-spotlight-title"><a href={'/articles/' + item.slug}>{item.title}</a></h3>}
          {(item.image || design !== 'classic') && <div className="article-card-image">
            {item.image ? <img src={item.image} alt={item.imageAlt} loading="lazy" /> : <div className="collection-image-placeholder" aria-hidden="true"><span className="placeholder-category">FROM THE JOURNAL</span><span className="placeholder-monogram">{String(index + 1).padStart(2, '0')}</span><span className="placeholder-rule" /></div>}
          </div>}
          <div className="article-card-copy">
            <span className="article-index" aria-hidden="true">{String(index + 1).padStart(2, '0')}</span>
            {design !== 'spotlight' && <h3><a href={'/articles/' + item.slug}>{item.title}</a></h3>}
            <p>{item.summary}</p>
            <a className="article-read" href={'/articles/' + item.slug} aria-label={'Read ' + item.title}>Read article <span className="collection-arrow" aria-hidden="true">{'\u2192'}</span></a>
          </div>
        </article>)}
      </div>}
  </section>;
}
