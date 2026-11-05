import type { ComponentProps, NavigationLink } from '../project/schema';
export default function Header({ brand, linkLabel, href, links, activePageId, design = 'classic' }: ComponentProps['Header'] & { href: string; links: NavigationLink[]; activePageId: string }) {
  const navigation = <>{links.map(link => <a key={link.id} href={link.href} aria-current={link.id === activePageId ? 'page' : undefined}>{link.label}</a>)}</>;
  return <header className="site-header site-container" data-design={design}>
    <a className="site-brand" href="/">{brand}</a>
    {links.length > 0 && <nav className="site-desktop-nav" aria-label="Main navigation">{navigation}</nav>}
    {linkLabel && <a className="site-nav-link" href={href}>{linkLabel}<span aria-hidden="true"> ↗</span></a>}
    {links.length > 0 && <details className="site-mobile-nav"><summary>Menu</summary><nav aria-label="Main navigation">{navigation}</nav></details>}
  </header>;
}
