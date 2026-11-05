import type { ComponentProps } from '../project/schema';
export default function Hero({ eyebrow, title, description, image, imageAlt, layout, motion = 'none', preview = false }: ComponentProps['Hero'] & { preview?: boolean }) {
  return <section className={'site-hero site-container hero-' + layout + (!image && !preview ? ' hero-no-image' : '')} data-motion={motion}>
    <div className="hero-copy"><p className="site-eyebrow">{eyebrow}</p><h1>{title}</h1><p className="hero-description">{description}</p></div>
    {image ? <img className="hero-image" src={image} alt={imageAlt} width="720" height="900"/> : preview ? <div className="image-placeholder"><span>YOUR PERSPECTIVE, HERE.</span><p>Add a photograph<br/>that tells your story.</p><small>Select this section to upload an image.</small></div> : null}
  </section>;
}
