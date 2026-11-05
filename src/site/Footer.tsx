import type { ComponentProps } from '../project/schema';
export default function Footer({ brand, note, design = 'classic' }: ComponentProps['Footer']) {
  return <footer className="site-footer site-container" data-design={design}><strong>{brand}</strong><p>{note}</p><a href="#top">Back to top ↑</a></footer>;
}

