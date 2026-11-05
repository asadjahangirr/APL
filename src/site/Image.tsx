import type { ComponentProps } from '../project/schema';
import { appearanceStyle, authoredClass } from './authored-style';
export default function Image({ id, image, alt, ratio, radius, appearance }: ComponentProps['Image'] & { id: string }) {
  return <figure data-layout-node={id} className={authoredClass('apl-image', appearance)} data-ratio={ratio} data-radius={radius} style={appearanceStyle(appearance)}>
    {image ? <img src={image} alt={alt} loading="lazy"/> : <div className="apl-image-placeholder"><span>YOUR PHOTOGRAPH</span><p>A place for your perspective.</p><small>Select this image and upload a photograph.</small></div>}
  </figure>;
}
